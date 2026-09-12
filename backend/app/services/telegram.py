"""Notifikasi Telegram untuk alarm NOC.

Semua kirim bersifat best-effort: kegagalan Telegram tidak boleh menggagalkan
polling atau request API. Error dicatat di log dan `last_test_status`.
"""

from __future__ import annotations

import html
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alarm, AlarmSeverity, TelegramConfig
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org"
_TIMEOUT = httpx.Timeout(10.0)

_SEVERITY_ICON = {
    AlarmSeverity.CRITICAL: "🔴",
    AlarmSeverity.WARNING: "🟡",
    AlarmSeverity.INFO: "🔵",
}


async def get_config(db: AsyncSession) -> TelegramConfig:
    """Ambil config singleton; bikin baris default kalau belum ada."""
    result = await db.execute(select(TelegramConfig).limit(1))
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = TelegramConfig()
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
        logger.info("Baris config Telegram default dibuat")
    return cfg


def _wants(cfg: TelegramConfig, alarm: Alarm) -> bool:
    """Filter berdasarkan preferensi notifikasi per severity/jenis."""
    if alarm.type.value == "olt_unreachable":
        return cfg.notify_on_olt_offline
    if alarm.severity is AlarmSeverity.CRITICAL:
        return cfg.notify_on_critical
    if alarm.severity is AlarmSeverity.WARNING:
        return cfg.notify_on_warning
    return False


async def send_message(
    bot_token: str,
    chat_id: str,
    text: str,
    thread_id: str | None = None,
) -> tuple[bool, str | None]:
    """Kirim satu pesan. Balikin (sukses, error). Tidak pernah raise."""
    payload: dict[str, object] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if thread_id:
        payload["message_thread_id"] = thread_id

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{_API_BASE}/bot{bot_token}/sendMessage", json=payload
            )
        if resp.status_code == 200 and resp.json().get("ok"):
            return True, None
        # Body Telegram memuat token? Tidak — tapi tetap dipotong supaya log ringkas.
        detail = resp.text[:200]
        logger.warning("Telegram menolak pesan (HTTP %s): %s", resp.status_code, detail)
        return False, detail
    except httpx.HTTPError as exc:
        logger.warning("Gagal menghubungi Telegram: %s", exc)
        return False, str(exc)


def format_alarm(alarm: Alarm, olt_name: str, target: str | None) -> str:
    """Susun pesan alarm. Semua nilai dari device di-escape (parse_mode HTML)."""
    icon = _SEVERITY_ICON.get(alarm.severity, "⚪")
    lines = [
        f"{icon} <b>{html.escape(alarm.severity.value.upper())}</b> — "
        f"{html.escape(alarm.type.value.replace('_', ' ').title())}",
        f"<b>OLT:</b> {html.escape(olt_name)}",
    ]
    if target:
        lines.append(f"<b>Target:</b> {html.escape(target)}")
    if alarm.rx_power is not None:
        lines.append(f"<b>Rx:</b> <code>{alarm.rx_power:.2f} dBm</code>")
    lines.append(f"<b>Pesan:</b> {html.escape(alarm.message)}")
    lines.append(
        f"<i>{alarm.created_at.astimezone().strftime('%d/%m/%Y %H:%M:%S')}</i>"
    )
    return "\n".join(lines)


async def notify_alarm(
    db: AsyncSession,
    alarm: Alarm,
    olt_name: str,
    target: str | None = None,
) -> bool:
    """Kirim notifikasi alarm kalau config mengizinkan. Idempotent per alarm."""
    if alarm.sent_to_telegram:
        return False

    cfg = await get_config(db)
    token = decrypt(cfg.bot_token)
    if not cfg.enabled or not token or not cfg.chat_id or not _wants(cfg, alarm):
        return False

    ok, _ = await send_message(
        token, cfg.chat_id, format_alarm(alarm, olt_name, target), cfg.thread_id
    )
    if ok:
        alarm.sent_to_telegram = True
        await db.commit()
    return ok


async def notify_recovery(db: AsyncSession, alarm: Alarm, olt_name: str) -> bool:
    """Pesan pemulihan saat alarm ditutup oleh collector."""
    cfg = await get_config(db)
    token = decrypt(cfg.bot_token)
    if not cfg.enabled or not token or not cfg.chat_id or not cfg.notify_on_recovery:
        return False

    text = (
        f"🟢 <b>RECOVERED</b> — "
        f"{html.escape(alarm.type.value.replace('_', ' ').title())}\n"
        f"<b>OLT:</b> {html.escape(olt_name)}\n"
        f"<b>Pesan:</b> {html.escape(alarm.message)}"
    )
    ok, _ = await send_message(token, cfg.chat_id, text, cfg.thread_id)
    return ok


async def send_test(db: AsyncSession) -> tuple[bool, str | None]:
    """Kirim pesan uji dari halaman Settings dan catat hasilnya."""
    cfg = await get_config(db)
    token = decrypt(cfg.bot_token)
    if not token or not cfg.chat_id:
        return False, "bot_token dan chat_id harus diisi dulu"

    ok, err = await send_message(
        token,
        cfg.chat_id,
        "✅ <b>JOGO-MON</b> — tes koneksi berhasil.\n"
        "<i>Notifikasi alarm akan dikirim ke chat ini.</i>",
        cfg.thread_id,
    )
    cfg.last_test_status = "success" if ok else "failed"
    cfg.last_test_at = datetime.now(timezone.utc)
    await db.commit()
    return ok, err
