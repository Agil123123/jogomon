import { create } from 'zustand';

export type Language = 'id' | 'en';

export interface Translations {
  // Common & Branding
  brandTitle: string;
  brandSubtitle: string;
  langIndonesian: string;
  langEnglish: string;
  live: string;
  synced: string;
  disconnected: string;
  active: string;
  online: string;
  offline: string;
  warning: string;
  critical: string;
  veryCritical: string;
  normal: string;
  unknown: string;

  // Nav
  navDashboard: string;
  navAlarms: string;
  navOlt: string;
  navSettings: string;

  // Topbar
  liveMonitoring: string;
  serverTime: string;
  roleAdmin: string;
  roleViewer: string;
  logout: string;

  // Dashboard
  dashboardTitle: string;
  dashboardSubtitle: string;
  kpiTotalOlt: string;
  kpiOltSubtitle: string;
  kpiPonPorts: string;
  kpiPonSubtitle: string;
  kpiTotalOnu: string;
  kpiOnuSubtitle: string;
  kpiActiveAlarms: string;
  kpiAlarmSubtitle: string;
  kpiOpticalHealth: string;
  kpiOpticalSubtitle: string;
  kpiTotalTraffic: string;
  kpiTrafficSubtitle: string;
  trafficDownload: string;
  trafficUpload: string;

  // Charts
  rxDistributionTitle: string;
  rxDistributionSubtitle: string;
  opticalHealthTitle: string;
  opticalHealthSubtitle: string;
  totalSubscribers: string;

  // OLT Fleet Table
  oltFleetTitle: string;
  colOltName: string;
  colStatus: string;
  colIp: string;
  colPon: string;
  colOnuTotal: string;
  colTraffic: string;
  colCpuRam: string;
  colTemp: string;
  colUptime: string;
  colAction: string;
  btnDetail: string;

  // OLT Inventory Page
  oltPageTitle: string;
  oltPageSubtitle: string;
  oltSearchLabel: string;
  oltSearchPlaceholder: string;
  oltFilterStatus: string;
  oltFilterVendor: string;
  oltVendorAll: string;
  oltFilterGroup: string;
  oltGroupAll: string;
  oltGroupUngrouped: string;
  oltGroupFormLabel: string;
  oltGroupFormHint: string;
  colGroup: string;
  groupScopeLabel: string;
  groupScopeAllOption: string;
  groupScopeBadge: string;
  groupBreakdownTitle: string;
  groupBreakdownSubtitle: string;
  groupDeviceCount: string;
  oltInventoryTitle: string;
  oltShownOfTotal: string;
  oltNoMatch: string;
  oltNoMatchHint: string;
  oltResetFilters: string;
  oltSortBy: string;
  colVendor: string;
  colAlarms: string;

  // Live Alarm Feed
  alarmFeedTitle: string;
  noActiveAlarms: string;

  // Worst ONU Card
  worstOnuTitle: string;
  worstOnuBadge: string;
  worstOnuSubtitle: string;
  colRank: string;
  colSerial: string;
  colLocation: string;
  colRxPower: string;
  colOnuTraffic: string;

  // OLT Detail Page
  backToFleet: string;
  oltDetailTitle: string;
  hardwareMetrics: string;
  metricCpu: string;
  metricRam: string;
  metricTemp: string;
  metricRatio: string;
  metricOltTraffic: string;
  metricTrafficPeak: string;
  uplinkTitle: string;
  uplinkSubtitle: string;
  ponTrafficTitle: string;
  ponTrafficSubtitle: string;
  gponCapacity: string;
  ponBreakdownTitle: string;
  ponClickHint: string;
  colPonPort: string;
  colPonOnline: string;
  colPonOffline: string;
  colPonLowRx: string;
  colPonTraffic: string;
  colLastPoll: string;
  onuSubscribersTitle: string;
  colOnuId: string;
  colTxPower: string;
  colOltRx: string;
  colDistance: string;
  colLastSeen: string;

  // Alarms Page
  alarmsTitle: string;
  alarmsSubtitle: string;
  tabAll: string;
  tabActive: string;
  tabCritical: string;
  tabWarning: string;
  tabAcknowledged: string;
  tabClosed: string;
  colSeverity: string;
  colTarget: string;
  colAlarmType: string;
  colMessage: string;
  colCreatedAt: string;
  btnAck: string;
  btnClose: string;
  alarmAckSuccess: string;
  alarmCloseSuccess: string;

