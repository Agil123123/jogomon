"""Autentikasi: hash password, JWT, dependency current-user, seed admin."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, UserRole

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# auto_error=False supaya bisa balikin 401 dengan pesan sendiri, bukan 403 default.
bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Kredensial tidak valid atau token kedaluwarsa",
    headers={"WWW-Authenticate": "Bearer"},
)


# --------------------------------------------------------------------------
# Password
# --------------------------------------------------------------------------


def hash_password(password: str) -> str:
    # bcrypt cuma memakai 72 byte pertama; potong eksplisit supaya passlib
    # tidak melempar error untuk passphrase panjang.
    return pwd_context.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain[:72], hashed)
    except ValueError:
        # Hash rusak / format tidak dikenal — perlakukan sebagai gagal login.
        logger.warning("Hash password tidak valid di DB")
        return False


# --------------------------------------------------------------------------
# JWT
# --------------------------------------------------------------------------


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise CREDENTIALS_ERROR from exc


# --------------------------------------------------------------------------
# Lookup
# --------------------------------------------------------------------------


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        # Tetap jalankan verify pada dummy hash supaya waktu respons untuk
        # username yang tidak ada mirip dengan yang ada (mitigasi user enumeration).
        pwd_context.dummy_verify()
        return None
    if not verify_password(password, user.password_hash):
        return None
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return user


async def get_user_by_token(db: AsyncSession, token: str) -> User:
    """Resolve token → User. Dipakai dependency HTTP maupun handshake WebSocket."""
    payload = decode_token(token)
    raw_id = payload.get("sub")
    if not raw_id:
        raise CREDENTIALS_ERROR
    try:
        user_id = uuid.UUID(raw_id)
    except ValueError as exc:
        raise CREDENTIALS_ERROR from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise CREDENTIALS_ERROR
    return user


# --------------------------------------------------------------------------
# Dependencies
# --------------------------------------------------------------------------


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_ERROR
    return await get_user_by_token(db, credentials.credentials)


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role is not UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Butuh role admin untuk aksi ini",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]


# --------------------------------------------------------------------------
# Seed
# --------------------------------------------------------------------------


async def seed_admin(db: AsyncSession) -> None:
    """Bikin admin awal kalau tabel users masih kosong.

    Password diambil dari SEED_ADMIN_PASSWORD. Kalau tidak diset, digenerate
    random dan dicetak ke log sekali — tidak pernah memakai default yang bisa
    ditebak.
    """
    existing = await db.execute(select(User.id).limit(1))
    if existing.first() is not None:
        return

    password = settings.seed_admin_password
    generated = False
    if not password:
        password = secrets.token_urlsafe(12)
        generated = True

    admin = User(
        username=settings.seed_admin_username,
        password_hash=hash_password(password),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    await db.commit()

    if generated:
        logger.warning(
            "Admin awal dibuat: username=%s password=%s "
            "(simpan sekarang, tidak akan ditampilkan lagi)",
            settings.seed_admin_username,
            password,
        )
    else:
        logger.info("Admin awal dibuat: username=%s (password dari .env)", admin.username)
