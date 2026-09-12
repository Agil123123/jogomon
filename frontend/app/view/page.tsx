'use client';

/**
 * Wallboard (view mode) — JOGO-MON
 *
 * Layar pantau untuk TV NOC. Beda filosofi dari /dashboard:
 *   - Read-only. Tidak ada filter, tombol aksi, tooltip, atau hover state —
 *     tidak ada yang megang mouse di depan TV.
 *   - Satu layar, tanpa scroll. Grid `.wallboard` bagi tinggi viewport, jadi
 *     tiap panel harus meng-cap jumlah baris yang dirender sendiri.
 *   - Angka besar, mono, tabular. Dibaca dari jarak 3+ meter.
 *   - Auto refresh sendiri (REFRESH_MS); operator tidak menekan apa pun.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import {
    fetchAlarms, fetchKPI, fetchOLTList, fetchOpticalSummary,
    fetchTrafficHistory, fetchWorstONUs,
} from '@/lib/api';
import type {
    Alarm, KPI, OLTSummary, OpticalSummary, TrafficHistoryPoint, WorstONU,
} from '@/lib/mock-data';
import { cn, formatDbm, formatTemp, formatTraffic, getRxColor } from '@/lib/utils';

const REFRESH_MS = 15_000;

/** Panel punya tinggi tetap, jadi tiap list di-cap keras. Sisanya diringkas
 *  jadi baris "+N". Lebih jujur daripada baris ke-9 kepotong separuh. */
const FLEET_ROWS = 7;
const ALARM_ROWS = 6;
const TICKER_ITEMS = 12;

type TileStatus = 'online' | 'warning' | 'critical' | 'muted';

const TILE_CLASS: Record<TileStatus, string> = {
    online: 'wall-online',
    warning: 'wall-warning',
    critical: 'wall-critical',
    muted: 'wall-muted',
};

function Tile({
    label, value, sub, status = 'online',
}: {
    label: string;
    value: string | number;
    sub?: string;
    status?: TileStatus;
}) {
    return (
        <div className={cn('wall-tile', TILE_CLASS[status])}>
            <span className="wall-label">{label}</span>
            <span className="wall-value">{value}</span>
            {sub && <span className="wall-sub">{sub}</span>}
        </div>
    );
}

function Panel({
    title, meta, children,
}: {
    title: string;
    meta?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="wall-panel">
            <header className="wall-panel-head">
                <h2 className="wall-label">{title}</h2>
                {meta && <span className="wall-sub">{meta}</span>}
            </header>
            <div className="wall-panel-body">{children}</div>
        </section>
    );
}

