// ============================================================
// JOGO-MON — Mock Data Layer
// Realistic GPON telemetry data matching PRD API contract
// ============================================================

// --- Types ---
export interface OLTSummary {
  id: string;
  name: string;
  vendor: string;
  /** Site cluster untuk grouping NOC, mis. "Klaten" / "Kebumen". */
  group: string;
  ip_address: string;
  status: 'online' | 'offline' | 'unknown';
  total_onu: number;
  online_onu: number;
  offline_onu: number;
  low_rx_onu: number;
  cpu_usage: number | null;
  memory_usage: number | null;
  temperature: number | null;
  uptime: number | null;
  last_poll: string;
  pon_count: number;
  active_alarms: number;
  traffic_in_mbps: number;
  traffic_out_mbps: number;
}

export interface UplinkPort {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'standby' | 'offline';
  speed_gbps: number;
  traffic_in_mbps: number;
  traffic_out_mbps: number;
  utilization_percent: number;
}

export interface OLTDetail extends OLTSummary {
  ssh_enabled: boolean;
  snmp_enabled: boolean;
  ssh_port: number;
  snmp_port: number;
  uplinks: UplinkPort[];
  traffic_history: TrafficHistoryPoint[];
  pons: PONDetail[];
}

export interface PONDetail {
  id: string;
  olt_id: string;
  slot: number;
  port: number;
  status: 'online' | 'offline';
  total_onu: number;
  online_onu: number;
  offline_onu: number;
  low_rx_onu: number;
  last_poll: string;
  traffic_in_mbps: number;
  traffic_out_mbps: number;
}

export interface ONUDetail {
  id: string;
  pon_id: string;
  onu_id: string;
  serial_number: string;
  status: 'online' | 'offline';
  rx_power: number | null;
  tx_power: number | null;
  olt_rx_power: number | null;
  olt_tx_power: number | null;
  distance: number | null;
  last_seen: string;
  traffic_in_mbps: number | null;
  traffic_out_mbps: number | null;
}

export interface Alarm {
  id: string;
  olt_id: string | null;
  olt_name: string;
  pon_id: string | null;
  pon_label: string | null;
  onu_id: string | null;
  onu_serial: string | null;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'closed';
  type: 'los' | 'high_attenuation' | 'olt_unreachable' | 'laser_out';
  message: string;
  rx_power: number | null;
  created_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
  sent_to_telegram?: boolean;
}

export interface KPI {
  total_olt: number;
  online_olt: number;
  offline_olt: number;
  total_onu: number;
  online_onu: number;
  offline_onu: number;
  active_alarms: number;
  critical_alarms: number;
  optical_health_percent: number;
  total_traffic_in_mbps: number;
  total_traffic_out_mbps: number;
  total_traffic_mbps: number;
}

export interface OpticalSummary {
  normal: number;
  warning: number;
  critical: number;
  very_critical: number;
}

export interface RxDistribution {
  range: string;
  count: number;
  classification: string;
}

export interface WorstONU {
  id: string;
  serial_number: string;
  rx_power: number;
  olt_name: string;
  pon_label: string;
  status: string;
  traffic_in_mbps: number;
  traffic_out_mbps: number;
}

export interface ONUHistory {
  timestamp: string;
  rx_power: number;
  tx_power: number;
}

export interface TrafficHistoryPoint {
  time: string;
  traffic_in_gbps: number;
  traffic_out_gbps: number;
  total_gbps: number;
}

export interface Threshold {
  id: string;
  normal_min: number;
  warning_min: number;
  critical_min: number;
  very_critical_min: number;
  is_active: boolean;
}

export interface PollingInterval {
  id: string;
  olt_status: number;
  pon_status: number;
  onu_status: number;
  optical_power: number;
  cpu_memory: number;
}

export interface TelegramConfig {
  id: string;
  enabled: boolean;
  bot_token: string;
  chat_id: string;
  thread_id?: string;
  notify_on_critical: boolean;
  notify_on_warning: boolean;
  notify_on_recovery: boolean;
  notify_on_olt_offline: boolean;
  last_test_status?: string | null;
  last_test_at?: string | null;
}

