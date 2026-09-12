# PRD — JOGO-MON: OLT/GPON Optical Monitoring

**Product owner:** Agil (JOGLONET NOC)
**Doc version:** 1.0
**Date:** 2026-09-04
**Status:** Approved (foundation phase)
**Owner repo:** `~/olt-monitoring`

---

## 1. Ringkasan (Summary)

JOGO-MON adalah panel monitoring real-time untuk armada OLT/GPON milik JOGLONET (ISP FTTH). Sistem ini meng-
poll OLT secara berkala (SSH + SNMP), mengumpulkan status chassis, kesehatan optik tiap PON port, dan
status + daya terima (Rx/Tx dBm) tiap ONU pelanggan, lalu menampilkan semuanya dalam dashboard NOC yang
dapat di-refresh live serta menghasilkan alarm berjenjang ketika terjadi `Loss of Signal` (LOS) atau
redaman optik tinggi.

Bukan sekadar "device inventory" — ini **telemetry command center**: fokus pada kesehatan link optik
pelanggan dan eskalasi gangguan ke teknisi lapangan.

---

## 2. Konteks Bisnis & Masalah

**Konteks:** JOGLONET mengoperasikan jaringan FTTH multi-site (Bulus, Mirit, Kalikotes, Gantiwarno, Purworejo)
dengan OLT brand HSGQ-E04MID (dan potensi vendor lain: ZTE, Huawei, FiberHome, CDATA). Monitoring saat ini
tersebar di SSH manual + SNMP ad-hoc; tidak ada satu pun panel terpusat yang menjawab cepat:

1. OLT mana yang sedang offline / bermasalah?
2. Berapa pelanggan (ONU) yang sedang down / LOS / redamannya kritis?
3. ONU mana yang paling parah (worst Rx) supaya bisa di-prioritaskan untuk penjemputan/diperbaiki?
4. Kapan alarm terakhir dan siapa yang sudah meng-acknowledge?

**Dampak tanpa produk ini:** deteksi gangguan manual, MTTR (Mean Time To Repair) tinggi, keluhan pelanggan
baru diketahui setelah komplain masuk.

---

## 3. Tujuan & Non-Tujuan

### Tujuan (In-Scope, v1)
- **T1.** Register & provision OLT (vendor, IP, SSH, SNMP) via UI.
- **T2.** Polling terjadwal multi-protokol: **SSH (rich CLI) → fallback SNMP**.
- **T3.** Health status per OLT: CPU, Memory, Temperature, Uptime, last poll.
- **T4.** Breakdown per PON port: total/online/offline/low-Rx ONU.
- **T5.** Telemetry optik per ONU: Rx/Tx power (dBm), distance, status.
- **T6.** Klasifikasi kesehatan optik berbasis threshold (normal/warning/critical/very-critical).
- **T7.** Sistem alarm berjenjang (SEV-1/2/3) + lifecycle `active → acknowledged → closed`.
- **T8.** Dashboard KPI + chart (distribusi Rx, status ONU, worst-10 ONU) + live alarm feed.
- **T9.** Real-time push via WebSocket saat data berubah.
- **T10.** Konfigurasi threshold & polling interval via UI.
- **T11.** Autentikasi (JWT) + role `admin` / `viewer`.

### Non-Tujuan (Out-of-Scope, v1)
- ❌ Manajemen inventaris kabel/spleiter end-to-end (itu domain FAMS, produk terpisah).
- ❌ Provisioning / konfigurasi aktif perangkat (read-only telemetry).
- ❌ Billing / customer CRM.
- ❌ Multi-tenant / multi-operator.
- ❌ Mobile app native (bisa via PWA/responsive web nanti).
- ❌ Prediktif AI / anomaly detection (candidate v2).

---

## 4. Persona Pengguna

| Persona | Role | Kebutuhan utama |
|---------|------|-----------------|
| **NOC Operator** (on-shift) | `viewer` | Melihat status armada real-time, tahu OLT/ONU mana yang bermasalah, ack alarm. |
| **NOC Lead / Agil** | `admin` | Semua fitur viewer + provision OLT, atur threshold, atur polling, audit trail. |
| **Teknisi Lapangan** (read-only) | `viewer` | Melihat daftar ONU bermasalah (worst Rx / offline) sebagai target perbaikan. |

---

## 5. Fitur Inti (Core Epics)

### E1 — OLT Provisioning
Operator register OLT baru: nama unik, vendor, IP, kredensial SSH (user/pass/port) + SNMP (version/community/port).
Setelah disimpan, OLT otomatis masuk queue scheduler polling.

