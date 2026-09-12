// ============================================================
// JOGO-MON — Utility Functions
// ============================================================

import { getTranslations } from '@/lib/i18n';

/**
 * Classify Rx power (dBm) into severity levels
 * Based on PRD threshold defaults
 */
export function classifyRxPower(
  rx: number | null,
  thresholds = { normal_min: -25, warning_min: -27, critical_min: -30 }
): 'normal' | 'warning' | 'critical' | 'very_critical' | 'unknown' {
  if (rx === null || rx === undefined) return 'unknown';
  if (rx >= thresholds.normal_min) return 'normal';
  if (rx >= thresholds.warning_min) return 'warning';
  if (rx >= thresholds.critical_min) return 'critical';
  return 'very_critical';
}

/**
 * Get CSS color for Rx classification
 */
export function getRxColor(classification: string): string {
  switch (classification) {
    case 'normal': return '#4EDEA3';
    case 'warning': return '#F59E0B';
    case 'critical': return '#F43F5E';
    case 'very_critical': return '#dc2626';
    default: return '#64748B';
  }
}

/**
 * Format dBm value with sign
 */
export function formatDbm(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)} dBm`;
}

/**
 * Format network traffic (Mbps / Gbps)
 */
export function formatTraffic(mbps: number | null | undefined): string {
  if (mbps === null || mbps === undefined) return '—';
  if (mbps === 0) return '0 Mbps';
  if (mbps < 1) return `${(mbps * 1024).toFixed(0)} Kbps`;
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

/**
 * Relative time formatting — mengikuti bahasa aktif (id/en)
 */
export function timeAgo(dateStr: string | null): string {
  const t = getTranslations();
  if (!dateStr) return t.timeNever;

  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 5) return t.timeJustNow;
  if (diff < 60) return `${diff} ${t.timeUnitSec} ${t.timeAgoSuffix}`;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t.timeUnitMin} ${t.timeAgoSuffix}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.timeUnitHour} ${t.timeAgoSuffix}`;
  return `${Math.floor(diff / 86400)} ${t.timeUnitDay} ${t.timeAgoSuffix}`;
}

/**
 * Format uptime from seconds
 */
export function formatUptime(seconds: number | null): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

/**
 * Format temperature
 */
export function formatTemp(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(0)}°C`;
}

/**
 * Merge classnames (simple cn utility)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get beacon class based on status
 */
export function getBeaconClass(status: string): string {
  switch (status) {
    case 'online': return 'beacon beacon-online';
    case 'warning': case 'degraded': return 'beacon beacon-warning';
    case 'critical': case 'offline': return 'beacon beacon-critical';
    default: return 'beacon beacon-offline';
  }
}

/**
 * Get badge class based on status/severity
 */
export function getBadgeClass(value: string): string {
  switch (value) {
    case 'online': case 'normal': case 'active': return 'badge-online';
    case 'warning': case 'acknowledged': return 'badge-warning';
    case 'critical': case 'very_critical': return 'badge-critical';
    case 'offline': case 'closed': return 'badge-offline';
    case 'info': return 'badge-info';
    default: return 'badge-offline';
  }
}
