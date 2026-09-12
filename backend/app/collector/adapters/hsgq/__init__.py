"""Adapter HSGQ (primary: HSGQ-E04MID).

`build_collectors(olt)` merakit daftar collector sesuai protokol yang diaktifkan
pada OLT, dengan urutan preferensi SSH → SNMP (sesuai strategi di AGENTS.md).
Scheduler mencoba tiap collector berurutan sampai ada yang mengembalikan
snapshot reachable; hasil SNMP yang chassis-only tetap dipakai daripada tidak
ada data sama sekali.
"""

from __future__ import annotations

from app.collector.adapters.hsgq.snmp import HSGQSnmpCollector
from app.collector.adapters.hsgq.ssh import HSGQSshCollector
from app.collector.base import Collector
from app.models import OLT


def build_collectors(olt: OLT) -> list[Collector]:
    """Collector aktif untuk satu OLT, urut preferensi (SSH dulu)."""
    collectors: list[Collector] = []
    if olt.ssh_enabled:
        collectors.append(HSGQSshCollector(olt))
    if olt.snmp_enabled:
        collectors.append(HSGQSnmpCollector(olt))
    return collectors


__all__ = ["HSGQSshCollector", "HSGQSnmpCollector", "build_collectors"]
