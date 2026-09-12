"""Konstanta spesifik HSGQ-E04MID: perintah CLI, OID SNMP, pemetaan status.

Semua yang device-specific dikumpulkan di sini supaya `ssh.py`, `snmp.py`, dan
`parser.py` tetap generik. Kalau revisi firmware mengubah label perintah atau
urutan kolom, cukup sunting file ini.

Status verifikasi:
* OID standar (SNMPv2-MIB, IF-MIB, HOST-RESOURCES-MIB) — aman, standar lintas
  vendor. Inilah yang dipakai jalur SNMP.
* OID ONU enterprise (optik/serial per-ONU) — BELUM terkonfirmasi di E04MID,
  jadi sengaja `None`. Konsekuensinya: SNMP tidak menghasilkan data ONU dan
  snapshot-nya `is_partial`; optik pelanggan mengandalkan SSH.
* Perintah CLI — best-effort dari dialek CLI HSGQ/Realtek EPON-GPON. Beberapa
  alias disertakan karena label berbeda antar-firmware; perintah yang tidak
  dikenal hanya menghasilkan pesan error di output dan diabaikan parser.
"""

from __future__ import annotations

import re

from app.models import DeviceStatus, PortStatus

# --------------------------------------------------------------------------
# Identitas & profil perangkat
# --------------------------------------------------------------------------

VENDOR = "HSGQ"
MODEL = "HSGQ-E04MID"
# 4 port GPON (nama "E04"). Dipakai sebagai sanity-check, bukan batas keras:
# parser tetap menerima slot/port apa pun yang dilaporkan perangkat.
PON_PORT_COUNT = 4
# Batas ONU per PON pada GPON (splitter 1:128).
MAX_ONU_PER_PON = 128


# --------------------------------------------------------------------------
# Perintah CLI (jalur SSH)
# --------------------------------------------------------------------------

# Dikirim sekali di awal sesi supaya output tidak terpotong pager. Dialek
# berbeda antar-firmware, jadi dicoba semuanya; yang ditolak tidak berbahaya.
# `ssh.py` tetap punya penanganan `--More--` sebagai jaring pengaman.
CMD_DISABLE_PAGING: tuple[str, ...] = (
    "terminal length 0",
    "screen-length 0 temporary",
    "no page",
)

# --- Perintah pengumpul data ---
CMD_SYSTEM_INFO = "show system-info"
CMD_VERSION = "show version"
CMD_CPU = "show cpu"
CMD_MEMORY = "show memory"
CMD_PON_STATE = "show pon state"
CMD_ONU_INFO = "show onu info"
CMD_ONU_OPTICAL = "show onu optical-info"
CMD_UPLINK = "show interface brief"

# Urutan eksekusi satu siklus poll. Chassis dulu (murah & cepat memastikan sesi
# hidup), baru tabel PON/ONU yang panjang.
COLLECT_COMMANDS: tuple[str, ...] = (
    CMD_SYSTEM_INFO,
    CMD_VERSION,
    CMD_CPU,
    CMD_MEMORY,
    CMD_PON_STATE,
    CMD_ONU_INFO,
    CMD_ONU_OPTICAL,
    CMD_UPLINK,
)


# --------------------------------------------------------------------------
# OID SNMP
# --------------------------------------------------------------------------

# SNMPv2-MIB — skalar.
OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0"
OID_SYS_UPTIME = "1.3.6.1.2.1.1.3.0"
OID_SYS_NAME = "1.3.6.1.2.1.1.5.0"

# HOST-RESOURCES-MIB — CPU & memori (tabel, di-walk).
OID_CPU_LOAD = "1.3.6.1.2.1.25.3.3.1.2"  # hrProcessorLoad (persen per core)
OID_STORAGE_DESCR = "1.3.6.1.2.1.25.2.3.1.3"  # hrStorageDescr
OID_STORAGE_SIZE = "1.3.6.1.2.1.25.2.3.1.5"  # hrStorageSize (unit alokasi)
OID_STORAGE_USED = "1.3.6.1.2.1.25.2.3.1.6"  # hrStorageUsed (unit alokasi)

