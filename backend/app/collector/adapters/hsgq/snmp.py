"""Collector SNMP HSGQ (jalur fallback, SNMPv2c).

Dipakai kalau SSH gagal/dimatikan. Hanya mengandalkan OID standar yang sudah
terkonfirmasi (SNMPv2-MIB, HOST-RESOURCES-MIB, IF-MIB): identitas chassis,
CPU, memori, dan inventaris/status interface uplink. OID ONU enterprise di
`e04mid.py` masih `None`, jadi SNMP TIDAK menghasilkan data PON/ONU —
snapshot-nya `is_partial` dan optik pelanggan tetap mengandalkan SSH.

pysnmp 6.x async HLAPI melakukan SATU operasi per `await` (bukan generator
seperti API sinkron), jadi walk tabel dilakukan manual: GETNEXT bertahap sambil
memeriksa prefix OID untuk berhenti di ujung subtree. `UdpTransportTarget`
punya dua gaya konstruksi antar-rilis 6.x (sync constructor vs async `.create`),
jadi keduanya ditangani.
"""

from __future__ import annotations

import asyncio
import logging
import re

try:  # pysnmp 6.x (pinned 6.2.6)
    from pysnmp.hlapi.asyncio import (
        CommunityData,
        ContextData,
        ObjectIdentity,
        ObjectType,
        SnmpEngine,
        UdpTransportTarget,
        getCmd,
        nextCmd,
    )
except ImportError:  # pragma: no cover — jaring pengaman kalau naik ke pysnmp 7.x
    from pysnmp.hlapi.v3arch.asyncio import (  # type: ignore[no-redef]
        CommunityData,
        ContextData,
        ObjectIdentity,
        ObjectType,
        SnmpEngine,
        UdpTransportTarget,
        get_cmd as getCmd,
        next_cmd as nextCmd,
    )

from app.collector.adapters.hsgq import e04mid as k
from app.collector.adapters.hsgq import parser
from app.collector.base import CollectorError, OLTSnapshot, UplinkData
from app.config import settings
from app.models import OLT, PollingProtocol, PortStatus
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

# Batas waktu total satu sesi SNMP (semua GET + walk).
_TOTAL_BUDGET = 45.0
# Jaring pengaman anti-loop kalau agen SNMP tak pernah keluar subtree.
_WALK_MAX_ROWS = 1024

# Interface virtual/manajemen yang bukan uplink. `\b` mencegah "lo" ketangkap
# di dalam "slot"/"flow" dan sejenisnya (bug substring klasik).
_VIRTUAL_RE = re.compile(
    r"\b(lo|loop\w*|null\d*|vlan\d*|mgmt|inband|meth\d*|cpu|tunnel\d*|register|nvgre|stack)\b",
    re.IGNORECASE,
)
# Port akses GPON/EPON — bukan uplink; datanya seharusnya dari SSH.
_ACCESS_RE = re.compile(r"\b(g?pon|epon|onu)\b|pon", re.IGNORECASE)
# Petunjuk nama uplink umum.
_UPLINK_RE = re.compile(
    r"(sfp|xge|10ge|40ge|100ge|hundredge|fortyge|tenge|\bge\b|ethernet|\beth\b|uplink|nni)",
    re.IGNORECASE,
)


def _mp_model(version: str | None) -> int:
    """0 = SNMPv1, 1 = SNMPv2c (default)."""
    return 0 if str(version or "v2c").lower() in {"v1", "1"} else 1


async def _make_target(host: str, port: int, timeout: float, retries: int):
    """Bangun UdpTransportTarget lintas-rilis pysnmp 6.x."""
    try:
        return await UdpTransportTarget.create((host, port), timeout=timeout, retries=retries)
    except AttributeError:  # rilis lama: constructor sinkron
        return UdpTransportTarget((host, port), timeout=timeout, retries=retries)


def _to_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _oid_tuple(oid) -> tuple[int, ...]:
    return tuple(int(x) for x in tuple(oid))


