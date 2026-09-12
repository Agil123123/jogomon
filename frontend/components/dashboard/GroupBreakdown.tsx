'use client';

// ============================================================
// JOGO-MON — Group Breakdown
// Kartu ringkasan per grup site. Dipakai operator NOC buat lihat
// wilayah mana yang sedang bermasalah, lalu klik untuk fokus dasbor
// ke grup itu tanpa pindah halaman.
// ============================================================

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatTraffic } from '@/lib/utils';
import { OLT_GROUP_ALL, type OLTGroupSummary } from '@/lib/mock-data';

interface Props {
    data: OLTGroupSummary[];
    /** Grup yang sedang aktif di dasbor; `OLT_GROUP_ALL` = tidak ada. */
    selected: string;
    onSelect: (group: string) => void;
}

/** Grup dianggap bermasalah kalau ada OLT mati atau alarm kritis menumpuk —
 *  urutan pengecekan ini yang menentukan warna aksen kartu. */
function groupSeverity(g: OLTGroupSummary): 'critical' | 'warning' | 'online' {
    if (g.offline_olt > 0) return 'critical';
    if (g.active_alarms > 0 || g.low_rx_onu > 0) return 'warning';
    return 'online';
}

const SEVERITY_STYLE: Record<'critical' | 'warning' | 'online', { dot: string; value: string }> = {
    critical: { dot: 'bg-noc-rose', value: 'text-noc-rose' },
    warning: { dot: 'bg-noc-amber', value: 'text-noc-amber' },
    online: { dot: 'bg-noc-emerald', value: 'text-noc-emerald' },
};

export function GroupBreakdown({ data, selected, onSelect }: Props) {
    const { t } = useTranslation();

    if (!data.length) return null;

    return (
        <section className="noc-card p-4 sm:p-5" aria-labelledby="group-breakdown-heading">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 id="group-breakdown-heading" className="card-title">
                    {t.groupBreakdownTitle}
                </h2>
                <p className="text-[0.6875rem] text-text-muted">{t.groupBreakdownSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((g) => {
                    const severity = groupSeverity(g);
                    const style = SEVERITY_STYLE[severity];
                    const isSelected = selected === g.group;

                    return (
                        <button
                            key={g.group}
                            type="button"
                            // Klik kedua pada grup aktif melepas filter — toggle, bukan
                            // jalan satu arah, supaya operator tidak perlu cari tombol reset.
                            onClick={() => onSelect(isSelected ? OLT_GROUP_ALL : g.group)}
                            aria-pressed={isSelected}
                            className={`group rounded-lg border p-3.5 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noc-cyan ${isSelected
                                ? 'border-noc-cyan/40 bg-noc-cyan/[0.07]'
                                : 'border-white/[0.06] bg-surface-2 hover:border-noc-cyan/20 hover:bg-white/[0.03]'
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span aria-hidden="true" className={`h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
                                    <span className="truncate text-sm font-semibold text-text-primary">{g.group}</span>
                                </span>
                                <span className="flex-shrink-0 font-mono text-[0.6875rem] text-text-muted">
                                    {g.total_olt} {t.groupDeviceCount}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <div>
                                    <span className="label-caps block text-text-muted">{t.colOnuTotal}</span>
                                    <span className="font-mono text-sm text-text-primary">
                                        {g.online_onu}
                                        <span className="text-text-muted">/{g.total_onu}</span>
                                    </span>
                                </div>
                                <div>
                                    <span className="label-caps block text-text-muted">{t.colAlarms}</span>
                                    {/* Angka alarm 0 tetap netral; hanya yang >0 diberi warna severity
                                        supaya kartu sehat tidak ikut "berteriak". */}
                                    <span
                                        className={`font-mono text-sm ${g.active_alarms > 0 ? style.value : 'text-text-primary'}`}
                                    >
                                        {g.active_alarms}
                                    </span>
                                </div>
                                <div>
                                    <span className="label-caps block text-text-muted">{t.colTraffic}</span>
                                    <span className="font-mono text-sm text-text-primary">
                                        {formatTraffic(g.traffic_in_mbps + g.traffic_out_mbps)}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
