"""Schema Pydantic — kontrak API.

Sumber kebenaran bentuk response adalah tipe di `frontend/lib/mock-data.ts`.
Perubahan di sini harus dicerminkan di sana (dan sebaliknya), termasuk nama
field snake_case dan nullability-nya.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------

DeviceStatusStr = Literal["online", "offline", "unknown"]
PortStatusStr = Literal["online", "offline", "standby"]
SeverityStr = Literal["critical", "warning", "info"]
AlarmStatusStr = Literal["active", "acknowledged", "closed"]
AlarmTypeStr = Literal["los", "high_attenuation", "olt_unreachable", "laser_out"]
RoleStr = Literal["admin", "viewer"]
OpticalClass = Literal["normal", "warning", "critical", "very_critical"]

Dbm = Annotated[float, Field(ge=-60, le=20)]
"""Daya optik dalam dBm. Batas longgar untuk menolak nilai sensor yang jelas ngawur."""


class ORMModel(BaseModel):
    """Base untuk schema yang dibangun dari objek SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class UserOut(ORMModel):
    id: uuid.UUID
    username: str
    role: RoleStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --------------------------------------------------------------------------
# Dashboard
# --------------------------------------------------------------------------


class KPIOut(BaseModel):
    total_olt: int
    online_olt: int
    offline_olt: int
    total_onu: int
    online_onu: int
    offline_onu: int
    active_alarms: int
    critical_alarms: int
    optical_health_percent: float
    total_traffic_in_mbps: float
    total_traffic_out_mbps: float
    total_traffic_mbps: float


class OpticalSummaryOut(BaseModel):
    normal: int = 0
    warning: int = 0
    critical: int = 0
    very_critical: int = 0


class RxDistributionOut(BaseModel):
    range: str
    count: int
    classification: OpticalClass


class WorstONUOut(BaseModel):
    id: uuid.UUID
    serial_number: str
    rx_power: float
    olt_name: str
    pon_label: str
    status: str
    traffic_in_mbps: float
    traffic_out_mbps: float


class TrafficHistoryPointOut(BaseModel):
    """Titik grafik trafik. Satuan Gbps (chart frontend memakai Gbps)."""

    time: str
    traffic_in_gbps: float
    traffic_out_gbps: float
    total_gbps: float


class OLTGroupSummaryOut(BaseModel):
    group: str
    total_olt: int
    online_olt: int
    offline_olt: int
    total_onu: int
    online_onu: int
    offline_onu: int
    low_rx_onu: int
    active_alarms: int
    traffic_in_mbps: float
    traffic_out_mbps: float


# --------------------------------------------------------------------------
# OLT / PON / ONU
# --------------------------------------------------------------------------


class OLTSummaryOut(ORMModel):
    id: uuid.UUID
    name: str
    vendor: str
    group: str
    ip_address: str
    status: DeviceStatusStr
    total_onu: int = 0
    online_onu: int = 0
    offline_onu: int = 0
    low_rx_onu: int = 0
    cpu_usage: float | None = None
    memory_usage: float | None = None
    temperature: float | None = None
    uptime: int | None = None
    last_poll: datetime | None = None
    pon_count: int = 0
    active_alarms: int = 0
    traffic_in_mbps: float = 0.0
    traffic_out_mbps: float = 0.0


class UplinkPortOut(ORMModel):
    id: uuid.UUID
    name: str
    type: str
    status: PortStatusStr
    speed_gbps: float
    traffic_in_mbps: float
    traffic_out_mbps: float
    utilization_percent: float


class PONDetailOut(ORMModel):
    id: uuid.UUID
    olt_id: uuid.UUID
    slot: int
    port: int
    status: PortStatusStr
    total_onu: int
    online_onu: int
    offline_onu: int
    low_rx_onu: int
    last_poll: datetime | None = None
    traffic_in_mbps: float
    traffic_out_mbps: float