class HSGQSnmpCollector:
    """Poll satu OLT via SNMP. Sekali pakai per siklus."""

    protocol = PollingProtocol.SNMP

    def __init__(self, olt: OLT) -> None:
        self._host = olt.ip_address
        self._port = olt.snmp_port or 161
        self._community = decrypt(olt.snmp_community) or ""
        self._mp_model = _mp_model(olt.snmp_version)
        self._name = olt.name
        self._timeout = float(settings.snmp_timeout)
        self._retries = int(settings.snmp_retries)

    async def collect(self) -> OLTSnapshot:
        if not self._community:
            raise CollectorError(f"{self._name}: SNMP community belum diset")
        try:
            return await asyncio.wait_for(self._collect(), timeout=_TOTAL_BUDGET)
        except asyncio.TimeoutError as exc:
            raise CollectorError(f"{self._name}: SNMP timeout (>{_TOTAL_BUDGET:.0f}s)") from exc
        except CollectorError:
            raise
        except Exception as exc:  # noqa: BLE001 — dinormalkan jadi CollectorError
            raise CollectorError(f"{self._name}: SNMP error tak terduga: {exc}") from exc

    # -- sesi ---------------------------------------------------------------

    async def _collect(self) -> OLTSnapshot:
        engine = SnmpEngine()
        community = CommunityData(self._community, mpModel=self._mp_model)
        target = await _make_target(self._host, self._port, self._timeout, self._retries)
        context = ContextData()
        try:
            snap = OLTSnapshot(protocol=self.protocol, reachable=False)

            descr, uptime_ticks = await self._read_scalars(engine, community, target, context)
            # Sampai sini agen sudah merespons → chassis reachable.
            snap.reachable = True
            snap.firmware = parser.parse_firmware(descr) if descr else None
            snap.uptime = uptime_ticks // 100 if uptime_ticks is not None else None

            snap.cpu_usage = await self._read_cpu(engine, community, target, context)
            snap.memory_usage = await self._read_memory(engine, community, target, context)
            snap.uplinks = await self._read_uplinks(engine, community, target, context)

            logger.info(
                "SNMP poll %s: cpu=%s mem=%s %d uplink (chassis-only, ONU via SSH)",
                self._name,
                snap.cpu_usage,
                snap.memory_usage,
                len(snap.uplinks),
            )
            return snap
        finally:
            _close_engine(engine)

    async def _read_scalars(self, engine, community, target, context):
        error_indication, error_status, _, var_binds = await getCmd(
            engine,
            community,
            target,
            context,
            ObjectType(ObjectIdentity(k.OID_SYS_DESCR)),
            ObjectType(ObjectIdentity(k.OID_SYS_UPTIME)),
        )
        if error_indication:
            # Tidak ada respons = tidak terjangkau; biar scheduler catat & stop.
            raise CollectorError(f"{self._name}: SNMP tak merespons ({error_indication})")
        if error_status:
            raise CollectorError(
                f"{self._name}: SNMP error {error_status.prettyPrint()}"
            )
        descr = str(var_binds[0][1]) if var_binds else ""
        uptime = _to_int(var_binds[1][1]) if len(var_binds) > 1 else None
        return descr, uptime

    async def _read_cpu(self, engine, community, target, context) -> float | None:
        rows = await self._walk(engine, community, target, context, k.OID_CPU_LOAD)
        loads = [v for v in (_to_int(val) for _, val in rows) if v is not None]
        if not loads:
            return None
        return round(sum(loads) / len(loads), 2)

    async def _read_memory(self, engine, community, target, context) -> float | None:
        descr = {
            idx: str(val)
            for idx, val in await self._walk(engine, community, target, context, k.OID_STORAGE_DESCR)
        }
        if not descr:
            return None
        size = {
            idx: _to_int(val)
            for idx, val in await self._walk(engine, community, target, context, k.OID_STORAGE_SIZE)
        }
        used = {
            idx: _to_int(val)
            for idx, val in await self._walk(engine, community, target, context, k.OID_STORAGE_USED)
        }

        want = re.compile(r"real|physical|ram|main\s*mem|system\s*mem|\bmemory\b", re.IGNORECASE)
        skip = re.compile(r"swap|virtual|flash|disk|rom|cache|buffer|/", re.IGNORECASE)
        for idx, name in descr.items():
            if skip.search(name) or not want.search(name):
                continue
            total, occupied = size.get(idx), used.get(idx)
            if total and occupied is not None and total > 0:
                return round(min(occupied / total * 100.0, 100.0), 2)
        return None

    async def _read_uplinks(self, engine, community, target, context) -> list[UplinkData]:
        names = {
            idx: str(val).strip()
            for idx, val in await self._walk(engine, community, target, context, k.OID_IF_DESCR)
        }
        if not names:
            return []
        oper = {
            idx: _to_int(val)
            for idx, val in await self._walk(engine, community, target, context, k.OID_IF_OPER_STATUS)
        }
        speed = {
            idx: _to_int(val)
            for idx, val in await self._walk(engine, community, target, context, k.OID_IF_HIGH_SPEED)
        }

        uplinks: list[UplinkData] = []
        for idx, name in sorted(names.items()):
            if not name or not _is_uplink(name, speed.get(idx)):
                continue
            mbps = speed.get(idx) or 0
            uplinks.append(
                UplinkData(
                    name=name,
                    type=_uplink_type(mbps),
                    status=k.IF_OPER_STATUS_MAP.get(oper.get(idx, 0), PortStatus.OFFLINE),
                    speed_gbps=round(mbps / 1000, 3) if mbps else 1.0,
                    # Rate butuh dua sampel counter; dihitung di layer persist,
                    # bukan dari satu snapshot. Sisakan 0 di sini.
                    traffic_in_mbps=0.0,
                    traffic_out_mbps=0.0,
                )
            )
        return uplinks

    # -- walk primitif (GETNEXT manual) ------------------------------------

    async def _walk(self, engine, community, target, context, base_oid: str):
        """Walk satu subtree → list ((suffix_oid_tuple), value). Berhenti saat
        OID keluar dari prefix `base_oid`, tak ada progres, atau error."""
        base = tuple(int(p) for p in base_oid.split("."))
        results: list[tuple[tuple[int, ...], object]] = []
        var = ObjectType(ObjectIdentity(base_oid))
        prev: tuple[int, ...] | None = None

        for _ in range(_WALK_MAX_ROWS):
            error_indication, error_status, _, var_binds = await nextCmd(
                engine, community, target, context, var
            )
            if error_indication or error_status or not var_binds:
                break

            vb = var_binds[0]
            # Beberapa rilis membungkus baris dalam list; buka satu lapis.
            if isinstance(vb, (list, tuple)) and vb and isinstance(vb[0], (list, tuple)):
                vb = vb[0]
            oid, value = vb
            oid_t = _oid_tuple(oid)

            if oid_t[: len(base)] != base:  # keluar subtree
                break
            if oid_t == prev:  # tak ada progres (endOfMibView / agen aneh)
                break
            prev = oid_t
            results.append((oid_t[len(base):], value))
            var = ObjectType(ObjectIdentity(oid))

        return results


