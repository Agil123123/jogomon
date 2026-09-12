"""Enkripsi kredensial device (ssh_password, snmp_community, bot_token).

Kalau `CREDENTIAL_KEY` diset di .env, nilai disimpan sebagai ciphertext Fernet
dengan prefix penanda. Kalau tidak diset (dev), nilai disimpan apa adanya —
`decrypt` tetap bisa membaca keduanya, jadi migrasi dev→prod tidak perlu
mem-backfill baris lama.
"""

from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

# Penanda supaya ciphertext bisa dibedakan dari plain-text legacy.
_PREFIX = "enc:v1:"


def _cipher() -> Fernet | None:
    if not settings.credential_key:
        return None
    try:
        return Fernet(settings.credential_key.encode())
    except (ValueError, TypeError):
        logger.error(
            "CREDENTIAL_KEY tidak valid (harus 32-byte base64 urlsafe). "
            "Kredensial akan disimpan plain-text."
        )
        return None


def encrypt(value: str | None) -> str | None:
    """Enkripsi nilai untuk disimpan. Idempotent — nilai terenkripsi dilewatkan."""
    if not value:
        return value
    if value.startswith(_PREFIX):
        return value
    cipher = _cipher()
    if cipher is None:
        return value
    return _PREFIX + cipher.encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    """Balikin plain-text. Nilai tanpa prefix dianggap plain-text legacy."""
    if not value:
        return value
    if not value.startswith(_PREFIX):
        return value
    cipher = _cipher()
    if cipher is None:
        logger.error("Data terenkripsi ditemukan tapi CREDENTIAL_KEY tidak diset")
        return None
    try:
        return cipher.decrypt(value[len(_PREFIX) :].encode()).decode()
    except InvalidToken:
        logger.error("Gagal dekripsi kredensial — CREDENTIAL_KEY berganti?")
        return None


def mask(value: str | None) -> str | None:
    """Representasi aman untuk response API (4 karakter terakhir saja)."""
    plain = decrypt(value)
    if not plain:
        return None
    return "•" * max(len(plain) - 4, 0) + plain[-4:] if len(plain) > 4 else "••••"
