"""Parser output CLI HSGQ-E04MID → struktur polos (`base.py`).

Setiap fungsi menerima output **satu** perintah (sudah dipisah oleh collector),
sehingga tiap parser tidak perlu menebak batas antar-perintah. Pendekatannya
sengaja toleran: kombinasi regex per-baris + pembacaan tabel lebar-tetap
(fixed-width) berdasar posisi header. Antar-revisi firmware label/urutan kolom
bisa bergeser — kalau ada yang meleset, sesuaikan regex/alias di sini saja.

Semua fungsi murni (tanpa I/O) supaya bisa diuji dari fixture teks tanpa OLT.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.collector.adapters.hsgq.e04mid import (
    ONU_STATE_MAP,
    PON_STATE_MAP,
    map_onu_status,
    map_pon_status,
)
from app.collector.base import ONUData, PONData, UplinkData
from app.models import DeviceStatus, PortStatus

# --------------------------------------------------------------------------
# Regex primitif
# --------------------------------------------------------------------------

# Kunci PON+ONU gabungan, mis. "0/1:5", "0/1/5", "gpon 0/1 5".
_PON_ONU_RE = re.compile(r"(\d{1,3})\s*/\s*(\d{1,3})\s*[:/ ]\s*(\d{1,3})\b")
# Label PON saja, mis. "0/1".
_PON_RE = re.compile(r"\b(\d{1,3})\s*/\s*(\d{1,3})\b")
_FLOAT_RE = re.compile(r"-?\d+\.\d+")
_PCT_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*%")
# Serial ONU: HWTC1234ABCD / 48575443xxxx / ZTEGxxxxxxxx.
_SERIAL_RE = re.compile(r"\b([A-Z]{2,6}[0-9A-Fa-f]{6,12}|[0-9A-Fa-f]{12,16})\b")
# Baris pemisah tabel ("-----", "=====", "+----+").
_SEPARATOR_RE = re.compile(r"^[\s\-=+_|]+$")
# Rate trafik: "12.5 Mbps", "800 kbit/s", "1500000 bps".
_RATE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*([kmg]?)b(?:ps|it/s|its/sec|/s)?", re.IGNORECASE)

# Rentang daya optik yang masuk akal (dBm) untuk menyaring angka non-optik.
_OPTICAL_MIN = -60.0
_OPTICAL_MAX = 20.0


# --------------------------------------------------------------------------
# Helper umum
# --------------------------------------------------------------------------


def _norm(name: str) -> str:
    """Normalisasi nama kolom → alnum lowercase ("OLT-Rx(dBm)" → "oltrxdbm")."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _clean_lines(text: str) -> list[str]:
    """Buang baris kosong, separator, dan prompt/echo perintah."""
    out: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if _SEPARATOR_RE.match(line):
            continue
        out.append(line)
    return out


def _first_float(text: str) -> float | None:
    m = _FLOAT_RE.search(text)
    return float(m.group()) if m else None


def _pon_onu_key(line: str) -> tuple[int, int, int] | None:
    m = _PON_ONU_RE.search(line)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def _pon_key(line: str) -> tuple[int, int] | None:
    """Ambil label PON dari baris yang BUKAN baris ONU (tanpa suffix :onu)."""
    if _PON_ONU_RE.search(line):
        return None
    m = _PON_RE.search(line)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _status_token(line: str, mapping: dict[str, object]) -> str | None:
    """Cari token pada baris yang persis ada di tabel pemetaan status."""
    for tok in re.split(r"[\s,;|]+", line):
        if tok.lower() in mapping:
            return tok
    return None


# --------------------------------------------------------------------------
# Tabel lebar-tetap (fixed-width) berbasis posisi header
# --------------------------------------------------------------------------


