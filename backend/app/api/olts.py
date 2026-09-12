"""CRUD OLT + traversal hierarki (PON → ONU → history).

Read endpoint terbuka untuk semua user ter-autentikasi; tulis (provision /
update / hapus) khusus admin. Kredensial dikirim client sebagai plain-text di
body HTTPS, disimpan terenkripsi Fernet (`services.crypto.encrypt`), dan tidak
pernah dikirim balik dalam bentuk apapun.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Alarm,
    AlarmStatus,
    ONU,
    OLT,
    ONUOpticalHistory,
    PON,
    UplinkPort,
)
from app.schemas import (
    ActionResult,
    ONUDetailOut,
    ONUHistoryOut,
    OLTCreate,
    OLTDetailOut,
    OLTSummaryOut,
    OLTUpdate,
    PONDetailOut,
)
from app.services.auth import AdminUser, CurrentUser
from app.services.crypto import encrypt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/olts", tags=["olts"])

DB = Annotated[AsyncSession, Depends(get_db)]


async def _get_olt(db: AsyncSession, olt_id: uuid.UUID) -> OLT:
    olt = await db.get(OLT, olt_id)
    if olt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OLT tidak ditemukan")
    return olt


async def _summary_for(db: AsyncSession, olts: list[OLT]) -> list[OLTSummaryOut]:
    """Lengkapi ringkasan OLT dengan agregat PON/ONU/alarm dalam 2 query total."""
    if not olts:
        return []
    ids = [o.id for o in olts]

    pon_stats: dict[uuid.UUID, tuple] = {}
    for row in (
        await db.execute(
            select(
                PON.olt_id,
                func.count(),
                func.coalesce(func.sum(PON.total_onu), 0),
                func.coalesce(func.sum(PON.online_onu), 0),
                func.coalesce(func.sum(PON.offline_onu), 0),
                func.coalesce(func.sum(PON.low_rx_onu), 0),
            )
            .where(PON.olt_id.in_(ids))
            .group_by(PON.olt_id)
        )
    ).all():
        pon_stats[row[0]] = row

    alarm_stats: dict[uuid.UUID, int] = {
        row[0]: row[1]
        for row in (
            await db.execute(
                select(Alarm.olt_id, func.count())
                .where(
                    Alarm.olt_id.in_(ids),
                    Alarm.status != AlarmStatus.CLOSED,
                )
                .group_by(Alarm.olt_id)
            )
        ).all()
    }

    out: list[OLTSummaryOut] = []
    for o in olts:
        s = pon_stats.get(o.id)
        out.append(
            OLTSummaryOut(
                id=o.id,
                name=o.name,
                vendor=o.vendor,
                group=o.group,
                ip_address=o.ip_address,
                status=o.status.value,
                cpu_usage=o.cpu_usage,
                memory_usage=o.memory_usage,
                temperature=o.temperature,
                uptime=o.uptime,
                last_poll=o.last_poll,
                traffic_in_mbps=o.traffic_in_mbps,
                traffic_out_mbps=o.traffic_out_mbps,
                pon_count=s[1] if s else 0,
                total_onu=s[2] if s else 0,
                online_onu=s[3] if s else 0,
                offline_onu=s[4] if s else 0,
                low_rx_onu=s[5] if s else 0,
                active_alarms=alarm_stats.get(o.id, 0),
            )
        )
    return out


def _pon_out(pon: PON) -> PONDetailOut:
    return PONDetailOut(
        id=pon.id,
        olt_id=pon.olt_id,
        slot=pon.slot,
        port=pon.port,
        status=pon.status.value,
        total_onu=pon.total_onu,
        online_onu=pon.online_onu,
        offline_onu=pon.offline_onu,
        low_rx_onu=pon.low_rx_onu,
        last_poll=pon.last_poll,
        traffic_in_mbps=pon.traffic_in_mbps,
        traffic_out_mbps=pon.traffic_out_mbps,
    )


@router.get("", response_model=list[OLTSummaryOut])
async def list_olts(
    db: DB,
    group: str | None = Query(default=None, description="Filter site cluster"),
    _: CurrentUser = None,
) -> list[OLTSummaryOut]:
    stmt = select(OLT).order_by(OLT.name)
    if group:
        stmt = stmt.where(OLT.group == group)
    olts = list((await db.execute(stmt)).scalars().all())
    return await _summary_for(db, olts)


@router.post("", response_model=OLTSummaryOut, status_code=status.HTTP_201_CREATED)
async def create_olt(payload: OLTCreate, db: DB, _: AdminUser) -> OLTSummaryOut:
    dup = (
        await db.execute(
            select(OLT.id).where(
                (OLT.name == payload.name) | (OLT.ip_address == payload.ip_address)
            )
        )
    ).first()
    if dup is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Nama atau IP OLT sudah terdaftar")

    olt = OLT(
        **payload.model_dump(exclude={"ssh_password", "snmp_community"}),
        ssh_password=encrypt(payload.ssh_password),
        snmp_community=encrypt(payload.snmp_community),
    )
    db.add(olt)
    await db.commit()
    await db.refresh(olt)
    logger.info("OLT provisioned: %s (%s)", olt.name, olt.ip_address)
    return (await _summary_for(db, [olt]))[0]


@router.get("/{olt_id}", response_model=OLTDetailOut)
async def get_olt(olt_id: uuid.UUID, db: DB, _: CurrentUser) -> OLTDetailOut:
    olt = await _get_olt(db, olt_id)
    pons = (
        (
            await db.execute(
                select(PON).where(PON.olt_id == olt_id).order_by(PON.slot, PON.port)
            )
        )
        .scalars()
        .all()
    )
    uplinks = (
        (
            await db.execute(
                select(UplinkPort)
                .where(UplinkPort.olt_id == olt_id)
                .order_by(UplinkPort.name)
            )
        )
        .scalars()
        .all()
    )
    [summary] = await _summary_for(db, [olt])
    return OLTDetailOut(
        **summary.model_dump(),
        ssh_enabled=olt.ssh_enabled,
        snmp_enabled=olt.snmp_enabled,
        ssh_port=olt.ssh_port,
        snmp_port=olt.snmp_port,
        firmware=olt.firmware,
        description=olt.description,
        last_error=olt.last_error,
        uplinks=[
            {
                "id": u.id,
                "name": u.name,
                "type": u.type,
                "status": u.status.value,
                "speed_gbps": u.speed_gbps,
                "traffic_in_mbps": u.traffic_in_mbps,
                "traffic_out_mbps": u.traffic_out_mbps,
                "utilization_percent": u.utilization_percent,
            }
            for u in uplinks
        ],
        traffic_history=[],
        pons=[_pon_out(p) for p in pons],
    )


@router.put("/{olt_id}", response_model=OLTSummaryOut)
async def update_olt(
    olt_id: uuid.UUID, payload: OLTUpdate, db: DB, _: AdminUser
) -> OLTSummaryOut:
    """Merge partial — field yang tidak dikirim tidak diubah."""
    olt = await _get_olt(db, olt_id)
    data = payload.model_dump(exclude_unset=True)
    for field in ("ssh_password", "snmp_community"):
        if field in data:
            value = data.pop(field)
            if value:  # string kosong = jangan ubah, bukan hapus kredensial
                setattr(olt, field, encrypt(value))
    for field, value in data.items():
        setattr(olt, field, value)
    await db.commit()
    await db.refresh(olt)
    return (await _summary_for(db, [olt]))[0]


@router.delete("/{olt_id}", response_model=ActionResult)
async def delete_olt(olt_id: uuid.UUID, db: DB, _: AdminUser) -> ActionResult:
    olt = await _get_olt(db, olt_id)
    name = olt.name
    await db.delete(olt)
    await db.commit()
    logger.info("OLT dihapus: %s", name)
    return ActionResult(message=f"OLT {name} dihapus")


@router.get("/{olt_id}/pons/{pon_id}", response_model=list[ONUDetailOut])
async def list_pon_onus(
    olt_id: uuid.UUID, pon_id: uuid.UUID, db: DB, _: CurrentUser
) -> list[ONUDetailOut]:
    await _get_olt(db, olt_id)
    pon = await db.get(PON, pon_id)
    if pon is None or pon.olt_id != olt_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PON tidak ditemukan")
    onus = (
        (await db.execute(select(ONU).where(ONU.pon_id == pon_id).order_by(ONU.onu_id)))
        .scalars()
        .all()
    )
    return [
        ONUDetailOut(
            id=o.id,
            pon_id=o.pon_id,
            onu_id=str(o.onu_id),
            serial_number=o.serial_number,
            status=o.status.value,
            rx_power=o.rx_power,
            tx_power=o.tx_power,
            olt_rx_power=o.olt_rx_power,
            olt_tx_power=o.olt_tx_power,
            distance=o.distance,
            last_seen=o.last_seen,
            traffic_in_mbps=o.traffic_in_mbps,
            traffic_out_mbps=o.traffic_out_mbps,
        )
        for o in onus
    ]


@router.get(
    "/{olt_id}/pons/{pon_id}/onus/{onu_id}/history",
    response_model=list[ONUHistoryOut],
)
async def onu_history(
    olt_id: uuid.UUID,
    pon_id: uuid.UUID,
    onu_id: uuid.UUID,
    db: DB,
    _: CurrentUser = None,
    limit: int = Query(default=200, ge=1, le=2000),
) -> list[ONUHistoryOut]:
    """Time-series Rx/Tx satu ONU, urut waktu naik (untuk grafik tren)."""
    await _get_olt(db, olt_id)
    pon = await db.get(PON, pon_id)
    if pon is None or pon.olt_id != olt_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PON tidak ditemukan")
    onu = await db.get(ONU, onu_id)
    if onu is None or onu.pon_id != pon_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ONU tidak ditemukan")

    rows = (
        (
            await db.execute(
                select(ONUOpticalHistory)
                .where(ONUOpticalHistory.onu_id == onu_id)
                .order_by(ONUOpticalHistory.timestamp.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        ONUHistoryOut(timestamp=r.timestamp, rx_power=r.rx_power, tx_power=r.tx_power)
        for r in reversed(rows)
    ]

