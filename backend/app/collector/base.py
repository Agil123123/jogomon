"""Kontrak antara collector dan layer persistensi.

Adapter vendor (SSH/SNMP) hanya bertugas menghasilkan `OLTSnapshot` — struktur
polos tanpa dependensi DB. Dengan begitu adapter bisa diuji dari fixture teks
CLI/OID tanpa Postgres, dan menambah vendor baru tidak menyentuh scheduler.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.models import DeviceStatus, PollingProtocol, PortStatus


class CollectorError(Exception):
    """Kegagalan yang bisa diantisipasi (timeout, auth, output tak terbaca).

    Scheduler menangkap ini per OLT lalu mencoba protokol berikutnya. Exception
    lain dianggap bug dan tetap dicatat, tapi tidak mematikan siklus polling.
    """


@dataclass(slots=True)
class ONUData:
    """Satu ONU pelanggan hasil satu kali poll."""

    onu_id: int
    serial_number: str | None = None
    name: str | None = None
    status: DeviceStatus = DeviceStatus.UNKNOWN
    # Sisi ONU (downstream yang diterima pelanggan).
    rx_power: float | None = None
    tx_power: float | None = None
    # Sisi OLT (upstream yang diterima OLT dari ONU ini).
    olt_rx_power: float | None = None
    olt_tx_power: float | None = None
    distance: float | None = None
    traffic_in_mbps: float | None = None
    traffic_out_mbps: float | None = None


@dataclass(slots=True)
class PONData:
    slot: int
    port: int
    status: PortStatus = PortStatus.OFFLINE
    traffic_in_mbps: float = 0.0
    traffic_out_mbps: float = 0.0
    onus: list[ONUData] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"{self.slot}/{self.port}"


@dataclass(slots=True)
class UplinkData:
    name: str
    type: str = "SFP+"
    status: PortStatus = PortStatus.OFFLINE
    speed_gbps: float = 1.0
    traffic_in_mbps: float = 0.0
    traffic_out_mbps: float = 0.0


@dataclass(slots=True)
class OLTSnapshot:
    """Hasil lengkap satu siklus poll terhadap satu OLT."""

    protocol: PollingProtocol
    reachable: bool = False
    error: str | None = None

    cpu_usage: float | None = None
    memory_usage: float | None = None
    temperature: float | None = None
    uptime: int | None = None
    firmware: str | None = None

    pons: list[PONData] = field(default_factory=list)
    uplinks: list[UplinkData] = field(default_factory=list)

    @property
    def onu_count(self) -> int:
        return sum(len(p.onus) for p in self.pons)

    @property
    def is_partial(self) -> bool:
        """Terhubung tapi tidak membawa data ONU — biasanya perintah CLI ditolak
        atau OID tabel tidak didukung firmware."""
        return self.reachable and self.onu_count == 0

    @property
    def traffic_in_mbps(self) -> float:
        """Trafik chassis: dari uplink kalau tersedia, kalau tidak jumlah PON."""
        if self.uplinks:
            return round(sum(u.traffic_in_mbps for u in self.uplinks), 3)
        return round(sum(p.traffic_in_mbps for p in self.pons), 3)

    @property
    def traffic_out_mbps(self) -> float:
        if self.uplinks:
            return round(sum(u.traffic_out_mbps for u in self.uplinks), 3)
        return round(sum(p.traffic_out_mbps for p in self.pons), 3)


class Collector(Protocol):
    """Antarmuka yang harus dipenuhi setiap adapter vendor."""

    protocol: PollingProtocol

    async def collect(self) -> OLTSnapshot:
        """Poll perangkat. Raise `CollectorError` kalau tidak terjangkau."""
        ...


__all__ = [
    "CollectorError",
    "Collector",
    "ONUData",
    "PONData",
    "UplinkData",
    "OLTSnapshot",
]
