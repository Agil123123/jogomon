'use client';

import React from 'react';
import { formatDbm, classifyRxPower, getRxColor, formatTraffic, cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { WorstONU } from '@/lib/mock-data';

interface Props {
  data: WorstONU[];
}

export function WorstONUList({ data }: Props) {
  const { t } = useTranslation();

  return (
    <div className="noc-card overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-noc-rose animate-pulse" />
          <h3 className="section-title">{t.worstOnuTitle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-mono text-[0.65rem] px-2 py-0.5 rounded bg-noc-rose/10 text-noc-rose border border-noc-rose/20">
            {t.worstOnuBadge}
          </span>
          <span className="font-mono text-xs text-text-muted">Top {data.length}</span>
        </div>
      </div>

      {/* Subtitle / Description */}
      <div className="px-4 py-1.5 bg-white/[0.01] border-b border-white/[0.03] text-[0.68rem] text-text-muted">
        {t.worstOnuSubtitle}
      </div>

      {/* List */}
      <div className="divide-y divide-white/[0.04]">
        {data.map((onu, idx) => {
          const classification = classifyRxPower(onu.rx_power);
          const color = getRxColor(classification);
          return (
            <div
              key={onu.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]',
                classification === 'very_critical' && 'border-l-2 border-noc-red-deep bg-noc-rose/[0.02]',
                classification === 'critical' && 'border-l-2 border-noc-rose',
              )}
            >
              {/* Rank */}
              <span className="font-mono text-xs text-text-muted w-5 text-right font-bold">
                {idx + 1}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-primary font-medium truncate">
                    {onu.serial_number}
                  </span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase font-mono',
                    onu.status === 'online' ? 'bg-noc-emerald/10 text-noc-emerald' : 'bg-noc-rose/10 text-noc-rose'
                  )}>
                    {onu.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="font-mono text-[0.65rem] text-noc-cyan">{onu.olt_name}</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">PON {onu.pon_label}</span>
                  {/* Traffic indicator per ONU */}
                  <span className="font-mono text-[0.65rem] text-text-secondary bg-white/[0.03] px-1.5 py-0.2 rounded">
                    ↓ {formatTraffic(onu.traffic_in_mbps)} &nbsp;↑ {formatTraffic(onu.traffic_out_mbps)}
                  </span>
                </div>
              </div>

              {/* Rx Power */}
              <div className="text-right">
                <span
                  className="font-mono text-sm font-bold whitespace-nowrap block"
                  style={{ color }}
                >
                  {formatDbm(onu.rx_power)}
                </span>
                <span className="font-mono text-[0.6rem] text-text-muted uppercase">
                  {classification === 'very_critical' ? t.veryCritical : classification === 'critical' ? t.critical : t.warning}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