  // Settings Page
  settingsTitle: string;
  settingsSubtitle: string;
  tabProvisionOlt: string;
  tabThresholds: string;
  tabPolling: string;
  tabTelegram: string;
  telegramTitle: string;
  telegramSubtitle: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramThreadId: string;
  telegramTriggers: string;
  telegramOnCritical: string;
  telegramOnWarning: string;
  telegramOnRecovery: string;
  telegramOnOltOffline: string;
  telegramTestBtn: string;
  telegramTesting: string;
  telegramPreviewTitle: string;
  telegramSentBadge: string;
  telegramResendBtn: string;
  adminNotice: string;
  saveSettings: string;
  saving: string;
  savedSuccess: string;

  // Login Page
  loginTitle: string;
  loginSubtitle: string;
  labelUsername: string;
  labelPassword: string;
  btnLogin: string;
  loggingIn: string;
  demoHint: string;

  // Relative time (dipakai util timeAgo)
  timeNever: string;
  timeJustNow: string;
  timeAgoSuffix: string;
  timeUnitSec: string;
  timeUnitMin: string;
  timeUnitHour: string;
  timeUnitDay: string;

  // Chart & telemetry shared labels
  loadingTelemetry: string;
  chartTime: string;
  chartTotal: string;
  chartDegraded: string;
  chartPeak24h: string;
  chartLast24h: string;
  chartRealtime: string;
  chartAggregateAll: string;
  chartNoData: string;
  chartCurrent: string;
  labelDown: string;
  labelUp: string;
  labelOfTotal: string;
  labelHealthy: string;

  // Rx distribution chart
  rxMeasuredOnu: string;
  rxBucketOnu: string;
  rxThresholdLine: string;

  // PON traffic breakdown
  ponTotalDown: string;
  ponTotalUp: string;
  ponActiveSubscribers: string;

  // Uplink card
  uplinkInbound: string;
  uplinkOutbound: string;
  uplinkUtilization: string;
  uplinkChartLabel: string;
  uplinkStandby: string;
  uplinkFullDuplex: string;

  // OLT detail page
  oltNotFound: string;
  noOnuData: string;
  onuConnectedUnit: string;
  ponPortsUnit: string;
  uptimeSubtitle: string;
  metricCpuSubtitle: string;
  metricRamSubtitle: string;
  metricTempSubtitle: string;

  // Accessibility landmarks & assistive labels
  skipToContent: string;
  landmarkMainNav: string;
  landmarkMainContent: string;
  openMenu: string;
  closeMenu: string;
  languageSwitcher: string;

  // Wallboard (view mode) — big-screen NOC display
  navWallboard: string;
  wallboardTitle: string;
  wallEnter: string;
  wallExit: string;
  wallFullscreen: string;
  wallFullscreenExit: string;
  wallUpdated: string;
  wallTrafficTitle: string;
  wallFleetTitle: string;
  wallAlarmTitle: string;
  wallOpticalTitle: string;
  wallWorstRxLabel: string;
  wallAllClear: string;
}


