'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  fetchThresholds, updateThresholds,
  fetchPollingInterval, updatePollingInterval,
  createOLT, fetchOLTGroups,
} from '@/lib/api';
import { TelegramForm } from '@/components/settings/TelegramForm';
import type { Threshold, PollingInterval } from '@/lib/mock-data';

type Tab = 'add-olt' | 'thresholds' | 'polling' | 'telegram';

export default function SettingsPage() {
  const { isAuthenticated, hydrate, user } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('add-olt');

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const isAdmin = user?.role === 'admin';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">{t.settingsTitle}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t.settingsSubtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-white/[0.06] overflow-x-auto">
          {([
            { key: 'add-olt', label: t.tabProvisionOlt },
            { key: 'thresholds', label: t.tabThresholds },
            { key: 'polling', label: t.tabPolling },
            { key: 'telegram', label: t.tabTelegram },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn('noc-tab', activeTab === tab.key && 'noc-tab-active')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-2xl">
          {activeTab === 'add-olt' && <AddOLTForm isAdmin={isAdmin} />}
          {activeTab === 'thresholds' && <ThresholdForm isAdmin={isAdmin} />}
          {activeTab === 'polling' && <PollingForm isAdmin={isAdmin} />}
          {activeTab === 'telegram' && <TelegramForm isAdmin={isAdmin} />}
        </div>
      </div>
    </MainLayout>
  );
}

// --- Add OLT Form ---
function AddOLTForm({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', vendor: 'HSGQ-E04MID', group: '', ip_address: '',
    ssh_enabled: true, ssh_username: '', ssh_password: '', ssh_port: '22',
    snmp_enabled: true, snmp_version: 'v2c', snmp_community: 'public', snmp_port: '161',
  });
  const [knownGroups, setKnownGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Grup yang sudah dipakai armada dijadikan saran, bukan pilihan tertutup:
  // site baru di wilayah baru tetap bisa diisi bebas.
  useEffect(() => {
    fetchOLTGroups()
      .then(setKnownGroups)
      .catch((error) => console.error('Failed to load OLT groups:', error));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await createOLT({
        ...form,
        ssh_port: parseInt(form.ssh_port),
        snmp_port: parseInt(form.snmp_port),
      });
      setSuccess(true);
      setForm({ name: '', vendor: 'HSGQ-E04MID', group: '', ip_address: '', ssh_enabled: true, ssh_username: '', ssh_password: '', ssh_port: '22', snmp_enabled: true, snmp_version: 'v2c', snmp_community: 'public', snmp_port: '161' });
    } catch (error) {
      console.error('Failed to create OLT:', error);
    }
    setSaving(false);
  };

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="noc-card p-6 space-y-4">
        <h3 className="label-caps text-noc-cyan mb-2">Informasi OLT</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-caps block mb-1.5">{t.colOltName}</label>
            <input className="noc-input" placeholder="OLT-Bulus" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="label-caps block mb-1.5">Vendor / Tipe</label>
            <select className="noc-select" value={form.vendor} onChange={(e) => update('vendor', e.target.value)}>
              <option value="HSGQ-E04MID">HSGQ-E04MID (Default)</option>
              <option value="ZTE">ZTE</option>
              <option value="Huawei">Huawei</option>
              <option value="FiberHome">FiberHome</option>
              <option value="CDATA">CDATA</option>
            </select>
          </div>
          <div>
            <label htmlFor="olt-form-group" className="label-caps block mb-1.5">{t.oltGroupFormLabel}</label>
            <input
              id="olt-form-group"
              className="noc-input"
              list="olt-form-group-options"
              placeholder="Klaten"
              value={form.group}
              onChange={(e) => update('group', e.target.value)}
              aria-describedby="olt-form-group-hint"
            />
            <datalist id="olt-form-group-options">
              {knownGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <p id="olt-form-group-hint" className="mt-1.5 text-[0.6875rem] text-text-muted">
              {t.oltGroupFormHint}
            </p>
          </div>
          <div>
            <label className="label-caps block mb-1.5">{t.colIp}</label>
            <input className="noc-input font-mono" placeholder="10.99.0.x" value={form.ip_address} onChange={(e) => update('ip_address', e.target.value)} required />
          </div>
        </div>
      </div>

      <div className="noc-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="label-caps text-noc-cyan">Konfigurasi SSH CLI</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ssh_enabled} onChange={(e) => update('ssh_enabled', e.target.checked)} className="accent-noc-cyan" />
            <span className="font-mono text-xs text-text-secondary">{t.active}</span>
          </label>
        </div>
        {form.ssh_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-caps block mb-1.5">Username</label>
              <input className="noc-input" placeholder="admin" value={form.ssh_username} onChange={(e) => update('ssh_username', e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-1.5">Password</label>
              <input className="noc-input" type="password" placeholder="••••••" value={form.ssh_password} onChange={(e) => update('ssh_password', e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-1.5">Port SSH</label>
              <input className="noc-input font-mono" type="number" value={form.ssh_port} onChange={(e) => update('ssh_port', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="noc-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="label-caps text-noc-cyan">Konfigurasi SNMPv2c (Fallback)</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.snmp_enabled} onChange={(e) => update('snmp_enabled', e.target.checked)} className="accent-noc-cyan" />
            <span className="font-mono text-xs text-text-secondary">{t.active}</span>
          </label>
        </div>
        {form.snmp_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-caps block mb-1.5">Versi</label>
              <select className="noc-select font-mono" value={form.snmp_version} onChange={(e) => update('snmp_version', e.target.value)}>
                <option value="v2c">SNMPv2c</option>
              </select>
            </div>
            <div>
              <label className="label-caps block mb-1.5">Community String</label>
              <input className="noc-input font-mono" placeholder="public" value={form.snmp_community} onChange={(e) => update('snmp_community', e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-1.5">Port SNMP</label>
              <input className="noc-input font-mono" type="number" value={form.snmp_port} onChange={(e) => update('snmp_port', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded bg-noc-emerald/10 border border-noc-emerald/20 px-4 py-3">
          <span className="beacon beacon-online" />
          <span className="font-mono text-xs text-noc-emerald">OLT baru berhasil didaftarkan ke sistem!</span>
        </div>
      )}

      <button type="submit" disabled={!isAdmin || saving} className="btn-primary !h-10 !px-8 disabled:opacity-50">
        {saving ? t.saving : t.tabProvisionOlt}
      </button>
      {!isAdmin && <p className="font-mono text-xs text-noc-amber mt-2">{t.adminNotice}</p>}
    </form>
  );
}

// --- Threshold Form ---
function ThresholdForm({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState<Threshold | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchThresholds().then(setThreshold);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threshold) return;
    setSaving(true);
    setSuccess(false);
    await updateThresholds(threshold);
    setSuccess(true);
    setSaving(false);
  };

  if (!threshold) return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="noc-card p-6 space-y-4">
        <h3 className="label-caps text-noc-cyan mb-2">Ambang Batas Daya Optik Rx (dBm)</h3>
        <p className="text-xs text-text-muted mb-4">Tentukan batas daya Rx untuk setiap jenjang klasifikasi. Nilai semakin negatif = sinyal semakin buruk.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-caps block mb-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: '#4EDEA3' }} />
              Normal Min (dBm)
            </label>
            <input className="noc-input font-mono" type="number" step="0.1" value={threshold.normal_min} onChange={(e) => setThreshold({ ...threshold, normal_min: parseFloat(e.target.value) })} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label-caps block mb-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: '#F59E0B' }} />
              Warning / Peringatan Min (dBm)
            </label>
            <input className="noc-input font-mono" type="number" step="0.1" value={threshold.warning_min} onChange={(e) => setThreshold({ ...threshold, warning_min: parseFloat(e.target.value) })} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label-caps block mb-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: '#F43F5E' }} />
              Kritis Min (dBm)
            </label>
            <input className="noc-input font-mono" type="number" step="0.1" value={threshold.critical_min} onChange={(e) => setThreshold({ ...threshold, critical_min: parseFloat(e.target.value) })} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label-caps block mb-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: '#dc2626' }} />
              Sangat Kritis Min (dBm)
            </label>
            <input className="noc-input font-mono" type="number" step="0.1" value={threshold.very_critical_min} onChange={(e) => setThreshold({ ...threshold, very_critical_min: parseFloat(e.target.value) })} disabled={!isAdmin} />
          </div>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded bg-noc-emerald/10 border border-noc-emerald/20 px-4 py-3">
          <span className="beacon beacon-online" />
          <span className="font-mono text-xs text-noc-emerald">{t.savedSuccess}</span>
        </div>
      )}

      <button type="submit" disabled={!isAdmin || saving} className="btn-primary !h-10 !px-8 disabled:opacity-50">
        {saving ? t.saving : t.saveSettings}
      </button>
      {!isAdmin && <p className="font-mono text-xs text-noc-amber mt-2">{t.adminNotice}</p>}
    </form>
  );
}

