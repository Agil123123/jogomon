# Alembic Migrations — JOGO-MON

Migration files hidup di `versions/`. Generate dengan:

```bash
# Dari ~/JOGOMON/backend (venv aktif)
alembic revision --autogenerate -m "deskripsi singkat"

# Jalankan migration
alembic upgrade head

# Rollback satu langkah
alembic downgrade -1

# Lihat riwayat
alembic history
```

**Deploy prod:** jalankan `alembic upgrade head` sekali sebelum start uvicorn.
`create_all` di `database.py` tetap jalan untuk dev supaya setup baru langsung bisa.