// --- Helpers ---
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

// --- OLT Fleet ---
export const mockOLTs: OLTSummary[] = [
  {
    id: uuid(1), name: 'OLT-Bulus', vendor: 'HSGQ-E04MID', group: 'Kebumen', ip_address: '10.99.0.11',
    status: 'online', total_onu: 128, online_onu: 121, offline_onu: 5, low_rx_onu: 7,
    cpu_usage: 34.2, memory_usage: 52.8, temperature: 42, uptime: 2592000,
    last_poll: ago(1), pon_count: 4, active_alarms: 3,
    traffic_in_mbps: 2840.5, traffic_out_mbps: 820.3,
  },
  {
    id: uuid(2), name: 'OLT-Mirit', vendor: 'HSGQ-E04MID', group: 'Kebumen', ip_address: '10.99.0.12',
    status: 'online', total_onu: 96, online_onu: 92, offline_onu: 3, low_rx_onu: 4,
    cpu_usage: 28.7, memory_usage: 45.3, temperature: 39, uptime: 1728000,
    last_poll: ago(1), pon_count: 4, active_alarms: 2,
    traffic_in_mbps: 1950.2, traffic_out_mbps: 540.8,
  },
  {
    id: uuid(3), name: 'OLT-Kalikotes', vendor: 'HSGQ-E04MID', group: 'Klaten', ip_address: '10.99.0.13',
    status: 'online', total_onu: 84, online_onu: 79, offline_onu: 4, low_rx_onu: 6,
    cpu_usage: 41.5, memory_usage: 61.2, temperature: 44, uptime: 864000,
    last_poll: ago(2), pon_count: 4, active_alarms: 4,
    traffic_in_mbps: 1620.0, traffic_out_mbps: 480.2,
  },
  {
    id: uuid(4), name: 'OLT-Gantiwarno', vendor: 'HSGQ-E04MID', group: 'Klaten', ip_address: '10.99.0.14',
    status: 'offline', total_onu: 64, online_onu: 0, offline_onu: 64, low_rx_onu: 0,
    cpu_usage: null, memory_usage: null, temperature: null, uptime: null,
    last_poll: ago(45), pon_count: 4, active_alarms: 1,
    traffic_in_mbps: 0, traffic_out_mbps: 0,
  },
  {
    id: uuid(5), name: 'OLT-Purworejo', vendor: 'HSGQ-E04MID', group: 'Purworejo', ip_address: '10.99.0.15',
    status: 'online', total_onu: 112, online_onu: 108, offline_onu: 2, low_rx_onu: 5,
    cpu_usage: 22.1, memory_usage: 38.9, temperature: 37, uptime: 5184000,
    last_poll: ago(1), pon_count: 4, active_alarms: 1,
    traffic_in_mbps: 2450.6, traffic_out_mbps: 710.4,
  },
];

// KPI, optical summary, dan Rx distribution di-derive per grup —
// lihat section "Group (site cluster) scoping" di bawah file ini.

