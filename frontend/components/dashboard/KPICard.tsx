'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type KPIStatus = 'online' | 'warning' | 'critical' | 'offline';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: { value: string; positive: boolean } | null;
  status?: KPIStatus;
  icon?: React.ReactNode;
}

/**
 * Status only ever swaps a single accent token (--metric-accent) — the rail,
 * corner bracket, icon chip, wash and neon bloom all read from it. Adding a
 * state later means adding a colour, not another card variant.
 */
const ACCENT_CLASS: Record<KPIStatus, string> = {
  online: 'metric-online',
  warning: 'metric-warning',
  critical: 'metric-critical',
  offline: 'metric-offline',
};

export function KPICard({ title, value, subtitle, delta, status, icon }: KPICardProps) {
  return (
    <div className={cn('metric-card group flex flex-col p-4', status && ACCENT_CLASS[status])}>
      {/* Decorative HUD layers — blueprint grid, hover sheen, corner bracket.
          Both are aria-hidden: status is already carried by the beacon's
          sibling text and the subtitle (a11y: color-not-only). */}
      <div aria-hidden="true" className="metric-grid" />
      <div aria-hidden="true" className="metric-hud" />

      {/* Content sits above the decoration layers (z-0) */}
      <div className="relative z-10 flex flex-1 flex-col gap-1.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          {/* min-w-0 so a long label truncates instead of shoving the icon
              chip out of the card at 6-up density */}
          <span className="label-caps min-w-0 truncate pt-1">{title}</span>
          <div className="flex flex-shrink-0 items-center gap-2">
            {status && (
              <div aria-hidden="true" className={cn(
                'beacon',
                status === 'online' && 'beacon-online',
                status === 'warning' && 'beacon-warning',
                status === 'critical' && 'beacon-critical',
                status === 'offline' && 'beacon-offline',
              )} />
            )}
            {icon && <span aria-hidden="true" className="metric-card-icon">{icon}</span>}
          </div>
        </div>

        {/* Value — the one element that should win the eye in this card.
            Gets the full card width so long readouts ("8.86 Gbps") stay on
            one line at 6-up. */}
        <div className="metric-display break-token">{value}</div>

        {/* Footer */}
        {(delta || subtitle) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
            {delta && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded border px-1.5 py-px font-mono text-[0.6875rem] font-semibold tabular-nums',
                delta.positive
                  ? 'border-noc-emerald/25 bg-noc-emerald/10 text-noc-emerald'
                  : 'border-noc-rose/25 bg-noc-rose/10 text-noc-rose'
              )}>
                {/* Arrow is decoration — direction is already in the colour
                    and the value text (a11y: icon-only-labels) */}
                <span aria-hidden="true">{delta.positive ? '↑' : '↓'}</span>
                {delta.value}
              </span>
            )}
            {subtitle && <span className="metric-sub truncate">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