# IF-MIB — inventaris & status interface.
OID_IF_DESCR = "1.3.6.1.2.1.2.2.1.2"  # ifDescr
OID_IF_ADMIN_STATUS = "1.3.6.1.2.1.2.2.1.7"  # ifAdminStatus
OID_IF_OPER_STATUS = "1.3.6.1.2.1.2.2.1.8"  # ifOperStatus
OID_IF_HIGH_SPEED = "1.3.6.1.2.1.31.1.1.1.15"  # ifHighSpeed (Mbps)
# Counter 64-bit. Butuh dua sampel untuk jadi rate — perhitungan delta ada di
# layer persist/scheduler, bukan di adapter.
OID_IF_HC_IN_OCTETS = "1.3.6.1.2.1.31.1.1.1.6"  # ifHCInOctets
OID_IF_HC_OUT_OCTETS = "1.3.6.1.2.1.31.1.1.1.10"  # ifHCOutOctets

# Enterprise OID ONU — BELUM terkonfirmasi di E04MID. Jangan diisi tebakan:
# walk ke subtree yang salah bikin polling lambat tanpa hasil. Isi setelah
# `snmpwalk` di perangkat nyata memastikan indeks & skala nilainya.
OID_ONU_SERIAL: str | None = None
OID_ONU_STATUS: str | None = None
OID_ONU_RX_POWER: str | None = None
OID_ONU_TX_POWER: str | None = None
OID_ONU_DISTANCE: str | None = None

# ifOperStatus (IF-MIB) → PortStatus.
IF_OPER_STATUS_MAP: dict[int, PortStatus] = {
    1: PortStatus.ONLINE,  # up
    2: PortStatus.OFFLINE,  # down
    3: PortStatus.OFFLINE,  # testing
    4: PortStatus.OFFLINE,  # unknown
    5: PortStatus.STANDBY,  # dormant
    6: PortStatus.OFFLINE,  # notPresent
    7: PortStatus.OFFLINE,  # lowerLayerDown
}


# --------------------------------------------------------------------------
# Pemetaan status CLI
# --------------------------------------------------------------------------

# Token status port PON. Kunci selalu lowercase.
PON_STATE_MAP: dict[str, PortStatus] = {
    "up": PortStatus.ONLINE,
    "online": PortStatus.ONLINE,
    "enable": PortStatus.ONLINE,
    "enabled": PortStatus.ONLINE,
    "active": PortStatus.ONLINE,
    "normal": PortStatus.ONLINE,
    "working": PortStatus.ONLINE,
    "down": PortStatus.OFFLINE,
    "offline": PortStatus.OFFLINE,
    "disable": PortStatus.OFFLINE,
    "disabled": PortStatus.OFFLINE,
    "shutdown": PortStatus.OFFLINE,
    "fault": PortStatus.OFFLINE,
    "los": PortStatus.OFFLINE,
    "linkdown": PortStatus.OFFLINE,
    "notpresent": PortStatus.OFFLINE,
    "absent": PortStatus.OFFLINE,
    "standby": PortStatus.STANDBY,
    "dormant": PortStatus.STANDBY,
    "inactive": PortStatus.STANDBY,
}

# Token status ONU. O5 = operational state GPON; O1–O4 masih proses aktivasi.
ONU_STATE_MAP: dict[str, DeviceStatus] = {
    "online": DeviceStatus.ONLINE,
    "up": DeviceStatus.ONLINE,
    "working": DeviceStatus.ONLINE,
    "active": DeviceStatus.ONLINE,
    "normal": DeviceStatus.ONLINE,
    "o5": DeviceStatus.ONLINE,
    "operation": DeviceStatus.ONLINE,
    "offline": DeviceStatus.OFFLINE,
    "down": DeviceStatus.OFFLINE,
    "los": DeviceStatus.OFFLINE,
    "losi": DeviceStatus.OFFLINE,
    "lofi": DeviceStatus.OFFLINE,
    "dyinggasp": DeviceStatus.OFFLINE,
    "dying-gasp": DeviceStatus.OFFLINE,
    "powerdown": DeviceStatus.OFFLINE,
    "deactive": DeviceStatus.OFFLINE,
    "disable": DeviceStatus.OFFLINE,
    "unknown": DeviceStatus.UNKNOWN,
    "init": DeviceStatus.UNKNOWN,
    "initial": DeviceStatus.UNKNOWN,
    "ranging": DeviceStatus.UNKNOWN,
    "authing": DeviceStatus.UNKNOWN,
    "auth": DeviceStatus.UNKNOWN,
    "standby": DeviceStatus.UNKNOWN,
    "o1": DeviceStatus.UNKNOWN,
    "o2": DeviceStatus.UNKNOWN,
    "o3": DeviceStatus.UNKNOWN,
    "o4": DeviceStatus.UNKNOWN,
}