export default function WallboardPage() {
    const { isAuthenticated, hydrate } = useAuthStore();
    const { t } = useTranslation();
    const router = useRouter();

    const [kpi, setKpi] = useState<KPI | null>(null);
    const [optical, setOptical] = useState<OpticalSummary | null>(null);
    const [olts, setOlts] = useState<OLTSummary[]>([]);
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [worst, setWorst] = useState<WorstONU[]>([]);
    const [traffic, setTraffic] = useState<TrafficHistoryPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    const load = useCallback(async () => {
        try {
            const [k, os, o, a, w, th] = await Promise.all([
                fetchKPI(),
                fetchOpticalSummary(),
                fetchOLTList(),
                fetchAlarms(),
                fetchWorstONUs(TICKER_ITEMS),
                fetchTrafficHistory(),
            ]);
            setKpi(k);
            setOptical(os);
            setOlts(o);
            setAlarms(a);
            setWorst(w);
            setTraffic(th);
            // Jam dirender client-only supaya tidak mismatch saat hydrate
            setUpdatedAt(new Date().toLocaleTimeString('id-ID', { hour12: false }));
        } catch (error) {
            console.error('Wallboard refresh failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => clearInterval(id);
    }, [isAuthenticated, router, load]);

    // Fullscreen state disinkronkan dari event, bukan dari klik: user bisa
    // keluar pakai Esc / F11 tanpa lewat tombol kita.
    useEffect(() => {
        const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void document.documentElement.requestFullscreen().catch(() => {
                /* diblok browser policy — tombol tetap idle, tidak perlu ribut */
            });
        }
    }, []);

    /** Prioritas armada: yang bermasalah naik ke atas, bukan urut abjad.
     *  offline → alarm terbanyak → Rx lemah terbanyak. */
    const fleet = useMemo(() => {
        const rank = (o: OLTSummary) => (o.status === 'offline' ? 0 : o.status === 'unknown' ? 1 : 2);
        return [...olts].sort((a, b) =>
            rank(a) - rank(b) ||
            b.active_alarms - a.active_alarms ||
            b.low_rx_onu - a.low_rx_onu
        );
    }, [olts]);

    const openAlarms = useMemo(() => {
        const sev = { critical: 0, warning: 1, info: 2 } as const;
        return alarms
            .filter((a) => a.status !== 'closed')
            .sort((a, b) =>
                sev[a.severity] - sev[b.severity] ||
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
    }, [alarms]);

    /** Donut komposisi optik dirakit jadi conic-gradient, bukan chart:
     *  tidak butuh sumbu, tooltip, atau legend interaktif. */
    const opticalSlices = useMemo(() => {
        if (!optical) return { stops: '', rows: [], total: 0 };
        const rows = [
            { key: 'normal', label: t.normal, value: optical.normal },
            { key: 'warning', label: t.warning, value: optical.warning },
            { key: 'critical', label: t.critical, value: optical.critical },
            { key: 'very_critical', label: t.veryCritical, value: optical.very_critical },
        ].map((r) => ({ ...r, color: getRxColor(r.key) }));

        const total = rows.reduce((s, r) => s + r.value, 0);
        let acc = 0;
        const stops = rows
            .map((r) => {
                const from = total ? (acc / total) * 100 : 0;
                acc += r.value;
                const to = total ? (acc / total) * 100 : 0;
                return `${r.color} ${from}% ${to}%`;
            })
            .join(', ');

        return { stops, rows, total };
    }, [optical, t]);

    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <main className="grid min-h-dvh place-items-center bg-surface-base">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-noc-cyan/30 border-t-noc-cyan" />
                    <span className="label-caps text-text-muted">{t.loadingTelemetry}</span>
                </div>
            </main>
        );
    }

    const healthy = optical
        ? Math.round((optical.normal / Math.max(opticalSlices.total, 1)) * 100)
        : 0;

    return (
        <main className="wallboard bg-surface-base" aria-label={t.wallboardTitle}>
            {/* Header: identitas layar + chrome minimal. Chrome sengaja kecil dan
          mono supaya tidak ikut terbaca dari jauh. */}
            <header className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-noc-emerald"
                    />
                    <h1 className="truncate font-mono text-[clamp(0.8rem,1.3vw,1.35rem)] font-bold tracking-[0.18em] text-text-primary">
                        {t.brandTitle} · {t.wallboardTitle}
                    </h1>
                    <span className="wall-sub hidden sm:inline">
                        {t.wallUpdated} {updatedAt}
                    </span>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                    <button type="button" className="wall-control" onClick={toggleFullscreen}>
                        {isFullscreen ? t.wallFullscreenExit : t.wallFullscreen}
                    </button>
                    <Link href="/" className="wall-control">
                        {t.wallExit}
                    </Link>
                </div>
            </header>

            {/* KPI band */}
            {kpi && (
                <div className="grid grid-cols-3 gap-[0.7rem] lg:grid-cols-6">
                    <Tile
                        label={t.kpiTotalOlt}
                        value={`${kpi.online_olt}/${kpi.total_olt}`}
                        sub={`${kpi.offline_olt} ${t.offline}`}
                        status={kpi.offline_olt > 0 ? 'critical' : 'online'}
                    />
                    <Tile
                        label={t.kpiTotalTraffic}
                        value={formatTraffic(kpi.total_traffic_mbps)}
                        sub={`↓ ${formatTraffic(kpi.total_traffic_in_mbps)}  ↑ ${formatTraffic(kpi.total_traffic_out_mbps)}`}
                    />
                    <Tile
                        label={t.kpiTotalOnu}
                        value={kpi.total_onu}
                        sub={`${kpi.online_onu} ${t.online}`}
                    />
                    <Tile
                        label={`ONU ${t.offline}`}
                        value={kpi.offline_onu}
                        sub={kpi.offline_onu > 0 ? t.offline : t.normal}
                        status={kpi.offline_onu > 10 ? 'critical' : kpi.offline_onu > 0 ? 'warning' : 'online'}
                    />
                    <Tile
                        label={t.kpiActiveAlarms}
                        value={kpi.active_alarms}
                        sub={`${kpi.critical_alarms} ${t.critical}`}
                        status={kpi.critical_alarms > 0 ? 'critical' : kpi.active_alarms > 0 ? 'warning' : 'online'}
                    />
                    <Tile
                        label={t.kpiOpticalHealth}
                        value={`${kpi.optical_health_percent}%`}
                        sub={t.kpiOpticalSubtitle}
                        status={
                            kpi.optical_health_percent > 90 ? 'online'
                                : kpi.optical_health_percent > 70 ? 'warning' : 'critical'
                        }
                    />
                </div>
            )}

            {/* Band 1 — trafik agregat + komposisi optik */}
            <div className="wall-band">
                <Panel title={t.wallTrafficTitle} meta={t.chartLast24h}>
                    {traffic.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            {/* Tanpa Tooltip: tidak ada kursor di wallboard. Nilai terkini
                  sudah ada di tile Total Trafik. */}
                            <AreaChart data={traffic} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                                <defs>
                                    <linearGradient id="wallIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#00F2FE" stopOpacity={0.45} />
                                        <stop offset="100%" stopColor="#00F2FE" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="wallOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#4EDEA3" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#4EDEA3" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: '#7D8FA9', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                                    stroke="rgba(148,163,184,0.15)"
                                    interval="preserveStartEnd"
                                    minTickGap={48}
                                />
                                <YAxis
                                    tick={{ fill: '#7D8FA9', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                                    stroke="rgba(148,163,184,0.15)"
                                    width={44}
                                    unit="G"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="traffic_in_gbps"
                                    stroke="#00F2FE"
                                    strokeWidth={2}
                                    fill="url(#wallIn)"
                                    isAnimationActive={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="traffic_out_gbps"
                                    stroke="#4EDEA3"
                                    strokeWidth={2}
                                    fill="url(#wallOut)"
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="grid h-full place-items-center wall-sub">{t.chartNoData}</div>
                    )}
                </Panel>

                <Panel title={t.wallOpticalTitle} meta={`${opticalSlices.total} ONU`}>
                    {/* Tanpa justify-center: kalau ruang mepet, overflow bakal
                        kebagi atas-bawah dan bikin donut keliatan kepotong.
                        Ring yang flex, legend tetap ukuran aslinya. */}
                    <div className="flex h-full flex-col gap-2">
                        <div className="wall-donut-wrap">
                            {/* Ring dibungkus sendiri: wrap = ruang yang tersedia,
                                ring = kotak persegi hasil clamp dua sumbu */}
                            <div className="wall-donut-ring">
                                {/* Donut dekoratif — angka pastinya ada di legend di bawah */}
                                <div
                                    aria-hidden="true"
                                    className="wall-donut"
                                    style={{ background: `conic-gradient(from -90deg, ${opticalSlices.stops})` }}
                                />
                                <div className="wall-donut-center">
                                    <span className="wall-donut-value metric-glow">{healthy}%</span>
                                    <span className="wall-label">{t.labelHealthy}</span>
                                </div>
                            </div>
                        </div>


                        <ul className="wall-donut-legend space-y-1">

                            {opticalSlices.rows.map((r) => (
                                <li key={r.key} style={{ color: r.color }}>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="wall-sub" style={{ color: r.color }}>{r.label}</span>
                                        <span className="wall-sub" style={{ color: r.color }}>{r.value}</span>
                                    </div>
                                    <div className="wall-bar">
                                        <div
                                            className="wall-bar-fill"
                                            style={{
                                                width: `${opticalSlices.total ? (r.value / opticalSlices.total) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Panel>
            </div>

            {/* Band 2 — armada OLT + alarm aktif */}
            <div className="wall-band">
                <Panel title={t.wallFleetTitle} meta={`${olts.length} OLT`}>
                    <ul className="flex h-full flex-col gap-1">
                        {fleet.slice(0, FLEET_ROWS).map((o) => (
                            <li
                                key={o.id}
                                className={cn(
                                    'wall-row',
                                    o.status === 'offline' && 'wall-row-critical',
                                    o.status === 'online' && o.low_rx_onu > 0 && 'wall-row-warning'
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'h-2 w-2 flex-shrink-0 rounded-full',
                                        o.status === 'online' ? 'bg-noc-emerald'
                                            : o.status === 'offline' ? 'bg-noc-rose' : 'bg-text-muted'
                                    )}
                                />
                                <span className="min-w-0 flex-1 truncate text-text-primary">{o.name}</span>
                                <span className="hidden w-28 text-right sm:inline">
                                    {o.online_onu}/{o.total_onu} ONU
                                </span>
                                <span className="w-24 text-right text-noc-cyan">
                                    {formatTraffic(o.traffic_in_mbps + o.traffic_out_mbps)}
                                </span>
                                <span className="hidden w-16 text-right lg:inline">{formatTemp(o.temperature)}</span>
                                <span
                                    className={cn(
                                        'w-14 text-right',
                                        o.active_alarms > 0 ? 'text-noc-rose' : 'text-text-muted'
                                    )}
                                >
                                    {o.active_alarms} ALM
                                </span>
                            </li>
                        ))}
                        {fleet.length > FLEET_ROWS && (
                            <li className="wall-sub px-1 pt-0.5">+{fleet.length - FLEET_ROWS}</li>
                        )}
                    </ul>
                </Panel>

                <Panel title={t.wallAlarmTitle} meta={`${openAlarms.length} ${t.active}`}>
                    {openAlarms.length > 0 ? (
                        <ul className="flex h-full flex-col gap-1">
                            {openAlarms.slice(0, ALARM_ROWS).map((a) => (
                                <li
                                    key={a.id}
                                    className={cn(
                                        'wall-row',
                                        a.severity === 'critical' && 'wall-row-critical',
                                        a.severity === 'warning' && 'wall-row-warning'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'w-10 flex-shrink-0 font-bold',
                                            a.severity === 'critical' ? 'text-noc-rose'
                                                : a.severity === 'warning' ? 'text-noc-amber' : 'text-noc-cyan'
                                        )}
                                    >
                                        {a.severity === 'critical' ? 'SEV1' : a.severity === 'warning' ? 'SEV2' : 'SEV3'}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-text-primary">
                                        {a.olt_name}
                                        {a.pon_label ? ` · ${a.pon_label}` : ''}
                                        {a.onu_serial ? ` · ${a.onu_serial}` : ''}
                                    </span>
                                    <span className="hidden w-24 flex-shrink-0 text-right uppercase lg:inline">
                                        {a.type.replace(/_/g, ' ')}
                                    </span>
                                    {a.rx_power !== null && (
                                        <span className="w-24 flex-shrink-0 text-right text-noc-rose">
                                            {formatDbm(a.rx_power)}
                                        </span>
                                    )}
                                </li>
                            ))}
                            {openAlarms.length > ALARM_ROWS && (
                                <li className="wall-sub px-1 pt-0.5">+{openAlarms.length - ALARM_ROWS}</li>
                            )}
                        </ul>
                    ) : (
                        <div className="grid h-full place-items-center">
                            <span className="wall-sub text-noc-emerald">{t.wallAllClear}</span>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Ticker Rx terlemah. Daftar dirender dua kali dan track digeser -50%,
          itu yang bikin loop-nya mulus tanpa jeda. Salinan kedua aria-hidden
          supaya screen reader tidak membaca dobel. */}
            <div className="wall-ticker">
                <span className="wall-label flex-shrink-0 text-noc-amber">{t.wallWorstRxLabel}</span>
                <div className="wall-ticker-track">
                    {[0, 1].map((copy) => (
                        <div
                            key={copy}
                            className="flex flex-shrink-0 gap-9"
                            aria-hidden={copy === 1 ? 'true' : undefined}
                        >
                            {worst.map((o) => (
                                <span key={`${copy}-${o.id}`} className="flex items-baseline gap-2 font-mono text-[clamp(0.62rem,0.8vw,0.9rem)]">
                                    <span className="text-text-secondary">{o.olt_name}</span>
                                    <span className="text-text-muted">{o.pon_label}</span>
                                    <span className="text-text-primary">{o.serial_number}</span>
                                    <span style={{ color: getRxColor(o.rx_power >= -27 ? 'warning' : o.rx_power >= -30 ? 'critical' : 'very_critical') }}>
                                        {formatDbm(o.rx_power)}
                                    </span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
