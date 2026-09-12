"""Scheduler polling async — loop background yang dijalankan lewat `lifespan`.

Per siklus: ambil semua OLT, poll paralel (batas `POLLING_CONCURRENCY`),
persist snapshot ke DB (upsert idempotent), catat PollingLog, evaluasi alarm,
lalu broadcast event WebSocket. Kegagalan diisolasi per OLT — satu OLT yang
macet tidak boleh menggagalkan siklus atau OLT lain.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.websocket import broadcast_event
from app.collector.adapters.hsgq import build_collectors
from app.collector.base import CollectorError, OLTSnapshot, ONUData, PONData, UplinkData
from app.config import settings
from app.database import async_session
from app.models import (
    ONU,
    OLT,
    PON,
    Alarm,
    DeviceStatus,
    ONUOpticalHistory,
    PollingInterval,
    PollingLog,
    PollingProtocol,
    PollingStatus,
    PortStatus,
    TrafficHistory,
    UplinkPort,
)
from app.schemas import (
    WS_ALARM,
    WS_OLT_STATUS,
)
from app.services.alarms import evaluate_olt_tree
from app.services.optical import Thresholds, get_thresholds, is_degraded
from app.services.telegram import notify_alarm, notify_recovery

logger = logging.getLogger(__name__)

# Jeda antar siklus saat tabel polling interval belum punya nilai.
_DEFAULT_CYCLE_SECONDS = 60

_stop = asyncio.Event()


async def run_polling_loop() -> None:
    """Loop utama. Berjalan sampai `stop_polling()` dipanggil (shutdown)."""
    logger.info(
        "Scheduler polling aktif (concurrency=%d)", settings.polling_concurrency
    )
    while not _stop.is_set():
        started = time.monotonic()
        try:
            await _run_cycle()
        except Exception:  # noqa: BLE001 — siklus tidak boleh mati karena satu bug
            logger.exception("Siklus polling gagal")
        interval = await _cycle_interval()
        delay = max(5.0, interval - (time.monotonic() - started))
        try:
            await asyncio.wait_for(_stop.wait(), timeout=delay)
        except asyncio.TimeoutError:
            pass
    logger.info("Scheduler polling berhenti")


async def stop_polling() -> None:
    _stop.set()


async def _cycle_interval() -> int:
    try:
        async with async_session() as db:
            row = (await db.execute(select(PollingInterval).limit(1))).scalar_one_or_none()
            return int(row.olt_status) if row and row.olt_status else _DEFAULT_CYCLE_SECONDS
    except Exception:  # noqa: BLE001 — DB belum siap, pakai default
        return _DEFAULT_CYCLE_SECONDS


async def _run_cycle() -> None:
    async with async_session() as db:
        olt_ids = [r for (r,) in (await db.execute(select(OLT.id))).all()]
    if not olt_ids:
        return

    semaphore = asyncio.Semaphore(max(1, settings.polling_concurrency))

    async def worker(olt_id: uuid.UUID) -> None:
        async with semaphore:
            try:
                await poll_olt(olt_id)
            except Exception:  # noqa: BLE001 — isolasi error per OLT
                logger.exception("Poll OLT %s gagal tak terduga", olt_id)

    await asyncio.gather(*(worker(i) for i in olt_ids))


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def poll_olt(olt_id: uuid.UUID) -> None:
    """Poll satu OLT: SSH → SNMP, persist, evaluasi alarm, broadcast."""
    async with async_session() as db:
        olt = await db.get(OLT, olt_id)
        if olt is None:
            return
        collectors = build_collectors(olt)
        if not collectors:
            logger.warning("OLT %s (%s) tidak punya protokol aktif", olt.name, olt.ip_address)
            return

        snapshot: OLTSnapshot | None = None
        last_error: str | None = None

        for collector in collectors:
            started = time.monotonic()
            try:
                snap = await collector.collect()
                duration = time.monotonic() - started
            except CollectorError as exc:
                duration = time.monotonic() - started
                last_error = str(exc)
                logger.warning(
                    "Poll %s %s gagal: %s", collector.protocol.value, olt.name, exc
                )
                await _record_poll(
                    db, olt, collector.protocol, PollingStatus.FAILED,
                    duration=duration, error_msg=str(exc),
                )
                continue
            except Exception as exc:  # noqa: BLE001 — bug adapter ≠ crash siklus
                duration = time.monotonic() - started
                last_error = f"{type(exc).__name__}: {exc}"
                logger.exception(
                    "Poll %s %s error tak terduga", collector.protocol.value, olt.name
                )
                await _record_poll(
                    db, olt, collector.protocol, PollingStatus.FAILED,
                    duration=duration, error_msg=last_error,
                )
                continue

            snapshot = snap
            if not snap.reachable:
                status = PollingStatus.FAILED
                last_error = snap.error
            elif snap.is_partial:
                status = PollingStatus.PARTIAL
            else:
                status = PollingStatus.SUCCESS
            await _record_poll(
                db, olt, collector.protocol, status,
                duration=duration, error_msg=snap.error, onu_count=snap.onu_count,
            )
            if snap.reachable:
                break

        if snapshot is None or not snapshot.reachable:
            # Semua protokol gagal → OLT offline + satu alarm SEV-1.
            olt.status = DeviceStatus.OFFLINE
            olt.last_error = last_error or "tidak merespons SSH maupun SNMP"
            olt.last_poll = _now()
            await db.commit()
            await broadcast_event(
                WS_OLT_STATUS,
                {"olt_id": str(olt.id), "status": DeviceStatus.OFFLINE.value, "group": olt.group},
                group=olt.group,
            )
            await _evaluate_and_notify(db, olt)
            return

        # Reachable: persist snapshot penuh + evaluasi alarm di bawahnya.
        await _persist_snapshot(db, olt, snapshot)
        await db.commit()
        await broadcast_event(
            WS_OLT_STATUS,
            {"olt_id": str(olt.id), "status": DeviceStatus.ONLINE.value, "group": olt.group},
            group=olt.group,
        )
        await _evaluate_and_notify(db, olt)


async def _persist_snapshot(db: AsyncSession, olt: OLT, snap: OLTSnapshot) -> None:
    """Upsert idempotent snapshot → OLT/PON/ONU + uplink + history trafik."""
    now = _now()

    # --- Telemetry chassis ---
    olt.status = DeviceStatus.ONLINE
    olt.cpu_usage = snap.cpu_usage
    olt.memory_usage = snap.memory_usage
    olt.temperature = snap.temperature
    olt.uptime = snap.uptime
    olt.firmware = snap.firmware
    olt.traffic_in_mbps = snap.traffic_in_mbps
    olt.traffic_out_mbps = snap.traffic_out_mbps
    olt.last_error = None
    olt.last_poll = now

    # --- Uplink (SFP+/QSFP) ---
    for u in snap.uplinks:
        await _upsert_uplink(db, olt.id, u, now)

    # --- Snapshot trafik per OLT (time-series) ---
    db.add(
        TrafficHistory(
            olt_id=olt.id,
            traffic_in_mbps=snap.traffic_in_mbps,
            traffic_out_mbps=snap.traffic_out_mbps,
        )
    )

    # --- PON → ONU. Snapshot partial (SNMP chassis-only) tidak menyentuh PON. ---
    if not snap.pons:
        return

    thresholds = await get_thresholds(db)
    seen_pon_ids: set[uuid.UUID] = set()
    for p in snap.pons:
        pon_id = await _upsert_pon(db, olt.id, p, thresholds, now)
        seen_pon_ids.add(pon_id)
        for o in p.onus:
            await _upsert_onu(db, pon_id, o, now)

    # PON yang tidak muncul lagi di hasil poll = port mati/hilang.
    await db.execute(
        update(PON)
        .where(PON.olt_id == olt.id, PON.id.notin_(seen_pon_ids))
        .values(
            status=PortStatus.OFFLINE.value,
            total_onu=0,
            online_onu=0,
            offline_onu=0,
            low_rx_onu=0,
        )
    )


async def _upsert_uplink(db: AsyncSession, olt_id: uuid.UUID, u: UplinkData, now: datetime) -> None:
    stmt = pg_insert(UplinkPort).values(
        olt_id=olt_id,
        name=u.name,
        type=u.type,
        status=u.status.value,
        speed_gbps=u.speed_gbps,
        traffic_in_mbps=u.traffic_in_mbps,
        traffic_out_mbps=u.traffic_out_mbps,
    )
    excluded = stmt.excluded
    stmt = stmt.on_conflict_do_update(
        constraint="uq_uplink_olt_name",
        set_={
            "type": excluded.type,
            "status": excluded.status,
            "speed_gbps": excluded.speed_gbps,
            "traffic_in_mbps": excluded.traffic_in_mbps,
            "traffic_out_mbps": excluded.traffic_out_mbps,
        },
    )
    await db.execute(stmt)


async def _upsert_pon(
    db: AsyncSession,
    olt_id: uuid.UUID,
    p: PONData,
    thresholds: Thresholds,
    now: datetime,
) -> uuid.UUID:
    total = len(p.onus)
    online = sum(1 for o in p.onus if o.status is DeviceStatus.ONLINE)
    offline = sum(1 for o in p.onus if o.status is DeviceStatus.OFFLINE)
    low_rx = sum(1 for o in p.onus if is_degraded(o.rx_power, thresholds))

    stmt = pg_insert(PON).values(
        olt_id=olt_id,
        slot=p.slot,
        port=p.port,
        status=p.status.value,
        total_onu=total,
        online_onu=online,
        offline_onu=offline,
        low_rx_onu=low_rx,
        traffic_in_mbps=p.traffic_in_mbps,
        traffic_out_mbps=p.traffic_out_mbps,
        last_poll=now,
    )
    excluded = stmt.excluded
    stmt = stmt.on_conflict_do_update(
        constraint="uq_pon_olt_slot_port",
        set_={
            "status": excluded.status,
            "total_onu": excluded.total_onu,
            "online_onu": excluded.online_onu,
            "offline_onu": excluded.offline_onu,
            "low_rx_onu": excluded.low_rx_onu,
            "traffic_in_mbps": excluded.traffic_in_mbps,
            "traffic_out_mbps": excluded.traffic_out_mbps,
            "last_poll": excluded.last_poll,
        },
    ).returning(PON.id)
    return (await db.execute(stmt)).scalar_one()


async def _upsert_onu(db: AsyncSession, pon_id: uuid.UUID, o: ONUData, now: datetime) -> uuid.UUID:
    online = o.status is DeviceStatus.ONLINE
    stmt = pg_insert(ONU).values(
        pon_id=pon_id,
        onu_id=o.onu_id,
        serial_number=o.serial_number,
        name=o.name,
        status=o.status.value,
        rx_power=o.rx_power,
        tx_power=o.tx_power,
        olt_rx_power=o.olt_rx_power,
        olt_tx_power=o.olt_tx_power,
        distance=o.distance,
        traffic_in_mbps=o.traffic_in_mbps,
        traffic_out_mbps=o.traffic_out_mbps,
        last_seen=now if online else None,
    )
    excluded = stmt.excluded
    set_: dict[str, object] = {
        "status": excluded.status,
        "name": excluded.name,
        "rx_power": excluded.rx_power,
        "tx_power": excluded.tx_power,
        "olt_rx_power": excluded.olt_rx_power,
        "olt_tx_power": excluded.olt_tx_power,
        "distance": excluded.distance,
        "traffic_in_mbps": excluded.traffic_in_mbps,
        "traffic_out_mbps": excluded.traffic_out_mbps,
    }
    # Jangan timpa serial dengan None saat ONU offline, dan jangan geser
    # last_seen ke belakang untuk ONU yang tetap offline.
    if o.serial_number is not None:
        set_["serial_number"] = excluded.serial_number
    if online:
        set_["last_seen"] = excluded.last_seen

    stmt = stmt.on_conflict_do_update(constraint="uq_onu_pon_onuid", set_=set_).returning(ONU.id)
    onu_id = (await db.execute(stmt)).scalar_one()

    # Riwayat optik hanya saat terukur (untuk grafik tren Rx/Tx).
    if o.rx_power is not None or o.tx_power is not None:
        db.add(ONUOpticalHistory(onu_id=onu_id, rx_power=o.rx_power, tx_power=o.tx_power))
    return onu_id


async def _record_poll(
    db: AsyncSession,
    olt: OLT,
    protocol: PollingProtocol,
    status: PollingStatus,
    *,
    duration: float,
    error_msg: str | None = None,
    onu_count: int | None = None,
) -> None:
    db.add(
        PollingLog(
            olt_id=olt.id,
            protocol=protocol,
            status=status,
            error_msg=error_msg,
            duration=round(duration, 3),
            onu_count=onu_count,
        )
    )
    await db.commit()


async def _evaluate_and_notify(db: AsyncSession, olt: OLT) -> None:
    delta = await evaluate_olt_tree(db, olt)
    for alarm in delta.raised:
        await broadcast_event(WS_ALARM, _alarm_payload(alarm), group=olt.group)
        await notify_alarm(db, alarm, olt.name)
    for alarm in delta.updated:
        await broadcast_event(WS_ALARM, _alarm_payload(alarm), group=olt.group)
    for alarm in delta.closed:
        await broadcast_event(
            WS_ALARM,
            {"alarm_id": str(alarm.id), "status": "closed", "message": alarm.message},
            group=olt.group,
        )
        await notify_recovery(db, alarm, olt.name)


def _alarm_payload(alarm: Alarm) -> dict[str, object]:
    return {
        "alarm_id": str(alarm.id),
        "severity": alarm.severity.value,
        "status": alarm.status.value,
        "type": alarm.type.value,
        "message": alarm.message,
        "olt_id": str(alarm.olt_id) if alarm.olt_id else None,
        "pon_id": str(alarm.pon_id) if alarm.pon_id else None,
        "onu_id": str(alarm.onu_id) if alarm.onu_id else None,
        "rx_power": alarm.rx_power,
    }