class _Table:
    """Pembaca tabel CLI ter-align. Kolom dipisah ≥2 spasi pada baris header;
    sel data diiris memakai posisi awal tiap kolom header."""

    def __init__(self, header_line: str) -> None:
        self.columns: list[tuple[str, int, int | None]] = []
        parts = [p for p in re.split(r"\s{2,}", header_line.strip()) if p]
        spans: list[tuple[str, int]] = []
        pos = 0
        for part in parts:
            idx = header_line.find(part, pos)
            if idx < 0:
                idx = pos
            spans.append((part, idx))
            pos = idx + len(part)
        for i, (name, start) in enumerate(spans):
            end = spans[i + 1][1] if i + 1 < len(spans) else None
            self.columns.append((_norm(name), start, end))

    def cell(self, line: str, predicate) -> str:
        for name, start, end in self.columns:
            if predicate(name):
                return (line[start:end] if end is not None else line[start:]).strip()
        return ""

    def cell_alias(self, line: str, *aliases: str) -> str:
        return self.cell(line, lambda n: any(a in n for a in aliases))


def _find_table(lines: list[str], *required: str) -> tuple[_Table, list[str]] | None:
    """Temukan baris header yang memuat semua kata kunci `required`, kembalikan
    (tabel, baris-data setelah header)."""
    for i, line in enumerate(lines):
        norm = _norm(line)
        if all(req in norm for req in required):
            return _Table(line), lines[i + 1 :]
    return None


# --------------------------------------------------------------------------
# Chassis: CPU / memori / firmware / uptime
# --------------------------------------------------------------------------


def parse_cpu_memory(text: str) -> tuple[float | None, float | None]:
    """Ekstrak persentase CPU & memori. Prioritas nilai ber-'%'."""
    cpu: float | None = None
    mem: float | None = None
    for line in text.splitlines():
        low = line.lower()
        if cpu is None and "cpu" in low:
            cpu = _percent(line)
        if mem is None and ("mem" in low or "ram" in low):
            mem = _percent(line)
    return cpu, mem


def _percent(line: str) -> float | None:
    m = _PCT_RE.search(line)
    if m:
        return _clamp_pct(float(m.group(1)))
    val = _first_float(line)
    if val is not None and 0.0 <= val <= 100.0:
        return _clamp_pct(val)
    return None


def _clamp_pct(v: float) -> float:
    return round(max(0.0, min(v, 100.0)), 2)


def parse_firmware(text: str) -> str | None:
    """Ambil string versi firmware/software dari baris versi."""
    patterns = (
        r"(?:firmware|software)\s*(?:version|ver|rev)?\s*[:=]?\s*(\S+)",
        r"version\s*[:=]?\s*(\S+)",
    )
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            fw = m.group(1).strip().strip(",;")
            if fw and fw.lower() not in {"info", "information"}:
                return fw[:80]
    return None


def parse_uptime_seconds(text: str) -> int | None:
    """Konversi deskripsi uptime → detik. Dukung "3 days 4 hours 5 min",
    "3d 4h 5m 6s", dan "HH:MM:SS"."""
    m = re.search(r"uptime\s*[:=]?\s*(.+)", text, re.IGNORECASE)
    scope = m.group(1) if m else text

    total = 0
    matched = False
    units = (
        (r"(\d+)\s*(?:days?|d)\b", 86400),
        (r"(\d+)\s*(?:hours?|hrs?|h)\b", 3600),
        (r"(\d+)\s*(?:minutes?|mins?|m)\b", 60),
        (r"(\d+)\s*(?:seconds?|secs?|s)\b", 1),
    )
    for pat, mult in units:
        um = re.search(pat, scope, re.IGNORECASE)
        if um:
            total += int(um.group(1)) * mult
            matched = True
    if matched:
        return total

    hms = re.search(r"\b(\d+):(\d{1,2}):(\d{1,2})\b", scope)
    if hms:
        h, mi, s = (int(x) for x in hms.groups())
        return h * 3600 + mi * 60 + s
    return None


# --------------------------------------------------------------------------
# PON state
# --------------------------------------------------------------------------


def parse_pon_state(text: str) -> dict[tuple[int, int], PortStatus]:
    """Peta (slot, port) → PortStatus dari `show pon state`."""
    result: dict[tuple[int, int], PortStatus] = {}
    for line in _clean_lines(text):
        key = _pon_key(line)
        if key is None:
            continue
        token = _status_token(line, PON_STATE_MAP)
        result[key] = map_pon_status(token) if token else map_pon_status(line)
    return result


# --------------------------------------------------------------------------
# ONU info
# --------------------------------------------------------------------------


