/**
 * storage.js — Persistencia y Exportación
 * Sistema de Monitoreo QoS FTTH-GPON
 */

const KEYS = {
  nodes:        'qos_gpon_nodes',
  sessions:     'qos_gpon_sessions',
  measurements: 'qos_gpon_measurements',
};

// ============================================================
// NODOS
// ============================================================
export function saveNode(node) {
  const nodes = loadNodes();
  const idx = nodes.findIndex(n => n.id === node.id);
  if (idx >= 0) nodes[idx] = node;
  else nodes.push(node);
  localStorage.setItem(KEYS.nodes, JSON.stringify(nodes));
  return node;
}

export function loadNodes() {
  return JSON.parse(localStorage.getItem(KEYS.nodes) || '[]');
}

export function deleteNode(id) {
  const nodes = loadNodes().filter(n => n.id !== id);
  localStorage.setItem(KEYS.nodes, JSON.stringify(nodes));
}

export function createNode(data) {
  const node = { id: crypto.randomUUID(), creadoEn: new Date().toISOString(), ...data };
  return saveNode(node);
}

// ============================================================
// SESIONES
// ============================================================
export function createSession(data) {
  const session = {
    id: crypto.randomUUID(),
    fechaInicio: new Date().toISOString(),
    fechaFin: null,
    estado: 'activa',
    ...data,
  };
  const sessions = loadSessions();
  sessions.push(session);
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  return session;
}

export function loadSessions() {
  return JSON.parse(localStorage.getItem(KEYS.sessions) || '[]');
}

export function updateSession(id, updates) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx >= 0) { sessions[idx] = { ...sessions[idx], ...updates }; }
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

export function deleteSession(id) {
  const sessions = loadSessions().filter(s => s.id !== id);
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  const measurements = loadMeasurements().filter(m => m.sessionId !== id);
  localStorage.setItem(KEYS.measurements, JSON.stringify(measurements));
}

// ============================================================
// MEDICIONES
// ============================================================
export function saveMeasurement(measurement, sessionId) {
  const measurements = loadMeasurements();
  measurements.push({ ...measurement, sessionId });
  localStorage.setItem(KEYS.measurements, JSON.stringify(measurements));
}

export function loadMeasurements(sessionId = null) {
  const all = JSON.parse(localStorage.getItem(KEYS.measurements) || '[]');
  if (sessionId) return all.filter(m => m.sessionId === sessionId);
  return all;
}

export function getMeasurementsByFase(fase) {
  const sessions = loadSessions().filter(s => s.fase === fase);
  const ids = new Set(sessions.map(s => s.id));
  return loadMeasurements().filter(m => ids.has(m.sessionId));
}

// ============================================================
// EXPORTACIÓN
// ============================================================
export function exportMeasurementsCSV(measurements, filename = 'qos_mediciones.csv') {
  const headers = [
    'ID', 'Fase', 'Nodo', 'Timestamp',
    'Delay_ms', 'Delay_Min_ms', 'Delay_Max_ms',
    'Jitter_ms',
    'Throughput_DL_Mbps', 'Throughput_UL_Mbps', 'Throughput_Pct',
    'Packet_Loss_Pct',
    'QoS_Delay', 'QoS_Jitter', 'QoS_Throughput', 'QoS_PacketLoss',
    'Score_Global', 'Calidad_Global',
    'Herramienta', 'Protocolo',
  ];

  const rows = measurements.map(m => [
    m.id, m.fase, `"${m.nodeNombre}"`, m.timestamp,
    m.delay, m.delayMin, m.delayMax,
    m.jitter,
    m.downloadMbps, m.uploadMbps, m.throughputPct,
    m.packetLoss,
    m.qos?.delay, m.qos?.jitter, m.qos?.throughput, m.qos?.packetLoss,
    m.globalScore, m.globalQuality,
    `"${m.herramienta}"`, m.protocolo,
  ].join(','));

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

export function exportAllJSON(filename = 'qos_backup.json') {
  const data = {
    exportedAt: new Date().toISOString(),
    nodes: loadNodes(),
    sessions: loadSessions(),
    measurements: loadMeasurements(),
  };
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revoke so browser has time to start the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ============================================================
// ESTADÍSTICAS
// ============================================================
export function computeStats(values) {
  if (!values || values.length === 0) return { min: 0, max: 0, avg: 0, std: 0, n: 0 };
  const n   = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.map(v => (v - avg) ** 2).reduce((a, b) => a + b, 0) / n);
  return {
    min: round(min), max: round(max),
    avg: round(avg), std: round(std), n,
  };
}

function round(v) { return parseFloat(v.toFixed(3)); }