// --- Polling Form ---
function PollingForm({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [polling, setPolling] = useState<PollingInterval | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPollingInterval().then(setPolling);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!polling) return;
    setSaving(true);
    setSuccess(false);
    await updatePollingInterval(polling);
    setSuccess(true);
    setSaving(false);
  };

  if (!polling) return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" /></div>;

  const fields = [
    { key: 'olt_status', label: 'Status OLT' },
    { key: 'pon_status', label: 'Status PON' },
    { key: 'onu_status', label: 'Status ONU' },
    { key: 'optical_power', label: 'Daya Optik Rx/Tx' },
    { key: 'cpu_memory', label: 'CPU & Memori' },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="noc-card p-6 space-y-4">
        <h3 className="label-caps text-noc-cyan mb-2">Interval Polling (Detik)</h3>
        <p className="text-xs text-text-muted mb-4">Minimal 10 detik. Nilai lebih rendah meningkatkan frekuensi pemantauan serta beban CPU OLT.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="label-caps block mb-1.5">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  className="noc-input font-mono"
                  type="number"
                  min="10"
                  value={polling[key]}
                  onChange={(e) => setPolling({ ...polling, [key]: parseInt(e.target.value) || 10 })}
                  disabled={!isAdmin}
                />
                <span className="font-mono text-xs text-text-muted whitespace-nowrap">detik</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded bg-noc-emerald/10 border border-noc-emerald/20 px-4 py-3">
          <span className="beacon beacon-online" />
          <span className="font-mono text-xs text-noc-emerald">{t.savedSuccess}</span>
        </div>
      )}

      <button type="submit" disabled={!isAdmin || saving} className="btn-primary !h-10 !px-8 disabled:opacity-50">
        {saving ? t.saving : t.saveSettings}
      </button>
      {!isAdmin && <p className="font-mono text-xs text-noc-amber mt-2">{t.adminNotice}</p>}
    </form>
  );
}
