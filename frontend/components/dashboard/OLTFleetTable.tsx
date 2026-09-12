'use client';

import React from 'react';
import Link from 'next/link';
import { cn, timeAgo, getBeaconClass, formatPercent, formatTemp, formatTraffic } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { OLTSummary } from '@/lib/mock-data';

interface Props {
  data: OLTSummary[];
}

export function OLTFleetTable({ data }: Props) {
  const { t } = useTranslation();

  return (
    <div className="noc-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="beacon beacon-online" />
          <h3 className="section-title">{t.oltFleetTitle}</h3>
        </div>
        <span className="font-mono text-xs text-text-muted">{data.length} OLT</span>
      </div>
      <div className="overflow-x-auto">
        <table className="noc-table">
          <thead>
            <tr>
              <th>{t.colStatus}</th>
              <th>{t.colOltName}</th>
              <th>{t.colIp}</th>
              <th>{t.colOnuTotal}</th>
              <th>{t.colTraffic}</th>
              <th>{t.colCpuRam}</th>
              <th>{t.colTemp}</th>
              <th>{t.colUptime}</th>
              <th className="text-right">{t.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((olt) => (
              <tr key={olt.id} className="hover:bg-white/[0.02] transition-colors">
                <td>
                  <div className="flex items-center gap-2">
                    <div className={getBeaconClass(olt.status)} />
                    <span className="font-mono text-xs capitalize text-text-secondary">
                      {olt.status === 'online' ? t.online : t.offline}
                    </span>
                  </div>
                </td>
                <td>
                  <Link
                    href={`/olt/${olt.id}`}
                    className="text-noc-cyan hover:underline font-semibold"
                  >
                    {olt.name}
                  </Link>
                  <div className="text-[0.65rem] text-text-muted font-mono">{olt.vendor}</div>
                </td>
                <td className="text-text-secondary font-mono text-xs">{olt.ip_address}</td>
                <td>
                  <span className="text-noc-emerald font-semibold">{olt.online_onu}</span>
                  <span className="text-text-muted"> / {olt.total_onu}</span>
                  {olt.offline_onu > 0 && (
                    <span className="ml-2 font-mono text-[0.65rem] text-noc-rose">
                      ({olt.offline_onu} off)
                    </span>
                  )}
                </td>
                {/* Traffic Column */}
                <td>
                  {olt.status === 'online' ? (
                    <div className="font-mono text-xs">
                      <span className="text-noc-cyan font-medium">↓ {formatTraffic(olt.traffic_in_mbps)}</span>
                      <span className="text-text-muted mx-1.5">|</span>
                      <span className="text-text-secondary">↑ {formatTraffic(olt.traffic_out_mbps)}</span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-text-muted">—</span>
                  )}
                </td>
                <td className="text-text-secondary font-mono text-xs">
                  {olt.cpu_usage !== null ? `${formatPercent(olt.cpu_usage)} / ${formatPercent(olt.memory_usage)}` : '—'}
                </td>
                <td className="text-text-secondary font-mono text-xs">{formatTemp(olt.temperature)}</td>
                <td className="text-text-muted font-mono text-xs">{timeAgo(olt.last_poll)}</td>
                <td className="text-right">
                  <Link
                    href={`/olt/${olt.id}`}
                    className="btn-ghost text-xs px-2.5 py-1 text-noc-cyan"
                  >
                    {t.btnDetail} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