def parse_onu_info(text: str) -> dict[tuple[int, int], dict[int, ONUData]]:
    """Peta (slot, port) → {onu_id: ONUData} dari `show onu info`.

    Regex per-baris: identifikasi kunci PON+ONU, serial (pola vendor), dan token
    status. Nama diambil dari sisa teks deskriptif bila ada.
    """
    result: dict[tuple[int, int], dict[int, ONUData]] = {}
    for line in _clean_lines(text):
        key = _pon_onu_key(line)
        if key is None:
            continue
        slot, port, onu_id = key

        serial_m = _SERIAL_RE.search(line)
        serial = serial_m.group(1) if serial_m else None

        token = _status_token(line, ONU_STATE_MAP)
        status = map_onu_status(token) if token else DeviceStatus.UNKNOWN

        onu = ONUData(
            onu_id=onu_id,
            serial_number=serial,
            name=_onu_name(line, serial),
            status=status,
        )
        result.setdefault((slot, port), {})[onu_id] = onu
    return result


def _onu_name(line: str, serial: str | None) -> str | None:
    """Nama deskriptif ONU dari teks dalam kutip, kalau ada."""
    m = re.search(r'"([^"]{1,120})"', line) or re.search(r"'([^']{1,120})'", line)
    if m:
        return m.group(1).strip()
    return None


# --------------------------------------------------------------------------
# ONU optical
# --------------------------------------------------------------------------


@dataclass(slots=True)
class OpticalReading:
    rx: float | None = None
    tx: float | None = None
    olt_rx: float | None = None
    olt_tx: float | None = None
    distance: float | None = None


def parse_onu_optical(text: str) -> dict[tuple[int, int, int], OpticalReading]:
    """Peta (slot, port, onu) → OpticalReading dari `show onu optical-info`.

    Utamakan tabel lebar-tetap (peran kolom dari header). Kalau header tak
    terdeteksi, fallback posisional: float dalam rentang dBm diambil berurutan
    sebagai rx, tx, olt_rx.
    """
    lines = _clean_lines(text)
    table = _find_table(lines, "rx")
    result: dict[tuple[int, int, int], OpticalReading] = {}

    if table is not None:
        tbl, data_lines = table
        for line in data_lines:
            key = _pon_onu_key(line)
            if key is None:
                continue
            result[key] = _optical_from_table(tbl, line)
        if result:
            return result

    # Fallback posisional.
    for line in lines:
        key = _pon_onu_key(line)
        if key is None:
            continue
        result[key] = _optical_positional(line)
    return result


def _optical_from_table(tbl: _Table, line: str) -> OpticalReading:
    def has(*subs: str):
        return lambda n: all(s in n for s in subs)

    def has_rx(n: str) -> bool:
        return "rx" in n and "olt" not in n

    def has_tx(n: str) -> bool:
        return "tx" in n and "olt" not in n

    return OpticalReading(
        rx=_first_float(tbl.cell(line, has_rx)),
        tx=_first_float(tbl.cell(line, has_tx)),
        olt_rx=_first_float(tbl.cell(line, has("olt", "rx"))),
        olt_tx=_first_float(tbl.cell(line, has("olt", "tx"))),
        distance=_first_float(tbl.cell_alias(line, "dist", "range", "length")),
    )


def _optical_positional(line: str) -> OpticalReading:
    floats = [
        f for f in map(float, _FLOAT_RE.findall(line)) if _OPTICAL_MIN <= f <= _OPTICAL_MAX
    ]
    reading = OpticalReading()
    if floats:
        reading.rx = floats[0]
    if len(floats) > 1:
        reading.tx = floats[1]
    if len(floats) > 2:
        reading.olt_rx = floats[2]
    return reading


def merge_onu_optical(
    onu_map: dict[tuple[int, int], dict[int, ONUData]],
    optical: dict[tuple[int, int, int], OpticalReading],
) -> None:
    """Gabungkan pembacaan optik ke ONUData. ONU yang hanya muncul di optical
    tetap dibuat agar datanya tidak hilang. Mutasi `onu_map` di tempat."""
    for (slot, port, onu_id), reading in optical.items():
        bucket = onu_map.setdefault((slot, port), {})
        onu = bucket.get(onu_id)
        if onu is None:
            onu = ONUData(onu_id=onu_id, status=DeviceStatus.UNKNOWN)
            bucket[onu_id] = onu
        if reading.rx is not None:
            onu.rx_power = reading.rx
        if reading.tx is not None:
            onu.tx_power = reading.tx
        if reading.olt_rx is not None:
            onu.olt_rx_power = reading.olt_rx
        if reading.olt_tx is not None:
            onu.olt_tx_power = reading.olt_tx
        if reading.distance is not None:
            onu.distance = reading.distance


