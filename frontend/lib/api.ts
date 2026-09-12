// ============================================================
// JOGO-MON — API Client
// Centralized API calls; currently uses mock data.
// Toggle USE_MOCK to false when backend is ready.
// ============================================================
import {
  getMockOLTDetail, getMockONUs, getMockONUHistory,
  mockThreshold, mockPollingInterval, getMockTrafficHistory, mockTelegramConfig,
  getMockKPI, getMockOpticalSummary, getMockRxDistribution, getMockWorstONUs,
  getMockOLTs, getMockAlarms, getOLTGroups, getMockGroupSummaries, OLT_GROUP_ALL,
  type KPI, type OpticalSummary, type RxDistribution, type WorstONU,
  type OLTSummary, type OLTDetail, type Alarm, type ONUDetail, type ONUHistory,
  type Threshold, type PollingInterval, type TrafficHistoryPoint, type TelegramConfig,
  type OLTGroupSummary,
} from './mock-data';
import { useAuthStore } from './store';

const USE_MOCK = false;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100/api';

/** Semua endpoint dashboard menerima scope grup site opsional. Sentinel
 *  "semua grup" tidak dikirim ke backend — absennya param artinya fleet-wide. */
function scopeQuery(group?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (group && group !== OLT_GROUP_ALL) params.set('group', group);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// --- Fetch wrapper ---
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API Error');
  }
  return res.json();
}

// --- Auth ---
export async function apiLogin(username: string, password: string): Promise<{ access_token: string; user: { id: string; username: string; role: 'admin' | 'viewer' } }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 500));
    return {
      access_token: 'mock-jwt-token-' + Date.now(),
      user: { id: '1', username, role: 'admin' },
    };
  }
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// --- Dashboard ---
export async function fetchKPI(group?: string): Promise<KPI> {
  if (USE_MOCK) return getMockKPI(group);
  return apiFetch(`/dashboard/kpi${scopeQuery(group)}`);
}

export async function fetchOpticalSummary(group?: string): Promise<OpticalSummary> {
  if (USE_MOCK) return getMockOpticalSummary(group);
  return apiFetch(`/dashboard/optical-summary${scopeQuery(group)}`);
}

export async function fetchRxDistribution(group?: string): Promise<RxDistribution[]> {
  if (USE_MOCK) return getMockRxDistribution(group);
  return apiFetch(`/dashboard/rx-distribution${scopeQuery(group)}`);
}

export async function fetchWorstONUs(limit = 10, group?: string): Promise<WorstONU[]> {
  if (USE_MOCK) return getMockWorstONUs(limit, group);
  return apiFetch(`/dashboard/worst-onu${scopeQuery(group, { limit: String(limit) })}`);
}

export async function fetchOLTList(group?: string): Promise<OLTSummary[]> {
  if (USE_MOCK) return getMockOLTs(group);
  return apiFetch(`/dashboard/olt-list${scopeQuery(group)}`);
}

export async function fetchTrafficHistory(group?: string): Promise<TrafficHistoryPoint[]> {
  if (USE_MOCK) return getMockTrafficHistory(group);
  return apiFetch(`/dashboard/traffic-history${scopeQuery(group)}`);
}

// --- Groups (site clusters) ---
export async function fetchOLTGroups(): Promise<string[]> {
  if (USE_MOCK) return getOLTGroups();
  return apiFetch('/dashboard/groups');
}

export async function fetchGroupSummaries(): Promise<OLTGroupSummary[]> {
  if (USE_MOCK) return getMockGroupSummaries();
  return apiFetch('/dashboard/group-summary');
}

// --- OLTs ---
export async function fetchOLTDetail(oltId: string): Promise<OLTDetail | null> {
  if (USE_MOCK) return getMockOLTDetail(oltId);
  return apiFetch(`/olts/${oltId}`);
}

export async function fetchPONONUs(oltId: string, ponId: string): Promise<ONUDetail[]> {
  if (USE_MOCK) return getMockONUs(ponId);
  return apiFetch(`/olts/${oltId}/pons/${ponId}`);
}

export async function fetchONUHistory(oltId: string, ponId: string, onuId: string): Promise<ONUHistory[]> {
  if (USE_MOCK) return getMockONUHistory(onuId);
  return apiFetch(`/olts/${oltId}/pons/${ponId}/onus/${onuId}/history`);
}