def _token_priority(mapping: dict[str, object], *groups: object) -> tuple[str, ...]:
    """Susun token berdasar prioritas nilai, token terpanjang lebih dulu.

    Panjang menang supaya "linkdown" tidak keduluan "down", dan urutan grup
    menentukan pemenang saat satu baris memuat token bertentangan (mis. admin
    "up" tapi oper "down").
    """
    ordered: list[str] = []
    for group in groups:
        ordered.extend(
            sorted((t for t, v in mapping.items() if v is group), key=len, reverse=True)
        )
    return tuple(ordered)


# Fail-safe: status negatif diperiksa lebih dulu, lalu standby, baru positif.
# Baris "admin up / oper down" jadi OFFLINE — lebih baik alarm palsu daripada
# gangguan yang tidak terlihat.
_PON_TOKEN_ORDER = _token_priority(
    PON_STATE_MAP, PortStatus.OFFLINE, PortStatus.STANDBY, PortStatus.ONLINE
)
_ONU_TOKEN_ORDER = _token_priority(
    ONU_STATE_MAP, DeviceStatus.OFFLINE, DeviceStatus.UNKNOWN, DeviceStatus.ONLINE
)

# Cache regex per token — dipanggil per baris untuk tiap ONU.
_TOKEN_RE_CACHE: dict[str, re.Pattern[str]] = {}


def _has_token(text: str, token: str) -> bool:
    """Cocokkan token utuh, bukan substring. Mencegah "up" cocok di "uplink"
    atau "backup", dan "los" cocok di "close"/"loss-of-nothing"."""
    pattern = _TOKEN_RE_CACHE.get(token)
    if pattern is None:
        pattern = re.compile(rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])")
        _TOKEN_RE_CACHE[token] = pattern
    return pattern.search(text) is not None


def map_pon_status(text: str | None) -> PortStatus:
    """Status PON dari token tunggal ATAU seluruh baris. Default OFFLINE —
    port yang tidak bisa dipastikan naik diperlakukan sebagai tidak melayani."""
    if not text:
        return PortStatus.OFFLINE
    low = text.strip().lower()
    exact = PON_STATE_MAP.get(low)
    if exact is not None:
        return exact
    for token in _PON_TOKEN_ORDER:
        if _has_token(low, token):
            return PON_STATE_MAP[token]
    return PortStatus.OFFLINE


def map_onu_status(text: str | None) -> DeviceStatus:
    """Status ONU dari token tunggal ATAU seluruh baris. Default UNKNOWN supaya
    ONU yang statusnya tak terbaca tidak memicu alarm LOS palsu."""
    if not text:
        return DeviceStatus.UNKNOWN
    low = text.strip().lower()
    exact = ONU_STATE_MAP.get(low)
    if exact is not None:
        return exact
    for token in _ONU_TOKEN_ORDER:
        if _has_token(low, token):
            return ONU_STATE_MAP[token]
    return DeviceStatus.UNKNOWN


__all__ = [
    "VENDOR",
    "MODEL",
    "PON_PORT_COUNT",
    "MAX_ONU_PER_PON",
    "CMD_DISABLE_PAGING",
    "CMD_SYSTEM_INFO",
    "CMD_VERSION",
    "CMD_CPU",
    "CMD_MEMORY",
    "CMD_PON_STATE",
    "CMD_ONU_INFO",
    "CMD_ONU_OPTICAL",
    "CMD_UPLINK",
    "COLLECT_COMMANDS",
    "OID_SYS_DESCR",
    "OID_SYS_UPTIME",
    "OID_SYS_NAME",
    "OID_CPU_LOAD",
    "OID_STORAGE_DESCR",
    "OID_STORAGE_SIZE",
    "OID_STORAGE_USED",
    "OID_IF_DESCR",
    "OID_IF_ADMIN_STATUS",
    "OID_IF_OPER_STATUS",
    "OID_IF_HIGH_SPEED",
    "OID_IF_HC_IN_OCTETS",
    "OID_IF_HC_OUT_OCTETS",
    "OID_ONU_SERIAL",
    "OID_ONU_STATUS",
    "OID_ONU_RX_POWER",
    "OID_ONU_TX_POWER",
    "OID_ONU_DISTANCE",
    "IF_OPER_STATUS_MAP",
    "PON_STATE_MAP",
    "ONU_STATE_MAP",
    "map_pon_status",
    "map_onu_status",
]
