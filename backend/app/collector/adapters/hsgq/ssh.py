"""Collector SSH HSGQ-E04MID (jalur utama, rich CLI).

Paramiko itu blocking, jadi seluruh sesi dijalankan di worker thread lewat
`asyncio.to_thread` dan dibungkus `asyncio.wait_for` sebagai batas waktu total.
CLI E04MID bersifat interaktif (bukan `exec_command` sekali jalan), jadi kita
buka shell, matikan paging, lalu kirim tiap perintah dan baca outputnya sampai
prompt muncul lagi / channel diam (idle). Output tiap perintah dipisah di sini
supaya `parser.py` cukup menangani satu perintah per fungsi.

Kalau prompt tak dikenal atau paging tak bisa dimatikan, pembacaan tetap
berakhir lewat idle-timeout, jadi output tetap terkumpul (mungkin dengan sisa
artefak `--More--` yang dibersihkan `_clean_output`).
"""

from __future__ import annotations

import asyncio
import logging
import re
import socket
import time

import paramiko

from app.collector.adapters.hsgq import e04mid as k
from app.collector.adapters.hsgq import parser
from app.collector.base import CollectorError, OLTSnapshot
from app.models import OLT, PollingProtocol
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)

# Batas waktu total satu sesi SSH (connect + semua perintah).
_TOTAL_BUDGET = 60.0
_CONNECT_TIMEOUT = 12
# Timeout socket channel — recv tidak menggantung selamanya.
_CHANNEL_TIMEOUT = 5.0
# Baca banner login setelah shell dibuka.
_BANNER_IDLE = 1.0
_BANNER_DEADLINE = 8.0
# Perintah setup (enable/paging) balasannya pendek.
_SETUP_WAIT = 4.0
# Diam selama _IDLE_TIMEOUT detik setelah byte terakhir = perintah selesai.
_IDLE_TIMEOUT = 1.5
# Batas keras per perintah (safety net kalau ada yang menggantung).
_MAX_CMD_WAIT = 25.0
_POLL_INTERVAL = 0.05
_RECV_BYTES = 65535

# --- Regex pembersih terminal ---
_ANSI_RE = re.compile(r"\x1b\[[0-9;?=]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]")
# Deteksi prompt pager untuk dijawab spasi.
_MORE_RE = re.compile(r"--\s*more\s*--|<\s*more\s*>|press any key", re.IGNORECASE)
# Bentuk artefak pager yang harus dibuang dari output final.
_MORE_LINE_RE = re.compile(
    r"[ \t]*-{2,}\s*more\s*-{2,}[ \t]*|<\s*more\s*>|press any key[^\n]*", re.IGNORECASE
)
# Baris prompt: satu token diakhiri #, > atau $ (mis. "OLT#", "OLT(config)#").
_PROMPT_LINE_RE = re.compile(r"^\S+[#>$]$")


