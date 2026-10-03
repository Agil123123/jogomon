'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { updateOLT, deleteOLT, fetchOLTGroups } from '@/lib/api';
import type { OLTDetail } from '@/lib/mock-data';

interface Props {
  olt: OLTDetail;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

/** Modal ubah + hapus OLT. Password/community dikosongkan by default —
 *  string kosong tidak dikirim supaya kredensial lama tidak tertimpa. */
export function OLTEditModal({ olt, onClose, onUpdated, onDeleted }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: olt.name,
    vendor: olt.vendor,
    group: olt.group,
    ip_address: olt.ip_address,
    ssh_enabled: olt.ssh_enabled,
    ssh_username: '',
    ssh_password: '',
    ssh_port: String(olt.ssh_port),
    snmp_enabled: olt.snmp_enabled,
    snmp_community: '',
    snmp_port: String(olt.snmp_port),
  });
  const [knownGroups, setKnownGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOLTGroups()
      .then(setKnownGroups)
      .catch((e) => console.error('Failed to load OLT groups:', e));
  }, []);

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Kirim hanya field terisi. Kredensial kosong = pertahankan yang lama.
    const payload: Record<string, unknown> = {
      name: form.name,
      vendor: form.vendor,
      group: form.group,
      ip_address: form.ip_address,
      ssh_enabled: form.ssh_enabled,
      ssh_port: parseInt(form.ssh_port) || 22,
      snmp_enabled: form.snmp_enabled,
      snmp_port: parseInt(form.snmp_port) || 161,
    };
    if (form.ssh_username) payload.ssh_username = form.ssh_username;
    if (form.ssh_password) payload.ssh_password = form.ssh_password;
    if (form.snmp_community) payload.snmp_community = form.snmp_community;
    try {
      await updateOLT(olt.id, payload);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteOLT(olt.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.editOltTitle}
    >
      <div className="noc-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">{t.editOltTitle}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-noc-cyan transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
            aria-label={t.cancel}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!showConfirm ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-caps block mb-1.5">{t.colOltName}</label>
                <input className="noc-input" value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div>
                <label className="label-caps block mb-1.5">Vendor / Tipe</label>
                <select className="noc-select" value={form.vendor} onChange={(e) => update('vendor', e.target.value)}>
                  <option value="HSGQ-E04MID">HSGQ-E04MID</option>
                  <option value="ZTE">ZTE</option>
                  <option value="Huawei">Huawei</option>
                  <option value="FiberHome">FiberHome</option>
                  <option value="CDATA">CDATA</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-olt-group" className="label-caps block mb-1.5">{t.oltGroupFormLabel}</label>
                <input
                  id="edit-olt-group"
                  className="noc-input"
                  list="edit-olt-group-options"
                  value={form.group}
                  onChange={(e) => update('group', e.target.value)}
                />
                <datalist id="edit-olt-group-options">
                  {knownGroups.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div>
                <label className="label-caps block mb-1.5">{t.colIp}</label>
                <input className="noc-input font-mono" value={form.ip_address} onChange={(e) => update('ip_address', e.target.value)} required />
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="label-caps text-noc-cyan">SSH CLI</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.ssh_enabled} onChange={(e) => update('ssh_enabled', e.target.checked)} className="accent-noc-cyan" />
                  <span className="font-mono text-xs text-text-secondary">{t.active}</span>
                </label>
              </div>
              {form.ssh_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label-caps block mb-1.5">Username</label>
                    <input className="noc-input" placeholder={olt.ssh_enabled ? '••••••' : 'admin'} value={form.ssh_username} onChange={(e) => update('ssh_username', e.target.value)} />
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">Password</label>
                    <input className="noc-input" type="password" placeholder="••••••" value={form.ssh_password} onChange={(e) => update('ssh_password', e.target.value)} />
                    <p className="mt-1 text-[0.6875rem] text-text-muted">{t.sshPasswordKeepHint}</p>
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">Port SSH</label>
                    <input className="noc-input font-mono" type="number" value={form.ssh_port} onChange={(e) => update('ssh_port', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="label-caps text-noc-cyan">SNMPv2c</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.snmp_enabled} onChange={(e) => update('snmp_enabled', e.target.checked)} className="accent-noc-cyan" />
                  <span className="font-mono text-xs text-text-secondary">{t.active}</span>
                </label>
              </div>
              {form.snmp_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-caps block mb-1.5">Community String</label>
                    <input className="noc-input font-mono" type="password" placeholder="••••••" value={form.snmp_community} onChange={(e) => update('snmp_community', e.target.value)} />
                    <p className="mt-1 text-[0.6875rem] text-text-muted">{t.snmpCommunityKeepHint}</p>
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">Port SNMP</label>
                    <input className="noc-input font-mono" type="number" value={form.snmp_port} onChange={(e) => update('snmp_port', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded bg-noc-rose/10 border border-noc-rose/20 px-4 py-3">
                <span className="font-mono text-xs text-noc-rose">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <button type="button" onClick={() => setShowConfirm(true)} className="btn-destructive !h-10 !px-6">
                {t.deleteOlt}
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="btn-secondary !h-10 !px-6">{t.cancel}</button>
                <button type="submit" disabled={saving} className="btn-primary !h-10 !px-8 disabled:opacity-50">
                  {saving ? t.saving : t.saveSettings}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded bg-noc-rose/10 border border-noc-rose/20 px-4 py-3">
              <p className="font-mono text-xs text-noc-rose leading-relaxed">{t.deleteOltWarning}</p>
            </div>
            <div>
              <label className="label-caps block mb-1.5">
                {t.deleteOltConfirm}: <span className="text-text-primary font-mono">{olt.name}</span>
              </label>
              <input
                className="noc-input font-mono"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={olt.name}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded bg-noc-rose/10 border border-noc-rose/20 px-4 py-3">
                <span className="font-mono text-xs text-noc-rose">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              <button type="button" onClick={() => { setShowConfirm(false); setConfirmName(''); }} className="btn-secondary !h-10 !px-6">
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || confirmName !== olt.name}
                className="btn-destructive !h-10 !px-8 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? t.deleting : t.confirmDelete}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


