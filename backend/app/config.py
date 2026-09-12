"""Config aplikasi — semua nilai sensitif dibaca dari .env, tidak ada hardcode."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# .env dicari di root repo (~/JOGOMON/.env) lalu fallback ke backend/.env
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILES = (_BACKEND_DIR.parent / ".env", _BACKEND_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_name: str = "JOGO-MON"
    api_prefix: str = "/api"
    log_level: str = "INFO"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://fams:fams@localhost:5432/olt_monitoring"
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # --- Cache ---
    redis_url: str = "redis://localhost:6379/1"

    # --- Auth ---
    secret_key: str = "dev-only-insecure-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    # --- Enkripsi kredensial device (Fernet). Kosong = simpan plain-text (dev only). ---
    credential_key: str | None = None

    # --- Seed admin ---
    seed_admin_username: str = "admin"
    seed_admin_password: str | None = None

    # --- CORS ---
    # NoDecode: nilai dari .env berupa "a,b,c", bukan JSON — biar validator
    # `_split_origins` yang memecah, bukan json.loads pydantic-settings.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3100"]

    # --- Collector ---
    polling_enabled: bool = True
    polling_concurrency: int = 4
    ssh_timeout: int = 15
    snmp_timeout: int = 5
    snmp_retries: int = 1

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        """Terima "a,b,c" dari .env maupun list dari kode."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def is_credential_encryption_enabled(self) -> bool:
        return bool(self.credential_key)


@lru_cache
def get_settings() -> Settings:
    """Cached supaya .env dibaca sekali per proses."""
    return Settings()


settings = get_settings()
