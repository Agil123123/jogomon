'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { RxDistributionChart } from '@/components/dashboard/RxDistributionChart';
import { ONUStatusChart } from '@/components/dashboard/ONUStatusChart';
import { TotalTrafficAreaChart } from '@/components/dashboard/TotalTrafficAreaChart';
import { OLTFleetTable } from '@/components/dashboard/OLTFleetTable';
import { AlarmFeed } from '@/components/dashboard/AlarmFeed';
import { WorstONUList } from '@/components/dashboard/WorstONUList';
import { GroupScopeSelect } from '@/components/dashboard/GroupScopeSelect';
import { GroupBreakdown } from '@/components/dashboard/GroupBreakdown';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { formatTraffic } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  fetchKPI, fetchOpticalSummary, fetchRxDistribution,
  fetchWorstONUs, fetchOLTList, fetchAlarms, fetchTrafficHistory,
  fetchGroupSummaries,
} from '@/lib/api';
import { OLT_GROUP_ALL } from '@/lib/mock-data';
import type {
  KPI, OpticalSummary, RxDistribution, WorstONU, OLTSummary, Alarm, TrafficHistoryPoint,
  OLTGroupSummary,
} from '@/lib/mock-data';

export default function DashboardPage() {
  const { isAuthenticated, hydrate } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();

  const [kpi, setKpi] = useState<KPI | null>(null);
  const [opticalSummary, setOpticalSummary] = useState<OpticalSummary | null>(null);
  const [rxDistribution, setRxDistribution] = useState<RxDistribution[]>([]);
  const [worstONUs, setWorstONUs] = useState<WorstONU[]>([]);
  const [olts, setOlts] = useState<OLTSummary[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [trafficHistory, setTrafficHistory] = useState<TrafficHistoryPoint[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<OLTGroupSummary[]>([]);
  /** Scope grup aktif. Semua agregat di halaman ini diturunkan dari nilai ini. */
  const [group, setGroup] = useState<string>(OLT_GROUP_ALL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        // Ringkasan per grup selalu fleet-wide — kartu grup harus tetap
        // menampilkan wilayah lain meski dasbor sedang di-scope ke satu grup.
        const [k, os, rx, w, o, a, th, gs] = await Promise.all([
          fetchKPI(group),
          fetchOpticalSummary(group),
          fetchRxDistribution(group),
          fetchWorstONUs(10, group),
          fetchOLTList(group),
          fetchAlarms({ group }),
          fetchTrafficHistory(group),
          fetchGroupSummaries(),
        ]);
        // Scope bisa berubah lagi sebelum fetch selesai; buang hasil basi
        // supaya data grup lama tidak menimpa pilihan terbaru.
        if (cancelled) return;
        setKpi(k);
        setOpticalSummary(os);
        setRxDistribution(rx);
        setWorstONUs(w);
        setOlts(o);
        setAlarms(a);
        setTrafficHistory(th);
        setGroupSummaries(gs);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router, group]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
            <span className="label-caps text-text-muted">{t.loadingTelemetry}</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Section rhythm: gaps between blocks are larger than gaps inside a
          block, so the eye reads groups instead of one flat wall of cards
          (layout: spacing-scale + proximity-grouping) */}
      <div className="space-y-5 sm:space-y-7">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title">{t.dashboardTitle}</h1>
            <p className="page-subtitle">{t.dashboardSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Scope grup berdiri sejajar dengan judul: keputusan "data mana"
                harus terlihat sebelum operator membaca angkanya. */}
            <GroupScopeSelect
              value={group}
              groups={groupSummaries.map((g) => g.group)}
              onChange={setGroup}
              deviceCount={olts.length}
            />

            {/* Polling heartbeat. role=status so SR users get the state without
                relying on the pulsing dot, which is decorative only. */}
            <div className="flex flex-shrink-0 items-center gap-2" role="status">
              <span className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-surface-2 px-3 py-1 font-mono text-[0.6875rem] font-medium tracking-wide text-text-secondary">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-noc-emerald animate-pulse" />
                <span>{t.live} NOC JOGLONET</span>
              </span>
            </div>
          </div>
        </div>

        {/* Ringkasan per grup site — jalur cepat menemukan wilayah bermasalah */}
        <GroupBreakdown data={groupSummaries} selected={group} onSelect={setGroup} />

        {/* KPI Cards: 6 cards including Total Traffic */}
        {kpi && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Total OLT */}
            <KPICard
              title={t.kpiTotalOlt}
              value={kpi.total_olt}
              subtitle={`${kpi.online_olt} ${t.online}`}
              status={kpi.offline_olt > 0 ? 'warning' : 'online'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" /></svg>
              }
            />

            {/* Total Traffic (All OLTs) */}
            <KPICard
              title={t.kpiTotalTraffic}
              value={formatTraffic(kpi.total_traffic_mbps)}
              subtitle={`↓ ${formatTraffic(kpi.total_traffic_in_mbps)} | ↑ ${formatTraffic(kpi.total_traffic_out_mbps)}`}
              status="online"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
            />

            {/* Total ONU */}
            <KPICard
              title={t.kpiTotalOnu}
              value={kpi.total_onu}
              subtitle={`${kpi.online_onu} ${t.online}`}
              status="online"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" /></svg>
              }
            />

            {/* ONU Offline */}
            <KPICard
              title={`ONU ${t.offline}`}
              value={kpi.offline_onu}
              subtitle={kpi.offline_onu > 0 ? `${kpi.offline_onu} ${t.offline}` : 'Normal'}
              status={kpi.offline_onu > 10 ? 'critical' : kpi.offline_onu > 0 ? 'warning' : 'online'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0119 12.55" /><path d="M5 12.55a10.94 10.94 0 015.17-2.39" /><path d="M10.71 5.05A16 16 0 0122.56 9" /><path d="M1.42 9a15.91 15.91 0 014.7-2.88" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" /></svg>
              }
            />

            {/* Active Alarms */}
            <KPICard
              title={t.kpiActiveAlarms}
              value={kpi.active_alarms}
              subtitle={`${kpi.critical_alarms} ${t.critical}`}
              status={kpi.critical_alarms > 0 ? 'critical' : kpi.active_alarms > 0 ? 'warning' : 'online'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              }
            />

            {/* Optical Health */}
            <KPICard
              title={t.kpiOpticalHealth}
              value={`${kpi.optical_health_percent}%`}
              subtitle={t.kpiOpticalSubtitle}
              status={kpi.optical_health_percent > 90 ? 'online' : kpi.optical_health_percent > 70 ? 'warning' : 'critical'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              }
            />
          </div>
        )}

        {/* Total Traffic Area Chart (di atas distribusi daya optik & kesehatan optik) */}
        <TotalTrafficAreaChart
          data={trafficHistory}
          currentInGbps={(kpi?.total_traffic_in_mbps || 8861) / 1000}
          currentOutGbps={(kpi?.total_traffic_out_mbps || 2551) / 1000}
        />

        {/* Optical Charts Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RxDistributionChart data={rxDistribution} />
          </div>
          <div className="lg:col-span-2">
            {opticalSummary && <ONUStatusChart data={opticalSummary} />}
          </div>
        </div>

        {/* Status Armada OLT Table */}
        <OLTFleetTable data={olts} />

        {/* Bottom Row: Alarm Feed + Worst ONU */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AlarmFeed data={alarms} />
          <WorstONUList data={worstONUs} />
        </div>
      </div>
    </MainLayout>
  );
}