// --- Alarms ---
export async function fetchAlarms(filters?: { status?: string; severity?: string; group?: string }): Promise<Alarm[]> {
  if (USE_MOCK) {
    let alarms = [...getMockAlarms(filters?.group)];
    if (filters?.status && filters.status !== 'all') {
      alarms = alarms.filter(a => a.status === filters.status);
    }
    if (filters?.severity && filters.severity !== 'all') {
      alarms = alarms.filter(a => a.severity === filters.severity);
    }
    return alarms;
  }
  const extra: Record<string, string> = {};
  if (filters?.status) extra.status = filters.status;
  if (filters?.severity) extra.severity = filters.severity;
  return apiFetch(`/alarms${scopeQuery(filters?.group, extra)}`);
}

export async function acknowledgeAlarm(alarmId: string): Promise<void> {
  if (USE_MOCK) {
    const alarm = getMockAlarms().find(a => a.id === alarmId);
    if (alarm) {
      alarm.status = 'acknowledged';
      alarm.acknowledged_at = new Date().toISOString();
    }
    return;
  }
  await apiFetch(`/alarms/${alarmId}/acknowledge`, { method: 'POST' });
}

export async function closeAlarm(alarmId: string): Promise<void> {
  if (USE_MOCK) {
    const alarm = getMockAlarms().find(a => a.id === alarmId);
    if (alarm) {
      alarm.status = 'closed';
      alarm.closed_at = new Date().toISOString();
    }
    return;
  }
  await apiFetch(`/alarms/${alarmId}/close`, { method: 'POST' });
}

// --- Settings ---
export async function fetchThresholds(): Promise<Threshold> {
  if (USE_MOCK) return mockThreshold;
  return apiFetch('/settings/thresholds');
}

export async function updateThresholds(data: Partial<Threshold>): Promise<Threshold> {
  if (USE_MOCK) return { ...mockThreshold, ...data };
  return apiFetch('/settings/thresholds', { method: 'PUT', body: JSON.stringify(data) });
}

export async function fetchPollingInterval(): Promise<PollingInterval> {
  if (USE_MOCK) return mockPollingInterval;
  return apiFetch('/settings/polling');
}

export async function updatePollingInterval(data: Partial<PollingInterval>): Promise<PollingInterval> {
  if (USE_MOCK) return { ...mockPollingInterval, ...data };
  return apiFetch('/settings/polling', { method: 'PUT', body: JSON.stringify(data) });
}

export async function createOLT(data: Record<string, unknown>): Promise<OLTSummary> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 500));
    return {
      id: 'new-' + Date.now(),
      name: data.name as string,
      vendor: data.vendor as string,
      group: (data.group as string) || 'Ungrouped',
      ip_address: data.ip_address as string,
      status: 'unknown',
      total_onu: 0, online_onu: 0, offline_onu: 0, low_rx_onu: 0,
      cpu_usage: null, memory_usage: null, temperature: null, uptime: null,
      last_poll: new Date().toISOString(), pon_count: 0, active_alarms: 0,
      traffic_in_mbps: 0, traffic_out_mbps: 0,
    };
  }
  return apiFetch('/olts', { method: 'POST', body: JSON.stringify(data) });
}

// --- Telegram Notifications ---
export async function fetchTelegramConfig(): Promise<TelegramConfig> {
  if (USE_MOCK) return mockTelegramConfig;
  return apiFetch('/settings/telegram');
}

export async function updateTelegramConfig(data: Partial<TelegramConfig>): Promise<TelegramConfig> {
  if (USE_MOCK) return { ...mockTelegramConfig, ...data };
  return apiFetch('/settings/telegram', { method: 'PUT', body: JSON.stringify(data) });
}

export async function testTelegramNotification(): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 600));
    return {
      success: true,
      message: 'Pesan pengujian berhasil dikirim ke grup Telegram NOC JOGLONET (-1002049182941)!',
    };
  }
  return apiFetch('/settings/telegram/test', { method: 'POST' });
}

export async function resendAlarmToTelegram(alarmId: string): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    return {
      success: true,
      message: `Alarm ${alarmId} berhasil diteruskan ke Telegram.`,
    };
  }
  return apiFetch(`/alarms/${alarmId}/notify-telegram`, { method: 'POST' });
}
