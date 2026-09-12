'use client';

// ============================================================
// JOGO-MON — Group Scope Select
// Pemilih scope grup site (kabupaten) untuk dasbor NOC.
// Satu kontrol ini yang menentukan semua agregat di halaman:
// KPI, chart, tabel armada, feed alarm, dan worst-ONU.
// ============================================================

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { OLT_GROUP_ALL } from '@/lib/mock-data';

interface Props {
    /** Grup terpilih; `OLT_GROUP_ALL` berarti fleet-wide. */
    value: string;
    groups: string[];
    onChange: (group: string) => void;
    /** Jumlah OLT dalam scope aktif — konfirmasi visual bahwa filter kepakai. */
    deviceCount?: number;
}

export function GroupScopeSelect({ value, groups, onChange, deviceCount }: Props) {
    const { t } = useTranslation();
    const selectId = 'group-scope-select';

    return (
        <div className="flex flex-shrink-0 items-center gap-2.5">
            {/* Label pakai <label htmlFor> bukan placeholder-option, biar SR user
          tetap tahu kontrol ini soal apa saat sudah ada nilai terpilih. */}
            <label htmlFor={selectId} className="label-caps whitespace-nowrap text-text-muted">
                {t.groupScopeLabel}
            </label>

            <div className="flex items-center gap-2">
                <select
                    id={selectId}
                    className="noc-select w-auto min-w-[13rem] font-mono"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value={OLT_GROUP_ALL}>{t.groupScopeAllOption}</option>
                    {groups.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>

                {/* Hitungan perangkat: teks, bukan cuma warna, supaya scope aktif
            terbaca tanpa bergantung pada persepsi warna (a11y: color-not-only) */}
                {typeof deviceCount === 'number' && (
                    <span className="hidden whitespace-nowrap rounded-md border border-white/[0.06] bg-surface-2 px-2 py-1 font-mono text-[0.6875rem] text-text-secondary sm:inline">
                        {deviceCount} {t.groupDeviceCount}
                    </span>
                )}
            </div>
        </div>
    );
}