const idTranslations: Translations = {
  // Common & Branding
  brandTitle: 'JOGO-MON',
  brandSubtitle: 'Monitoring OLT & GPON',
  langIndonesian: 'Bahasa Indonesia',
  langEnglish: 'English',
  live: 'LIVE',
  synced: 'Sinkron',
  disconnected: 'Terputus',
  active: 'Aktif',
  online: 'Online',
  offline: 'Offline',
  warning: 'Peringatan',
  critical: 'Kritis',
  veryCritical: 'Sangat Kritis',
  normal: 'Normal',
  unknown: 'Tidak Diketahui',

  // Nav
  navDashboard: 'Dashboard',
  navAlarms: 'Alarm',
  navOlt: 'Perangkat OLT',
  navSettings: 'Pengaturan',

  // Topbar
  liveMonitoring: 'Monitoring Live',
  serverTime: 'Waktu Server',
  roleAdmin: 'Administrator',
  roleViewer: 'Operator NOC',
  logout: 'Keluar',

  // Dashboard
  dashboardTitle: 'Dashboard NOC',
  dashboardSubtitle: 'Pantauan real-time OLT GPON dan ONU pelanggan JOGLONET',
  kpiTotalOlt: 'Total OLT',
  kpiOltSubtitle: 'OLT terpasang di jaringan',
  kpiPonPorts: 'Total Port PON',
  kpiPonSubtitle: 'port PON aktif',
  kpiTotalOnu: 'Total ONU',
  kpiOnuSubtitle: 'ONU pelanggan terdaftar',
  kpiActiveAlarms: 'Alarm Aktif',
  kpiAlarmSubtitle: 'belum ditangani',
  kpiOpticalHealth: 'Kesehatan Optik',
  kpiOpticalSubtitle: 'ONU di rentang aman',
  kpiTotalTraffic: 'Total Trafik',
  kpiTrafficSubtitle: 'Gabungan throughput semua OLT',
  trafficDownload: 'Download',
  trafficUpload: 'Upload',

  // Charts
  rxDistributionTitle: 'Sebaran Daya Optik Rx (dBm)',
  rxDistributionSubtitle: 'Level daya terima seluruh ONU per rentang',
  opticalHealthTitle: 'Kesehatan Optik ONU',
  opticalHealthSubtitle: 'Komposisi kualitas sinyal pelanggan',
  totalSubscribers: 'Total ONU',

  // OLT Fleet Table
  oltFleetTitle: 'Status Perangkat OLT',
  colOltName: 'Nama OLT',
  colStatus: 'Status',
  colIp: 'Alamat IP',
  colPon: 'PON',
  colOnuTotal: 'ONU (On/Total)',
  colTraffic: 'Trafik (Down/Up)',
  colCpuRam: 'CPU / RAM',
  colTemp: 'Suhu',
  colUptime: 'Uptime',
  colAction: 'Aksi',
  btnDetail: 'Detail',

  // OLT Inventory Page
  oltPageTitle: 'Perangkat OLT',
  oltPageSubtitle: 'Inventaris menyeluruh armada OLT JOGLONET',
  oltSearchLabel: 'Cari perangkat',
  oltSearchPlaceholder: 'Nama, vendor, atau alamat IP…',
  oltFilterStatus: 'Status Perangkat',
  oltFilterVendor: 'Vendor',
  oltVendorAll: 'Semua Vendor',
  oltFilterGroup: 'Grup Site',
  oltGroupAll: 'Semua Grup',
  oltGroupUngrouped: 'Tanpa Grup',
  oltGroupFormLabel: 'Grup Site',
  oltGroupFormHint: 'Kelompokkan per wilayah, mis. Klaten atau Kebumen.',
  colGroup: 'Grup',
  groupScopeLabel: 'Tampilkan data',
  groupScopeAllOption: 'Semua Grup (Seluruh Armada)',
  groupScopeBadge: 'Grup',
  groupBreakdownTitle: 'Ringkasan per Grup Site',
  groupBreakdownSubtitle: 'Klik grup untuk memfokuskan dasbor',
  groupDeviceCount: 'OLT',
  oltInventoryTitle: 'Daftar Perangkat OLT',
  oltShownOfTotal: 'ditampilkan dari',
  oltNoMatch: 'Tidak ada perangkat yang cocok',
  oltNoMatchHint: 'Coba ubah kata kunci atau reset filter.',
  oltResetFilters: 'Reset filter',
  oltSortBy: 'Urutkan menurut',
  colVendor: 'Vendor',
  colAlarms: 'Alarm',

  // Live Alarm Feed
  alarmFeedTitle: 'Alarm Masuk (Live)',
  noActiveAlarms: 'Tidak ada alarm aktif',

  // Worst ONU Card
  worstOnuTitle: 'ONU Sinyal Terlemah (Rx)',
  worstOnuBadge: 'Perlu Ditindak',
  worstOnuSubtitle: 'ONU dengan sinyal optik paling lemah beserta beban trafiknya',
  colRank: 'No',
  colSerial: 'Serial ONU',
  colLocation: 'OLT / PON',
  colRxPower: 'Rx Power',
  colOnuTraffic: 'Trafik',

  // OLT Detail Page
  backToFleet: '← Kembali ke Daftar OLT',
  oltDetailTitle: 'Detail Perangkat OLT',
  hardwareMetrics: 'Metrik Hardware & Performa',
  metricCpu: 'Beban CPU',
  metricRam: 'Penggunaan RAM',
  metricTemp: 'Suhu Board',
  metricRatio: 'Rasio ONU Online',
  metricOltTraffic: 'Total Trafik OLT',
  metricTrafficPeak: 'Puncak Throughput',
  uplinkTitle: 'Trafik Uplink & Port SFP+',
  uplinkSubtitle: 'Throughput uplink ke core network',
  ponTrafficTitle: 'Trafik & Utilisasi Port PON',
  ponTrafficSubtitle: 'Throughput tiap port PON (kapasitas GPON 2.5 Gbps)',
  gponCapacity: 'Kapasitas GPON',
  ponBreakdownTitle: 'Rincian Port PON',
  ponClickHint: 'Klik baris PON untuk lihat daftar ONU pelanggan',
  colPonPort: 'Port PON',
  colPonOnline: 'Online',
  colPonOffline: 'Offline',
  colPonLowRx: 'Rx Lemah',
  colPonTraffic: 'Trafik Port (Down/Up)',
  colLastPoll: 'Polling Terakhir',
  onuSubscribersTitle: 'Daftar ONU Terhubung —',
  colOnuId: 'ONU ID',
  colTxPower: 'Tx Power',
  colOltRx: 'Rx di OLT',
  colDistance: 'Jarak',
  colLastSeen: 'Terakhir Aktif',

  // Alarms Page
  alarmsTitle: 'Pusat Alarm & Insiden',
  alarmsSubtitle: 'Pantauan dan penanganan alarm OLT & ONU',
  tabAll: 'Semua',
  tabActive: 'Aktif',
  tabCritical: 'Kritis (SEV-1)',
  tabWarning: 'Peringatan (SEV-2)',
  tabAcknowledged: 'Ditangani',
  tabClosed: 'Selesai',
  colSeverity: 'Severity',
  colTarget: 'Perangkat',
  colAlarmType: 'Jenis Gangguan',
  colMessage: 'Keterangan',
  colCreatedAt: 'Waktu Kejadian',
  btnAck: 'Ack',
  btnClose: 'Selesaikan',
  alarmAckSuccess: 'Alarm ditandai sedang ditangani',
  alarmCloseSuccess: 'Alarm ditandai selesai',

  // Settings Page
  settingsTitle: 'Pengaturan Sistem',
  settingsSubtitle: 'Atur perangkat OLT, ambang batas optik, dan interval polling',
  tabProvisionOlt: 'Tambah OLT',
  tabThresholds: 'Ambang Batas Optik',
  tabPolling: 'Interval Polling',
  tabTelegram: 'Notifikasi Telegram',
  telegramTitle: 'Integrasi Bot Telegram NOC',
  telegramSubtitle: 'Kirim notifikasi otomatis ke grup atau channel Telegram saat ada gangguan',
  telegramBotToken: 'Bot Token API',
  telegramChatId: 'Chat ID / Grup ID',
  telegramThreadId: 'Message Thread ID (opsional, untuk topik forum)',
  telegramTriggers: 'Pemicu Notifikasi',
  telegramOnCritical: 'Kirim saat alarm kritis SEV-1 (LOS / redaman ekstrem)',
  telegramOnWarning: 'Kirim saat alarm peringatan SEV-2 (redaman mendekati batas)',
  telegramOnRecovery: 'Kirim notifikasi saat perangkat kembali normal',
  telegramOnOltOffline: 'Kirim langsung saat OLT tidak bisa dihubungi',
  telegramTestBtn: 'Kirim Tes Notifikasi',
  telegramTesting: 'Mengirim...',
  telegramPreviewTitle: 'Contoh Format Pesan Telegram',
  telegramSentBadge: 'Terkirim ke Telegram',
  telegramResendBtn: 'Kirim Ulang ke Telegram',
  adminNotice: 'Hanya akun Administrator yang bisa mengubah pengaturan.',
  saveSettings: 'Simpan Konfigurasi',
  saving: 'Menyimpan...',
  savedSuccess: 'Pengaturan berhasil disimpan.',

  // Login Page
  loginTitle: 'Masuk ke JOGO-MON',
  loginSubtitle: 'Panel Monitoring Jaringan Akses FTTH JOGLONET',
  labelUsername: 'Username',
  labelPassword: 'Password',
  btnLogin: 'Masuk',
  loggingIn: 'Memverifikasi...',
  demoHint: 'Akun demo: admin / admin123 (akses Administrator)',

  // Relative time
  timeNever: 'Belum pernah',
  timeJustNow: 'Baru saja',
  timeAgoSuffix: 'lalu',
  timeUnitSec: 'dtk',
  timeUnitMin: 'mnt',
  timeUnitHour: 'jam',
  timeUnitDay: 'hr',

  // Chart & telemetry shared labels
  loadingTelemetry: 'Memuat telemetri OLT...',
  chartTime: 'Waktu',
  chartTotal: 'Total',
  chartDegraded: 'terdegradasi',
  chartPeak24h: 'Puncak 24 jam',
  chartLast24h: '24 jam terakhir',
  chartRealtime: 'Throughput real-time',
  chartAggregateAll: 'Gabungan semua OLT',
  chartNoData: 'Belum ada data',
  chartCurrent: 'Saat ini',
  labelDown: 'Down',
  labelUp: 'Up',
  labelOfTotal: 'dari total',
  labelHealthy: 'Sehat',

  // Rx distribution chart
  rxMeasuredOnu: 'ONU terukur',
  rxBucketOnu: 'ONU',
  rxThresholdLine: 'Batas aman −25 dBm',

  // PON traffic breakdown
  ponTotalDown: 'Total Down',
  ponTotalUp: 'Total Up',
  ponActiveSubscribers: 'Pelanggan aktif',

  // Uplink card
  uplinkInbound: 'Inbound (Down)',
  uplinkOutbound: 'Outbound (Up)',
  uplinkUtilization: 'Utilisasi port (kapasitas 10G)',
  uplinkChartLabel: 'Grafik throughput uplink',
  uplinkStandby: 'Standby (LACP)',
  uplinkFullDuplex: 'Full Duplex',

  // OLT detail page
  oltNotFound: 'Perangkat OLT tidak ditemukan',
  noOnuData: 'Tidak ada data ONU',
  onuConnectedUnit: 'ONU terhubung',
  ponPortsUnit: 'port PON',
  uptimeSubtitle: 'Waktu nyala perangkat',
  metricCpuSubtitle: 'Prosesor chassis',
  metricRamSubtitle: 'Memori sistem',
  metricTempSubtitle: 'Sensor board',

  // Accessibility landmarks & assistive labels
  skipToContent: 'Lompat ke konten utama',
  landmarkMainNav: 'Navigasi utama',
  landmarkMainContent: 'Konten utama',
  openMenu: 'Buka menu navigasi',
  closeMenu: 'Tutup menu navigasi',
  languageSwitcher: 'Pilih bahasa',

  // Wallboard (view mode)
  navWallboard: 'Mode Layar NOC',
  wallboardTitle: 'Layar Pantau NOC',
  wallEnter: 'Mode Layar',
  wallExit: 'Keluar',
  wallFullscreen: 'Layar Penuh',
  wallFullscreenExit: 'Keluar Layar Penuh',
  wallUpdated: 'Diperbarui',
  wallTrafficTitle: 'Trafik Agregat',
  wallFleetTitle: 'Status OLT',
  wallAlarmTitle: 'Alarm Aktif',
  wallOpticalTitle: 'Kesehatan Optik',
  wallWorstRxLabel: 'RX TERLEMAH',
  wallAllClear: 'Semua normal — tidak ada alarm aktif',
};


