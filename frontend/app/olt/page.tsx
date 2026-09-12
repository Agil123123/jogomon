'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { fetchOLTList } from '@/lib/api';
import {
    cn,
    timeAgo,
    getBeaconClass,
    formatPercent,
    formatTemp,
    formatTraffic,
    formatUptime,
} from '@/lib/utils';
import { OLT_GROUP_ALL } from '@/lib/mock-data';
import type { OLTSummary } from '@/lib/mock-data';

type StatusFilter = 'all' | 'online' | 'offline';
type SortKey = 'status' | 'name' | 'onu' | 'traffic' | 'alarms';

const STATUS_FILTERS: StatusFilter[] = ['all', 'online', 'offline'];
const SORT_KEYS: SortKey[] = ['status', 'name', 'onu', 'traffic', 'alarms'];

const VENDOR_ALL = '__all__';

/** Total throughput of one device — the sort key operators actually mean by "busiest". */
function totalTraffic(olt: OLTSummary): number {
    return (olt.traffic_in_mbps || 0) + (olt.traffic_out_mbps || 0);
}

export default function OLTInventoryPage() {
    const { isAuthenticated, hydrate } = useAuthStore();
    const { t } = useTranslation();
    const router = useRouter();

    const [olts, setOlts] = useState<OLTSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [vendorFilter, setVendorFilter] = useState<string>(VENDOR_ALL);
    const [groupFilter, setGroupFilter] = useState<string>(OLT_GROUP_ALL);
    const [sortKey, setSortKey] = useState<SortKey>('status');

    useEffect(() => { hydrate(); }, [hydrate]);

    useEffect(() => {
        if (!isAuthenticated) { router.push('/login'); return; }

        async function loadData() {
            try {
                setOlts(await fetchOLTList());
            } catch (error) {
                console.error('Failed to load OLT inventory:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [isAuthenticated, router]);

    // Vendor list is derived, not hardcoded — a new vendor shows up in the filter
    // the moment the first device of that brand is provisioned.
    const vendors = useMemo(
        () => Array.from(new Set(olts.map((o) => o.vendor))).sort((a, b) => a.localeCompare(b)),
        [olts]
    );

    // Same derivation for site groups — the inventory is the source of truth for
    // which regions exist, so no static kabupaten list to keep in sync.
    const groups = useMemo(
        () => Array.from(new Set(olts.map((o) => o.group))).sort((a, b) => a.localeCompare(b)),
        [olts]
    );

    const fleetStats = useMemo(() => {
        const online = olts.filter((o) => o.status === 'online').length;
        return {
            total: olts.length,
            online,
            offline: olts.length - online,
            totalOnu: olts.reduce((sum, o) => sum + o.total_onu, 0),
            onlineOnu: olts.reduce((sum, o) => sum + o.online_onu, 0),
            lowRxOnu: olts.reduce((sum, o) => sum + o.low_rx_onu, 0),
            traffic: olts.reduce((sum, o) => sum + totalTraffic(o), 0),
            alarms: olts.reduce((sum, o) => sum + o.active_alarms, 0),
        };
    }, [olts]);

    const visibleOlts = useMemo(() => {
        const needle = query.trim().toLowerCase();

        const filtered = olts.filter((olt) => {
            if (statusFilter !== 'all' && olt.status !== statusFilter) return false;
            if (vendorFilter !== VENDOR_ALL && olt.vendor !== vendorFilter) return false;
            if (groupFilter !== OLT_GROUP_ALL && olt.group !== groupFilter) return false;
            if (!needle) return true;
            // One box covers the identifiers a NOC operator actually types:
            // site name, brand, region, and the management IP.
            return (
                olt.name.toLowerCase().includes(needle) ||
                olt.vendor.toLowerCase().includes(needle) ||
                olt.group.toLowerCase().includes(needle) ||
                olt.ip_address.toLowerCase().includes(needle)
            );
        });

        const sorted = [...filtered];
        switch (sortKey) {
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'onu':
                sorted.sort((a, b) => b.total_onu - a.total_onu);
                break;
            case 'traffic':
                sorted.sort((a, b) => totalTraffic(b) - totalTraffic(a));
                break;
            case 'alarms':
                sorted.sort((a, b) => b.active_alarms - a.active_alarms);
                break;
            case 'status':
            default:
                // Trouble first: offline devices float to the top, then the noisiest.
                sorted.sort((a, b) => {
                    const rank = (o: OLTSummary) => (o.status === 'offline' ? 0 : o.status === 'unknown' ? 1 : 2);
                    return rank(a) - rank(b) || b.active_alarms - a.active_alarms || a.name.localeCompare(b.name);
                });
                break;
        }
        return sorted;
    }, [olts, query, statusFilter, vendorFilter, groupFilter, sortKey]);

    const filtersDirty =
        query.trim() !== '' ||
        statusFilter !== 'all' ||
        vendorFilter !== VENDOR_ALL ||
        groupFilter !== OLT_GROUP_ALL;

    const resetFilters = () => {
        setQuery('');
        setStatusFilter('all');
        setVendorFilter(VENDOR_ALL);
        setGroupFilter(OLT_GROUP_ALL);
    };

    const sortLabel = (key: SortKey): string => {
        switch (key) {
            case 'status': return t.colStatus;
            case 'name': return t.colOltName;
            case 'onu': return t.colOnuTotal;
            case 'traffic': return t.colTraffic;
            case 'alarms': return t.colAlarms;
        }
    };

    const statusLabel = (key: StatusFilter): string =>
        key === 'all' ? t.tabAll : key === 'online' ? t.online : t.offline;

    if (!isAuthenticated) return null;

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-full min-h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-noc-cyan/30 border-t-noc-cyan" />
                        <span className="label-caps text-text-muted">{t.loadingTelemetry}</span>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="space-y-5 sm:space-y-7">
                {/* Page header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="page-title">{t.oltPageTitle}</h1>
                        <p className="page-subtitle">{t.oltPageSubtitle}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2" role="status">
                        <span className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-surface-2 px-3 py-1 font-mono text-[0.6875rem] font-medium tracking-wide text-text-secondary">
                            <span aria-hidden="true" className={getBeaconClass(fleetStats.offline > 0 ? 'warning' : 'online')} />
                            <span>{fleetStats.online}/{fleetStats.total} OLT {t.online}</span>
                        </span>
                    </div>
                </div>

                {/* Fleet-wide roll-up — same numbers the dashboard shows, scoped to devices */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KPICard
                        title={t.kpiTotalOlt}
                        value={fleetStats.total}
                        subtitle={`${fleetStats.online} ${t.online} · ${fleetStats.offline} ${t.offline}`}
                        status={fleetStats.offline > 0 ? 'warning' : 'online'}
                        icon={
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" /></svg>
                        }
                    />
                    <KPICard
                        title={t.kpiTotalOnu}
                        value={fleetStats.totalOnu}
                        subtitle={`${fleetStats.onlineOnu} ${t.online}`}
                        status="online"
                        icon={
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" /></svg>
                        }
                    />
                    <KPICard
                        title={t.kpiTotalTraffic}
                        value={formatTraffic(fleetStats.traffic)}
                        subtitle={t.chartAggregateAll}
                        status="online"
                        icon={
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                        }
                    />
                    <KPICard
                        title={t.kpiActiveAlarms}
                        value={fleetStats.alarms}
                        subtitle={`${fleetStats.lowRxOnu} ONU ${t.chartDegraded}`}
                        status={fleetStats.alarms > 5 ? 'critical' : fleetStats.alarms > 0 ? 'warning' : 'online'}
                        icon={
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        }
                    />
                </div>

                {/* Filter bar */}
                <div className="noc-card space-y-4 p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                        {/* Search — visible label, not a placeholder-only field
                (forms: label-visibility) */}
                        <div>
                            <label htmlFor="olt-search" className="label-caps mb-1.5 block">
                                {t.oltSearchLabel}
                            </label>
                            <input
                                id="olt-search"
                                type="search"
                                className="noc-input"
                                placeholder={t.oltSearchPlaceholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>

                        <div className="md:w-44">
                            <label htmlFor="olt-group" className="label-caps mb-1.5 block">
                                {t.oltFilterGroup}
                            </label>
                            <select
                                id="olt-group"
                                className="noc-select font-mono"
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                            >
                                <option value={OLT_GROUP_ALL}>{t.oltGroupAll}</option>
                                {groups.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:w-44">
                            <label htmlFor="olt-vendor" className="label-caps mb-1.5 block">
                                {t.oltFilterVendor}
                            </label>
                            <select
                                id="olt-vendor"
                                className="noc-select font-mono"
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                            >
                                <option value={VENDOR_ALL}>{t.oltVendorAll}</option>
                                {vendors.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:w-44">
                            <label htmlFor="olt-sort" className="label-caps mb-1.5 block">
                                {t.oltSortBy}
                            </label>
                            <select
                                id="olt-sort"
                                className="noc-select"
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value as SortKey)}
                            >
                                {SORT_KEYS.map((key) => (
                                    <option key={key} value={key}>{sortLabel(key)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <span className="label-caps mb-2 block">{t.oltFilterStatus}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {STATUS_FILTERS.map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setStatusFilter(f)}
                                        // aria-pressed so the "on" chip is announced, not just tinted
                                        // (a11y: color-not-only)
                                        aria-pressed={statusFilter === f}
                                        className={cn('filter-chip', statusFilter === f && 'filter-chip-active')}
                                    >
                                        {statusLabel(f)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filtersDirty && (
                            <button type="button" onClick={resetFilters} className="btn-secondary !h-8 !text-xs">
                                {t.oltResetFilters}
                            </button>
                        )}
                    </div>
                </div>

                {/* Inventory table */}
                <div className="noc-card overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <div aria-hidden="true" className="beacon beacon-online" />
                            <h2 className="section-title truncate">{t.oltInventoryTitle}</h2>
                        </div>
                        {/* Result count is live: filtering is a silent change otherwise */}
                        <span aria-live="polite" className="flex-shrink-0 font-mono text-xs text-text-muted">
                            {visibleOlts.length} {t.oltShownOfTotal} {olts.length}
                        </span>
                    </div>

                    {visibleOlts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="16.5" y1="16.5" x2="21" y2="21" />
                            </svg>
                            <span className="label-caps text-text-muted">{t.oltNoMatch}</span>
                            <p className="max-w-xs text-xs text-text-muted">{t.oltNoMatchHint}</p>
                            {filtersDirty && (
                                <button type="button" onClick={resetFilters} className="btn-secondary !h-8 !text-xs">
                                    {t.oltResetFilters}
                                </button>
                            )}
                        </div>
                    ) : (
                        // Keyboard users need to be able to reach the horizontal scroll of a
                        // wide table, hence the focusable region (a11y: scrollable-focus)
                        <div
                            className="overflow-x-auto"
                            role="region"
                            aria-label={t.oltInventoryTitle}
                            tabIndex={0}
                        >
                            <table className="noc-table">
                                <thead>
                                    <tr>
                                        <th scope="col">{t.colStatus}</th>
                                        <th scope="col">{t.colOltName}</th>
                                        <th scope="col">{t.colGroup}</th>
                                        <th scope="col">{t.colIp}</th>
                                        <th scope="col">{t.colPon}</th>
                                        <th scope="col">{t.colOnuTotal}</th>
                                        <th scope="col">{t.colPonLowRx}</th>
                                        <th scope="col">{t.colTraffic}</th>
                                        <th scope="col">{t.colCpuRam}</th>
                                        <th scope="col">{t.colTemp}</th>
                                        <th scope="col">{t.colUptime}</th>
                                        <th scope="col">{t.colAlarms}</th>
                                        <th scope="col">{t.colLastPoll}</th>
                                        <th scope="col" className="text-right">{t.colAction}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleOlts.map((olt) => (
                                        <tr
                                            key={olt.id}
                                            className={cn(
                                                'transition-colors',
                                                // An unreachable OLT is the highest-value row on the page:
                                                // give it a rail so it reads at a glance, not just a badge.
                                                olt.status === 'offline' && 'border-l-2 border-noc-rose bg-noc-rose/[0.03]'
                                            )}
                                        >
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div aria-hidden="true" className={getBeaconClass(olt.status)} />
                                                    <span className="font-mono text-xs capitalize text-text-secondary">
                                                        {olt.status === 'online' ? t.online : olt.status === 'offline' ? t.offline : t.unknown}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <Link href={`/olt/${olt.id}`} className="font-semibold text-noc-cyan hover:underline">
                                                    {olt.name}
                                                </Link>
                                            </td>
                                            <td className="font-mono text-xs text-text-secondary">
                                                {olt.group || t.oltGroupUngrouped}
                                            </td>
                                            <td className="font-mono text-xs text-text-secondary">{olt.ip_address}</td>
                                            <td className="font-mono text-xs text-text-secondary">{olt.pon_count}</td>
                                            <td>
                                                <span className="font-semibold text-noc-emerald">{olt.online_onu}</span>
                                                <span className="text-text-muted"> / {olt.total_onu}</span>
                                                {olt.offline_onu > 0 && (
                                                    <span className="ml-2 font-mono text-[0.65rem] text-noc-rose">
                                                        ({olt.offline_onu} off)
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {olt.low_rx_onu > 0 ? (
                                                    <span className="font-mono text-xs font-semibold text-noc-amber">{olt.low_rx_onu}</span>
                                                ) : (
                                                    <span className="font-mono text-xs text-text-muted">0</span>
                                                )}
                                            </td>
                                            <td>
                                                {olt.status === 'online' ? (
                                                    <div className="font-mono text-xs">
                                                        <span className="font-medium text-noc-cyan">↓ {formatTraffic(olt.traffic_in_mbps)}</span>
                                                        <span className="mx-1.5 text-text-muted">|</span>
                                                        <span className="text-text-secondary">↑ {formatTraffic(olt.traffic_out_mbps)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-xs text-text-muted">—</span>
                                                )}
                                            </td>
                                            <td className="font-mono text-xs text-text-secondary">
                                                {olt.cpu_usage !== null
                                                    ? `${formatPercent(olt.cpu_usage)} / ${formatPercent(olt.memory_usage)}`
                                                    : '—'}
                                            </td>
                                            <td className="font-mono text-xs text-text-secondary">{formatTemp(olt.temperature)}</td>
                                            <td className="font-mono text-xs text-text-secondary">{formatUptime(olt.uptime)}</td>
                                            <td>
                                                {olt.active_alarms > 0 ? (
                                                    <span className="badge-critical">{olt.active_alarms}</span>
                                                ) : (
                                                    <span className="font-mono text-xs text-text-muted">—</span>
                                                )}
                                            </td>
                                            <td className="font-mono text-xs text-text-muted">{timeAgo(olt.last_poll)}</td>
                                            <td className="text-right">
                                                <Link href={`/olt/${olt.id}`} className="btn-ghost px-2.5 py-1 text-xs text-noc-cyan">
                                                    {t.btnDetail} →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
