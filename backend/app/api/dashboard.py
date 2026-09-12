"""Endpoint dashboard — agregat KPI, optik, trafik, ringkasan per grup site.

Semua endpoint menerima query param `group` opsional. Absennya param =
fleet-wide (semua site). Frontend mengirim sentinel "semua grup" dengan tidak
menyertakan param sama sekali (lihat `scopeQuery` di `frontend/lib/api.ts`).

Agregasi dilakukan di SQL (bukan tarik semua baris lalu hitung di Python) supaya
tetap enteng saat armada membesar.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    ONU,
    OLT,
    PON,
    Alarm,
    AlarmSeverity,
    AlarmStatus,
    DeviceStatus,
    TrafficHistory,
)
from app.schemas import (
    KPIOut,
    OLTGroupSummaryOut,
    OLTSummaryOut,
    OpticalSummaryOut,
    RxDistributionOut,
    TrafficHistoryPointOut,
    WorstONUOut,
)
from app.services.auth import CurrentUser
from app.services.optical import (
    RX_BUCKETS,
    Thresholds,
    classify_rx_power,
    get_thresholds,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DB = Annotated[AsyncSession, Depends(get_db)]
GroupScope = Annotated[str | None, Query(description="Filter site cluster; kosong = seluruh armada")]

# Pisah "belum dikelompokkan" dari filter sungguhan tetap ditangani lewat nilai
# grup eksplisit "Ungrouped" di kolom OLT.group.


def _scope(stmt: Select, group: str | None) -> Select:
    """Terapkan filter grup ke query yang sudah punya OLT di FROM/JOIN-nya."""
    return stmt.where(OLT.group == group) if group else stmt


def _rx_class_case(t: Thresholds):
    """CASE SQL untuk klasifikasi Rx memakai ambang batas aktif."""
    rx = ONU.rx_power
    return case(
        (rx >= t.normal_min, "normal"),
        (rx >= t.warning_min, "warning"),
        (rx >= t.critical_min, "critical"),
        else_="very_critical",
    )


async def _optical_counts(db: AsyncSession, group: str | None) -> dict[str, int]:
    """Hitung ONU per kelas optik (hanya yang Rx-nya terukur)."""
    t = await get_thresholds(db)
    cls = _rx_class_case(t)
    stmt = (
        select(cls.label("cls"), func.count())
        .select_from(ONU)
        .join(PON, ONU.pon_id == PON.id)
        .join(OLT, PON.olt_id == OLT.id)
        .where(ONU.rx_power.isnot(None))
        .group_by(cls)
    )
    counts = {"normal": 0, "warning": 0, "critical": 0, "very_critical": 0}
    for cls_name, n in (await db.execute(_scope(stmt, group))).all():
        counts[cls_name] = n
    return counts


async def build_olt_summaries(
    db: AsyncSession, group: str | None = None
) -> list[OLTSummaryOut]:
    """Rangkum tiap OLT + statistik ONU/PON/alarm-nya (dipakai olt-list & /olts)."""
    olt_stmt = _scope(select(OLT), group).order_by(OLT.name)
    olts = (await db.execute(olt_stmt)).scalars().all()
    if not olts:
        return []
    ids = [o.id for o in olts]

    pon_stmt = (
        select(
            PON.olt_id,
            func.count().label("pon_count"),
            func.coalesce(func.sum(PON.total_onu), 0),
            func.coalesce(func.sum(PON.online_onu), 0),
            func.coalesce(func.sum(PON.offline_onu), 0),
            func.coalesce(func.sum(PON.low_rx_onu), 0),
        )
        .where(PON.olt_id.in_(ids))
        .group_by(PON.olt_id)
    )
    pon_stats = {row[0]: row for row in (await db.execute(pon_stmt)).all()}

    alarm_stmt = (
        select(Alarm.olt_id, func.count())
        .where(Alarm.olt_id.in_(ids), Alarm.status != AlarmStatus.CLOSED)
        .group_by(Alarm.olt_id)
    )
    alarm_stats = {row[0]: row[1] for row in (await db.execute(alarm_stmt)).all()}

    summaries: list[OLTSummaryOut] = []
    for o in olts:
        ps = pon_stats.get(o.id)
        summaries.append(
            OLTSummaryOut(
                id=o.id,
                name=o.name,
                vendor=o.vendor,
                group=o.group,
                ip_address=o.ip_address,
                status=o.status.value,
                total_onu=ps[2] if ps else 0,
                online_onu=ps[3] if ps else 0,
                offline_onu=ps[4] if ps else 0,
                low_rx_onu=ps[5] if ps else 0,
                cpu_usage=o.cpu_usage,
                memory_usage=o.memory_usage,
                temperature=o.temperature,
                uptime=o.uptime,
                last_poll=o.last_poll,
                pon_count=ps[1] if ps else 0,
                active_alarms=alarm_stats.get(o.id, 0),
                traffic_in_mbps=o.traffic_in_mbps,
                traffic_out_mbps=o.traffic_out_mbps,
            )
        )
    return summaries


@router.get("/kpi", response_model=KPIOut)
async def kpi(db: DB, _: CurrentUser, group: GroupScope = None) -> KPIOut:
    # --- OLT status ---
    olt_stmt = _scope(select(OLT.status, func.count()).group_by(OLT.status), group)
    olt_counts = {s: n for s, n in (await db.execute(olt_stmt)).all()}
    total_olt = sum(olt_counts.values())

    # --- ONU status (join ke OLT untuk scoping grup) ---
    onu_stmt = (
        select(ONU.status, func.count())
        .select_from(ONU)
        .join(PON, ONU.pon_id == PON.id)
        .join(OLT, PON.olt_id == OLT.id)
        .group_by(ONU.status)
    )
    onu_counts = {s: n for s, n in (await db.execute(_scope(onu_stmt, group))).all()}
    total_onu = sum(onu_counts.values())

    # --- Alarm aktif & kritis ---
    alarm_stmt = (
        select(Alarm.severity, func.count())
        .select_from(Alarm)
        .join(OLT, Alarm.olt_id == OLT.id)
        .where(Alarm.status != AlarmStatus.CLOSED)
        .group_by(Alarm.severity)
    )
    alarm_counts = {s: n for s, n in (await db.execute(_scope(alarm_stmt, group))).all()}
    active_alarms = sum(alarm_counts.values())
    critical_alarms = alarm_counts.get(AlarmSeverity.CRITICAL, 0)

    # --- Trafik agregat ---
    traffic_stmt = _scope(
        select(
            func.coalesce(func.sum(OLT.traffic_in_mbps), 0.0),
            func.coalesce(func.sum(OLT.traffic_out_mbps), 0.0),
        ),
        group,
    )
    traffic_in, traffic_out = (await db.execute(traffic_stmt)).one()

    # --- Kesehatan optik = persen ONU terukur yang normal ---
    optical = await _optical_counts(db, group)
    measured = sum(optical.values())
    health = round(optical["normal"] / measured * 100, 1) if measured else 100.0

    return KPIOut(
        total_olt=total_olt,
        online_olt=olt_counts.get(DeviceStatus.ONLINE, 0),
        offline_olt=olt_counts.get(DeviceStatus.OFFLINE, 0),
        total_onu=total_onu,
        online_onu=onu_counts.get(DeviceStatus.ONLINE, 0),
        offline_onu=onu_counts.get(DeviceStatus.OFFLINE, 0),
        active_alarms=active_alarms,
        critical_alarms=critical_alarms,
        optical_health_percent=health,
        total_traffic_in_mbps=round(float(traffic_in), 2),
        total_traffic_out_mbps=round(float(traffic_out), 2),
        total_traffic_mbps=round(float(traffic_in) + float(traffic_out), 2),
    )


@router.get("/optical-summary", response_model=OpticalSummaryOut)
async def optical_summary(db: DB, _: CurrentUser, group: GroupScope = None) -> OpticalSummaryOut:
    counts = await _optical_counts(db, group)
    return OpticalSummaryOut(**counts)


@router.get("/rx-distribution", response_model=list[RxDistributionOut])
async def rx_distribution(db: DB, _: CurrentUser, group: GroupScope = None) -> list[RxDistributionOut]:
    t = await get_thresholds(db)
    bucket = case(
        *[
            (and_(ONU.rx_power >= low, ONU.rx_power < high), label)
            for (label, low, high) in RX_BUCKETS
        ],
        else_=None,
    )
    stmt = (
        select(bucket.label("bucket"), func.count())
        .select_from(ONU)
        .join(PON, ONU.pon_id == PON.id)
        .join(OLT, PON.olt_id == OLT.id)
        .where(ONU.rx_power.isnot(None))
        .group_by(bucket)
    )
    raw = {b: n for b, n in (await db.execute(_scope(stmt, group))).all() if b}

    # Kembalikan dalam urutan bucket tetap; kelasifikasi lewat titik tengah bucket.
    out: list[RxDistributionOut] = []
    for label, low, high in RX_BUCKETS:
        mid = (max(low, high - 20.0) + high) / 2
        out.append(
            RxDistributionOut(
                range=label,
                count=raw.get(label, 0),
                classification=classify_rx_power(mid, t),
            )
        )
    return out


@router.get("/worst-onu", response_model=list[WorstONUOut])
async def worst_onu(
    db: DB,
    _: CurrentUser,
    group: GroupScope = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> list[WorstONUOut]:
    stmt = (
        select(ONU, OLT.name, PON.slot, PON.port)
        .select_from(ONU)
        .join(PON, ONU.pon_id == PON.id)
        .join(OLT, PON.olt_id == OLT.id)
        .where(ONU.rx_power.isnot(None))
        .order_by(ONU.rx_power.asc())
        .limit(limit)
    )
    rows = (await db.execute(_scope(stmt, group))).all()
    return [
        WorstONUOut(
            id=onu.id,
            serial_number=onu.serial_number or f"ONU {onu.onu_id}",
            rx_power=onu.rx_power,
            olt_name=olt_name,
            pon_label=f"{slot}/{port}",
            status=onu.status.value,
            traffic_in_mbps=onu.traffic_in_mbps or 0.0,
            traffic_out_mbps=onu.traffic_out_mbps or 0.0,
        )
        for onu, olt_name, slot, port in rows
    ]


@router.get("/olt-list", response_model=list[OLTSummaryOut])
async def olt_list(db: DB, _: CurrentUser, group: GroupScope = None) -> list[OLTSummaryOut]:
    return await build_olt_summaries(db, group)


@router.get("/traffic-history", response_model=list[TrafficHistoryPointOut])
async def traffic_history(db: DB, _: CurrentUser, group: GroupScope = None) -> list[TrafficHistoryPointOut]:
    # Satukan snapshot antar-OLT ke bucket per menit lalu jumlahkan (fleet/grup total).
    bucket = func.date_trunc("minute", TrafficHistory.timestamp)
    stmt = (
        select(
            bucket.label("t"),
            func.coalesce(func.sum(TrafficHistory.traffic_in_mbps), 0.0),
            func.coalesce(func.sum(TrafficHistory.traffic_out_mbps), 0.0),
        )
        .select_from(TrafficHistory)
        .join(OLT, TrafficHistory.olt_id == OLT.id)
        .group_by(bucket)
        .order_by(bucket.desc())
        .limit(60)
    )
    rows = (await db.execute(_scope(stmt, group))).all()
    points: list[TrafficHistoryPointOut] = []
    for ts, tin, tout in reversed(rows):  # kembalikan urut waktu naik
        gin = round(float(tin) / 1000, 3)
        gout = round(float(tout) / 1000, 3)
        points.append(
            TrafficHistoryPointOut(
                time=ts.strftime("%H:%M"),
                traffic_in_gbps=gin,
                traffic_out_gbps=gout,
                total_gbps=round(gin + gout, 3),
            )
        )
    return points


@router.get("/groups", response_model=list[str])
async def groups(db: DB, _: CurrentUser) -> list[str]:
    stmt = select(OLT.group).distinct().order_by(OLT.group)
    return [g for (g,) in (await db.execute(stmt)).all()]


@router.get("/group-summary", response_model=list[OLTGroupSummaryOut])
async def group_summary(db: DB, _: CurrentUser) -> list[OLTGroupSummaryOut]:
    # OLT counts + traffic per grup.
    olt_stmt = (
        select(
            OLT.group,
            func.count(),
            func.coalesce(func.sum(case((OLT.status == DeviceStatus.ONLINE, 1), else_=0)), 0),
            func.coalesce(func.sum(case((OLT.status == DeviceStatus.OFFLINE, 1), else_=0)), 0),
            func.coalesce(func.sum(OLT.traffic_in_mbps), 0.0),
            func.coalesce(func.sum(OLT.traffic_out_mbps), 0.0),
        )
        .group_by(OLT.group)
        .order_by(OLT.group)
    )
    olt_rows = (await db.execute(olt_stmt)).all()

    # ONU counts per grup.
    onu_stmt = (
        select(
            OLT.group,
            func.coalesce(func.sum(PON.total_onu), 0),
            func.coalesce(func.sum(PON.online_onu), 0),
            func.coalesce(func.sum(PON.offline_onu), 0),
            func.coalesce(func.sum(PON.low_rx_onu), 0),
        )
        .select_from(PON)
        .join(OLT, PON.olt_id == OLT.id)
        .group_by(OLT.group)
    )
    onu_stats = {row[0]: row for row in (await db.execute(onu_stmt)).all()}

    # Alarm aktif per grup.
    alarm_stmt = (
        select(OLT.group, func.count())
        .select_from(Alarm)
        .join(OLT, Alarm.olt_id == OLT.id)
        .where(Alarm.status != AlarmStatus.CLOSED)
        .group_by(OLT.group)
    )
    alarm_stats = {g: n for g, n in (await db.execute(alarm_stmt)).all()}

    out: list[OLTGroupSummaryOut] = []
    for grp, total_olt, online_olt, offline_olt, tin, tout in olt_rows:
        onu = onu_stats.get(grp)
        out.append(
            OLTGroupSummaryOut(
                group=grp,
                total_olt=total_olt,
                online_olt=online_olt,
                offline_olt=offline_olt,
                total_onu=onu[1] if onu else 0,
                online_onu=onu[2] if onu else 0,
                offline_onu=onu[3] if onu else 0,
                low_rx_onu=onu[4] if onu else 0,
                active_alarms=alarm_stats.get(grp, 0),
                traffic_in_mbps=round(float(tin), 2),
                traffic_out_mbps=round(float(tout), 2),
            )
        )
    return out