class OLTDetailOut(OLTSummaryOut):
    ssh_enabled: bool
    snmp_enabled: bool
    ssh_port: int
    snmp_port: int
    firmware: str | None = None
    description: str | None = None
    last_error: str | None = None
    uplinks: list[UplinkPortOut] = Field(default_factory=list)
    traffic_history: list[TrafficHistoryPointOut] = Field(default_factory=list)
    pons: list[PONDetailOut] = Field(default_factory=list)


class ONUDetailOut(ORMModel):
    id: uuid.UUID
    pon_id: uuid.UUID
    # String di kontrak frontend walaupun disimpan integer di DB.
    onu_id: str
    serial_number: str | None = None
    status: DeviceStatusStr
    rx_power: float | None = None
    tx_power: float | None = None
    olt_rx_power: float | None = None
    olt_tx_power: float | None = None
    distance: float | None = None
    last_seen: datetime | None = None
    traffic_in_mbps: float | None = None
    traffic_out_mbps: float | None = None

    @field_validator("onu_id", mode="before")
    @classmethod
    def _stringify(cls, v: Any) -> Any:
        return str(v) if isinstance(v, int) else v


class ONUHistoryOut(ORMModel):
    timestamp: datetime
    rx_power: float | None = None
    tx_power: float | None = None


class OLTCreate(BaseModel):
    """Provision OLT baru. Kredensial dienkripsi sebelum disimpan."""

    name: str = Field(min_length=1, max_length=100)
    vendor: str = Field(default="HSGQ-E04MID", max_length=50)
    group: str = Field(default="Ungrouped", max_length=80)
    ip_address: str = Field(min_length=7, max_length=45)
    description: str | None = None

    ssh_enabled: bool = True
    ssh_username: str | None = Field(default=None, max_length=64)
    ssh_password: str | None = None
    ssh_port: int = Field(default=22, ge=1, le=65535)

    snmp_enabled: bool = True
    snmp_version: str = Field(default="v2c", max_length=10)
    snmp_community: str | None = None
    snmp_port: int = Field(default=161, ge=1, le=65535)

    @field_validator("group", mode="before")
    @classmethod
    def _default_group(cls, v: Any) -> Any:
        """Grup kosong dari form disimpan sebagai "Ungrouped", bukan string kosong."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "Ungrouped"
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _need_one_protocol(self) -> OLTCreate:
        if not self.ssh_enabled and not self.snmp_enabled:
            raise ValueError("Minimal satu protokol (SSH atau SNMP) harus aktif")
        if self.ssh_enabled and not self.ssh_username:
            raise ValueError("ssh_username wajib kalau SSH diaktifkan")
        if self.snmp_enabled and not self.snmp_community:
            raise ValueError("snmp_community wajib kalau SNMP diaktifkan")
        return self


class OLTUpdate(BaseModel):
    """Partial update — field yang tidak dikirim tidak diubah (merge, bukan replace)."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    vendor: str | None = Field(default=None, max_length=50)
    group: str | None = Field(default=None, max_length=80)
    ip_address: str | None = Field(default=None, max_length=45)
    description: str | None = None
    ssh_enabled: bool | None = None
    ssh_username: str | None = Field(default=None, max_length=64)
    ssh_password: str | None = None
    ssh_port: int | None = Field(default=None, ge=1, le=65535)
    snmp_enabled: bool | None = None
    snmp_version: str | None = Field(default=None, max_length=10)
    snmp_community: str | None = None
    snmp_port: int | None = Field(default=None, ge=1, le=65535)


# --------------------------------------------------------------------------
# Alarm
# --------------------------------------------------------------------------


class AlarmOut(BaseModel):
    id: uuid.UUID
    olt_id: uuid.UUID | None = None
    olt_name: str = "—"
    pon_id: uuid.UUID | None = None
    pon_label: str | None = None
    onu_id: uuid.UUID | None = None
    onu_serial: str | None = None
    severity: SeverityStr
    status: AlarmStatusStr
    type: AlarmTypeStr
    message: str
    rx_power: float | None = None
    created_at: datetime
    acknowledged_at: datetime | None = None
    closed_at: datetime | None = None
    sent_to_telegram: bool = False
    occurrence_count: int = 1
    last_seen_at: datetime | None = None


