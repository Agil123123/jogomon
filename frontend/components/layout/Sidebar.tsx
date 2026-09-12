'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    {
      label: t.navDashboard,
      href: '/',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      label: t.navOlt,
      href: '/olt',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="7" rx="1.5" />
          <rect x="2" y="14" width="20" height="7" rx="1.5" />
          <line x1="6" y1="6.5" x2="6" y2="6.5" />
          <line x1="6" y1="17.5" x2="6" y2="17.5" />
          <line x1="10" y1="6.5" x2="18" y2="6.5" />
          <line x1="10" y1="17.5" x2="18" y2="17.5" />
        </svg>
      ),
    },
    {
      label: t.navAlarms,
      href: '/alarms',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      label: t.navSettings,
      href: '/settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      id="primary-nav"
      className={cn(
        // visibility is in the transition list on purpose: it flips only at the
        // end when heading to hidden, so the slide-out still plays
        'fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-white/[0.06] bg-surface-1 transition-[transform,visibility] duration-300 lg:static lg:visible lg:translate-x-0',
        // visibility (not just translate) so an off-screen drawer stays out of
        // the tab order on mobile — hidden focusable content is a a11y trap.
        // Desktop is always visible via lg:visible above.
        isOpen ? 'translate-x-0' : 'invisible -translate-x-full'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4">
        <Image src="/logo.png" alt="" aria-hidden="true" width={36} height={36} className="rounded" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold tracking-wide text-text-primary">JOGO-MON</h1>
          <p className="text-[0.6rem] font-medium tracking-wider text-text-muted uppercase">
            {t.brandSubtitle}
          </p>
        </div>
        {/* Explicit dismiss inside the drawer — the scrim is decorative and
            Escape isn't discoverable on touch (a11y: escape-routes) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closeMenu}
          className="-mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-primary [touch-action:manipulation] lg:hidden"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label={t.landmarkMainNav} className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              // aria-current is what screen readers announce; colour alone
              // can't carry "you are here" (a11y: color-not-only)
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // 44px min touch target + inset ring instead of border-l, so the
                // active item doesn't shift its own label by 2px on navigation
                'flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 [touch-action:manipulation]',
                isActive
                  ? 'bg-noc-cyan/10 text-noc-cyan shadow-[inset_2px_0_0_0_var(--color-noc-cyan)]'
                  : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
              )}
            >
              <span aria-hidden="true" className={cn(isActive ? 'text-noc-cyan' : 'text-text-muted')}>
                {item.icon}
              </span>
              <span className="font-mono text-xs uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        {/* Polling health: beacon is decorative, the text is the real signal */}
        <div className="flex items-center gap-2" role="status">
          <div aria-hidden="true" className="beacon beacon-online" />
          <span className="font-mono text-[0.65rem] text-text-muted uppercase tracking-wider">
            {t.synced}
          </span>
        </div>
      </div>
    </aside>
  );
}
