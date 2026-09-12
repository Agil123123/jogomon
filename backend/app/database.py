"""Engine async + session factory. Semua akses DB lewat AsyncSession."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base declarative untuk seluruh model."""


engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency FastAPI — satu session per request, rollback kalau error."""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Siapkan schema database.

    Kalau tabel `alembic_version` sudah ada (prod), asumsikan migration sudah
    dijalankan manual (`alembic upgrade head`) — jangan sentuh schema.
    Kalau belum ada (dev / fresh setup), fallback ke `create_all` supaya
    local development tetap zero-config.
    """
    from app import models  # noqa: F401  — pastikan semua model ter-register

    async with engine.begin() as conn:
        # Cek apakah Alembic sudah pernah jalan di DB ini
        result = await conn.execute(
            sa.text(
                "SELECT EXISTS ("
                "  SELECT FROM information_schema.tables "
                "  WHERE table_name = 'alembic_version'"
                ")"
            )
        )
        alembic_present = result.scalar()

        if alembic_present:
            logger.info("Schema dikelola Alembic — create_all dilewati")
            return

        await conn.run_sync(Base.metadata.create_all)
        logger.info("Schema database siap (create_all — dev mode)")


async def close_db() -> None:
    await engine.dispose()
    logger.info("Connection pool database ditutup")