class ActionResult(BaseModel):
    """Response generik untuk aksi yang tidak mengembalikan resource."""

    success: bool = True
    message: str


# --------------------------------------------------------------------------
# Settings
# --------------------------------------------------------------------------


class ThresholdOut(ORMModel):
    id: uuid.UUID
    normal_min: float
    warning_min: float
    critical_min: float
    very_critical_min: float
    is_active: bool


class ThresholdUpdate(BaseModel):
    normal_min: Dbm | None = None
    warning_min: Dbm | None = None
    critical_min: Dbm | None = None
    very_critical_min: Dbm | None = None
    is_active: bool | None = None


class PollingIntervalOut(ORMModel):
    id: uuid.UUID
    olt_status: int
    pon_status: int
    onu_status: int
    optical_power: int
    cpu_memory: int


class PollingIntervalUpdate(BaseModel):
    # Batas bawah 10 detik: di bawah itu polling SSH/SNMP saling tumpang-tindih.
    olt_status: int | None = Field(default=None, ge=10, le=86400)
    pon_status: int | None = Field(default=None, ge=10, le=86400)
    onu_status: int | None = Field(default=None, ge=10, le=86400)
    optical_power: int | None = Field(default=None, ge=10, le=86400)
    cpu_memory: int | None = Field(default=None, ge=10, le=86400)


class TelegramConfigOut(ORMModel):
    id: uuid.UUID
    enabled: bool
    # Token dikirim ter-mask (•••1234); frontend cuma butuh indikasi "sudah diisi".
    bot_token: str | None = None
    chat_id: str | None = None
    thread_id: str | None = None
    notify_on_critical: bool
    notify_on_warning: bool
    notify_on_recovery: bool
    notify_on_olt_offline: bool
    last_test_status: str | None = None
    last_test_at: datetime | None = None


class TelegramConfigUpdate(BaseModel):
    enabled: bool | None = None
    bot_token: str | None = None
    chat_id: str | None = Field(default=None, max_length=64)
    thread_id: str | None = Field(default=None, max_length=64)
    notify_on_critical: bool | None = None
    notify_on_warning: bool | None = None
    notify_on_recovery: bool | None = None
    notify_on_olt_offline: bool | None = None

    @field_validator("bot_token", mode="before")
    @classmethod
    def _ignore_masked(cls, v: Any) -> Any:
        """Form yang di-submit ulang tanpa mengubah token mengirim balik nilai
        ter-mask. Perlakukan sebagai "jangan ubah"."""
        if isinstance(v, str) and "•" in v:
            return None
        return v


# --------------------------------------------------------------------------
# WebSocket events
# --------------------------------------------------------------------------

WS_OLT_STATUS = "olt-status"
WS_ONU_STATUS = "onu-status"
WS_OPTICAL = "optical"
WS_ALARM = "alarm"
WS_KPI = "kpi"
WS_POLL_CYCLE = "poll-cycle"


class WSEvent(BaseModel):
    """Envelope broadcast. `group` diisi supaya klien bisa memfilter per site."""

    event: str
    group: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    ts: datetime = Field(default_factory=lambda: datetime.now().astimezone())


__all__ = [
    "LoginRequest",
    "UserOut",
    "TokenResponse",
    "KPIOut",
    "OpticalSummaryOut",
    "RxDistributionOut",
    "WorstONUOut",
    "TrafficHistoryPointOut",
    "OLTGroupSummaryOut",
    "OLTSummaryOut",
    "OLTDetailOut",
    "OLTCreate",
    "OLTUpdate",
    "UplinkPortOut",
    "PONDetailOut",
    "ONUDetailOut",
    "ONUHistoryOut",
    "AlarmOut",
    "ActionResult",
    "ThresholdOut",
    "ThresholdUpdate",
    "PollingIntervalOut",
    "PollingIntervalUpdate",
    "TelegramConfigOut",
    "TelegramConfigUpdate",
    "WSEvent",
    "WS_OLT_STATUS",
    "WS_ONU_STATUS",
    "WS_OPTICAL",
    "WS_ALARM",
    "WS_KPI",
    "WS_POLL_CYCLE",
]