// --- Worst ONU ---
export const mockWorstONUs: WorstONU[] = [
  { id: uuid(101), serial_number: 'HSGQ-A1B2C3D4', rx_power: -33.2, olt_name: 'OLT-Kalikotes', pon_label: '0/1', status: 'online', traffic_in_mbps: 3.4, traffic_out_mbps: 0.8 },
  { id: uuid(102), serial_number: 'HSGQ-E5F6G7H8', rx_power: -32.8, olt_name: 'OLT-Bulus', pon_label: '0/3', status: 'online', traffic_in_mbps: 8.2, traffic_out_mbps: 1.5 },
  { id: uuid(103), serial_number: 'HSGQ-I9J0K1L2', rx_power: -31.5, olt_name: 'OLT-Mirit', pon_label: '0/2', status: 'online', traffic_in_mbps: 12.6, traffic_out_mbps: 2.1 },
  { id: uuid(104), serial_number: 'HSGQ-M3N4O5P6', rx_power: -31.1, olt_name: 'OLT-Kalikotes', pon_label: '0/3', status: 'online', traffic_in_mbps: 5.1, traffic_out_mbps: 0.9 },
  { id: uuid(105), serial_number: 'HSGQ-Q7R8S9T0', rx_power: -30.7, olt_name: 'OLT-Purworejo', pon_label: '0/1', status: 'offline', traffic_in_mbps: 0.0, traffic_out_mbps: 0.0 },
  { id: uuid(106), serial_number: 'HSGQ-U1V2W3X4', rx_power: -30.2, olt_name: 'OLT-Bulus', pon_label: '0/1', status: 'online', traffic_in_mbps: 18.4, traffic_out_mbps: 3.8 },
  { id: uuid(107), serial_number: 'HSGQ-Y5Z6A7B8', rx_power: -29.8, olt_name: 'OLT-Kalikotes', pon_label: '0/2', status: 'online', traffic_in_mbps: 14.2, traffic_out_mbps: 2.7 },
  { id: uuid(108), serial_number: 'HSGQ-C9D0E1F2', rx_power: -29.4, olt_name: 'OLT-Mirit', pon_label: '0/3', status: 'online', traffic_in_mbps: 22.8, traffic_out_mbps: 4.5 },
  { id: uuid(109), serial_number: 'HSGQ-G3H4I5J6', rx_power: -28.9, olt_name: 'OLT-Purworejo', pon_label: '0/2', status: 'online', traffic_in_mbps: 27.5, traffic_out_mbps: 5.2 },
  { id: uuid(110), serial_number: 'HSGQ-K7L8M9N0', rx_power: -28.5, olt_name: 'OLT-Bulus', pon_label: '0/2', status: 'online', traffic_in_mbps: 31.0, traffic_out_mbps: 6.4 },
];

