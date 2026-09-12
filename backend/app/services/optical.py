"""Klasifikasi daya optik + akses threshold (singleton, cached)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Threshold

logger = logging.getLogger(__name__)

OpticalClass = Literal["normal", "warning", "critical", "very_critical", "unknown"]

# Histogram Rx dashboard. Batas atas eksklusif, bawah inklusif (dBm makin negatif
# = makin buruk), label mengikuti teks di frontend.
RX_BUCKETS: tuple[tuple[str, float, float], ...] = (
    ("-10 to -15", -15.0, 0.0),
    ("-15 to -18", -18.0, -15.0),
    ("-18 to -20", -20.0, -18.0),
    ("-20 to -23", -23.0, -20.0),
    ("-23 to -25", -25.0, -23.0),
    ("-25 to -27", -27.0, -25.0),
    ("-27 to -30", -30.0, -27.0),
    ("below -30", -999.0, -30.0),
)


@dataclass(frozen=True, slots=True)
class Thresholds:
    """Snapshot ambang batas — immutable supaya aman dipakai lintas task."""

    normal_min: float = -25.0
    warning_min: float = -27.0
    critical_min: float = -30.0
    very_critical_min: float = -35.0

    @classmethod
    def from_row(cls, row: Threshold) -> Thresholds:
        return cls(
            normal_min=row.normal_min,
            warning_min=row.warning_min,
            critical_min=row.critical_min,
            very_critical_min=row.very_critical_min,
        )


DEFAULT_THRESHOLDS = Thresholds()

# Cache proses. Diinvalidasi saat threshold di-update via API.
_cache: Thresholds | None = None


def invalidate_threshold_cache() -> None:
    global _cache
    _cache = None


async def get_threshold_row(db: AsyncSession) -> Threshold:
    """Ambil baris threshold aktif; bikin dari default kalau belum ada."""
    result = await db.execute(
        select(Threshold).where(Threshold.is_active.is_(True)).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = Threshold()
        db.add(row)
        await db.commit()
        await db.refresh(row)
        logger.info("Baris threshold default dibuat")
    return row


async def get_thresholds(db: AsyncSession) -> Thresholds:
    global _cache
    if _cache is None:
        _cache = Thresholds.from_row(await get_threshold_row(db))
    return _cache


def classify_rx_power(rx: float | None, t: Thresholds = DEFAULT_THRESHOLDS) -> OpticalClass:
    """Klasifikasi Rx (dBm). None → "unknown" (ONU offline / belum terukur)."""
    if rx is None:
        return "unknown"
    if rx >= t.normal_min:
        return "normal"
    if rx >= t.warning_min:
        return "warning"
    if rx >= t.critical_min:
        return "critical"
    return "very_critical"


def is_degraded(rx: float | None, t: Thresholds = DEFAULT_THRESHOLDS) -> bool:
    """True kalau Rx di bawah ambang normal — basis hitungan `low_rx_onu`."""
    return rx is not None and rx < t.normal_min


def bucket_for(rx: float) -> str:
    """Label bucket histogram untuk satu nilai Rx."""
    for label, low, high in RX_BUCKETS:
        if low <= rx < high:
            return label
    # Rx positif (>= 0 dBm) praktis tidak terjadi di GPON; masukkan ke bucket teratas.
    return RX_BUCKETS[0][0]
