'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatTraffic, cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { UplinkPort, TrafficHistoryPoint } from '@/lib/mock-data';

interface Props {
  uplinks: UplinkPort[];
  history: TrafficHistoryPoint[];
  oltName: string;
}

export function OLTUplinkTrafficCard({ uplinks, history, oltName }: Props) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'24h' | '12h' | '6h'>('24h');

  const filteredHistory = React.useMemo(() => {
    if (timeRange === '6h') return history.slice(-6);
    if (timeRange === '12h') return history.slice(-12);
    return history;
  }, [history, timeRange]);

  const primaryUplink = uplinks.find(u => u.status === 'online') || uplinks[0];
  const peakThroughput = Math.max(...(history.length ? history.map(h => h.total_gbps) : [0]));

  return (
    <div className="noc-card p-5 space-y-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-noc-cyan/40 to-transparent" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="beacon beacon-online" />
            <h3 className="label-caps !text-sm text-text-primary tracking-wider">
              {t.uplinkTitle}
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {t.uplinkSubtitle} — {oltName}
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]">
            {(['6h', '12h', '24h'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  'px-2.5 py-1 text-xs font-mono rounded transition-colors',
                  timeRange === r
                    ? 'bg-noc-cyan/20 text-noc-cyan font-bold border border-noc-cyan/30'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Uplink Ports Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {uplinks.map((port) => {
          const isOnline = port.status === 'online';
          return (
            <div
              key={port.id}
              className={cn(
                'rounded-lg p-3.5 border transition-colors',
                isOnline
                  ? 'bg-surface-2/90 border-noc-cyan/20 shadow-sm'
                  : 'bg-surface-2/40 border-white/[0.05] opacity-75'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    isOnline ? 'bg-noc-emerald animate-pulse' : 'bg-text-muted'
                  )} />
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    {port.name}
                  </span>
                </div>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[0.65rem] font-mono uppercase font-bold',
                  isOnline
                    ? 'bg-noc-emerald/10 text-noc-emerald border border-noc-emerald/20'
                    : 'bg-white/[0.05] text-text-muted border border-white/[0.08]'
                )}>
                  {port.status === 'online' ? t.online : port.status === 'standby' ? t.uplinkStandby : t.offline}
                </span>
              </div>

              {/* Port spec */}
              <div className="flex items-center justify-between text-[0.7rem] font-mono text-text-muted mb-3">
                <span>{port.type}</span>
                <span className="text-noc-cyan font-semibold">{port.speed_gbps} Gbps {t.uplinkFullDuplex}</span>
              </div>

              {/* Live Throughput */}
              <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black/20 border border-white/[0.03] mb-2.5 font-mono text-xs">
                <div>
                  <span className="text-[0.65rem] text-text-muted block">{t.uplinkInbound}</span>
                  <span className="font-bold text-noc-cyan">↓ {formatTraffic(port.traffic_in_mbps)}</span>
                </div>
                <div>
                  <span className="text-[0.65rem] text-text-muted block">{t.uplinkOutbound}</span>
                  <span className="font-bold text-noc-emerald">↑ {formatTraffic(port.traffic_out_mbps)}</span>
                </div>
              </div>

              {/* Utilization progress bar */}
              <div>
                <div className="flex items-center justify-between text-[0.65rem] font-mono text-text-muted mb-1">
                  <span>{t.uplinkUtilization}</span>
                  <span className="font-bold text-text-secondary">{port.utilization_percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      port.utilization_percent > 80 ? 'bg-noc-rose' :
                        port.utilization_percent > 60 ? 'bg-noc-amber' : 'bg-noc-cyan'
                    )}
                    style={{ width: `${Math.min(port.utilization_percent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Uplink Traffic Area Chart */}
      {filteredHistory && filteredHistory.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <span className="text-text-muted">{t.uplinkChartLabel} ({oltName}):</span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-noc-cyan">↓ {t.labelDown} ({t.chartCurrent}): <strong>{((primaryUplink?.traffic_in_mbps || 0) / 1000).toFixed(2)} Gbps</strong></span>
              <span className="text-noc-emerald">↑ {t.labelUp}: <strong>{((primaryUplink?.traffic_out_mbps || 0) / 1000).toFixed(2)} Gbps</strong></span>
              <span className="text-noc-amber">{t.chartPeak24h}: <strong>{peakThroughput.toFixed(2)} Gbps</strong></span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredHistory} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="oltUplinkIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="oltUplinkOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4EDEA3" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4EDEA3" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'var(--font-jetbrains)' }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'var(--font-jetbrains)' }} axisLine={false} tickLine={false} unit=" G" domain={[0, 'auto']} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as TrafficHistoryPoint;
                    return (
                      <div className="rounded-lg border border-noc-cyan/30 bg-surface-1/95 p-2.5 shadow-xl backdrop-blur-md font-mono text-xs space-y-1 min-w-[150px]">
                        <div className="text-text-muted border-b border-white/[0.08] pb-1 font-semibold flex items-center justify-between">
                          <span>{t.chartTime}: {label}</span>
                          <span className="text-[0.6rem] text-noc-cyan">UPLINK</span>
                        </div>
                        <div className="flex items-center justify-between text-noc-cyan">
                          <span>{t.labelDown}:</span>
                          <span className="font-bold">{d.traffic_in_gbps.toFixed(2)} Gbps</span>
                        </div>
                        <div className="flex items-center justify-between text-noc-emerald">
                          <span>{t.labelUp}:</span>
                          <span className="font-bold">{d.traffic_out_gbps.toFixed(2)} Gbps</span>
                        </div>
                        <div className="flex items-center justify-between text-noc-amber pt-1 border-t border-white/[0.06] font-bold">
                          <span>{t.chartTotal}:</span>
                          <span>{d.total_gbps.toFixed(2)} Gbps</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="traffic_in_gbps" stroke="#00f2fe" strokeWidth={2} fillOpacity={1} fill="url(#oltUplinkIn)" name={t.uplinkInbound} />
                <Area type="monotone" dataKey="traffic_out_gbps" stroke="#4EDEA3" strokeWidth={1.8} fillOpacity={1} fill="url(#oltUplinkOut)" name={t.uplinkOutbound} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
