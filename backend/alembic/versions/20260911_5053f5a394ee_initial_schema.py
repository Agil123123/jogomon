"""initial_schema

Revision ID: 5053f5a394ee
Revises: 
Create Date: 2026-09-11 09:48:16.581585

Baseline migration — DB sudah punya semua tabel dari `create_all`.
Migration ini kosong, cuma sebagai anchor point supaya `alembic upgrade head`
di deployment baru tetap jalan (stamping).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5053f5a394ee'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline — tabel sudah ada di DB (dibuat oleh create_all di dev).
    # Untuk deployment baru, jalankan `alembic upgrade head` dulu
    # sebelum start app, lalu stamp: `alembic stamp head`.
    pass


def downgrade() -> None:
    # Downgrade tidak disediakan untuk baseline.
    # Kalau perlu rollback total, drop DB dan rebuild dari model.
    pass