'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { fetchTelegramConfig, updateTelegramConfig, testTelegramNotification } from '@/lib/api';
import type { TelegramConfig } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface Props {
  isAdmin: boolean;
}

export function TelegramForm({ isAdmin }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchTelegramConfig().then(setConfig);
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
      </div>
    );
  }

  const update = (key: keyof TelegramConfig, val: unknown) => {
    setConfig(prev => prev ? ({ ...prev, [key]: val }) : null);
    setSaveSuccess(false);
    setTestResult(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateTelegramConfig(config);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save Telegram config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testTelegramNotification();
      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal mengirim pesan uji coba ke Telegram.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Master Toggle Card */}
      <div className="noc-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Telegram Icon */}
            <div className="w-10 h-10 rounded-lg bg-[#229ED9]/15 border border-[#229ED9]/30 flex items-center justify-center text-[#229ED9]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.63 3.73-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.66-2.88 7.99-3.44 3.8-1.58 4.59-1.86 5.11-1.87.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.21-.03.35z"/>
              </svg>
            </div>
            <div>
              <h3 className="label-caps !text-sm text-text-primary tracking-wide">
                {t.telegramTitle}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {t.telegramSubtitle}
              </p>
            </div>
          </div>

          {/* Toggle button */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              disabled={!isAdmin}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#229ED9]"></div>
          </label>
        </div>
      </div>

      {/* Bot & Group Credentials Card */}
      <div className={cn("noc-card p-6 space-y-4", !config.enabled && "opacity-60 pointer-events-none")}>
        <h3 className="label-caps text-noc-cyan mb-1">Kredensial Telegram Bot</h3>
        <p className="text-xs text-text-muted mb-4">
          Buat bot melalui <strong>@BotFather</strong> di Telegram, dapatkan API Token, lalu tambahkan bot ke grup NOC Anda dan salin Chat ID.
        </p>

        <div className="space-y-4">
          {/* Bot Token */}
          <div>
            <label className="label-caps block mb-1.5">{t.telegramBotToken}</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.bot_token}
                onChange={(e) => update('bot_token', e.target.value)}
                disabled={!isAdmin}
                className="noc-input font-mono pr-20"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 font-mono text-[0.65rem] text-text-muted hover:text-text-primary rounded bg-white/[0.04]"
              >
                {showToken ? 'Sembunyi' : 'Lihat'}
              </button>
            </div>
          </div>

          {/* Chat ID & Thread ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-caps block mb-1.5">{t.telegramChatId}</label>
              <input
                type="text"
                value={config.chat_id}
                onChange={(e) => update('chat_id', e.target.value)}
                disabled={!isAdmin}
                className="noc-input font-mono"
                placeholder="-1001234567890"
                required
              />
              <span className="font-mono text-[0.65rem] text-text-muted mt-1 block">
                Contoh: ID grup NOC berawalan -100
              </span>
            </div>
            <div>
              <label className="label-caps block mb-1.5">{t.telegramThreadId}</label>
              <input
                type="text"
                value={config.thread_id || ''}
                onChange={(e) => update('thread_id', e.target.value)}
                disabled={!isAdmin}
                className="noc-input font-mono"
                placeholder="42"
              />
              <span className="font-mono text-[0.65rem] text-text-muted mt-1 block">
                Kosongkan jika bukan supergroup forum
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Triggers Card */}
      <div className={cn("noc-card p-6 space-y-4", !config.enabled && "opacity-60 pointer-events-none")}>
        <h3 className="label-caps text-noc-cyan mb-1">{t.telegramTriggers}</h3>
        <p className="text-xs text-text-muted mb-4">
          Pilih jenis insiden yang akan otomatis memicu pesan alert ke grup Telegram.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-2/60 border border-white/[0.03] cursor-pointer hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={config.notify_on_critical}
              onChange={(e) => update('notify_on_critical', e.target.checked)}
              disabled={!isAdmin}
              className="accent-[#229ED9] mt-0.5"
            />
            <div>
              <span className="font-mono text-xs font-semibold text-text-primary block">
                {t.telegramOnCritical}
              </span>
              <span className="font-mono text-[0.68rem] text-text-muted">
                Daya Rx &lt; -27 dBm atau status ONU berubah menjadi offline (LOS).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-2/60 border border-white/[0.03] cursor-pointer hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={config.notify_on_warning}
              onChange={(e) => update('notify_on_warning', e.target.checked)}
              disabled={!isAdmin}
              className="accent-[#229ED9] mt-0.5"
            />
            <div>
              <span className="font-mono text-xs font-semibold text-text-primary block">
                {t.telegramOnWarning}
              </span>
              <span className="font-mono text-[0.68rem] text-text-muted">
                Daya Rx -25 s/d -27 dBm mendekati batas toleransi sebelum putus.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-2/60 border border-white/[0.03] cursor-pointer hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={config.notify_on_olt_offline}
              onChange={(e) => update('notify_on_olt_offline', e.target.checked)}
              disabled={!isAdmin}
              className="accent-[#229ED9] mt-0.5"
            />
            <div>
              <span className="font-mono text-xs font-semibold text-noc-rose block">
                {t.telegramOnOltOffline}
              </span>
              <span className="font-mono text-[0.68rem] text-text-muted">
                Prioritas darurat tertinggi (SEV-1): Kegagalan komunikasi SSH & SNMP ke OLT.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-2.5 rounded-lg bg-surface-2/60 border border-white/[0.03] cursor-pointer hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={config.notify_on_recovery}
              onChange={(e) => update('notify_on_recovery', e.target.checked)}
              disabled={!isAdmin}
              className="accent-[#229ED9] mt-0.5"
            />
            <div>
              <span className="font-mono text-xs font-semibold text-noc-emerald block">
                {t.telegramOnRecovery}
              </span>
              <span className="font-mono text-[0.68rem] text-text-muted">
                Kirim info pemulihan saat OLT kembali online atau redaman ONU normal kembali.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Message Template Preview Card */}
      <div className="noc-card p-6 space-y-3">
        <h3 className="label-caps text-noc-cyan">{t.telegramPreviewTitle}</h3>
        <p className="text-xs text-text-muted">
          Format pesan markdown yang diterima oleh operator di aplikasi Telegram:
        </p>

        {/* Telegram Chat Bubble Simulation */}
        <div className="rounded-xl bg-[#17212b] p-4 border border-white/[0.08] text-white font-mono text-xs max-w-lg space-y-2 shadow-2xl">
          <div className="flex items-center justify-between text-[0.65rem] text-[#229ed9] border-b border-white/[0.06] pb-1.5 font-bold">
            <span>🤖 JOGO-MON NOC Bot</span>
            <span className="text-gray-400">02:48 WIB</span>
          </div>
          <div className="space-y-1 text-[0.75rem] leading-relaxed">
            <p className="text-[#f43f5e] font-bold">🚨 [JOGO-MON ALERT] — SEV-1 CRITICAL</p>
            <p className="text-gray-400">━━━━━━━━━━━━━━━━━━</p>
            <p><strong>📍 Lokasi</strong> : OLT-Gantiwarno (10.99.0.14)</p>
            <p><strong>⚠️ Gangguan</strong> : OLT Unreachable (Chassis Down)</p>
            <p><strong>⏱️ Terdeteksi</strong> : 05/09/2026 02:48:12 WIB</p>
            <p><strong>👥 Dampak</strong> : 64 Pelanggan (ONU Offline)</p>
            <p className="text-gray-400">━━━━━━━━━━━━━━━━━━</p>
            <p className="text-[#4edea3]">💡 Status: Scheduler auto-failover ke SNMP gagal.</p>
          </div>
        </div>
      </div>

      {/* Test feedback banner */}
      {testResult && (
        <div className={cn(
          "flex items-center gap-2.5 rounded-lg p-3.5 border font-mono text-xs",
          testResult.success
            ? "bg-noc-emerald/10 border-noc-emerald/30 text-noc-emerald"
            : "bg-noc-rose/10 border-noc-rose/30 text-noc-rose"
        )}>
          <span className={cn("w-2 h-2 rounded-full", testResult.success ? "bg-noc-emerald animate-pulse" : "bg-noc-rose")} />
          <span>{testResult.message}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded bg-noc-emerald/10 border border-noc-emerald/20 px-4 py-3">
          <span className="beacon beacon-online" />
          <span className="font-mono text-xs text-noc-emerald">{t.savedSuccess}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!isAdmin || saving}
          className="btn-primary !h-10 !px-7 disabled:opacity-50"
        >
          {saving ? t.saving : t.saveSettings}
        </button>

        <button
          type="button"
          onClick={handleTest}
          disabled={!isAdmin || testing || !config.enabled}
          className="btn-secondary !h-10 !px-5 font-mono text-xs flex items-center gap-2 border-[#229ED9]/40 text-[#229ED9] hover:bg-[#229ED9]/10 disabled:opacity-50"
        >
          {testing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-[#229ED9]/30 border-t-[#229ED9] rounded-full animate-spin" />
              <span>{t.telegramTesting}</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
              <span>{t.telegramTestBtn}</span>
            </>
          )}
        </button>

        {!isAdmin && <p className="font-mono text-xs text-noc-amber mt-1">{t.adminNotice}</p>}
      </div>
    </form>
  );
}
