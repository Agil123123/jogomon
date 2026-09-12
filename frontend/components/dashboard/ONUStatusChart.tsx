'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from '@/lib/i18n';
import type { OpticalSummary } from '@/lib/mock-data';

interface Props {
  data: OpticalSummary;
}

/** Glass tooltip, matched to the Rx distribution panel beside it. */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(9,22,38,0.94)',
  border: '1px solid rgba(0,242,254,0.28)',
  borderRadius: '0.375rem',
  boxShadow: '0 18px 40px -22px rgba(0,242,254,0.55)',
  backdropFilter: 'blur(10px)',
  padding: '0.5rem 0.625rem',
};

export function ONUStatusChart({ data }: Props) {
  const { t } = useTranslation();

  const statusData = [
    { key: 'normal', label: t.normal, color: '#4EDEA3' },
    { key: 'warning', label: t.warning, color: '#F59E0B' },
    { key: 'critical', label: t.critical, color: '#F43F5E' },
    { key: 'very_critical', label: t.veryCritical, color: '#dc2626' },
  ];

  const chartData = statusData.map((s) => ({
    key: s.key,
    name: s.label,
    value: data[s.key as keyof OpticalSummary],
    color: s.color,
  }));

  const total = chartData.reduce((a, d) => a + d.value, 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const healthyPct = pct(data.normal);

  // The donut's arcs aren't reachable as text, so the composition is restated
  // once for assistive tech (a11y: chart-alt-text).
  const summary = `${t.opticalHealthTitle} — ${chartData
    .map((d) => `${d.name}: ${d.value} (${pct(d.value).toFixed(1)}%)`)
    .join(', ')}`;

  return (
    <div className="chart-card p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="section-title">{t.opticalHealthTitle}</h3>
          <p className="section-subtitle">{t.opticalHealthSubtitle}</p>
        </div>
        {/* Headline health read — colour follows the same thresholds as the KPI tiles */}
        <span
          className="chart-chip chart-chip-accent flex-shrink-0"
          style={{
            color: healthyPct >= 90 ? '#4EDEA3' : healthyPct >= 75 ? '#F59E0B' : '#F43F5E',
          }}
        >
          {healthyPct.toFixed(1)}%
          <span className="font-normal opacity-80">{t.labelHealthy}</span>
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Donut + HUD chrome */}
        <div
          className="chart-plot h-[184px] w-[184px] relative flex-shrink-0 grid place-items-center"
          role="img"
          aria-label={summary}
        >
          {/* Decorative rings sit under the arcs; they encode nothing */}
          <div className="chart-ring-gauge" aria-hidden="true" />
          <div className="chart-ring-track" aria-hidden="true" />
          <div className="chart-ring-core" aria-hidden="true" />

          <div className="absolute inset-0 z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {chartData.map((entry) => (
                    <linearGradient
                      key={entry.key}
                      id={`onu-grad-${entry.key}`}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.45} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={`url(#onu-grad-${entry.key})`}
                      stroke={entry.color}
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{
                    color: '#d4e4fa',
                    fontFamily: 'var(--font-jetbrains)',
                    fontSize: '0.75rem',
                    padding: 0,
                  }}
                  formatter={(value, name) =>
                    [`${value} (${pct(value as number).toFixed(1)}%)`, name as string] as [string, string]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Centre readout — pointer-events-none so it never eats arc hovers */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-[1.75rem] leading-8 font-bold tracking-tight text-text-primary metric-glow">
              {total}
            </span>
            <span className="label-caps text-[0.55rem] text-text-muted">{t.totalSubscribers}</span>
          </div>
        </div>

        {/* Legend — each row doubles as a share meter */}
        <ul className="flex flex-col gap-2.5 flex-1 w-full min-w-0 list-none">
          {chartData.map((item) => (
            <li key={item.key} style={{ color: item.color }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-3.5 rounded-sm flex-shrink-0"
                    style={{
                      background: 'currentColor',
                      boxShadow: '0 0 8px color-mix(in srgb, currentColor 60%, transparent)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-text-secondary truncate">{item.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-shrink-0">
                  <span className="font-mono text-xs font-semibold text-text-primary tabular-nums">
                    {item.value}
                  </span>
                  <span className="font-mono text-[0.625rem] text-text-muted tabular-nums">
                    {pct(item.value).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="chart-legend-track">
                <div className="chart-legend-fill" style={{ width: `${pct(item.value)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
