'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { OLTUplinkTrafficCard } from '@/components/olt/OLTUplinkTrafficCard';
import { PONTrafficBreakdown } from '@/components/olt/PONTrafficBreakdown';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { fetchOLTDetail, fetchPONONUs } from '@/lib/api';
import { OLTEditModal } from '@/components/olt/OLTEditModal';
import {
  cn, formatDbm, formatPercent, formatTemp, formatUptime, formatTraffic,
  timeAgo, getBeaconClass, classifyRxPower, getRxColor,
} from '@/lib/utils';
import type { OLTDetail, ONUDetail } from '@/lib/mock-data';

function copySerial(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(()=>{});
}

export default function OLTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, hasHydrated, hydrate, user } = useAuthStore();
  const { t } = useTranslation();

  const [olt, setOlt] = useState<OLTDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPon, setExpandedPon] = useState<string | null>(null);
  const [onus, setOnus] = useState<Record<string, ONUDetail[]>>({});
  const [loadingOnus, setLoadingOnus] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [onuQuery, setOnuQuery] = useState<Record<string,string>>({});
  const [onuStatus, setOnuStatus] = useState<Record<string,'all'|'online'|'offline'>>({});

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    const oltId = params.id as string;
    if (!oltId) return;

    fetchOLTDetail(oltId).then((data) => {
      setOlt(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isAuthenticated, hasHydrated, router, params.id]);

  const reloadDetail = async () => {
    const oltId = params.id as string;
    if (!oltId) return;
    try {
      const data = await fetchOLTDetail(oltId);
      setOlt(data);
      // ONU cache bisa basi setelah edit; reset supaya di-fetch ulang saat expand.
      setOnus({});
      setExpandedPon(null);
    } catch (error) {
      console.error('Failed to reload OLT detail:', error);
    }
  };

  const togglePon = async (ponId: string) => {
    if (expandedPon === ponId) {
      setExpandedPon(null);
      return;
    }
    setExpandedPon(ponId);
    if (!onus[ponId]) {
      setLoadingOnus(ponId);
      try {
        const data = await fetchPONONUs(params.id as string, ponId);
        setOnus((prev) => ({ ...prev, [ponId]: data }));
      } catch (error) {
        console.error('Failed to load ONUs:', error);
      }
      setLoadingOnus(null);
    }
  };

  if (!hasHydrated) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }
  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!olt) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[60vh]">
          <span className="label-caps text-text-muted">{t.oltNotFound}</span>
          <button onClick={() => router.push('/')} className="btn-secondary">
            {t.backToFleet}
          </button>
        </div>
      </MainLayout>
    );
  }

  const totalOltTraffic = (olt.traffic_in_mbps || 0) + (olt.traffic_out_mbps || 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-text-muted hover:text-noc-cyan transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
              title={t.backToFleet}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-text-primary tracking-tight">{olt.name}</h1>
                <div className={getBeaconClass(olt.status)} />
                <span className={cn(
                  olt.status === 'online' ? 'badge-online' : 'badge-critical'
                )}>
                  {olt.status === 'online' ? t.online : t.offline}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="font-mono text-xs text-text-muted">{olt.vendor}</span>
                <span className="text-text-muted">·</span>
                <span className="font-mono text-xs text-text-secondary">{olt.ip_address}</span>
                <span className="text-text-muted">·</span>
                <span className="font-mono text-xs text-noc-cyan">SSH :{olt.ssh_port}</span>
                <span className="text-text-muted">·</span>
                <span className="font-mono text-xs text-noc-emerald">SNMP :{olt.snmp_port}</span>
              </div>
            </div>
          </div>

          {/* Quick status badges */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-muted bg-surface-2 px-3 py-1 rounded-md border border-white/[0.06]">
              {t.colLastPoll}: <span className="text-text-secondary">{timeAgo(olt.last_poll)}</span>
            </span>
            {user?.role === 'admin' && (
              <button onClick={() => setShowEdit(true)} className="btn-secondary !h-8 !px-4" title={t.editOlt}>
                {t.editOlt}
              </button>
            )}
          </div>
        </div>

        {/* Stat Cards: Total OLT Traffic, CPU, RAM, Temp, Uptime, Total ONU */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Traffic for this OLT */}
          <KPICard
            title={t.metricOltTraffic}
            value={formatTraffic(totalOltTraffic)}
            subtitle={`↓ ${formatTraffic(olt.traffic_in_mbps)} | ↑ ${formatTraffic(olt.traffic_out_mbps)}`}
            status={olt.status === 'online' ? 'online' : 'offline'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            }
          />

          {/* CPU */}
          <KPICard
            title={t.metricCpu}
            value={formatPercent(olt.cpu_usage)}
            subtitle={t.metricCpuSubtitle}
            status={olt.cpu_usage && olt.cpu_usage > 80 ? 'critical' : 'online'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /></svg>
            }
          />

          {/* Memory */}
          <KPICard
            title={t.metricRam}
            value={formatPercent(olt.memory_usage)}
            subtitle={t.metricRamSubtitle}
            status={olt.memory_usage && olt.memory_usage > 80 ? 'critical' : 'online'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19v-3" /><path d="M10 19v-3" /><path d="M14 19v-3" /><path d="M18 19v-3" /><rect x="2" y="5" width="20" height="9" rx="2" /></svg>
            }
          />

          {/* Temperature */}
          <KPICard
            title={t.metricTemp}
            value={formatTemp(olt.temperature)}
            subtitle={t.metricTempSubtitle}
            status={olt.temperature && olt.temperature > 60 ? 'warning' : 'online'}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>
            }
          />

          {/* Uptime */}
          <KPICard
            title={t.colUptime}
            value={formatUptime(olt.uptime)}
            subtitle={t.uptimeSubtitle}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            }
          />

          {/* Total ONU */}
          <KPICard
            title={t.kpiTotalOnu}
            value={olt.total_onu}
            subtitle={`${olt.online_onu} ${t.online}`}
            status="online"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" /></svg>
            }
          />
        </div>

        {/* 1. TRAFFIC UPLINK SECTION: Uplink ports & 24h Area Chart */}
        <OLTUplinkTrafficCard
          uplinks={olt.uplinks || []}
          history={olt.traffic_history || []}
          oltName={olt.name}
        />

        {/* 2. TRAFFIC PON SECTION: Capacity utilization & throughput per PON port */}
        <PONTrafficBreakdown
          pons={olt.pons || []}
        />

        {/* 3. PON & ONU Detailed Table with Drilldown */}
        <div className="noc-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div>
              <h3 className="label-caps">{t.ponBreakdownTitle}</h3>
              <p className="text-[0.68rem] text-text-muted mt-0.5">{t.ponClickHint}</p>
            </div>
            <span className="font-mono text-xs text-text-muted">{olt.pons.length} {t.ponPortsUnit}</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {olt.pons.map((pon) => (
              <div key={pon.id}>
                {/* PON row button */}
                <button
                  onClick={() => togglePon(pon.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={cn(
                      'transition-transform duration-200 text-text-muted flex-shrink-0',
                      expandedPon === pon.id && 'rotate-90 text-noc-cyan'
                    )}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  <div className={getBeaconClass(pon.status)} />

                  <span className="font-mono text-sm font-bold text-noc-cyan min-w-[85px]">
                    PON {pon.slot}/{pon.port}
                  </span>

                  <div className="flex flex-wrap items-center gap-4 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="label-caps text-[0.55rem]">{t.chartTotal}:</span>
                      <span className="font-mono text-xs font-semibold text-text-primary">{pon.total_onu}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="label-caps text-[0.55rem] text-noc-emerald">{t.colPonOnline}:</span>
                      <span className="font-mono text-xs font-semibold text-noc-emerald">{pon.online_onu}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="label-caps text-[0.55rem] text-noc-rose">{t.colPonOffline}:</span>
                      <span className={cn('font-mono text-xs font-semibold', pon.offline_onu > 0 ? 'text-noc-rose' : 'text-text-muted')}>
                        {pon.offline_onu}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="label-caps text-[0.55rem] text-noc-amber">{t.colPonLowRx}:</span>
                      <span className={cn('font-mono text-xs font-semibold', pon.low_rx_onu > 0 ? 'text-noc-amber' : 'text-text-muted')}>
                        {pon.low_rx_onu}
                      </span>
                    </div>
                    {/* PON Port Traffic Live */}
                    <div className="flex items-center gap-1.5 ml-auto font-mono text-xs bg-white/[0.02] px-2.5 py-1 rounded border border-white/[0.04]">
                      <span className="label-caps text-[0.55rem] text-noc-cyan">{t.colPonTraffic}:</span>
                      <span className="text-noc-cyan font-bold">↓ {formatTraffic(pon.traffic_in_mbps)}</span>
                      <span className="text-text-muted">/</span>
                      <span className="text-noc-emerald font-bold">↑ {formatTraffic(pon.traffic_out_mbps)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded ONU list */}
                {expandedPon === pon.id && (
                  <div className="bg-surface-dim/50 border-t border-white/[0.04] p-2">
                    <div className="px-3 py-1.5 text-xs font-mono font-medium text-text-secondary border-b border-white/[0.04] flex items-center justify-between">
                      <span>{t.onuSubscribersTitle} PON {pon.slot}/{pon.port}</span>
                      <span className="text-text-muted">{onus[pon.id]?.length || 0} {t.onuConnectedUnit}</span>
                    </div>
                    {loadingOnus === pon.id ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
                      </div>
                    ) : onus[pon.id] && onus[pon.id].length > 0 ? (
                      <>
                      {/* ONU filter bar - A+C polish */}
                      <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                          <input value={onuQuery[pon.id] || '' } onChange={(e)=> setOnuQuery(prev=> ({...prev, [pon.id]: e.target.value}))} placeholder={t.colOnuName + ' / ' + t.colSerial + '...'} className="noc-input !h-7 !py-1 !text-xs flex-1 min-w-0" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['all','online','offline'] as const).map(s=> (
                            <button key={s} onClick={()=> setOnuStatus(prev=> ({...prev, [pon.id]: s}))} className={cn('filter-chip !min-h-0 !py-1 !px-2 text-[0.62rem]', (onuStatus[pon.id]||'all')===s && 'filter-chip-active')}>{s==='all' ? 'Semua' : s==='online' ? t.online : t.offline}</button>
                          ))}
                        </div>
                        <span className="ml-auto font-mono text-[0.68rem] text-text-muted">{(() => { const q=(onuQuery[pon.id]||'').toLowerCase(); const f=onuStatus[pon.id]||'all'; const list=onus[pon.id]||[]; const fl=list.filter(o=>{ const ms=f==='all'||o.status===f; const hay=((o.name||'')+' '+o.serial_number+' '+o.onu_id).toLowerCase(); const mq=!q||hay.includes(q); return ms&&mq; }); return `${fl.length}/${list.length}`; })()} ONU</span>
                      </div>
                      <div className="overflow-x-auto overscroll-x-contain -mx-2 px-2">
                        <table className="noc-table min-w-[880px]">
                          <thead>
                            <tr>
                              <th className="!bg-surface-dim w-12">ID</th>
                              <th className="!bg-surface-dim min-w-[220px]">{t.colOnuName}</th>
                              <th className="!bg-surface-dim">{t.colStatus}</th>
                              <th className="!bg-surface-dim">{t.colRxPower}</th>
                              <th className="!bg-surface-dim">{t.colTxPower}</th>
                              <th className="!bg-surface-dim">{t.colOnuTraffic}</th>
                              <th className="!bg-surface-dim">{t.colDistance}</th>
                              <th className="!bg-surface-dim">{t.colLastSeen}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const q=(onuQuery[pon.id]||'').toLowerCase();
                              const st=onuStatus[pon.id]||'all';
                              const filtered=(onus[pon.id]||[]).filter(o=>{ const ms=st==='all'||o.status===st; const hay=((o.name||'')+' '+(o.serial_number||'')+' '+o.onu_id).toLowerCase(); const mq=!q||hay.includes(q); return ms&&mq; });
                              if(filtered.length===0) return (<tr><td colSpan={8} className="py-8 text-center"><span className="label-caps text-text-muted">Tidak ada ONU cocok filter</span></td></tr>);
                              return filtered.map((onu) => {
                              const rxClass = classifyRxPower(onu.rx_power);
                              const rxColor = getRxColor(rxClass);
                              const rxBadge = rxClass==='normal' ? 'badge-online' : rxClass==='warning' ? 'badge-warning' : rxClass==='critical' || rxClass==='very_critical' ? 'badge-critical' : 'badge-offline';
                              return (
                                <tr key={onu.id}>
                                  <td className="text-text-primary font-semibold font-mono text-xs">{onu.onu_id}</td>
                                  <td className="min-w-[220px]">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={cn('font-medium text-[0.78rem] leading-tight truncate max-w-[220px]', onu.name ? 'text-text-primary' : 'text-text-muted italic')} title={onu.name || ''}>{onu.name || '— tanpa nama'}</span>
                                      <span className="flex items-center gap-1.5">
                                        <span className="font-mono text-[0.68rem] text-text-secondary truncate max-w-[160px]" title={onu.serial_number || ''}>{onu.serial_number || '—'}</span>
                                        {onu.serial_number && (<button onClick={()=> copySerial(onu.serial_number!)} className="shrink-0 p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-noc-cyan transition-colors" title="Salin serial" aria-label="Salin serial"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"/></svg></button>)}
                                      </span>
                                    </div>
                                  </td>
                                  <td><span className={cn(onu.status === 'online' ? 'badge-online' : 'badge-critical')}>{onu.status === 'online' ? t.online : t.offline}</span></td>
                                  <td><span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold', rxBadge)} title={rxClass}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: rxColor}} />{formatDbm(onu.rx_power)}</span></td>
                                  <td className="text-text-secondary font-mono text-xs">{formatDbm(onu.tx_power)}</td>
                                  {/* ONU Traffic */}
                                  <td className="font-mono text-xs">
                                    {onu.status === 'online' ? (
                                      <span>
                                        <span className="text-noc-cyan font-medium">↓ {formatTraffic(onu.traffic_in_mbps)}</span>
                                        <span className="text-text-muted mx-1">/</span>
                                        <span className="text-noc-emerald font-medium">↑ {formatTraffic(onu.traffic_out_mbps)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="text-text-secondary font-mono text-xs">{onu.distance !== null ? `${onu.distance} m` : '—'}</td>
                                  <td className="text-text-muted font-mono text-xs">{timeAgo(onu.last_seen)}</td>
                                </tr>
                              );
                              })
                            })()}
                          </tbody>
                        </table>
                      </div>
                      </>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="label-caps text-text-muted">{t.noOnuData}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEdit && olt && (
        <OLTEditModal
          olt={olt}
          onClose={() => setShowEdit(false)}
          onUpdated={() => { setShowEdit(false); reloadDetail(); }}
          onDeleted={() => { setShowEdit(false); router.push('/'); }}
        />
      )}
    </MainLayout>
  );
}