# --------------------------------------------------------------------------
# Helper murni
# --------------------------------------------------------------------------


def _is_uplink(name: str, speed_mbps: int | None) -> bool:
    """Uplink = bukan interface virtual, bukan port akses PON, dan namanya
    mirip uplink ATAU speed ≥ 1 Gbps."""
    if _VIRTUAL_RE.search(name) or _ACCESS_RE.search(name):
        return False
    if _UPLINK_RE.search(name):
        return True
    return bool(speed_mbps and speed_mbps >= 1000)


def _uplink_type(mbps: int) -> str:
    if mbps >= 40000:
        return "QSFP+"
    if mbps >= 10000:
        return "SFP+"
    return "SFP"


def _close_engine(engine: SnmpEngine) -> None:
    """Tutup dispatcher lintas gaya penamaan pysnmp 6.x (snake vs camel)."""
    for closer in (
        getattr(engine, "close_dispatcher", None),
        getattr(getattr(engine, "transport_dispatcher", None), "close_dispatcher", None),
        getattr(getattr(engine, "transportDispatcher", None), "closeDispatcher", None),
    ):
        if callable(closer):
            try:
                closer()
            except Exception:  # noqa: BLE001 — cleanup best-effort
                continue
            return


__all__ = ["HSGQSnmpCollector"]