// --- Alarms ---
export const mockAlarms: Alarm[] = [
  {
    id: uuid(201), olt_id: uuid(4), olt_name: 'OLT-Gantiwarno', pon_id: null, pon_label: null,
    onu_id: null, onu_serial: null, severity: 'critical', status: 'active',
    type: 'olt_unreachable', message: 'OLT Gantiwarno unreachable - SSH & SNMP timeout',
    rx_power: null, created_at: ago(45), acknowledged_at: null, closed_at: null,
    sent_to_telegram: true,
  },
  {
    id: uuid(202), olt_id: uuid(1), olt_name: 'OLT-Bulus', pon_id: uuid(301), pon_label: '0/3',
    onu_id: uuid(102), onu_serial: 'HSGQ-E5F6G7H8', severity: 'critical', status: 'active',
    type: 'high_attenuation', message: 'Rx power -32.8 dBm below critical threshold',
    rx_power: -32.8, created_at: ago(12), acknowledged_at: null, closed_at: null,
    sent_to_telegram: true,
  },
  {
    id: uuid(203), olt_id: uuid(3), olt_name: 'OLT-Kalikotes', pon_id: uuid(309), pon_label: '0/1',
    onu_id: uuid(101), onu_serial: 'HSGQ-A1B2C3D4', severity: 'critical', status: 'active',
    type: 'high_attenuation', message: 'Rx power -33.2 dBm below critical threshold',
    rx_power: -33.2, created_at: ago(8), acknowledged_at: null, closed_at: null,
    sent_to_telegram: true,
  },
  {
    id: uuid(204), olt_id: uuid(5), olt_name: 'OLT-Purworejo', pon_id: uuid(317), pon_label: '0/1',
    onu_id: uuid(105), onu_serial: 'HSGQ-Q7R8S9T0', severity: 'critical', status: 'acknowledged',
    type: 'los', message: 'ONU offline - Loss of Signal detected',
    rx_power: -30.7, created_at: ago(120), acknowledged_at: ago(90), closed_at: null,
    sent_to_telegram: true,
  },
  {
    id: uuid(205), olt_id: uuid(1), olt_name: 'OLT-Bulus', pon_id: uuid(301), pon_label: '0/1',
    onu_id: uuid(106), onu_serial: 'HSGQ-U1V2W3X4', severity: 'warning', status: 'active',
    type: 'high_attenuation', message: 'Rx power -30.2 dBm in critical range',
    rx_power: -30.2, created_at: ago(5), acknowledged_at: null, closed_at: null,
  },
  {
    id: uuid(206), olt_id: uuid(2), olt_name: 'OLT-Mirit', pon_id: uuid(305), pon_label: '0/2',
    onu_id: uuid(103), onu_serial: 'HSGQ-I9J0K1L2', severity: 'warning', status: 'active',
    type: 'high_attenuation', message: 'Rx power -31.5 dBm in critical range',
    rx_power: -31.5, created_at: ago(15), acknowledged_at: null, closed_at: null,
  },
  {
    id: uuid(207), olt_id: uuid(3), olt_name: 'OLT-Kalikotes', pon_id: uuid(311), pon_label: '0/3',
    onu_id: uuid(104), onu_serial: 'HSGQ-M3N4O5P6', severity: 'warning', status: 'active',
    type: 'high_attenuation', message: 'Rx power -31.1 dBm in critical range',
    rx_power: -31.1, created_at: ago(20), acknowledged_at: null, closed_at: null,
  },
  {
    id: uuid(208), olt_id: uuid(1), olt_name: 'OLT-Bulus', pon_id: uuid(303), pon_label: '0/2',
    onu_id: uuid(110), onu_serial: 'HSGQ-K7L8M9N0', severity: 'warning', status: 'acknowledged',
    type: 'high_attenuation', message: 'Rx power -28.5 dBm approaching warning threshold',
    rx_power: -28.5, created_at: ago(180), acknowledged_at: ago(150), closed_at: null,
  },
  {
    id: uuid(209), olt_id: uuid(2), olt_name: 'OLT-Mirit', pon_id: uuid(307), pon_label: '0/3',
    onu_id: uuid(108), onu_serial: 'HSGQ-C9D0E1F2', severity: 'info', status: 'active',
    type: 'high_attenuation', message: 'Rx power -29.4 dBm - monitor closely',
    rx_power: -29.4, created_at: ago(30), acknowledged_at: null, closed_at: null,
  },
  {
    id: uuid(210), olt_id: uuid(3), olt_name: 'OLT-Kalikotes', pon_id: uuid(309), pon_label: '0/2',
    onu_id: uuid(107), onu_serial: 'HSGQ-Y5Z6A7B8', severity: 'info', status: 'closed',
    type: 'high_attenuation', message: 'Rx power recovered after connector cleaning',
    rx_power: -29.8, created_at: ago(360), acknowledged_at: ago(300), closed_at: ago(240),
  },
  {
    id: uuid(211), olt_id: uuid(5), olt_name: 'OLT-Purworejo', pon_id: uuid(319), pon_label: '0/2',
    onu_id: uuid(109), onu_serial: 'HSGQ-G3H4I5J6', severity: 'warning', status: 'active',
    type: 'high_attenuation', message: 'Rx power -28.9 dBm approaching critical threshold',
    rx_power: -28.9, created_at: ago(10), acknowledged_at: null, closed_at: null,
  },
];

// --- OLT Detail (with PONs) ---
function generatePONs(oltId: string, oltIndex: number): PONDetail[] {
  const bases = [
    { total: 32, online: 30, offline: 1, low: 2, tin: 740.5, tout: 215.2 },
    { total: 28, online: 27, offline: 1, low: 1, tin: 610.8, tout: 182.4 },
    { total: 36, online: 33, offline: 2, low: 3, tin: 890.2, tout: 260.5 },
    { total: 32, online: 31, offline: 1, low: 1, tin: 599.0, tout: 162.2 },
  ];
  return bases.map((b, i) => ({
    id: uuid(300 + oltIndex * 4 + i),
    olt_id: oltId,
    slot: 0,
    port: i + 1,
    status: 'online' as const,
    total_onu: b.total,
    online_onu: b.online,
    offline_onu: b.offline,
    low_rx_onu: b.low,
    last_poll: ago(1),
    traffic_in_mbps: b.tin,
    traffic_out_mbps: b.tout,
  }));
}

