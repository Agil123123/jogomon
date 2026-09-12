"""Aggregator router HTTP.

Semua endpoint REST digabung di bawah prefix `/api` supaya cocok dengan
`API_BASE` di `frontend/lib/api.ts`. Router WebSocket TIDAK ikut di sini —
pathnya `/ws` di root, dimount langsung di `app.main`.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api import alarms, auth, dashboard, olts, settings

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(olts.router)
api_router.include_router(alarms.router)
api_router.include_router(settings.router)

__all__ = ["api_router"]
