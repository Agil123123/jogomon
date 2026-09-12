"""Model SQLAlchemy 2.0 — hierarki OLT → PON → ONU plus tabel pendukung.

Konvensi:
- PK UUID (server-side `gen_random_uuid()`, butuh ekstensi pgcrypto/pg13+).
- Semua timestamp timezone-aware.
- Enum disimpan sebagai VARCHAR + CHECK (`native_enum=False`) supaya nambah
  nilai baru tidak perlu ALTER TYPE.
- Unique constraint dipakai sebagai kunci idempotent upsert oleh collector.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# --------------------------------------------------------------------------
# Enums
# --------------------------------------------------------------------------


class DeviceStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class PortStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    STANDBY = "standby"


class AlarmSeverity(str, enum.Enum):
    CRITICAL = "critical"  # SEV-1
    WARNING = "warning"  # SEV-2
    INFO = "info"  # SEV-3


class AlarmStatus(str, enum.Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


class AlarmType(str, enum.Enum):
    LOS = "los"
    HIGH_ATTENUATION = "high_attenuation"
    OLT_UNREACHABLE = "olt_unreachable"
    LASER_OUT = "laser_out"


class PollingProtocol(str, enum.Enum):
    SSH = "ssh"
    SNMP = "snmp"


class PollingStatus(str, enum.Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    VIEWER = "viewer"


def _enum(py_enum: type[enum.Enum], name: str) -> Enum:
    """VARCHAR + CHECK, nilai kolom = value enum (bukan nama atribut)."""
    return Enum(
        py_enum,
        name=name,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda e: [member.value for member in e],
    )


def _uuid_pk():
    """Factory PK UUID — objek `mapped_column` tidak boleh dipakai ulang antar tabel."""
    return mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

# Grup default untuk OLT yang belum dikelompokkan. Disimpan eksplisit (bukan NULL)
# supaya GROUP BY dan filter tidak perlu COALESCE di setiap query.
UNGROUPED = "Ungrouped"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# --------------------------------------------------------------------------
# Core hierarchy
# --------------------------------------------------------------------------


class OLT(TimestampMixin, Base):
    __tablename__ = "olts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    vendor: Mapped[str] = mapped_column(String(50), nullable=False, default="HSGQ-E04MID")
    # Site cluster untuk scoping dashboard NOC, mis. "Klaten" / "Kebumen".
    group: Mapped[str] = mapped_column(
        String(80), nullable=False, default=UNGROUPED, server_default=UNGROUPED, index=True
    )
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # --- Akses SSH ---
    ssh_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ssh_username: Mapped[str | None] = mapped_column(String(64))
    # Ciphertext Fernet kalau CREDENTIAL_KEY diset; plain-text kalau tidak (dev only).
    ssh_password: Mapped[str | None] = mapped_column(Text)
    ssh_port: Mapped[int] = mapped_column(Integer, default=22, nullable=False)

    # --- Akses SNMP ---
    snmp_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    snmp_version: Mapped[str] = mapped_column(String(10), default="v2c", nullable=False)
    snmp_community: Mapped[str | None] = mapped_column(Text)
    snmp_port: Mapped[int] = mapped_column(Integer, default=161, nullable=False)

    # --- Telemetry chassis (hasil polling terakhir) ---
    status: Mapped[DeviceStatus] = mapped_column(
        _enum(DeviceStatus, "device_status"), default=DeviceStatus.UNKNOWN, nullable=False
    )
    cpu_usage: Mapped[float | None] = mapped_column(Float)
    memory_usage: Mapped[float | None] = mapped_column(Float)
    temperature: Mapped[float | None] = mapped_column(Float)
    uptime: Mapped[int | None] = mapped_column(Integer)  # detik
    firmware: Mapped[str | None] = mapped_column(String(80))
    traffic_in_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    traffic_out_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_poll: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    pons: Mapped[list[PON]] = relationship(
        back_populates="olt", cascade="all, delete-orphan", passive_deletes=True
    )
    uplinks: Mapped[list[UplinkPort]] = relationship(
        back_populates="olt", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint("ssh_port > 0 AND ssh_port <= 65535", name="ck_olt_ssh_port"),
        CheckConstraint("snmp_port > 0 AND snmp_port <= 65535", name="ck_olt_snmp_port"),
        Index("ix_olts_group_status", "group", "status"),
    )

    def __repr__(self) -> str:
        return f"<OLT {self.name} ({self.ip_address}) {self.status}>"


class PON(TimestampMixin, Base):
    __tablename__ = "pons"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("olts.id", ondelete="CASCADE"), nullable=False
    )
    slot: Mapped[int] = mapped_column(Integer, nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[PortStatus] = mapped_column(
        _enum(PortStatus, "port_status"), default=PortStatus.OFFLINE, nullable=False
    )
    total_onu: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    online_onu: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offline_onu: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_rx_onu: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    traffic_in_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    traffic_out_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_poll: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    olt: Mapped[OLT] = relationship(back_populates="pons")
    onus: Mapped[list[ONU]] = relationship(
        back_populates="pon", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("olt_id", "slot", "port", name="uq_pon_olt_slot_port"),
    )

    @property
    def label(self) -> str:
        """Label PON gaya CLI HSGQ, mis. "0/1"."""
        return f"{self.slot}/{self.port}"

    def __repr__(self) -> str:
        return f"<PON {self.label} olt={self.olt_id}>"


class ONU(TimestampMixin, Base):
    __tablename__ = "onus"

    id: Mapped[uuid.UUID] = _uuid_pk()
    pon_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pons.id", ondelete="CASCADE"), nullable=False
    )
    # Index ONU di dalam PON (bukan PK global).
    onu_id: Mapped[int] = mapped_column(Integer, nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(64), index=True)
    name: Mapped[str | None] = mapped_column(String(120))

    status: Mapped[DeviceStatus] = mapped_column(
        _enum(DeviceStatus, "device_status"), default=DeviceStatus.UNKNOWN, nullable=False
    )
    # Sisi ONU (diukur ONU).
    rx_power: Mapped[float | None] = mapped_column(Float)
    tx_power: Mapped[float | None] = mapped_column(Float)
    # Sisi OLT (diukur OLT untuk arah upstream) — buat isolasi arah gangguan.
    olt_rx_power: Mapped[float | None] = mapped_column(Float)
    olt_tx_power: Mapped[float | None] = mapped_column(Float)
    distance: Mapped[float | None] = mapped_column(Float)  # meter
    traffic_in_mbps: Mapped[float | None] = mapped_column(Float)
    traffic_out_mbps: Mapped[float | None] = mapped_column(Float)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    pon: Mapped[PON] = relationship(back_populates="onus")
    optical_history: Mapped[list[ONUOpticalHistory]] = relationship(
        back_populates="onu", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("pon_id", "onu_id", name="uq_onu_pon_onuid"),
        # Worst-ONU ranking: Rx terburuk lebih dulu, NULL dibuang di query.
        Index("ix_onus_rx_power", "rx_power"),
        Index("ix_onus_pon_status", "pon_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<ONU {self.serial_number or self.onu_id} rx={self.rx_power}>"


class ONUOpticalHistory(Base):
    """Time-series Rx/Tx per ONU untuk grafik tren."""

    __tablename__ = "onu_optical_history"

    id: Mapped[uuid.UUID] = _uuid_pk()
    onu_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("onus.id", ondelete="CASCADE"), nullable=False
    )
    rx_power: Mapped[float | None] = mapped_column(Float)
    tx_power: Mapped[float | None] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    onu: Mapped[ONU] = relationship(back_populates="optical_history")

    __table_args__ = (Index("ix_onu_history_onu_ts", "onu_id", "timestamp"),)


# --------------------------------------------------------------------------
# Traffic & uplink
# --------------------------------------------------------------------------


class UplinkPort(TimestampMixin, Base):
    """Port uplink OLT (SFP+/QSFP) — dipakai kartu trafik di halaman OLT."""

    __tablename__ = "uplink_ports"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("olts.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    type: Mapped[str] = mapped_column(String(40), default="SFP+", nullable=False)
    status: Mapped[PortStatus] = mapped_column(
        _enum(PortStatus, "port_status"), default=PortStatus.OFFLINE, nullable=False
    )
    speed_gbps: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    traffic_in_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    traffic_out_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    olt: Mapped[OLT] = relationship(back_populates="uplinks")

    __table_args__ = (UniqueConstraint("olt_id", "name", name="uq_uplink_olt_name"),)

    @property
    def utilization_percent(self) -> float:
        """Persen pemakaian arah tersibuk terhadap kapasitas port."""
        capacity_mbps = self.speed_gbps * 1000
        if capacity_mbps <= 0:
            return 0.0
        busiest = max(self.traffic_in_mbps, self.traffic_out_mbps)
        return round(min(busiest / capacity_mbps * 100, 100.0), 2)


class TrafficHistory(Base):
    """Snapshot trafik per OLT. Agregat armada/grup = SUM lalu GROUP BY timestamp."""

    __tablename__ = "traffic_history"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("olts.id", ondelete="CASCADE"), nullable=False
    )
    traffic_in_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    traffic_out_mbps: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_traffic_history_olt_ts", "olt_id", "timestamp"),)


# --------------------------------------------------------------------------
# Alarm & logging
# --------------------------------------------------------------------------


class Alarm(Base):
    __tablename__ = "alarms"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("olts.id", ondelete="CASCADE")
    )
    pon_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pons.id", ondelete="CASCADE")
    )
    onu_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("onus.id", ondelete="CASCADE")
    )

    severity: Mapped[AlarmSeverity] = mapped_column(
        _enum(AlarmSeverity, "alarm_severity"), nullable=False
    )
    status: Mapped[AlarmStatus] = mapped_column(
        _enum(AlarmStatus, "alarm_status"), default=AlarmStatus.ACTIVE, nullable=False
    )
    type: Mapped[AlarmType] = mapped_column(_enum(AlarmType, "alarm_type"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    rx_power: Mapped[float | None] = mapped_column(Float)

    # Dedup: satu insiden = satu baris. Poll berulang menaikkan occurrence_count
    # dan menggeser last_seen_at, bukan menambah baris baru.
    fingerprint: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sent_to_telegram: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[str | None] = mapped_column(String(64))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    olt: Mapped[OLT | None] = relationship()
    pon: Mapped[PON | None] = relationship()
    onu: Mapped[ONU | None] = relationship()

    __table_args__ = (
        Index("ix_alarms_status_created", "status", "created_at"),
        Index("ix_alarms_severity_status", "severity", "status"),
        # Dedup hanya berlaku untuk insiden yang masih terbuka; insiden lama yang
        # sudah closed boleh punya fingerprint sama saat gangguan terulang.
        Index(
            "uq_alarm_open_fingerprint",
            "fingerprint",
            unique=True,
            postgresql_where=text("status <> 'closed'"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Alarm {self.severity}/{self.type} {self.status}>"


class PollingLog(Base):
    __tablename__ = "polling_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("olts.id", ondelete="CASCADE"), nullable=False
    )
    protocol: Mapped[PollingProtocol] = mapped_column(
        _enum(PollingProtocol, "polling_protocol"), nullable=False
    )
    status: Mapped[PollingStatus] = mapped_column(
        _enum(PollingStatus, "polling_status"), nullable=False
    )
    error_msg: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[float | None] = mapped_column(Float)  # detik
    onu_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_polling_logs_olt_created", "olt_id", "created_at"),)


# --------------------------------------------------------------------------
# Settings (singleton) & user
# --------------------------------------------------------------------------


class Threshold(TimestampMixin, Base):
    """Ambang batas Rx (dBm). Singleton: baris is_active=True yang dipakai."""

    __tablename__ = "thresholds"

    id: Mapped[uuid.UUID] = _uuid_pk()
    normal_min: Mapped[float] = mapped_column(Float, default=-25.0, nullable=False)
    warning_min: Mapped[float] = mapped_column(Float, default=-27.0, nullable=False)
    critical_min: Mapped[float] = mapped_column(Float, default=-30.0, nullable=False)
    very_critical_min: Mapped[float] = mapped_column(Float, default=-35.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PollingInterval(TimestampMixin, Base):
    """Interval polling per jenis metrik (detik)."""

    __tablename__ = "polling_intervals"

    id: Mapped[uuid.UUID] = _uuid_pk()
    olt_status: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    pon_status: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    onu_status: Mapped[int] = mapped_column(Integer, default=180, nullable=False)
    optical_power: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    cpu_memory: Mapped[int] = mapped_column(Integer, default=120, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "olt_status >= 10 AND pon_status >= 10 AND onu_status >= 10 "
            "AND optical_power >= 10 AND cpu_memory >= 10",
            name="ck_polling_min_interval",
        ),
    )


class TelegramConfig(TimestampMixin, Base):
    """Integrasi bot Telegram NOC. Singleton."""

    __tablename__ = "telegram_config"

    id: Mapped[uuid.UUID] = _uuid_pk()
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Ciphertext Fernet kalau CREDENTIAL_KEY diset.
    bot_token: Mapped[str | None] = mapped_column(Text)
    chat_id: Mapped[str | None] = mapped_column(String(64))
    thread_id: Mapped[str | None] = mapped_column(String(64))
    notify_on_critical: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_on_warning: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_on_recovery: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_on_olt_offline: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_test_status: Mapped[str | None] = mapped_column(String(20))
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        _enum(UserRole, "user_role"), default=UserRole.VIEWER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"


__all__ = [
    "UNGROUPED",
    "OLT",
    "PON",
    "ONU",
    "ONUOpticalHistory",
    "UplinkPort",
    "TrafficHistory",
    "Alarm",
    "PollingLog",
    "Threshold",
    "PollingInterval",
    "TelegramConfig",
    "User",
    "DeviceStatus",
    "PortStatus",
    "AlarmSeverity",
    "AlarmStatus",
    "AlarmType",
    "PollingProtocol",
    "PollingStatus",
    "UserRole",
]
