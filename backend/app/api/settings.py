"""Endpoint konfigurasi: threshold optik, interval polling, notifikasi Telegram.

Threshold & polling interval adalah tabel singleton (satu baris aktif). Update
bersifat merge partial — field yang tidak dikirim tidak diubah. Bot token
Telegram disimpan terenkripsi (Fernet) dan dikirim balik ter-mask.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PollingInterval
from app.schemas import (
    ActionResult,
    PollingIntervalOut,
    PollingIntervalUpdate,
    TelegramConfigOut,
    TelegramConfigUpdate,
    ThresholdOut,
    ThresholdUpdate,
)
from app.services.auth import AdminUser, CurrentUser
from app.services.crypto import encrypt, mask
from app.services.optical import get_threshold_row, invalidate_threshold_cache
from app.services.telegram import get_config, send_test

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

DB = Annotated[AsyncSession, Depends(get_db)]


# --------------------------------------------------------------------------
# Threshold optik
# --------------------------------------------------------------------------


@router.get("/thresholds", response_model=ThresholdOut)
async def read_thresholds(db: DB, _: CurrentUser) -> ThresholdOut:
    return ThresholdOut.model_validate(await get_threshold_row(db))


@router.put("/thresholds", response_model=ThresholdOut)
async def update_thresholds(db: DB, _: AdminUser, payload: ThresholdUpdate) -> ThresholdOut:
    row = await get_threshold_row(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    # Cache di `services.optical` harus di-refresh supaya klasifikasi Rx memakai
    # ambang baru tanpa perlu restart proses.
    invalidate_threshold_cache()
    logger.info("Threshold optik diperbarui: %s", data)
    return ThresholdOut.model_validate(row)


# --------------------------------------------------------------------------
# Interval polling
# --------------------------------------------------------------------------


async def _get_polling_row(db: AsyncSession) -> PollingInterval:
    row = (await db.execute(select(PollingInterval).limit(1))).scalar_one_or_none()
    if row is None:
        row = PollingInterval()
        db.add(row)
        await db.commit()
        await db.refresh(row)
        logger.info("Baris polling interval default dibuat")
    return row


@router.get("/polling", response_model=PollingIntervalOut)
async def read_polling(db: DB, _: CurrentUser) -> PollingIntervalOut:
    return PollingIntervalOut.model_validate(await _get_polling_row(db))


@router.put("/polling", response_model=PollingIntervalOut)
async def update_polling(db: DB, _: AdminUser, payload: PollingIntervalUpdate) -> PollingIntervalOut:
    row = await _get_polling_row(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    logger.info("Interval polling diperbarui: %s", data)
    return PollingIntervalOut.model_validate(row)


# --------------------------------------------------------------------------
# Telegram
# --------------------------------------------------------------------------


@router.get("/telegram", response_model=TelegramConfigOut)
async def read_telegram(db: DB, _: CurrentUser) -> TelegramConfigOut:
    cfg = await get_config(db)
    return TelegramConfigOut(
        id=cfg.id,
        enabled=cfg.enabled,
        bot_token=mask(cfg.bot_token),
        chat_id=cfg.chat_id,
        thread_id=cfg.thread_id,
        notify_on_critical=cfg.notify_on_critical,
        notify_on_warning=cfg.notify_on_warning,
        notify_on_recovery=cfg.notify_on_recovery,
        notify_on_olt_offline=cfg.notify_on_olt_offline,
        last_test_status=cfg.last_test_status,
        last_test_at=cfg.last_test_at,
    )


@router.put("/telegram", response_model=TelegramConfigOut)
async def update_telegram(db: DB, _: AdminUser, payload: TelegramConfigUpdate) -> TelegramConfigOut:
    cfg = await get_config(db)
    data = payload.model_dump(exclude_unset=True)

    # Token di-mask dikirim balik oleh form sebagai "•••1234" — validator schema
    # sudah mengubahnya menjadi None supaya tidak menimpa token tersimpan.
    if data.get("bot_token"):
        cfg.bot_token = encrypt(data.pop("bot_token"))
    else:
        data.pop("bot_token", None)

    for field, value in data.items():
        setattr(cfg, field, value)
    await db.commit()
    await db.refresh(cfg)
    logger.info("Konfigurasi Telegram diperbarui")
    return TelegramConfigOut(
        id=cfg.id,
        enabled=cfg.enabled,
        bot_token=mask(cfg.bot_token),
        chat_id=cfg.chat_id,
        thread_id=cfg.thread_id,
        notify_on_critical=cfg.notify_on_critical,
        notify_on_warning=cfg.notify_on_warning,
        notify_on_recovery=cfg.notify_on_recovery,
        notify_on_olt_offline=cfg.notify_on_olt_offline,
        last_test_status=cfg.last_test_status,
        last_test_at=cfg.last_test_at,
    )


@router.post("/telegram/test", response_model=ActionResult)
async def test_telegram(db: DB, _: AdminUser) -> ActionResult:
    ok, err = await send_test(db)
    if ok:
        return ActionResult(success=True, message="Pesan pengujian berhasil dikirim.")
    return ActionResult(success=False, message=f"Gagal mengirim pesan uji: {err}")
