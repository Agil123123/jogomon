"""Smoke test backend JOGO-MON.

Init DB + seed admin, lalu hit endpoint inti via ASGI transport (tanpa server
eksternal). Jalankan: python smoke_test.py
"""

from __future__ import annotations

import asyncio

import httpx

from app.database import async_session, close_db, init_db
from app.main import app
from app.services.auth import seed_admin

GET_PATHS = [
    "/health",
    "/api/auth/me",
    "/api/dashboard/kpi",
    "/api/dashboard/optical-summary",
    "/api/dashboard/olt-list",
    "/api/alarms",
    "/api/settings/thresholds",
    "/api/settings/polling",
    "/api/settings/telegram",
]


async def main() -> None:
    await init_db()
    async with async_session() as db:
        await seed_admin(db)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/auth/login", json={"username": "admin", "password": "admin123"}
        )
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        print("200 POST /api/auth/login")

        for path in GET_PATHS:
            resp = await c.get(path, headers=headers)
            assert resp.status_code == 200, (path, resp.text)
            print(f"{resp.status_code} GET {path}")

        r = await c.put(
            "/api/settings/thresholds", headers=headers, json={"warning_min": -26.0}
        )
        assert r.status_code == 200, r.text
        assert r.json()["warning_min"] == -26.0
        print("200 PUT /api/settings/thresholds")

        r = await c.put(
            "/api/settings/polling", headers=headers, json={"olt_status": 60}
        )
        assert r.status_code == 200, r.text
        print("200 PUT /api/settings/polling")

        r = await c.get("/api/dashboard/kpi")
        assert r.status_code == 401, "endpoint harus menolak request tanpa token"
        print("401 GET /api/dashboard/kpi (tanpa token)")

    await close_db()
    print("SMOKE TEST OK")


if __name__ == "__main__":
    asyncio.run(main())