# --------------------------------------------------------------------------
# Assembly PON + ONU
# --------------------------------------------------------------------------


def assemble_pons(
    pon_states: dict[tuple[int, int], PortStatus],
    onu_map: dict[tuple[int, int], dict[int, ONUData]],
) -> list[PONData]:
    """Rakit list PONData dari status PON + ONU. PON yang cuma punya ONU (tanpa
    baris state eksplisit) statusnya disimpulkan dari keberadaan ONU online."""
    pons: list[PONData] = []
    for slot, port in sorted(set(pon_states) | set(onu_map)):
        onus_dict = onu_map.get((slot, port), {})
        onus = [onus_dict[i] for i in sorted(onus_dict)]

        status = pon_states.get((slot, port))
        if status is None:
            status = (
                PortStatus.ONLINE
                if any(o.status is DeviceStatus.ONLINE for o in onus)
                else PortStatus.OFFLINE
            )

        pon = PONData(slot=slot, port=port, status=status, onus=onus)
        pon.traffic_in_mbps = round(sum(o.traffic_in_mbps or 0.0 for o in onus), 3)
        pon.traffic_out_mbps = round(sum(o.traffic_out_mbps or 0.0 for o in onus), 3)
        pons.append(pon)
    return pons


# --------------------------------------------------------------------------
# Uplink
# --------------------------------------------------------------------------


def parse_uplink(text: str) -> list[UplinkData]:
    """Parse statistik uplink. Best-effort: butuh kolom rate eksplisit.

    Counter oktet mentah tidak bisa jadi Mbps dari satu snapshot (perlu dua
    sampel), jadi jalur SNMP IF-MIB lebih diandalkan untuk trafik uplink. Di
    sini hanya baris dengan rate eksplisit (bps/kbps/Mbps) yang dihitung.
    """
    lines = _clean_lines(text)
    table = _find_table(lines, "interface") or _find_table(lines, "port")
    if table is None:
        return []

    tbl, data_lines = table
    uplinks: list[UplinkData] = []
    for line in data_lines:
        name = tbl.cell_alias(line, "interface", "port", "name")
        if not name:
            continue
        status_cell = tbl.cell_alias(line, "status", "state", "oper", "link")
        uplinks.append(
            UplinkData(
                name=name,
                status=map_pon_status(status_cell or line),
                speed_gbps=_speed_gbps(tbl.cell_alias(line, "speed", "highspeed")),
                traffic_in_mbps=_rate_mbps(tbl.cell_alias(line, "in", "rx", "input"))
                or 0.0,
                traffic_out_mbps=_rate_mbps(tbl.cell_alias(line, "out", "tx", "output"))
                or 0.0,
            )
        )
    return uplinks


def _speed_gbps(cell: str) -> float:
    val = _first_float(cell)
    if val is None:
        m = re.search(r"(\d+)", cell)
        val = float(m.group(1)) if m else None
    if val is None:
        return 1.0
    # Heuristik: >100 dianggap Mbps → konversi ke Gbps.
    return round(val / 1000, 3) if val > 100 else val


def _rate_mbps(cell: str) -> float | None:
    m = _RATE_RE.search(cell)
    if not m:
        return None
    value = float(m.group(1))
    unit = m.group(2).lower()
    if unit == "g":
        return round(value * 1000, 3)
    if unit == "m":
        return round(value, 3)
    if unit == "k":
        return round(value / 1000, 6)
    # Tanpa prefix = bit/detik.
    return round(value / 1_000_000, 6)


__all__ = [
    "OpticalReading",
    "parse_cpu_memory",
    "parse_firmware",
    "parse_uptime_seconds",
    "parse_pon_state",
    "parse_onu_info",
    "parse_onu_optical",
    "merge_onu_optical",
    "assemble_pons",
    "parse_uplink",
]
