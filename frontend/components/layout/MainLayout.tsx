'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useTranslation } from '@/lib/i18n';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Escape closes the mobile drawer — every overlay needs a keyboard
  // escape route, not just a tappable scrim (a11y: escape-routes).
  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  // Route change: collapse the drawer and reset the scroll container so the
  // next page doesn't inherit the previous scroll offset (nav: back-behavior).
  useEffect(() => {
    setSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      {/* Keyboard users jump straight past nav into telemetry (a11y: skip-links) */}
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>

      {/* Mobile scrim — decorative; Escape and the drawer close button are the
          real dismiss affordances, so keep it out of the a11y tree */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
        <main
          ref={mainRef}
          id="main-content"
          aria-label={t.landmarkMainContent}
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 lg:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
