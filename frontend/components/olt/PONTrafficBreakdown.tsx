'use client';

import React from 'react';
import { formatTraffic, cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { PONDetail } from '@/lib/mock-data';

interface Props {
  pons: PONDetail[];
}

export function PONTrafficBreakdown({ pons }: Props) {
  const { t } = useTranslation();

  // GPON standard capacity: 2488.32 Mbps Downstream, 1244.16 Mbps Upstream
  const GPON_DOWN_CAPACITY = 2488;
  const GPON_UP_CAPACITY = 1244;

  const totalPonTrafficIn = pons.reduce((a, p) => a + (p.traffic_in_mbps || 0), 0);
  const totalPonTrafficOut = pons.reduce((a, p) => a + (p.traffic_out_mbps || 0), 0);

  return (
    <div className="noc-card p-5 space-y-4 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-noc-cyan" />
            <h3 className="label-caps !text-sm text-text-primary tracking-wider">
              {t.ponTrafficTitle}
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {t.ponTrafficSubtitle}
          </p>
        </div>

        {/* Agregat PON */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1 rounded bg-noc-cyan/10 border border-noc-cyan/20">
            <span className="text-text-muted">{t.ponTotalDown}: </span>
            <span className="font-bold text-noc-cyan">↓ {formatTraffic(totalPonTrafficIn)}</span>
          </div>
          <div className="px-3 py-1 rounded bg-noc-emerald/10 border border-noc-emerald/20">
            <span className="text-text-muted">{t.ponTotalUp}: </span>
            <span className="font-bold text-noc-emerald">↑ {formatTraffic(totalPonTrafficOut)}</span>
          </div>
        </div>
      </div>

      {/* PON Ports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {pons.map((pon) => {
          const inMbps = pon.traffic_in_mbps || 0;
          const outMbps = pon.traffic_out_mbps || 0;
          const downUtil = parseFloat(((inMbps / GPON_DOWN_CAPACITY) * 100).toFixed(1));
          const upUtil = parseFloat(((outMbps / GPON_UP_CAPACITY) * 100).toFixed(1));

          return (
            <div
              key={pon.id}
              className="p-3.5 rounded-lg bg-surface-2/60 border border-white/[0.06] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-noc-cyan">
                  PON {pon.slot}/{pon.port}
                </span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[0.6rem] font-mono uppercase font-semibold',
                  pon.status === 'online' ? 'bg-noc-emerald/10 text-noc-emerald' : 'bg-noc-rose/10 text-noc-rose'
                )}>
                  {pon.status}
                </span>
              </div>

              {/* ONU Count */}
              <div className="flex items-center justify-between text-[0.7rem] font-mono text-text-muted">
                <span>{t.ponActiveSubscribers}:</span>
                <span className="text-text-primary font-bold">
                  {pon.online_onu} / {pon.total_onu} ONU
                </span>
              </div>

              {/* Inbound / Downstream */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[0.65rem] font-mono">
                  <span className="text-text-muted">{t.labelDown}:</span>
                  <span className="text-noc-cyan font-bold">↓ {formatTraffic(inMbps)} ({downUtil}%)</span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      downUtil > 80 ? 'bg-noc-rose' : downUtil > 60 ? 'bg-noc-amber' : 'bg-noc-cyan'
                    )}
                    style={{ width: `${Math.min(downUtil, 100)}%` }}
                  />
                </div>
              </div>

              {/* Outbound / Upstream */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[0.65rem] font-mono">
                  <span className="text-text-muted">{t.labelUp}:</span>
                  <span className="text-noc-emerald font-bold">↑ {formatTraffic(outMbps)} ({upUtil}%)</span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      upUtil > 80 ? 'bg-noc-rose' : upUtil > 60 ? 'bg-noc-amber' : 'bg-noc-emerald'
                    )}
                    style={{ width: `${Math.min(upUtil, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
