'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';


interface TopBarProps {
  onMenuClick: () => void;
  /** Drawer state, so the trigger can expose aria-expanded (a11y: state-in-aria) */
  sidebarOpen?: boolean;
}

export function TopBar({ onMenuClick, sidebarOpen = false }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-surface-1/80 px-4 backdrop-blur-md">
      {/* Left: hamburger + live indicator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          // 44px hit area pulled back with -ml-2 so the icon stays visually flush
          className="-ml-2 flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-primary [touch-action:manipulation] lg:hidden"
          aria-label={t.openMenu}
          aria-expanded={sidebarOpen}
          aria-controls="primary-nav"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {/* Polling heartbeat — beacon is decorative, the caption carries meaning
            (a11y: color-not-only) */}
        <div className="flex items-center gap-2" role="status">
          <div aria-hidden="true" className="beacon beacon-online" />
          <span className="label-caps text-text-muted">{t.liveMonitoring}</span>
        </div>
        {timeStr && (
          <span className="hidden sm:inline-block font-mono text-[0.7rem] text-text-muted bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.04]">
            {timeStr}
          </span>
        )}
      </div>

      {/* Right: Wallboard entry + language switch + user info */}
      <div className="flex items-center gap-4">
        {/* Wallboard entry — hidden below sm because /view is built for large
            displays, not phones */}
        <Link
          href="/view"
          className="hidden sm:flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 font-mono text-[0.65rem] tracking-wider text-text-muted transition-colors hover:border-noc-cyan/30 hover:bg-noc-cyan/10 hover:text-noc-cyan [touch-action:manipulation]"
          aria-label={t.navWallboard}
        >
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>{t.wallEnter}</span>
        </Link>

        {/* Language Switcher — aria-pressed carries the active state; the border

            is always present (transparent when idle) so switching never shifts
            the adjacent label by 1px (layout: no-layout-shift) */}
        <div
          role="group"
          aria-label={t.languageSwitcher}
          className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/[0.06]"
        >
          {(['id', 'en'] as const).map((lang) => {
            const isActive = language === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-pressed={isActive}
                aria-label={lang === 'id' ? t.langIndonesian : t.langEnglish}
                className={cn(
                  'flex items-center justify-center rounded border px-2 py-0.5 font-mono text-[0.68rem] font-medium transition-colors [touch-action:manipulation]',
                  isActive
                    ? 'border-noc-cyan/30 bg-noc-cyan/20 text-noc-cyan'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                )}
              >
                <span aria-hidden="true">{lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}</span>
              </button>
            );
          })}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-xs text-text-primary">{user.username}</p>
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-noc-cyan">
                {user.role === 'admin' ? t.roleAdmin : t.roleViewer}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[0.65rem] tracking-wider text-text-muted transition-colors hover:bg-noc-rose/10 hover:text-noc-rose border border-transparent hover:border-noc-rose/20 [touch-action:manipulation]"
              // Label text is hidden below sm, so the icon-only state still needs
              // a name (a11y: icon-button-labels)
              aria-label={t.logout}
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