function generateUplinks(olt: OLTSummary): UplinkPort[] {
  if (olt.status === 'offline') {
    return [
      { id: 'up-1', name: 'Uplink 1 (10GE SFP+)', type: '10GBASE-LR SFP+', status: 'offline', speed_gbps: 10, traffic_in_mbps: 0, traffic_out_mbps: 0, utilization_percent: 0 },
      { id: 'up-2', name: 'Uplink 2 (10GE SFP+)', type: '10GBASE-LR SFP+', status: 'offline', speed_gbps: 10, traffic_in_mbps: 0, traffic_out_mbps: 0, utilization_percent: 0 },
    ];
  }
  const util = parseFloat(((olt.traffic_in_mbps / 10000) * 100).toFixed(1));
  return [
    {
      id: 'up-1',
      name: 'Uplink 1 (10GE SFP+ - Core JOGLONET)',
      type: '10GBASE-LR SFP+ (Single-mode)',
      status: 'online',
      speed_gbps: 10,
      traffic_in_mbps: olt.traffic_in_mbps,
      traffic_out_mbps: olt.traffic_out_mbps,
      utilization_percent: util,
    },
    {
      id: 'up-2',
      name: 'Uplink 2 (10GE SFP+ - Ring Backup)',
      type: '10GBASE-LR SFP+ (Single-mode)',
      status: 'standby',
      speed_gbps: 10,
      traffic_in_mbps: 0,
      traffic_out_mbps: 0,
      utilization_percent: 0,
    },
  ];
}

function generateOLTTrafficHistory(olt: OLTSummary): TrafficHistoryPoint[] {
  const baseCurve = getMockTrafficHistory();
  if (olt.status === 'offline') {
    return baseCurve.map(b => ({ ...b, traffic_in_gbps: 0, traffic_out_gbps: 0, total_gbps: 0 }));
  }
  const scale = (olt.traffic_in_mbps / 8861.3) || 0.3;
  return baseCurve.map(b => {
    const inG = parseFloat((b.traffic_in_gbps * scale).toFixed(2));
    const outG = parseFloat((b.traffic_out_gbps * scale).toFixed(2));
    return {
      time: b.time,
      traffic_in_gbps: inG,
      traffic_out_gbps: outG,
      total_gbps: parseFloat((inG + outG).toFixed(2)),
    };
  });
}

export function getMockOLTDetail(oltId: string): OLTDetail | null {
  const idx = mockOLTs.findIndex(o => o.id === oltId);
  if (idx === -1) return null;
  const olt = mockOLTs[idx];
  return {
    ...olt,
    ssh_enabled: true,
    snmp_enabled: true,
    ssh_port: 22,
    snmp_port: 161,
    uplinks: generateUplinks(olt),
    traffic_history: generateOLTTrafficHistory(olt),
    pons: olt.status === 'offline'
      ? generatePONs(oltId, idx).map(p => ({
        ...p,
        status: 'offline' as const,
        online_onu: 0,
        offline_onu: p.total_onu,
        traffic_in_mbps: 0,
        traffic_out_mbps: 0,
      }))
      : generatePONs(oltId, idx),
  };
}

// --- ONUs per PON ---
function randomRx(): number {
  // Weighted distribution: mostly normal, some warning/critical
  const r = Math.random();
  if (r < 0.70) return -(15 + Math.random() * 10);      // -15 to -25 (normal)
  if (r < 0.85) return -(25 + Math.random() * 2);        // -25 to -27 (warning)
  if (r < 0.95) return -(27 + Math.random() * 3);        // -27 to -30 (critical)
  return -(30 + Math.random() * 4);                       // -30 to -34 (very critical)
}

