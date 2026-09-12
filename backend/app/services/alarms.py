"""Evaluasi alarm berjenjang + dedup per insiden.

Satu insiden = satu baris `alarms`. Poll berulang untuk gangguan yang sama
menaikkan `occurrence_count` dan menggeser `last_seen_at`, bukan menambah baris
(lihat partial unique index `uq_alarm_open_fingerprint`).

Fungsi di sini hanya menyentuh DB dan mengembalikan perubahan; pengiriman
Telegram dan broadcast WebSocket dilakukan pemanggil (scheduler / API) supaya
service ini tetap bisa dites tanpa I/O jaringan.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ONU,
    OLT,
    PON,
    Alarm,
    AlarmSeverity,
    AlarmStatus,
    AlarmType,
    DeviceStatus,
    PortStatus,
)
from app.services.optical import DEFAULT_THRESHOLDS, Thresholds, classify_rx_power

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AlarmDelta:
    """Ringkasan perubahan alarm satu siklus evaluasi."""

    raised: list[Alarm] = field(default_factory=list)  # insiden baru
    updated: list[Alarm] = field(default_factory=list)  # insiden berulang
    closed: list[Alarm] = field(default_factory=list)  # pulih

    def merge(self, other: AlarmDelta) -> None:
        self.raised.extend(other.raised)
        self.updated.extend(other.updated)
        self.closed.extend(other.closed)

    @property
    def is_empty(self) -> bool:
        return not (self.raised or self.updated or self.closed)


# --------------------------------------------------------------------------
# Fingerprint
# --------------------------------------------------------------------------


def make_fingerprint(
    alarm_type: AlarmType,
    *,
    olt_id: uuid.UUID | None = None,
    pon_id: uuid.UUID | None = None,
    onu_id: uuid.UUID | None = None,
) -> str:
    """Identitas insiden = jenis alarm + objek terkecil yang terdampak."""
    if onu_id is not None:
        return f"{alarm_type.value}:onu:{onu_id}"
    if pon_id is not None:
        return f"{alarm_type.value}:pon:{pon_id}"
    return f"{alarm_type.value}:olt:{olt_id}"


# --------------------------------------------------------------------------
# Primitive raise / close
# --------------------------------------------------------------------------


async def raise_alarm(
    db: AsyncSession,
    *,
    alarm_type: AlarmType,
    severity: AlarmSeverity,
    message: str,
    olt_id: uuid.UUID | None = None,
    pon_id: uuid.UUID | None = None,
    onu_id: uuid.UUID | None = None,
    rx_power: float | None = None,
) -> tuple[Alarm, bool]:
    """Upsert alarm. Balikin (alarm, is_new).

    Atomic lewat ON CONFLICT pada partial unique index, jadi dua poll yang
    beririsan tidak bisa menghasilkan baris ganda.
    """
    fp = make_fingerprint(alarm_type, olt_id=olt_id, pon_id=pon_id, onu_id=onu_id)

    stmt = pg_insert(Alarm).values(
        olt_id=olt_id,
        pon_id=pon_id,
        onu_id=onu_id,
        severity=severity.value,
        status=AlarmStatus.ACTIVE.value,
        type=alarm_type.value,
        message=message,
        rx_power=rx_power,
        fingerprint=fp,
        occurrence_count=1,
        last_seen_at=func.now(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Alarm.fingerprint],
        # Harus persis sama dengan predikat index supaya Postgres mau memakainya.
        index_where=text("status <> 'closed'"),
        set_={
            "occurrence_count": Alarm.occurrence_count + 1,
            "last_seen_at": func.now(),
            "message": stmt.excluded.message,
            "rx_power": stmt.excluded.rx_power,
            # Severity boleh naik/turun kalau kondisi optik berubah kelas.
            "severity": stmt.excluded.severity,
        },
    ).returning(Alarm.id, Alarm.occurrence_count)

    row = (await db.execute(stmt)).one()
    await db.commit()

    alarm = (await db.execute(select(Alarm).where(Alarm.id == row.id))).scalar_one()
    is_new = row.occurrence_count == 1
    if is_new:
        logger.info("Alarm baru [%s] %s: %s", severity.value, alarm_type.value, message)
    return alarm, is_new


async def close_alarm_by_fingerprint(db: AsyncSession, fp: str) -> Alarm | None:
    """Tutup insiden terbuka dengan fingerprint tsb. None kalau tidak ada."""
    stmt = (
        update(Alarm)
        .where(Alarm.fingerprint == fp, Alarm.status != AlarmStatus.CLOSED)
        .values(status=AlarmStatus.CLOSED.value, closed_at=datetime.now(timezone.utc))
        .returning(Alarm.id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        await db.rollback()
        return None
    await db.commit()
    alarm = (await db.execute(select(Alarm).where(Alarm.id == row.id))).scalar_one()
    logger.info("Alarm pulih: %s", fp)
    return alarm


async def _close(
    db: AsyncSession,
    alarm_type: AlarmType,
    *,
    olt_id: uuid.UUID | None = None,
    pon_id: uuid.UUID | None = None,
    onu_id: uuid.UUID | None = None,
) -> Alarm | None:
    return await close_alarm_by_fingerprint(
        db, make_fingerprint(alarm_type, olt_id=olt_id, pon_id=pon_id, onu_id=onu_id)
    )


# --------------------------------------------------------------------------
# Evaluator
# --------------------------------------------------------------------------


async def evaluate_olt(db: AsyncSession, olt: OLT) -> AlarmDelta:
    """OLT tidak terjangkau → SEV-1. Balik online → tutup insidennya."""
    delta = AlarmDelta()

    if olt.status is DeviceStatus.ONLINE:
        if closed := await _close(db, AlarmType.OLT_UNREACHABLE, olt_id=olt.id):
            delta.closed.append(closed)
        return delta

    reason = olt.last_error or "tidak merespons SSH maupun SNMP"
    alarm, is_new = await raise_alarm(
        db,
        alarm_type=AlarmType.OLT_UNREACHABLE,
        severity=AlarmSeverity.CRITICAL,
        message=f"OLT {olt.name} ({olt.ip_address}) tidak terjangkau — {reason}",
        olt_id=olt.id,
    )
    (delta.raised if is_new else delta.updated).append(alarm)
    return delta


async def evaluate_pon(db: AsyncSession, olt: OLT, pon: PON) -> tuple[AlarmDelta, bool]:
    """Evaluasi satu PON. Balikin (delta, pon_down).

    `pon_down` dipakai pemanggil untuk menekan alarm LOS per-ONU: kalau
    port-nya yang mati, satu alarm PON lebih berguna buat NOC daripada puluhan
    alarm ONU.
    """
    delta = AlarmDelta()
    # PON tanpa ONU terdaftar = port belum dipakai, bukan gangguan.
    pon_down = pon.status is PortStatus.OFFLINE and pon.total_onu > 0

    if not pon_down:
        if closed := await _close(db, AlarmType.LOS, pon_id=pon.id):
            delta.closed.append(closed)
        return delta, False

    alarm, is_new = await raise_alarm(
        db,
        alarm_type=AlarmType.LOS,
        severity=AlarmSeverity.CRITICAL,
        message=(
            f"PON {pon.label} di {olt.name} down — "
            f"{pon.total_onu} ONU kehilangan sinyal"
        ),
        olt_id=olt.id,
        pon_id=pon.id,
    )
    (delta.raised if is_new else delta.updated).append(alarm)
    return delta, True


async def evaluate_onu(
    db: AsyncSession,
    olt: OLT,
    pon: PON,
    onu: ONU,
    thresholds: Thresholds = DEFAULT_THRESHOLDS,
    *,
    suppress_los: bool = False,
) -> AlarmDelta:
    """LOS saat ONU offline, high-attenuation berjenjang saat Rx memburuk."""
    delta = AlarmDelta()
    label = onu.serial_number or f"ONU {onu.onu_id}"
    where = f"{olt.name} PON {pon.label}"

    if onu.status is not DeviceStatus.ONLINE:
        # Rx terakhir tidak lagi merepresentasikan kondisi; tutup alarm optik.
        if closed := await _close(db, AlarmType.HIGH_ATTENUATION, onu_id=onu.id):
            delta.closed.append(closed)
        if suppress_los:
            return delta
        alarm, is_new = await raise_alarm(
            db,
            alarm_type=AlarmType.LOS,
            severity=AlarmSeverity.CRITICAL,
            message=f"{label} di {where} kehilangan sinyal (LOS)",
            olt_id=olt.id,
            pon_id=pon.id,
            onu_id=onu.id,
        )
        (delta.raised if is_new else delta.updated).append(alarm)
        return delta

    if closed := await _close(db, AlarmType.LOS, onu_id=onu.id):
        delta.closed.append(closed)

    klas = classify_rx_power(onu.rx_power, thresholds)
    if klas in ("normal", "unknown"):
        if closed := await _close(db, AlarmType.HIGH_ATTENUATION, onu_id=onu.id):
            delta.closed.append(closed)
        return delta

    # Redaman: warning = perlu dipantau, critical/very-critical = perlu tindakan.
    severity = (
        AlarmSeverity.WARNING if klas == "warning" else AlarmSeverity.CRITICAL
    )
    alarm, is_new = await raise_alarm(
        db,
        alarm_type=AlarmType.HIGH_ATTENUATION,
        severity=severity,
        message=(
            f"{label} di {where} redaman tinggi — "
            f"Rx {onu.rx_power:.2f} dBm ({klas.replace('_', ' ')})"
        ),
        olt_id=olt.id,
        pon_id=pon.id,
        onu_id=onu.id,
        rx_power=onu.rx_power,
    )
    (delta.raised if is_new else delta.updated).append(alarm)
    return delta


async def evaluate_olt_tree(
    db: AsyncSession,
    olt: OLT,
    thresholds: Thresholds = DEFAULT_THRESHOLDS,
) -> AlarmDelta:
    """Evaluasi satu OLT beserta seluruh PON dan ONU-nya.

    Saat OLT unreachable, evaluasi turunan dilewati: data PON/ONU sudah basi,
    dan satu alarm OLT lebih akurat daripada membanjiri feed dengan LOS palsu.
    """
    delta = await evaluate_olt(db, olt)
    if olt.status is not DeviceStatus.ONLINE:
        return delta

    pons = (
        (await db.execute(select(PON).where(PON.olt_id == olt.id).order_by(PON.slot, PON.port)))
        .scalars()
        .all()
    )
    for pon in pons:
        pon_delta, pon_down = await evaluate_pon(db, olt, pon)
        delta.merge(pon_delta)

        onus = (
            (await db.execute(select(ONU).where(ONU.pon_id == pon.id)))
            .scalars()
            .all()
        )
        for onu in onus:
            delta.merge(
                await evaluate_onu(
                    db, olt, pon, onu, thresholds, suppress_los=pon_down
                )
            )

    return delta