const enTranslations: Translations = {
  // Common & Branding
  brandTitle: 'JOGO-MON',
  brandSubtitle: 'GPON OLT Monitoring',
  langIndonesian: 'Bahasa Indonesia',
  langEnglish: 'English',
  live: 'LIVE',
  synced: 'Synced',
  disconnected: 'Disconnected',
  active: 'Active',
  online: 'Online',
  offline: 'Offline',
  warning: 'Warning',
  critical: 'Critical',
  veryCritical: 'Very Critical',
  normal: 'Normal',
  unknown: 'Unknown',

  // Nav
  navDashboard: 'Dashboard',
  navAlarms: 'Alarms',
  navOlt: 'OLT Devices',
  navSettings: 'Settings',

  // Topbar
  liveMonitoring: 'Live Monitoring',
  serverTime: 'Server Time',
  roleAdmin: 'Administrator',
  roleViewer: 'NOC Operator',
  logout: 'Logout',

  // Dashboard
  dashboardTitle: 'NOC Dashboard',
  dashboardSubtitle: 'Real-time telemetry for JOGLONET GPON OLTs & customer ONUs',
  kpiTotalOlt: 'Total OLTs',
  kpiOltSubtitle: 'OLTs deployed in network',
  kpiPonPorts: 'Total PON Ports',
  kpiPonSubtitle: 'active PON ports',
  kpiTotalOnu: 'Total ONUs',
  kpiOnuSubtitle: 'registered subscriber ONUs',
  kpiActiveAlarms: 'Active Alarms',
  kpiAlarmSubtitle: 'unresolved',
  kpiOpticalHealth: 'Optical Health',
  kpiOpticalSubtitle: 'ONUs within safe range',
  kpiTotalTraffic: 'Total Traffic',
  kpiTrafficSubtitle: 'Combined throughput across all OLTs',
  trafficDownload: 'Download',
  trafficUpload: 'Upload',

  // Charts
  rxDistributionTitle: 'Rx Optical Power Distribution (dBm)',
  rxDistributionSubtitle: 'Received power level across all ONUs by range',
  opticalHealthTitle: 'ONU Optical Health',
  opticalHealthSubtitle: 'Subscriber signal quality breakdown',
  totalSubscribers: 'Total ONUs',

  // OLT Fleet Table
  oltFleetTitle: 'OLT Device Status',
  colOltName: 'OLT Name',
  colStatus: 'Status',
  colIp: 'IP Address',
  colPon: 'PON',
  colOnuTotal: 'ONU (On/Total)',
  colTraffic: 'Traffic (Down/Up)',
  colCpuRam: 'CPU / RAM',
  colTemp: 'Temp',
  colUptime: 'Uptime',
  colAction: 'Action',
  btnDetail: 'Detail',

  // OLT Inventory Page
  oltPageTitle: 'OLT Devices',
  oltPageSubtitle: 'Complete inventory of the JOGLONET OLT fleet',
  oltSearchLabel: 'Search devices',
  oltSearchPlaceholder: 'Name, vendor, or IP address…',
  oltFilterStatus: 'Device Status',
  oltFilterVendor: 'Vendor',
  oltVendorAll: 'All Vendors',
  oltFilterGroup: 'Site Group',
  oltGroupAll: 'All Groups',
  oltGroupUngrouped: 'Ungrouped',
  oltGroupFormLabel: 'Site Group',
  oltGroupFormHint: 'Cluster by region, e.g. Klaten or Kebumen.',
  colGroup: 'Group',
  groupScopeLabel: 'Show data for',
  groupScopeAllOption: 'All Groups (Entire Fleet)',
  groupScopeBadge: 'Group',
  groupBreakdownTitle: 'Site Group Breakdown',
  groupBreakdownSubtitle: 'Select a group to focus the dashboard',
  groupDeviceCount: 'OLT',
  oltInventoryTitle: 'OLT Device List',
  oltShownOfTotal: 'shown of',
  oltNoMatch: 'No matching devices',
  oltNoMatchHint: 'Try a different keyword or reset the filters.',
  oltResetFilters: 'Reset filters',
  oltSortBy: 'Sort by',
  colVendor: 'Vendor',
  colAlarms: 'Alarms',

  // Live Alarm Feed
  alarmFeedTitle: 'Incoming Alarms (Live)',
  noActiveAlarms: 'No active alarms',

  // Worst ONU Card
  worstOnuTitle: 'Weakest ONU Signal (Rx)',
  worstOnuBadge: 'Needs Action',
  worstOnuSubtitle: 'ONUs with the weakest optical signal and their traffic load',
  colRank: 'No',
  colSerial: 'ONU Serial',
  colLocation: 'OLT / PON',
  colRxPower: 'Rx Power',
  colOnuTraffic: 'Traffic',

  // OLT Detail Page
  backToFleet: '← Back to OLT List',
  oltDetailTitle: 'OLT Device Detail',
  hardwareMetrics: 'Hardware Metrics & Performance',
  metricCpu: 'CPU Load',
  metricRam: 'RAM Usage',
  metricTemp: 'Board Temp',
  metricRatio: 'Online ONU Ratio',
  metricOltTraffic: 'Total OLT Traffic',
  metricTrafficPeak: 'Peak Throughput',
  uplinkTitle: 'Uplink Traffic & SFP+ Ports',
  uplinkSubtitle: 'Uplink throughput to core network',
  ponTrafficTitle: 'PON Port Traffic & Utilization',
  ponTrafficSubtitle: 'Throughput per PON port (2.5 Gbps GPON capacity)',
  gponCapacity: 'GPON Capacity',
  ponBreakdownTitle: 'PON Port Breakdown',
  ponClickHint: 'Click a PON row to view its connected ONU subscribers',
  colPonPort: 'PON Port',
  colPonOnline: 'Online',
  colPonOffline: 'Offline',
  colPonLowRx: 'Low Rx',
  colPonTraffic: 'Port Traffic (Down/Up)',
  colLastPoll: 'Last Polled',
  onuSubscribersTitle: 'Connected ONU Subscribers —',
  colOnuId: 'ONU ID',
  colTxPower: 'Tx Power',
  colOltRx: 'Rx at OLT',
  colDistance: 'Distance',
  colLastSeen: 'Last Seen',

  // Alarms Page
  alarmsTitle: 'Alarm & Incident Hub',
  alarmsSubtitle: 'Monitoring and response for OLT & ONU alarms',
  tabAll: 'All',
  tabActive: 'Active',
  tabCritical: 'Critical (SEV-1)',
  tabWarning: 'Warning (SEV-2)',
  tabAcknowledged: 'Acknowledged',
  tabClosed: 'Closed',
  colSeverity: 'Severity',
  colTarget: 'Device',
  colAlarmType: 'Alarm Type',
  colMessage: 'Details',
  colCreatedAt: 'Occurred At',
  btnAck: 'Ack',
  btnClose: 'Close',
  alarmAckSuccess: 'Alarm marked as acknowledged',
  alarmCloseSuccess: 'Alarm marked as closed',

  // Settings Page
  settingsTitle: 'System Settings',
  settingsSubtitle: 'Configure OLT devices, optical thresholds, and polling intervals',
  tabProvisionOlt: 'Add OLT',
  tabThresholds: 'Optical Thresholds',
  tabPolling: 'Polling Intervals',
  tabTelegram: 'Telegram Notifications',
  telegramTitle: 'NOC Telegram Bot Integration',
  telegramSubtitle: 'Send automatic alerts to a Telegram group or channel when incidents occur',
  telegramBotToken: 'Bot API Token',
  telegramChatId: 'Chat ID / Group ID',
  telegramThreadId: 'Message Thread ID (optional, for forum topics)',
  telegramTriggers: 'Notification Triggers',
  telegramOnCritical: 'Send on SEV-1 critical alarms (LOS / extreme attenuation)',
  telegramOnWarning: 'Send on SEV-2 warning alarms (attenuation nearing threshold)',
  telegramOnRecovery: 'Send a notification when a device returns to normal',
  telegramOnOltOffline: 'Send immediately when an OLT becomes unreachable',
  telegramTestBtn: 'Send Test Notification',
  telegramTesting: 'Sending...',
  telegramPreviewTitle: 'Telegram Message Format Preview',
  telegramSentBadge: 'Sent to Telegram',
  telegramResendBtn: 'Resend to Telegram',
  adminNotice: 'Only Administrator accounts can change these settings.',
  saveSettings: 'Save Configuration',
  saving: 'Saving...',
  savedSuccess: 'Settings saved successfully.',

  // Login Page
  loginTitle: 'Sign in to JOGO-MON',
  loginSubtitle: 'JOGLONET FTTH Access Network Monitoring Panel',
  labelUsername: 'Username',
  labelPassword: 'Password',
  btnLogin: 'Sign In',
  loggingIn: 'Authenticating...',
  demoHint: 'Demo account: admin / admin123 (Administrator access)',

  // Relative time
  timeNever: 'Never',
  timeJustNow: 'Just now',
  timeAgoSuffix: 'ago',
  timeUnitSec: 's',
  timeUnitMin: 'm',
  timeUnitHour: 'h',
  timeUnitDay: 'd',

  // Chart & telemetry shared labels
  loadingTelemetry: 'Loading OLT telemetry...',
  chartTime: 'Time',
  chartTotal: 'Total',
  chartDegraded: 'degraded',
  chartPeak24h: '24h peak',
  chartLast24h: 'Last 24 hours',
  chartRealtime: 'Real-time throughput',
  chartAggregateAll: 'All OLTs combined',
  chartNoData: 'No data yet',
  chartCurrent: 'Current',
  labelDown: 'Down',
  labelUp: 'Up',
  labelOfTotal: 'of total',
  labelHealthy: 'Healthy',

  // Rx distribution chart
  rxMeasuredOnu: 'ONUs measured',
  rxBucketOnu: 'ONUs',
  rxThresholdLine: 'Safe limit −25 dBm',

  // PON traffic breakdown
  ponTotalDown: 'Total Down',
  ponTotalUp: 'Total Up',
  ponActiveSubscribers: 'Active subscribers',

  // Uplink card
  uplinkInbound: 'Inbound (Down)',
  uplinkOutbound: 'Outbound (Up)',
  uplinkUtilization: 'Port utilization (10G capacity)',
  uplinkChartLabel: 'Uplink throughput graph',
  uplinkStandby: 'Standby (LACP)',
  uplinkFullDuplex: 'Full Duplex',

  // OLT detail page
  oltNotFound: 'OLT device not found',
  noOnuData: 'No ONU data',
  onuConnectedUnit: 'ONUs connected',
  ponPortsUnit: 'PON ports',
  uptimeSubtitle: 'Device uptime',
  metricCpuSubtitle: 'Chassis core',
  metricRamSubtitle: 'System RAM',
  metricTempSubtitle: 'Board sensor',

  // Accessibility landmarks & assistive labels
  skipToContent: 'Skip to main content',
  landmarkMainNav: 'Main navigation',
  landmarkMainContent: 'Main content',
  openMenu: 'Open navigation menu',
  closeMenu: 'Close navigation menu',
  languageSwitcher: 'Select language',

  // Wallboard (view mode)
  navWallboard: 'NOC Wallboard',
  wallboardTitle: 'NOC Wallboard',
  wallEnter: 'Wallboard',
  wallExit: 'Exit',
  wallFullscreen: 'Fullscreen',
  wallFullscreenExit: 'Exit Fullscreen',
  wallUpdated: 'Updated',
  wallTrafficTitle: 'Aggregate Traffic',
  wallFleetTitle: 'OLT Status',
  wallAlarmTitle: 'Active Alarms',
  wallOpticalTitle: 'Optical Health',
  wallWorstRxLabel: 'WEAKEST RX',
  wallAllClear: 'All clear — no active alarms',
};


export const translationsRecord: Record<Language, Translations> = {
  id: idTranslations,
  en: enTranslations,
};

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: 'id', // Default primary is Bahasa Indonesia
  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('jogomon_lang', lang);
      } catch { }
    }
    set({ language: lang });
  },
  toggleLanguage: () => {
    set((state) => {
      const next = state.language === 'id' ? 'en' : 'id';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('jogomon_lang', next);
        } catch { }
      }
      return { language: next };
    });
  },
}));

export function useTranslation() {
  const { language, setLanguage, toggleLanguage } = useLanguageStore();
  const t = translationsRecord[language] || idTranslations;
  return { t, language, setLanguage, toggleLanguage };
}

/**
 * Non-hook accessor untuk dipakai di util biasa (mis. formatter di lib/utils.ts).
 * Tetap sinkron dengan store karena komponen pemanggil umumnya sudah re-render
 * lewat useTranslation saat bahasa berubah.
 */
export function getTranslations(): Translations {
  return translationsRecord[useLanguageStore.getState().language] || idTranslations;
}
