'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { fetchAlarms, acknowledgeAlarm, closeAlarm, resendAlarmToTelegram } from '@/lib/api';
import { cn, timeAgo, getBadgeClass } from '@/lib/utils';
import type { Alarm } from '@/lib/mock-data';

const SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info'] as const;
const STATUS_FILTERS = ['all', 'active', 'acknowledged', 'closed'] as const;

export default function AlarmsPage() {
  const { isAuthenticated, hydrate } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [telegramToast, setTelegramToast] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const loadAlarms = useCallback(async () => {
    try {
      const data = await fetchAlarms({
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setAlarms(data);
    } catch (error) {
      console.error('Failed to load alarms:', error);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    loadAlarms();
  }, [isAuthenticated, router, loadAlarms]);

  const handleAck = async (id: string) => {
    await acknowledgeAlarm(id);
    loadAlarms();
  };

  const handleClose = async (id: string) => {
    await closeAlarm(id);
    loadAlarms();
  };

  const handleSendTelegram = async (id: string) => {
    setResendingId(id);
    try {
      const res = await resendAlarmToTelegram(id);
      setTelegramToast(res.message);
      setTimeout(() => setTelegramToast(null), 4000);
    } catch {
      setTelegramToast('Gagal meneruskan alarm ke Telegram.');
      setTimeout(() => setTelegramToast(null), 4000);
    } finally {
      setResendingId(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">{t.alarmsTitle}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t.alarmsSubtitle}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-6">
          <div>
            <span className="label-caps block mb-2">{t.colSeverity}</span>
            <div className="flex gap-1.5">
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  className={cn(
                    'filter-chip',
                    severityFilter === f && 'filter-chip-active'
                  )}
                >
                  {f === 'all' ? t.tabAll : f === 'critical' ? 'SEV-1 (Kritis)' : f === 'warning' ? 'SEV-2 (Peringatan)' : 'SEV-3 (Info)'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label-caps block mb-2">{t.colStatus}</span>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'filter-chip',
                    statusFilter === f && 'filter-chip-active'
                  )}
                >
                  {f === 'all' ? t.tabAll : f === 'active' ? t.tabActive : f === 'acknowledged' ? t.tabAcknowledged : t.tabClosed}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telegram feedback toast */}
        {telegramToast && (
          <div className="flex items-center gap-2 rounded-lg bg-[#229ED9]/15 border border-[#229ED9]/30 px-4 py-3 text-xs font-mono text-white animate-fadeIn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#229ED9">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
            <span className="text-[#229ED9] font-semibold">{telegramToast}</span>
          </div>
        )}

        {/* Alarms Table */}
        <div className="noc-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
            </div>
          ) : alarms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span className="label-caps mt-3 text-text-muted">{t.noActiveAlarms}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="noc-table">
                <thead>
                  <tr>
                    <th>{t.colSeverity}</th>
                    <th>{t.colAlarmType}</th>
                    <th>OLT</th>
                    <th>PON</th>
                    <th>ONU</th>
                    <th>Rx Power</th>
                    <th>{t.colStatus}</th>
                    <th>{t.colCreatedAt}</th>
                    <th>{t.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((alarm) => (
                    <tr
                      key={alarm.id}
                      className={cn(
                        alarm.severity === 'critical' && alarm.status === 'active' && 'border-l-2 border-noc-rose bg-noc-rose/[0.02]'
                      )}
                    >
                      <td>
                        <span className={cn(getBadgeClass(alarm.severity))}>
                          {alarm.severity === 'critical' ? 'SEV-1' : alarm.severity === 'warning' ? 'SEV-2' : 'SEV-3'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase font-mono',
                            alarm.type === 'los' || alarm.type === 'olt_unreachable' ? 'bg-noc-rose/10 text-noc-rose' : 'bg-noc-amber/10 text-noc-amber'
                          )}>
                            {alarm.type.replace(/_/g, ' ')}
                          </span>
                          {alarm.sent_to_telegram && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.55rem] font-mono font-medium bg-[#229ED9]/15 text-[#229ED9] border border-[#229ED9]/30"
                              title={t.telegramSentBadge}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                              </svg>
                              <span>TG</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-noc-cyan font-mono">{alarm.olt_name}</td>
                      <td className="text-text-secondary font-mono">{alarm.pon_label || '—'}</td>
                      <td className="text-text-secondary font-mono text-[0.7rem]">{alarm.onu_serial || '—'}</td>
                      <td>
                        {alarm.rx_power !== null ? (
                          <span className={cn(
                            'font-semibold font-mono',
                            alarm.rx_power < -30 ? 'text-noc-red-deep' :
                            alarm.rx_power < -27 ? 'text-noc-rose' :
                            alarm.rx_power < -25 ? 'text-noc-amber' : 'text-noc-emerald'
                          )}>
                            {alarm.rx_power.toFixed(1)} dBm
                          </span>
                        ) : (
                          <span className="text-text-muted font-mono">—</span>
                        )}
                      </td>
                      <td>
                        <span className={cn(getBadgeClass(alarm.status))}>
                          {alarm.status === 'active' ? t.tabActive : alarm.status === 'acknowledged' ? t.tabAcknowledged : t.tabClosed}
                        </span>
                      </td>
                      <td className="text-text-muted font-mono text-xs">{timeAgo(alarm.created_at)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {alarm.status === 'active' && (
                            <button
                              onClick={() => handleAck(alarm.id)}
                              className="btn-secondary !h-6 !text-[0.65rem] !px-2.5 font-mono"
                            >
                              {t.btnAck}
                            </button>
                          )}
                          {alarm.status === 'acknowledged' && (
                            <button
                              onClick={() => handleClose(alarm.id)}
                              className="btn-primary !h-6 !text-[0.65rem] !px-2.5 font-mono"
                            >
                              {t.btnClose}
                            </button>
                          )}
                          {/* Send / Resend to Telegram Button */}
                          <button
                            onClick={() => handleSendTelegram(alarm.id)}
                            disabled={resendingId === alarm.id}
                            className="btn-ghost !h-6 !px-2 !text-[#229ED9] border border-[#229ED9]/25 hover:bg-[#229ED9]/15 flex items-center gap-1"
                            title={t.telegramResendBtn}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                            <span className="text-[0.6rem] font-mono hidden sm:inline">TG</span>
                          </button>
                          {alarm.status === 'closed' && (
                            <span className="font-mono text-[0.6rem] text-text-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