class HSGQSshCollector:
    """Poll satu OLT via SSH. Sekali pakai per siklus (satu instance = satu OLT)."""

    protocol = PollingProtocol.SSH

    def __init__(self, olt: OLT, *, connect_timeout: int = _CONNECT_TIMEOUT) -> None:
        self._host = olt.ip_address
        self._port = olt.ssh_port or 22
        self._username = olt.ssh_username or ""
        self._password = decrypt(olt.ssh_password) or ""
        self._connect_timeout = connect_timeout
        self._name = olt.name

    async def collect(self) -> OLTSnapshot:
        if not self._username:
            raise CollectorError(f"{self._name}: SSH username belum diset")
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._collect_blocking), timeout=_TOTAL_BUDGET
            )
        except asyncio.TimeoutError as exc:
            raise CollectorError(f"{self._name}: SSH timeout (>{_TOTAL_BUDGET:.0f}s)") from exc
        except CollectorError:
            raise
        except Exception as exc:  # noqa: BLE001 — dinormalkan jadi CollectorError
            raise CollectorError(f"{self._name}: SSH error tak terduga: {exc}") from exc

    # -- sesi (blocking, dijalankan di thread) -----------------------------

    def _collect_blocking(self) -> OLTSnapshot:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            try:
                client.connect(
                    hostname=self._host,
                    port=self._port,
                    username=self._username,
                    password=self._password,
                    timeout=self._connect_timeout,
                    banner_timeout=self._connect_timeout,
                    auth_timeout=self._connect_timeout,
                    allow_agent=False,
                    look_for_keys=False,
                )
            except paramiko.AuthenticationException as exc:
                raise CollectorError(f"{self._name}: SSH auth ditolak") from exc
            except (paramiko.SSHException, OSError) as exc:
                raise CollectorError(f"{self._name}: SSH connect gagal: {exc}") from exc

            chan = client.invoke_shell(width=512, height=2000)
            chan.settimeout(_CHANNEL_TIMEOUT)
            # Buang banner/motd sebelum mulai kirim perintah.
            self._read(chan, _BANNER_IDLE, deadline=_BANNER_DEADLINE)

            for cmd in k.CMD_DISABLE_PAGING:
                self._run(chan, cmd, wait=_SETUP_WAIT)

            outputs = {cmd: self._run(chan, cmd) for cmd in k.COLLECT_COMMANDS}

            try:
                chan.close()
            except Exception:  # noqa: BLE001
                pass
            return self._build_snapshot(outputs)
        finally:
            client.close()

    def _run(self, chan: paramiko.Channel, command: str, *, wait: float = _MAX_CMD_WAIT) -> str:
        try:
            chan.sendall(command + "\n")
        except OSError as exc:
            raise CollectorError(f"{self._name}: koneksi SSH putus saat kirim perintah") from exc
        raw = self._read(chan, _IDLE_TIMEOUT, deadline=wait)
        return _clean_output(raw, command)

    def _read(self, chan: paramiko.Channel, idle: float, *, deadline: float) -> str:
        """Baca channel sampai (a) prompt muncul di ekor, (b) diam ≥ `idle`,
        atau (c) `deadline` terlewat. Menjawab `--More--` dengan spasi."""
        chunks: list[str] = []
        start = last = time.monotonic()
        while True:
            now = time.monotonic()
            if now - start > deadline:
                break
            if chan.recv_ready():
                try:
                    data = chan.recv(_RECV_BYTES)
                except socket.timeout:
                    data = b""
                except OSError:
                    break
                if not data:
                    break
                chunks.append(data.decode("utf-8", "replace"))
                last = time.monotonic()
                if _MORE_RE.search(chunks[-1]):
                    try:
                        chan.sendall(" ")
                    except OSError:
                        break
                    continue
                if _tail_is_prompt(chunks):
                    time.sleep(_POLL_INTERVAL)
                    if not chan.recv_ready():
                        break
                continue
            if chunks and (now - last) >= idle:
                break
            if chan.closed:
                break
            time.sleep(_POLL_INTERVAL)
        return "".join(chunks)

    # -- perakitan snapshot ------------------------------------------------

    def _build_snapshot(self, out: dict[str, str]) -> OLTSnapshot:
        snap = OLTSnapshot(protocol=self.protocol, reachable=True)

        sys_text = "\n".join(
            (out.get(k.CMD_SYSTEM_INFO, ""), out.get(k.CMD_VERSION, ""))
        )
        snap.firmware = parser.parse_firmware(sys_text)
        snap.uptime = parser.parse_uptime_seconds(sys_text)

        cpu, mem = parser.parse_cpu_memory(
            "\n".join(
                (
                    out.get(k.CMD_CPU, ""),
                    out.get(k.CMD_MEMORY, ""),
                    out.get(k.CMD_SYSTEM_INFO, ""),
                )
            )
        )
        snap.cpu_usage = cpu
        snap.memory_usage = mem

        pon_states = parser.parse_pon_state(out.get(k.CMD_PON_STATE, ""))
        onu_map = parser.parse_onu_info(out.get(k.CMD_ONU_INFO, ""))
        optical = parser.parse_onu_optical(out.get(k.CMD_ONU_OPTICAL, ""))
        parser.merge_onu_optical(onu_map, optical)
        snap.pons = parser.assemble_pons(pon_states, onu_map)
        snap.uplinks = parser.parse_uplink(out.get(k.CMD_UPLINK, ""))

        logger.info(
            "SSH poll %s: %d PON, %d ONU, %d uplink",
            self._name,
            len(snap.pons),
            snap.onu_count,
            len(snap.uplinks),
        )
        return snap


# --------------------------------------------------------------------------
# Helper modul (murni, tanpa I/O)
# --------------------------------------------------------------------------


def _strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def _tail_is_prompt(chunks: list[str]) -> bool:
    """True kalau baris terakhir buffer sudah berupa prompt (perintah selesai)."""
    tail = _strip_ansi("".join(chunks))[-160:]
    last_line = tail.replace("\r", "\n").rstrip("\n").split("\n")[-1].strip()
    return bool(_PROMPT_LINE_RE.match(last_line))


def _looks_like_prompt(line: str) -> bool:
    return bool(_PROMPT_LINE_RE.match(line.strip()))


def _clean_output(raw: str, command: str) -> str:
    """Bersihkan output mentah: hapus ANSI, normalisasi newline, buang echo
    perintah di awal dan prompt di akhir, serta artefak pager."""
    text = _strip_ansi(raw).replace("\r\n", "\n").replace("\r", "\n").replace("\x08", "")
    text = _MORE_LINE_RE.sub("", text)
    lines = text.split("\n")

    cmd_norm = command.strip()
    cleaned: list[str] = []
    dropped_echo = False
    for line in lines:
        if not dropped_echo and (line.strip() == cmd_norm or line.rstrip().endswith(cmd_norm)):
            dropped_echo = True
            continue
        cleaned.append(line)

    while cleaned and (not cleaned[-1].strip() or _looks_like_prompt(cleaned[-1])):
        cleaned.pop()
    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    return "\n".join(cleaned)


__all__ = ["HSGQSshCollector"]