### E2 — Telemetry Collector
Scheduler asyncio yang berjalan di background (dipakai `lifespan`). Per OLT:
1. Coba **SSH** (rich CLI, parser HSGQ).
2. Jika SSH gagal / nonaktif, **fallback SNMP** (SNMPv2c, sudah terkonfirmasi jalan di HSGQ-E04MID).
3. Proses hasil: upsert OLT status → upsert PON per slot/port → upsert ONU + Rx/Tx.
4. Catat `PollingLog` (sukses/gagal, protokol, durasi, error).
5. Jalankan evaluasi alarm, broadcast WebSocket.

### E3 — Optical Health Scoring
Threshold dBm (default):
| Kelas | Rentang Rx | Warna |
|-------|-----------|-------|
| Normal | ≥ −25 dBm | Green |
| Warning | −25 … −27 dBm | Amber |
| Critical | −27 … −30 dBm | Red |
| Very Critical | < −30 dBm | Deep red |

Semua nilai **editable** via UI (E7).

### E4 — Alarm & Incident Hub
Trigger:
- **LOS / Offline:** status ONU → offline , atau OLT unreachable (N kali berturut-turut).
- **High Attenuation:** Rx turun di bawah `critical_min`.
- **Dying gasp:** Rx turun drastis (delta) sebelum LOS total *(candidate, v1.1)*.
- **Laser Out:** status offline/Last deregister reason Laser Out
Jenjang: `critical` (SEV-1), `warning` (SEV-2), `info` (SEV-3).
Lifecycle: `active → acknowledged → closed` (action dari UI).

### E5 — Dashboard & Analytics
KPI cards (total OLT, total ONU, ONU offline, insiden aktif, % optical link health), total traffic incoming/outgoing per second dari semua total OLT,
chart distribusi Rx (bar), donut status ONU, worst-10 ONU (Rx terburuk), live alarm feed, inventaris armada OLT.

### E6 — Detail OLT
Drill-down per OLT: stat cards (traffic Rx/Tx Uplink/CPU/Mem/Temp/Uptime/last-poll), breakdown PON (slot/port),
expandable ONU list dengan Rx/Tx + status.

### E7 — Konfigurasi
Tab: **Ambang Batas Optik** (4 threshold dBm), **Polling Intervals** (olt/pon/onu/optical/cpu — min 10s),
**Add OLT** (form provisioning).

### E8 — Authentication
Login (JWT, HS256, expiry 480 menit). Endpoint `admin` untuk provisioning & config.
Default admin di-seed saat pertama boot.

---

## 6. Persyaratan Fungsional (Functional Requirements)

| ID | Requirement | Prioritas |
|----|-------------|-----------|
| FR-01 | Create/Read OLT; nama & IP unik (uniqueness constraint). | P0 |
| FR-02 | Polling per OLT: SSH dulu, fallback SNMP; catat protokol yang dipakai. | P0 |
| FR-03 | OLT status: `online / offline / unknown` + last_poll. | P0 |
| FR-04 | Chassis metrics: CPU%, Mem%, Temp, Uptime. | P0 |
| FR-05 | PON per slot/port: total/online/offline/low-rx count. | P0 |
| FR-06 | ONU: id, serial, status, Rx/Tx dBm, distance, last_seen. | P0 |
| FR-07 | Klasifikasi optik per threshold yang bisa dikonfigurasi. | P0 |
| FR-08 | Generate alarm (LOS, high-atten) + dedup (jangan spam per poll). | P0 |
| FR-09 | Alarm lifecycle: acknowledge, close; filter by status/severity. | P0 |
| FR-10 | Dashboard KPI + charts + worst-10 ONU + live feed. | P0 |
| FR-11 | WebSocket broadcast event: olt-status, onu-status, optical, alarm. | P1 |
| FR-12 | KPI endpoint aggregate (total_olt/online/offline, onu, alarms). | P0 |
| FR-13 | PollingLog per OLT (audit jejak polling). | P1 |
| FR-14 | Optical history per ONU (time-series Rx). | P1 |
| FR-15 | Update threshold & polling interval via API + UI. | P0 |
| FR-16 | Role-based: admin vs viewer. | P0 |

---

## 7. Arsitektur Data (ERD)

