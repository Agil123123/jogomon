'use client';

import React from 'react';
import Link from 'next/link';
import { cn, timeAgo, getBadgeClass } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { Alarm } from '@/lib/mock-data';

interface Props {
  data: Alarm[];
  maxItems?: number;
}

export function AlarmFeed({ data, maxItems = 8 }: Props) {
  const { t } = useTranslation();
  const items = data
    .filter(a => a.status !== 'closed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  return (
    <div className="noc-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="beacon beacon-critical" />
          <h3 className="section-title">{t.alarmFeedTitle}</h3>
        </div>
        <Link href="/alarms" className="font-mono text-[0.65rem] text-noc-cyan hover:underline uppercase tracking-wider">
          {t.tabAll} →
        </Link>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <span className="label-caps text-text-muted">{t.noActiveAlarms}</span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((alarm) => (
              <div
                key={alarm.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]',
                  alarm.severity === 'critical' && 'border-l-2 border-noc-rose'
                )}
              >
                {/* Severity indicator */}
                <div className={cn(
                  'mt-0.5 beacon',
                  alarm.severity === 'critical' && 'beacon-critical',
                  alarm.severity === 'warning' && 'beacon-warning',
                  alarm.severity === 'info' && 'beacon-online',
                )} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[0.65rem] font-semibold uppercase', getBadgeClass(alarm.severity))}>
                      {alarm.severity === 'critical' ? 'SEV-1' : alarm.severity === 'warning' ? 'SEV-2' : 'SEV-3'}
                    </span>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase font-mono',
                      alarm.type === 'los' ? 'bg-noc-rose/10 text-noc-rose' :
                        alarm.type === 'olt_unreachable' ? 'bg-noc-rose/10 text-noc-rose' :
                          'bg-noc-amber/10 text-noc-amber'
                    )}>
                      {alarm.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-text-primary truncate">{alarm.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[0.65rem] text-noc-cyan">{alarm.olt_name}</span>
                    {alarm.pon_label && (
                      <span className="font-mono text-[0.65rem] text-text-muted">PON {alarm.pon_label}</span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span className="font-mono text-[0.6rem] text-text-muted whitespace-nowrap mt-0.5">
                  {timeAgo(alarm.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
