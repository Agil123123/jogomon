"""Endpoint autentikasi: login, current user.

Seed admin dijalankan otomatis di lifespan (`app.main`), bukan lewat HTTP —
endpoint publik untuk bikin admin = lubang privilege escalation.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.services.auth import CurrentUser, authenticate_user, create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DB) -> TokenResponse:
    """Tukar username/password dengan JWT.

    Pesan error sengaja seragam untuk user tidak ada / password salah / user
    non-aktif supaya tidak membocorkan username mana yang valid.
    """
    user = await authenticate_user(db, payload.username, payload.password)
    if user is None:
        logger.info("Login gagal untuk username=%s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("Login sukses: %s (%s)", user.username, user.role.value)
    return TokenResponse(
        access_token=create_access_token(user),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    """Identitas pemegang token. Dipakai frontend untuk rehydrate sesi."""
    return UserOut.model_validate(user)