```
┌─────────────┐        ┌──────────────┐        ┌───────────────┐
│    OLT      │ 1     N │     PON      │ 1     N │     ONU       │
├─────────────┤────────├──────────────┤────────├───────────────┤
│ id (UUID) PK│        │ id (UUID) PK │        │ id (UUID) PK  │
│ name *uniq  │        │ olt_id  FK   │        │ pon_id   FK   │
│ vendor      │        │ slot (int)   │        │ onu_id (str)  │
│ ip *uniq    │        │ port (int)   │        │ serial_number │
│ ssh_*       │        │ status       │        │ status        │
│ snmp_*      │        │ total_onu    │        │ rx_power dBm  │
│ status      │        │ online_onu   │        │ tx_power dBm  │
│ cpu/mem/temp│        │ offline_onu  │        │ olt_rx/tx     │
│ uptime      │        │ low_rx_onu   │        │ distance km   │
│ last_poll   │        │ last_poll    │        │ last_seen     │
└─────────────┘        └──────────────┘        └───────┬───────┘
       │ 1                                              │ 1
       │ N                                              │ N
┌──────────────┐  ┌───────────────────────┐  ┌─────────────────────────┐
│ PollingLog   │  │     ONUOpticalHistory │  │          Alarm          │
├──────────────┤  ├───────────────────────┤  ├─────────────────────────┤
│ olt_id   FK  │  │ onu_id FK             │  │ olt_id FK (nullable)    │
│ protocol     │  │ rx_power, tx_power    │  │ pon_id FK (nullable)    │
│ status(ok/er)│  │ timestamp             │  │ onu_id FK (nullable)    │
│ error_msg    │  └───────────────────────┘  │ severity (crit/warn/info)│
│ duration     │                             │ status (act/ack/closed) │
└──────────────┘                             │ type (los/high_atten/..)│
                                             │ rx_power, created_at    │
                                             └─────────────────────────┘

┌──────────────┐        ┌──────────────────┐
│    User      │        │ Threshold (1 row)│
├──────────────┤        ├──────────────────┤
│ id (UUID) PK │        │ normal_min dBm   │
│ username uniq│        │ warning_min      │
│ password_hash│        │ critical_min     │
│ role (admin/ │        │ very_critical_min│
│      viewer) │        │ is_active        │
└──────────────┘        └──────────────────┘
                        (PollingInterval juga 1 row:
                         olt/pon/onu/optical/cpu_memory)
```

**Business rules / constraints:**
- `OLT.name` & `OLT.ip_address` — unique.
- `PON` — `UNIQUE(olt_id, slot, port)`; cascade delete dari OLT.
- `ONU` — `UNIQUE(pon_id, onu_id)`; cascade dari PON.
- `ONUOpticalHistory` — cascade dari ONU, order by `timestamp desc`.
- `Alarm` — optional FK ke OLT/PON/ONU (bisa alarm level-OLT tanpa ONU spesifik).
- `Threshold` & `PollingInterval` — singleton (1 row aktif).

---

## 8. API Contract (REST, prefix `/api`)

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| POST | `/auth/login` | public | Login → `{ access_token }` |
| GET  | `/auth/me` | user | Info user saat ini |
| GET  | `/dashboard/kpi` | user | Agregat KPI utama |
| GET  | `/dashboard/optical-summary` | user | Breakdown Rx per kelas |
| GET  | `/dashboard/rx-distribution` | user | Distribusi Rx (untuk chart) |
| GET  | `/dashboard/worst-onu?limit=10` | user | Top-N ONU worst Rx |
| GET  | `/dashboard/olt-list` | user | Daftar OLT + ringkasan |
| GET  | `/olts` | user | List semua OLT |
| POST | `/olts` | admin | Provision OLT baru |
| GET  | `/olts/{olt_id}` | user | Detail OLT + PON + stats |
| GET  | `/olts/{olt_id}/pons/{pon_id}` | user | Detail PON + ONU list |
| GET  | `/olts/{olt_id}/pons/{pon_id}/onus/{onu_id}` | user | Detail 1 ONU |
| GET  | `.../onus/{onu_id}/history` | user | Time-series Rx |
| GET  | `/alarms?status=&severity=&limit=` | user | List alarm |
| POST | `/alarms/{id}/acknowledge` | user | Ack alarm |
| POST | `/alarms/{id}/close` | user | Close alarm |
| GET  | `/settings/thresholds` | user | Baca threshold |
| PUT  | `/settings/thresholds` | admin | Update threshold |
| GET  | `/settings/polling` | user | Baca interval |
| PUT  | `/settings/polling` | admin | Update interval |
| WS   | `/ws` | token | Event stream: olt-status, onu-status, optical, alarm |

**Konvensi response:** JSON; error → HTTP status + `{ "detail": "..." }`.

---

## 9. Tech Stack

| Layer | Pilihan | Catatan |
|-------|---------|---------|
| **Backend** | Python 3.11 · FastAPI · Uvicorn | Async-first |
| **ORM** | SQLAlchemy 2.0 (async) | AsyncSession |
| **DB** | PostgreSQL (`asyncpg`) | DB `olt_monitoring` |
| **Cache/Broker** | Redis (`db 1`) | (reserve: WS fanout, queue) |
| **Collector** | Paramiko (SSH) + SnmpLib (SNMPv2c) · `netmiko` | Adapter per vendor |
| **Auth** | `python-jose` (JWT) · `passlib[bcrypt]` | HS256 |
| **Frontend** | Next.js (App Router) · TypeScript | |
| **Styling** | Tailwind CSS · | Dark, Inter + JetBrains Mono | Gradient, Glassmorphism |  
| **Charts** | Recharts | Bar + Donut | gradient 
| **State** | Zustand | Auth + store |
| **Runtime FE** | Node (dev port 3100) | `next dev -H 0` |

