'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LabelList, ReferenceLine,
} from 'recharts';
import { useTranslation } from '@/lib/i18n';
import type { RxDistribution } from '@/lib/mock-data';

const COLORS: Record<string, string> = {
  normal: '#4EDEA3',
  warning: '#F59E0B',
  critical: '#F43F5E',
  very_critical: '#dc2626',
};

/** Glass tooltip, shared with the donut panel next to it. */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(9,22,38,0.94)',
  border: '1px solid rgba(0,242,254,0.28)',
  borderRadius: '0.375rem',
  boxShadow: '0 18px 40px -22px rgba(0,242,254,0.55)',
  backdropFilter: 'blur(10px)',
  padding: '0.5rem 0.625rem',
};

interface Props {
  data: RxDistribution[];
}

export function RxDistributionChart({ data }: Props) {
  const { t } = useTranslation();

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const degraded = data
    .filter((d) => d.classification !== 'normal')
    .reduce((sum, d) => sum + d.count, 0);

  // Threshold marker is derived, not hardcoded to a range string: the first
  // non-normal bucket is where the −25 dBm safe limit is crossed, whatever
  // the backend labels it.
  const thresholdRange = data.find((d) => d.classification !== 'normal')?.range;

  // Bars carry numbers that exist nowhere else on screen, so the plot gets one
  // summarised label instead of 8 unreachable SVG rects (a11y: chart-alt-text).
  const summary = `${t.rxDistributionTitle} — ${data
    .map((d) => `${d.range} dBm: ${d.count}`)
    .join(', ')}`;

  return (
    <div className="chart-card p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="section-title">{t.rxDistributionTitle}</h3>
          <p className="section-subtitle">{t.rxDistributionSubtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="chart-chip text-text-secondary">
            {total}
            <span className="text-text-muted font-normal">{t.rxMeasuredOnu}</span>
          </span>
          <span
            className="chart-chip chart-chip-accent"
            style={{ color: degraded > 0 ? COLORS.warning : COLORS.normal }}
          >
            {degraded}
            <span className="font-normal opacity-80">{t.chartDegraded}</span>
          </span>
        </div>
      </div>

      <div className="chart-plot h-64" role="img" aria-label={summary}>
        <div className="relative z-10 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 18, right: 8, bottom: 8, left: -10 }}>
              <defs>
                {Object.entries(COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`rx-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                    <stop offset="55%" stopColor={color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.08} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.08)" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fill: '#7D8FA9', fontSize: 10, fontFamily: 'var(--font-jetbrains)' }}
                axisLine={{ stroke: 'rgba(0,242,254,0.18)' }}
                tickLine={false}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: '#7D8FA9', fontSize: 10, fontFamily: 'var(--font-jetbrains)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{
                  color: '#00F2FE',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '0.25rem',
                }}
                itemStyle={{
                  color: '#d4e4fa',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
                formatter={(value) => [value as number, t.rxBucketOnu] as [number, string]}
                labelFormatter={(label) => `${label} dBm`}
                cursor={{ fill: 'rgba(0,242,254,0.06)' }}
              />

              {/* Safe-limit divider — the amber run to its right is the action zone */}
              {thresholdRange && (
                <ReferenceLine
                  x={thresholdRange}
                  stroke="rgba(245,158,11,0.5)"
                  strokeDasharray="4 4"
                  label={{
                    value: t.rxThresholdLine,
                    position: 'insideTopRight',
                    fill: '#F59E0B',
                    fontSize: 9,
                    fontFamily: 'var(--font-jetbrains)',
                  }}
                />
              )}

              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {data.map((entry, index) => {
                  const key = entry.classification in COLORS ? entry.classification : 'normal';
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#rx-grad-${key})`}
                      stroke={COLORS[key]}
                      strokeOpacity={0.55}
                    />
                  );
                })}
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={8}
                  fill="#7D8FA9"
                  fontSize={10}
                  fontFamily="var(--font-jetbrains)"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
