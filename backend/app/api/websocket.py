"""Hub broadcast WebSocket (path `/ws`, dimount di `app.main`).

Klien NOC subscribe dengan token JWT sebagai query param, opsional dengan
`?group=<nama>` untuk berlangganan satu site cluster saja. Server mendorong
envelope `WSEvent` (olt-status / onu-status / optical / alarm / kpi /
poll-cycle). Koneksi mati dibersihkan otomatis; broadcast ke klien yang
hilang tidak boleh mengganggu pengirim.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas import WSEvent
from app.services.auth import get_user_by_token
from app.database import async_session

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionHub:
    """Registry klien aktif + broadcast fan-out per grup."""

    def __init__(self) -> None:
        self._clients: dict[WebSocket, set[str | None]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, groups: set[str | None]) -> None:
        async with self._lock:
            self._clients[ws] = groups

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.pop(ws, None)

    async def broadcast(self, event: str, data: dict, group: str | None = None) -> None:
        """Kirim envelope ke semua klien yang cocok (None = langganan semua grup)."""
        envelope = WSEvent(event=event, group=group, data=data)
        payload = json.loads(envelope.model_dump_json())
        async with self._lock:
            targets = [
                ws
                for ws, subs in self._clients.items()
                if None in subs or group in subs or group is None
            ]
        if not targets:
            return
        results = await asyncio.gather(
            *(self._safe_send(ws, payload) for ws in targets), return_exceptions=True
        )
        failed = [ws for ws, r in zip(targets, results) if isinstance(r, Exception)]
        for ws in failed:
            await self.disconnect(ws)

    @staticmethod
    async def _safe_send(ws: WebSocket, payload: dict) -> None:
        await ws.send_text(json.dumps(payload, default=str))


hub = ConnectionHub()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """Handshake: token wajib, grup opsional (bisa >1 via `groups` param)."""
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4401)
        return

    try:
        async with async_session() as db:
            await get_user_by_token(db, token)
    except Exception:  # noqa: BLE001 — auth gagal dalam bentuk apapun = tolak
        await ws.close(code=4401)
        return

    requested = ws.query_params.getlist("group") or ws.query_params.getlist("groups")
    groups: set[str | None] = {g for g in requested if g} or {None}

    await ws.accept()
    await hub.connect(ws, groups)
    logger.info("WS client tersambung (grup=%s)", groups or "semua")
    try:
        while True:
            # Server tidak menunggu perintah; ping dikirim supaya klien yakin hidup.
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text(json.dumps({"event": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(ws)


async def broadcast_event(event: str, data: dict, group: str | None = None) -> None:
    """Fasad untuk scheduler/API: tak peduli ada klien atau tidak."""
    await hub.broadcast(event, data, group)


__all__ = ["router", "hub", "broadcast_event"]
