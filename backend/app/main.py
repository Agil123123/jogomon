"""Entry point FastAPI JOGO-MON.

Lifespan menyiapkan DB (create_all) + seed admin, lalu menyalakan scheduler
polling kalau `POLLING_ENABLED=true`. Router REST digabung di `app.api.v1`
(prefix `/api`); WebSocket dimount di root `/ws`.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.api.websocket import router as ws_router
from app.config import settings
from app.database import async_session, close_db, init_db
from app.services.auth import seed_admin

logger = logging.getLogger(__name__)
logging.basicConfig(level=settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    async with async_session() as db:
        await seed_admin(db)

    polling_task: asyncio.Task[None] | None = None
    if settings.polling_enabled:
        from app.collector.scheduler import run_polling_loop

        polling_task = asyncio.create_task(run_polling_loop(), name="polling-loop")
        logger.info("Scheduler polling dinyalakan")
    else:
        logger.info("Scheduler polling dimatikan (POLLING_ENABLED=false)")

    try:
        yield
    finally:
        if polling_task is not None:
            from app.collector.scheduler import stop_polling

            await stop_polling()
            polling_task.cancel()
            with suppress(asyncio.CancelledError):
                await polling_task
        await close_db()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
