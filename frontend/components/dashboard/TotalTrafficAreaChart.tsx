'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from '@/lib/i18n';
import type { TrafficHistoryPoint } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface Props {
  data: TrafficHistoryPoint[];
  currentInGbps?: number;
  currentOutGbps?: number;
}

export function TotalTrafficAreaChart({ data, currentInGbps = 8.86, currentOutGbps = 2.55 }: Props) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'24h' | '12h' | '6h'>('24h');

  // Filter based on range
  const filteredData = React.useMemo(() => {
    if (timeRange === '6h') return data.slice(-6);
    if (timeRange === '12h') return data.slice(-12);
    return data;
  }, [data, timeRange]);

  // Calculate stats
  const peakTotal = Math.max(...data.map(d => d.total_gbps));
  const currentTotal = currentInGbps + currentOutGbps;

  return (
    <div className="noc-card p-5 relative overflow-hidden">
      {/* Top subtle glow banner */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-noc-cyan/40 to-transparent" />

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="beacon beacon-online" />
            <h3 className="section-title">
              {t.kpiTotalTraffic} — {t.chartRealtime}
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {t.kpiTrafficSubtitle} — {t.chartLast24h}
          </p>
        </div>

        {/* Quick summary badges + Range Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Inbound */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-noc-cyan/10 border border-noc-cyan/20 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-noc-cyan animate-pulse" />
            <span className="text-text-muted">{t.trafficDownload}:</span>
            <span className="font-bold text-noc-cyan">{currentInGbps.toFixed(2)} Gbps</span>
          </div>

          {/* Live Outbound */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-noc-emerald/10 border border-noc-emerald/20 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-noc-emerald" />
            <span className="text-text-muted">{t.trafficUpload}:</span>
            <span className="font-bold text-noc-emerald">{currentOutGbps.toFixed(2)} Gbps</span>
          </div>

          {/* Peak Total */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] font-mono text-xs">
            <span className="text-text-muted">{t.metricTrafficPeak}:</span>
            <span className="font-bold text-noc-amber">{peakTotal.toFixed(2)} Gbps</span>
          </div>

          {/* Time range selector */}
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

      {/* Area Chart Container */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              {/* Cyan gradient for Download / Inbound */}
              <linearGradient id="colorTrafficIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
              </linearGradient>

              {/* Emerald gradient for Upload / Outbound */}
              <linearGradient id="colorTrafficOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4EDEA3" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4EDEA3" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.06)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}
              axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
              tickLine={false}
            />

            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}
              axisLine={false}
              tickLine={false}
              unit=" G"
              domain={[0, 'auto']}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as TrafficHistoryPoint;
                return (
                  <div className="rounded-lg border border-noc-cyan/30 bg-surface-1/95 p-3 shadow-xl backdrop-blur-md font-mono text-xs space-y-1.5 min-w-[170px]">
                    <div className="text-text-muted border-b border-white/[0.08] pb-1 font-semibold flex items-center justify-between">
                      <span>{t.chartTime}: {label}</span>
                      <span className="text-[0.65rem] text-noc-cyan">WIB</span>
                    </div>
                    <div className="flex items-center justify-between text-noc-cyan">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-noc-cyan" />
                        <span>{t.trafficDownload}:</span>
                      </span>
                      <span className="font-bold">{d.traffic_in_gbps.toFixed(2)} Gbps</span>
                    </div>
                    <div className="flex items-center justify-between text-noc-emerald">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-noc-emerald" />
                        <span>{t.trafficUpload}:</span>
                      </span>
                      <span className="font-bold">{d.traffic_out_gbps.toFixed(2)} Gbps</span>
                    </div>
                    <div className="flex items-center justify-between text-text-primary pt-1 border-t border-white/[0.06] font-bold">
                      <span>{t.chartTotal}:</span>
                      <span className="text-noc-amber">{d.total_gbps.toFixed(2)} Gbps</span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Inbound Area (Cyan) */}
            <Area
              type="monotone"
              dataKey="traffic_in_gbps"
              stroke="#00f2fe"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorTrafficIn)"
              name={t.trafficDownload}
            />

            {/* Outbound Area (Emerald) */}
            <Area
              type="monotone"
              dataKey="traffic_out_gbps"
              stroke="#4EDEA3"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTrafficOut)"
              name={t.trafficUpload}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Footnote */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.04] text-xs font-mono text-text-muted">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded bg-noc-cyan" />
            <span>{t.trafficDownload} ({t.labelDown})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded bg-noc-emerald" />
            <span>{t.trafficUpload} ({t.labelUp})</span>
          </div>
        </div>
        <div>
          <span>{t.chartAggregateAll}: <strong className="text-text-primary">{currentTotal.toFixed(2)} Gbps</strong></span>
        </div>
      </div>
    </div>
  );
}
