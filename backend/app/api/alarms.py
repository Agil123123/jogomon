"""Endpoint alarm — list + filter, acknowledge, close, resend ke Telegram.

Alarm sudah ter-dedup di level collector (satu insiden = satu baris, lihat
`Alarm.fingerprint` + partial unique index). Router ini murni read + transisi
lifecycle: active -> acknowledged -> closed, plus resend notifikasi Telegram
untuk insiden yang masih aktif.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Sequence

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import Row, Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    ONU,
    OLT,
    PON,
    Alarm,
    AlarmSeverity,
    AlarmStatus,
    AlarmType,
)
from app.schemas import ActionResult, AlarmOut
from app.services.auth import CurrentUser
from app.services.telegram import notify_alarm

router = APIRouter(prefix="/alarms", tags=["alarms"])

DB = Annotated[AsyncSession, Depends(get_db)]
AlarmId = Annotated[uuid.UUID, Path(description="UUID alarm")]


def _base_query() -> Select:
    """Alarm + label device-nya. Outer join karena alarm level OLT tidak punya PON/ONU."""
    return (
        select(Alarm, OLT.name, PON.slot, PON.port, ONU.serial_number, ONU.onu_id)
        .select_from(Alarm)
        .outerjoin(OLT, Alarm.olt_id == OLT.id)
        .outerjoin(PON, Alarm.pon_id == PON.id)
        .outerjoin(ONU, Alarm.onu_id == ONU.id)
    )


def _to_out(row: Row) -> AlarmOut:
    alarm, olt_name, slot, port, serial, onu_index = row
    return AlarmOut(
        id=alarm.id,
        olt_id=alarm.olt_id,
        olt_name=olt_name or "—",
        pon_id=alarm.pon_id,
        pon_label=f"{slot}/{port}" if slot is not None else None,
        onu_id=alarm.onu_id,
        onu_serial=serial or (str(onu_index) if onu_index is not None else None),
        severity=alarm.severity.value,
        status=alarm.status.value,
        type=alarm.type.value,
        message=alarm.message,
        rx_power=alarm.rx_power,
        created_at=alarm.created_at,
        acknowledged_at=alarm.acknowledged_at,
        closed_at=alarm.closed_at,
        sent_to_telegram=alarm.sent_to_telegram,
        occurrence_count=alarm.occurrence_count,
        last_seen_at=alarm.last_seen_at,
    )


async def _fetch_out(db: AsyncSession, alarm_id: uuid.UUID) -> AlarmOut:
    row = (await db.execute(_base_query().where(Alarm.id == alarm_id))).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alarm tidak ditemukan")
    return _to_out(row)


async def _get_alarm_or_404(db: AsyncSession, alarm_id: uuid.UUID) -> Alarm:
    alarm = await db.get(Alarm, alarm_id)
    if alarm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alarm tidak ditemukan")
    return alarm


@router.get("", response_model=list[AlarmOut])
async def list_alarms(
    db: DB,
    _: CurrentUser,
    alarm_status: Annotated[AlarmStatus | None, Query(alias="status")] = None,
    severity: Annotated[AlarmSeverity | None, Query()] = None,
    alarm_type: Annotated[AlarmType | None, Query(alias="type")] = None,
    group: Annotated[str | None, Query()] = None,
    olt_id: Annotated[uuid.UUID | None, Query()] = None,
    active_only: Annotated[bool, Query(description="Sembunyikan alarm closed")] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AlarmOut]:
    stmt = _base_query()
    if alarm_status is not None:
        stmt = stmt.where(Alarm.status == alarm_status)
    elif active_only:
        stmt = stmt.where(Alarm.status != AlarmStatus.CLOSED)
    if severity is not None:
        stmt = stmt.where(Alarm.severity == severity)
    if alarm_type is not None:
        stmt = stmt.where(Alarm.type == alarm_type)
    if group:
        stmt = stmt.where(OLT.group == group)
    if olt_id is not None:
        stmt = stmt.where(Alarm.olt_id == olt_id)

    stmt = stmt.order_by(Alarm.created_at.desc()).limit(limit).offset(offset)
    rows: Sequence[Row] = (await db.execute(stmt)).all()
    return [_to_out(r) for r in rows]


@router.post("/{alarm_id}/acknowledge", response_model=AlarmOut)
async def acknowledge_alarm(alarm_id: AlarmId, db: DB, user: CurrentUser) -> AlarmOut:
    alarm = await _get_alarm_or_404(db, alarm_id)
    if alarm.status is AlarmStatus.CLOSED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Alarm sudah closed, tidak bisa di-acknowledge"
        )
    # Idempotent: ack ulang tidak menimpa jejak siapa yang ack pertama.
    if alarm.status is not AlarmStatus.ACKNOWLEDGED:
        alarm.status = AlarmStatus.ACKNOWLEDGED
        alarm.acknowledged_at = datetime.now(timezone.utc)
        alarm.acknowledged_by = user.username
        await db.commit()
    return await _fetch_out(db, alarm_id)


@router.post("/{alarm_id}/close", response_model=AlarmOut)
async def close_alarm(alarm_id: AlarmId, db: DB, _: CurrentUser) -> AlarmOut:
    alarm = await _get_alarm_or_404(db, alarm_id)
    if alarm.status is not AlarmStatus.CLOSED:
        alarm.status = AlarmStatus.CLOSED
        alarm.closed_at = datetime.now(timezone.utc)
        await db.commit()
    return await _fetch_out(db, alarm_id)


@router.post("/{alarm_id}/notify-telegram", response_model=ActionResult)
async def resend_alarm_to_telegram(alarm_id: AlarmId, db: DB, _: CurrentUser) -> ActionResult:
    """Kirim ulang notifikasi Telegram untuk satu alarm (paksa, abaikan flag terkirim)."""
    alarm = await _get_alarm_or_404(db, alarm_id)

    olt_name = "—"
    if alarm.olt_id is not None:
        olt = await db.get(OLT, alarm.olt_id)
        olt_name = olt.name if olt is not None else "—"

    # Reset supaya `notify_alarm` benar-benar mengirim lagi, bukan skip karena
    # `sent_to_telegram` masih True dari pengiriman otomatis sebelumnya.
    alarm.sent_to_telegram = False
    sent = await notify_alarm(db, alarm, olt_name)
    if not sent:
        return ActionResult(
            success=False,
            message=(
                "Notifikasi tidak terkirim. Periksa konfigurasi Telegram "
                "(enabled, bot_token, chat_id, dan preferensi notifikasi)."
            ),
        )
    return ActionResult(success=True, message="Alarm diteruskan ke Telegram.")