export function getMockONUs(ponId: string): ONUDetail[] {
  const count = 8 + Math.floor(Math.random() * 8);
  return Array.from({ length: count }, (_, i) => {
    const isOffline = Math.random() < 0.08;
    const rx = isOffline ? null : parseFloat(randomRx().toFixed(2));
    const trafficIn = isOffline ? null : parseFloat((2 + Math.random() * 45).toFixed(1));
    const trafficOut = isOffline ? null : parseFloat((0.5 + Math.random() * 12).toFixed(1));
    return {
      id: uuid(500 + parseInt(ponId.slice(-3)) * 20 + i),
      pon_id: ponId,
      onu_id: String(i + 1),
      serial_number: `HSGQ-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: isOffline ? 'offline' as const : 'online' as const,
      rx_power: rx,
      tx_power: rx ? parseFloat((rx + 25 + Math.random() * 3).toFixed(2)) : null,
      olt_rx_power: rx ? parseFloat((rx + 2 + Math.random()).toFixed(2)) : null,
      olt_tx_power: rx ? parseFloat((2 + Math.random() * 2).toFixed(2)) : null,
      distance: isOffline ? null : parseFloat((0.5 + Math.random() * 15).toFixed(2)),
      last_seen: isOffline ? ago(60 + Math.floor(Math.random() * 600)) : ago(Math.floor(Math.random() * 5)),
      traffic_in_mbps: trafficIn,
      traffic_out_mbps: trafficOut,
    };
  });
}

// --- ONU History ---
export function getMockONUHistory(onuId: string): ONUHistory[] {
  const baseRx = -20 - Math.random() * 8;
  return Array.from({ length: 48 }, (_, i) => ({
    timestamp: new Date(now.getTime() - (47 - i) * 30 * 60000).toISOString(),
    rx_power: parseFloat((baseRx + (Math.random() - 0.5) * 2).toFixed(2)),
    tx_power: parseFloat((baseRx + 25 + (Math.random() - 0.5)).toFixed(2)),
  }));
}

// --- Settings ---
export const mockThreshold: Threshold = {
  id: uuid(901),
  normal_min: -25,
  warning_min: -27,
  critical_min: -30,
  very_critical_min: -35,
  is_active: true,
};

export const mockPollingInterval: PollingInterval = {
  id: uuid(902),
  olt_status: 60,
  pon_status: 60,
  onu_status: 60,
  optical_power: 300,
  cpu_memory: 120,
};

export const mockTelegramConfig: TelegramConfig = {
  id: uuid(903),
  enabled: true,
  bot_token: '7192849182:AAH9fklmN284jklsdj90234_jklmNOP',
  chat_id: '-1002049182941',
  thread_id: '42',
  notify_on_critical: true,
  notify_on_warning: true,
  notify_on_recovery: true,
  notify_on_olt_offline: true,
  last_test_status: 'success',
  last_test_at: ago(15),
};

export function getMockTrafficHistory(group?: string): TrafficHistoryPoint[] {
  const curve = [
    { hour: 3, inG: 2.15, outG: 0.62 },
    { hour: 4, inG: 1.84, outG: 0.51 },
    { hour: 5, inG: 2.45, outG: 0.72 },
    { hour: 6, inG: 3.82, outG: 1.14 },
    { hour: 7, inG: 5.21, outG: 1.58 },
    { hour: 8, inG: 6.95, outG: 2.02 },
    { hour: 9, inG: 7.54, outG: 2.18 },
    { hour: 10, inG: 7.82, outG: 2.29 },
    { hour: 11, inG: 7.94, outG: 2.34 },
    { hour: 12, inG: 8.21, outG: 2.41 },
    { hour: 13, inG: 8.12, outG: 2.38 },
    { hour: 14, inG: 8.35, outG: 2.44 },
    { hour: 15, inG: 8.52, outG: 2.49 },
    { hour: 16, inG: 8.74, outG: 2.53 },
    { hour: 17, inG: 9.18, outG: 2.65 },
    { hour: 18, inG: 9.85, outG: 2.82 },
    { hour: 19, inG: 10.54, outG: 2.94 },
    { hour: 20, inG: 10.82, outG: 3.12 },
    { hour: 21, inG: 10.41, outG: 3.01 },
    { hour: 22, inG: 9.62, outG: 2.76 },
    { hour: 23, inG: 7.85, outG: 2.25 },
    { hour: 0, inG: 5.42, outG: 1.58 },
    { hour: 1, inG: 3.91, outG: 1.15 },
    { hour: 2, inG: 2.84, outG: 0.82 },
  ];

  // Saat di-scope ke satu grup, kurva harian yang sama diskalakan ke porsi
  // throughput grup tsb — biar chart grup bukan cuma chart fleet yang diganti label.
  const scale = groupTrafficShare(group);

  return curve.map((c) => {
    const timeStr = `${String(c.hour).padStart(2, '0')}:00`;
    const inG = parseFloat((c.inG * scale).toFixed(2));
    const outG = parseFloat((c.outG * scale).toFixed(2));
    return {
      time: timeStr,
      traffic_in_gbps: inG,
      traffic_out_gbps: outG,
      total_gbps: parseFloat((inG + outG).toFixed(2)),
    };
  });
}

// ============================================================
// Group (site cluster) scoping
// Armada OLT JOGLONET tersebar di beberapa kabupaten. NOC mantau per grup
// site, jadi semua agregat (KPI, optik, traffic, alarm) bisa di-scope ke
// satu grup atau ditampilkan fleet-wide.
// ============================================================

/** Sentinel untuk "semua grup" — dipakai di value <select> dan query param. */
export const OLT_GROUP_ALL = '__all__';

export interface OLTGroupSummary {
  group: string;
  total_olt: number;
  online_olt: number;
  offline_olt: number;
  total_onu: number;
  online_onu: number;
  offline_onu: number;
  low_rx_onu: number;
  active_alarms: number;
  traffic_in_mbps: number;
  traffic_out_mbps: number;
}

function isScoped(group?: string): boolean {
  return !!group && group !== OLT_GROUP_ALL;
}

/** Grup diturunkan dari perangkat yang ada, bukan daftar hardcode — site baru
 *  langsung muncul di filter begitu OLT pertamanya di-provision. */
export function getOLTGroups(): string[] {
  return Array.from(new Set(mockOLTs.map((o) => o.group))).sort((a, b) => a.localeCompare(b));
}

export function getMockOLTs(group?: string): OLTSummary[] {
  return isScoped(group) ? mockOLTs.filter((o) => o.group === group) : mockOLTs;
}

export function getMockAlarms(group?: string): Alarm[] {
  if (!isScoped(group)) return mockAlarms;
  const oltIds = new Set(getMockOLTs(group).map((o) => o.id));
  return mockAlarms.filter((a) => (a.olt_id ? oltIds.has(a.olt_id) : false));
}

export function getMockWorstONUs(limit = 10, group?: string): WorstONU[] {
  if (!isScoped(group)) return mockWorstONUs.slice(0, limit);
  const oltNames = new Set(getMockOLTs(group).map((o) => o.name));
  return mockWorstONUs.filter((w) => oltNames.has(w.olt_name)).slice(0, limit);
}

/** Pecah ONU degraded satu OLT ke kelas warning / critical / very-critical. */
function opticalForOLT(olt: OLTSummary): OpticalSummary {
  const degraded = Math.min(olt.low_rx_onu, olt.online_onu);
  const veryCritical = Math.floor(degraded * 0.15);
  const critical = Math.floor(degraded * 0.3);
  return {
    normal: olt.online_onu - degraded,
    warning: degraded - critical - veryCritical,
    critical,
    very_critical: veryCritical,
  };
}

export function getMockOpticalSummary(group?: string): OpticalSummary {
  return getMockOLTs(group).reduce<OpticalSummary>(
    (acc, olt) => {
      const o = opticalForOLT(olt);
      return {
        normal: acc.normal + o.normal,
        warning: acc.warning + o.warning,
        critical: acc.critical + o.critical,
        very_critical: acc.very_critical + o.very_critical,
      };
    },
    { normal: 0, warning: 0, critical: 0, very_critical: 0 }
  );
}

/** Bobot histogram Rx untuk rentang "normal" (kurva tipikal FTTH JOGLONET). */
const NORMAL_RX_BUCKETS: { range: string; weight: number }[] = [
  { range: '-10 to -15', weight: 0.13 },
  { range: '-15 to -18', weight: 0.26 },
  { range: '-18 to -20', weight: 0.33 },
  { range: '-20 to -23', weight: 0.20 },
  { range: '-23 to -25', weight: 0.08 },
];

export function getMockRxDistribution(group?: string): RxDistribution[] {
  const optical = getMockOpticalSummary(group);
  const counts = NORMAL_RX_BUCKETS.map((b) => Math.round(optical.normal * b.weight));
  // Serap sisa pembulatan di bucket dominan supaya total histogram == total ONU.
  counts[2] += optical.normal - counts.reduce((a, c) => a + c, 0);

  return [
    ...NORMAL_RX_BUCKETS.map((b, i) => ({
      range: b.range,
      count: counts[i],
      classification: 'normal',
    })),
    { range: '-25 to -27', count: optical.warning, classification: 'warning' },
    { range: '-27 to -30', count: optical.critical, classification: 'critical' },
    { range: 'below -30', count: optical.very_critical, classification: 'very_critical' },
  ];
}

function groupTrafficShare(group?: string): number {
  if (!isScoped(group)) return 1;
  const fleet = mockOLTs.reduce((a, o) => a + o.traffic_in_mbps + o.traffic_out_mbps, 0);
  if (!fleet) return 0;
  const scoped = getMockOLTs(group).reduce((a, o) => a + o.traffic_in_mbps + o.traffic_out_mbps, 0);
  return scoped / fleet;
}

export function getMockKPI(group?: string): KPI {
  const scoped = getMockOLTs(group);
  // Alarm yang sudah closed bukan beban operasional, jadi tidak dihitung.
  const openAlarms = getMockAlarms(group).filter((a) => a.status !== 'closed');
  const optical = getMockOpticalSummary(group);
  const graded = optical.normal + optical.warning + optical.critical + optical.very_critical;
  const trafficIn = scoped.reduce((a, o) => a + o.traffic_in_mbps, 0);
  const trafficOut = scoped.reduce((a, o) => a + o.traffic_out_mbps, 0);

  return {
    total_olt: scoped.length,
    online_olt: scoped.filter((o) => o.status === 'online').length,
    offline_olt: scoped.filter((o) => o.status !== 'online').length,
    total_onu: scoped.reduce((a, o) => a + o.total_onu, 0),
    online_onu: scoped.reduce((a, o) => a + o.online_onu, 0),
    offline_onu: scoped.reduce((a, o) => a + o.offline_onu, 0),
    active_alarms: openAlarms.length,
    critical_alarms: openAlarms.filter((a) => a.severity === 'critical').length,
    optical_health_percent: graded
      ? parseFloat(((optical.normal / graded) * 100).toFixed(1))
      : 0,
    total_traffic_in_mbps: parseFloat(trafficIn.toFixed(1)),
    total_traffic_out_mbps: parseFloat(trafficOut.toFixed(1)),
    total_traffic_mbps: parseFloat((trafficIn + trafficOut).toFixed(1)),
  };
}

export function getMockGroupSummaries(): OLTGroupSummary[] {
  return getOLTGroups().map((group) => {
    const scoped = getMockOLTs(group);
    return {
      group,
      total_olt: scoped.length,
      online_olt: scoped.filter((o) => o.status === 'online').length,
      offline_olt: scoped.filter((o) => o.status !== 'online').length,
      total_onu: scoped.reduce((a, o) => a + o.total_onu, 0),
      online_onu: scoped.reduce((a, o) => a + o.online_onu, 0),
      offline_onu: scoped.reduce((a, o) => a + o.offline_onu, 0),
      low_rx_onu: scoped.reduce((a, o) => a + o.low_rx_onu, 0),
      active_alarms: getMockAlarms(group).filter((a) => a.status !== 'closed').length,
      traffic_in_mbps: parseFloat(scoped.reduce((a, o) => a + o.traffic_in_mbps, 0).toFixed(1)),
      traffic_out_mbps: parseFloat(scoped.reduce((a, o) => a + o.traffic_out_mbps, 0).toFixed(1)),
    };
  });
}

// Snapshot fleet-wide untuk caller yang tidak pernah men-scope.
export const mockKPI: KPI = getMockKPI();
export const mockOpticalSummary: OpticalSummary = getMockOpticalSummary();
export const mockRxDistribution: RxDistribution[] = getMockRxDistribution();