**Design system (frontend):** background `#051424`, accent cyan `#00F2FE`,
emerald `#4EDEA3`, warning amber, error rose `#F43F5E`; cards glass
(`rgba(13,28,45,.82)` + backdrop-blur) + ambient glow orbs, dan juga modern futuristic glow style.       

---

## 10. Persyaratan Non-Fungsional

| Kategori | Target |
|----------|--------|
| **Kecepatan** | Dashboard first-paint < 1.5s (local); auto-refresh 5s tanpa flicker. |
| **Keandalan polling** | Satu OLT gagal tidak boleh memblokir OLT lain (isolasi error per-OLT). |
| **Idempotensi** | Polling ulang = upsert (bukan duplikat row). |
| **Keamanan** | SSH password disimpan encrypted di prod; JWT expiry 480m; CORS dipatok domain FE; role gate di endpoint admin. |
| **Skalabilitas** | Desain adapter berbasis *vendor* → tambah vendor tanpa ubah scheduler. |
| **Observability** | PollingLog + structured logging; alarm dedup supaya feed tidak spam. |
| **Usability** | UI Bahasa Indonesia; angka teknis dalam font mono; warna konsisten per status. |

---

## 11. Metrik Keberhasilan (Success Metrics)

| Metrik | Baseline (tanpa) | Target |
|--------|------------------|--------|
| Deteksi OLT offline | Manual (jam) | < 1 polling interval (≤ 60s) |
| MTTR gangguan optik | Tinggi | Turun ≥ 50% |
| Visibility pelanggan down | Tidak ada | 100% ONU termonitor |
| Waktu provision OLT baru | Manual (menit) | < 1 menit via UI |
| False-alarm | N/A | Dedup → 1 alarm per insiden |

---

## 12. Roadmap / Milestones

**Milestone 1 — Foundation (selesai ✅)**
- [x] DB schema + models (OLT/PON/ONU/Alarm/History/Threshold/PollingLog/User)
- [x] Auth (login/JWT/seed admin)
- [x] Collector HSGQ (SSH + SNMP) + scheduler
- [x] Alarm engine (evaluate olt/pon/onu)
- [x] REST API (dashboard/olts/alarms/settings)
- [x] WebSocket broadcast
- [x] Frontend 5 halaman (Dashboard, Login, Alarms, OLT Detail, Settings) + design system JOGO-MON

**Milestone 2 — Hardening (sebagian besar selesai)**
- [x] Enkripsi kredensial SSH di DB — Fernet via `CREDENTIAL_KEY`
- [x] CORS dipatok ke domain FE — `CORS_ORIGINS` di `.env`
- [x] Alarm dedup + retry/backoff untuk OLT offline — fingerprint + semaphore
- [x] Polling concurrency control — `POLLING_CONCURRENCY` semaphore
- [x] Migrations (Alembic) — `backend/alembic/`, initial: `5053f5a394ee`
- [x] Notifikasi Telegram — `services/telegram.py`
- [ ] PWA / offline cache (view last-known state)
- [ ] E2E regression + deploy prod (VPS 103.20.88.83)

**Milestone 3 — Advanced (v1.1/v2)**
- [x] Notifikasi keluar (Telegram bot) saat SEV-1
- [ ] Adapter vendor lain (ZTE / Huawei / FiberHome / CDATA)
- [ ] Dying-gasp detection (delta Rx)
- [ ] Time-series retention + downsample (Grafana-like)
- [ ] Audit trail penuh (siapa ack/close kapan)
- [ ] Dashboard per-site (Bulus / Mirit / Kalikotes / Gantiwarno / Purworejo)

---

## 13. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| SSH tidak stabil di semua OLT | Data hilang | Fallback SNMP (sudah ada); retry. |
| Password SSH plain-text | Kebocoran kredensial | Enkripsi kolom (Fernet) sebelum deploy prod. |
| OLT lambat / timeout | Scheduler macet | Timeout per-poll + run di task terpisah per OLT. |
| Alarm spam | Feed tidak terbaca | Dedup by (olt,pon,onu,type) selama masih `active`. |
| DB growth (history) | Performa turun | Retention policy + downsample. |
| CORS `*` | Misconfig security | Patok `frontend_url` exact. |

---

## 14. Pertanyaan Terbuka

1. Apakah `PollingLog` perlu retention (purge > N hari)?
2. Notifikasi keluar: Telegram bot sudah ada infra (NOC shift report) — reuse channel?
3. Multi-admin? Untuk sekarang single-admin cukup?
4. Apakah perlu SSO / LDAP atau tetap local JWT?

---
