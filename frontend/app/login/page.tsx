'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { apiLogin } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, hydrate } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiLogin(username, password);
      login(result.access_token, result.user);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-base">
      {/* Ambient glow background */}
      <div className="ambient-glow ambient-glow-cyan" style={{ width: 800, height: 800, top: '-20%', right: '-10%' }} />
      <div className="ambient-glow ambient-glow-emerald" style={{ width: 600, height: 600, bottom: '-10%', left: '-5%' }} />

      {/* Language Switcher in top right */}
      <div className="absolute top-4 right-4 z-20 flex items-center bg-surface-1/80 p-0.5 rounded-md border border-white/[0.08] backdrop-blur">
        <button
          onClick={() => setLanguage('id')}
          className={cn(
            'px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors',
            language === 'id'
              ? 'bg-noc-cyan/20 text-noc-cyan border border-noc-cyan/30'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          🇮🇩 ID
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={cn(
            'px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors',
            language === 'en'
              ? 'bg-noc-cyan/20 text-noc-cyan border border-noc-cyan/30'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          🇬🇧 EN
        </button>
      </div>

      {/* Login Card */}
      <div className="noc-card-glow w-full max-w-sm mx-4 p-8 relative z-10">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="JOGO-MON"
            width={64}
            height={64}
            className="rounded-lg mb-4"
          />
          <h1 className="text-xl font-bold text-text-primary tracking-wide">{t.loginTitle}</h1>
          <p className="label-caps mt-1 text-[0.65rem] text-center text-text-muted">
            {t.loginSubtitle}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-caps block mb-1.5">{t.labelUsername}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="noc-input"
              placeholder={t.labelUsername}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label-caps block mb-1.5">{t.labelPassword}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="noc-input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded bg-noc-rose/10 border border-noc-rose/20 px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="font-mono text-xs text-noc-rose">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full !h-10 !text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-surface-base/30 border-t-surface-base rounded-full animate-spin" />
                {t.loggingIn}
              </span>
            ) : (
              t.btnLogin
            )}
          </button>
        </form>

        {/* Demo credentials info */}
        <div className="mt-5 p-2.5 rounded bg-white/[0.02] border border-white/[0.04] text-center">
          <p className="font-mono text-[0.65rem] text-text-muted">
            {t.demoHint}
          </p>
        </div>

        {/* Footer hint */}
        <p className="text-center mt-6 font-mono text-[0.6rem] text-text-muted uppercase tracking-wider">
          JOGLONET Network Operations Center
        </p>
      </div>
    </div>
  );
}
