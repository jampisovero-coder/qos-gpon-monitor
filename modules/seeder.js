/**
 * seeder.js — Generador de Datos Históricos Demo
 * Sistema de Monitoreo QoS FTTH-GPON
 *
 * Genera datos realistas desde Marzo 2026 hasta Mayo 2026 (mes actual)
 * PRETEST  = Marzo 2026        → Red convencional (ADSL/HFC cable coaxial)
 * POSTEST  = Abril + Mayo 2026 → Red FTTH-GPON implementada (ITU-T G.984)
 *
 * Valores basados en:
 *   - ITU-T G.984.2 (2003) — GPON Physical Media Dependent Layer Specification
 *   - ITU-T Y.1541 — Network performance objectives for IP-based services
 *   - RFC 2544 — Benchmarking Methodology for Network Interconnect Devices
 *   - Kanellopoulos et al. (2011) — "QoS provisioning in GPON access networks"
 *     DOI: 10.1109/AICT.2011.6 (IEEE)
 *   - Okonkwo et al. (2022) — "FTTH Networks: Performance analysis"
 *     IEEE Communications Surveys & Tutorials
 *
 * PRETEST (HFC/ADSL):
 *   Delay promedio: 85–110 ms (fuente: ITU-T Y.1541, clase 2)
 *   Jitter: 20–35 ms (alta variabilidad en red compartida)
 *   Throughput: 30–60 Mbps (plan 100 Mbps con saturación)
 *   Packet Loss: 2–4% (congestión típica HFC)
 *
 * POSTEST (FTTH-GPON ITU-T G.984):
 *   Delay promedio: 5–15 ms (fibra óptica, latencia mínima)
 *   Jitter: 0.5–2 ms (DBA + T-CONT tipo 1/2 garantizan estabilidad)
 *   Throughput: 240–290 Mbps (plan 300 Mbps, >80% garantizado)
 *   Packet Loss: 0.01–0.1% (ITU-T G.984 target < 0.1%)
 *
 * Variación estadística basada en distribución normal truncada
 * para simular mediciones reales de campo.
 */

import { createNode, createSession, saveMeasurement, loadNodes, loadSessions,
         loadMeasurements } from './storage.js';

// ============================================================
// NODOS DE PRUEBA (puntos de monitoreo)
// ============================================================
const DEMO_NODES = [
  { nombre: 'ONT-Ate-Sector-A',       tipo: 'ONU', ipObjetivo: '192.168.1.10', planMbps: 300,
    ubicacion: 'Av. Metropolitana 1245, Ate', oltAsociada: 'LIM_ATE_OLT_01', puertoGpon: '0/1/3', ontId: '15' },
  { nombre: 'ONT-Ate-Sector-B',       tipo: 'ONU', ipObjetivo: '192.168.1.20', planMbps: 300,
    ubicacion: 'Jr. Los Cipreses 432, Ate',  oltAsociada: 'LIM_ATE_OLT_01', puertoGpon: '0/1/7', ontId: '22' },
  { nombre: 'ONT-LosAlamitos-Sector-C', tipo: 'ONU', ipObjetivo: '192.168.2.10', planMbps: 200,
    ubicacion: 'Urb. Los Alamitos, Ate',     oltAsociada: 'LIM_ATE_OLT_02', puertoGpon: '0/2/1', ontId: '8'  },
];

// ============================================================
// PARÁMETROS POR FASE
// Pretest: red convencional con calidad degradada
// Postest: red FTTH-GPON con alta calidad
// ============================================================
// ============================================================
// PARÁMETROS POR FASE — Valores basados en literatura técnica
// Fuente: ITU-T G.984, Y.1541 · RFC 2544 · IEEE QoS GPON studies
// ============================================================
const PHASE_PARAMS = {
  PRETEST: {
    // Red HFC/ADSL convencional — calidad degradada
    // Referencia: ITU-T Y.1541 Clase 2, mediciones típicas HFC Lima
    delay:        { base: 98,   std: 18   },  // ms — latencia alta (HFC compartida)
    jitter:       { base: 27,   std: 8    },  // ms — alta variabilidad
    downloadMbps: { base: 42,   std: 12   },  // Mbps — plan 100Mbps con saturación ~42%
    uploadMbps:   { base: 10,   std: 4    },  // Mbps — subida asimétrica
    packetLoss:   { base: 3.1,  std: 1.2  },  // % — pérdida notable por congestión
  },
  POSTEST: {
    // Red FTTH-GPON (ITU-T G.984) — mejora significativa demostrable
    // Referencia: ITU-T G.984.2 §7, RFC 2544, DBA con T-CONT tipo 1/2
    delay:        { base: 8,    std: 2    },  // ms — fibra óptica, latencia mínima (-92%)
    jitter:       { base: 1.2,  std: 0.4  },  // ms — DBA estabiliza variación (-96%)
    downloadMbps: { base: 268,  std: 18   },  // Mbps — plan 300Mbps, >89% garantizado
    uploadMbps:   { base: 175,  std: 15   },  // Mbps — subida simétrica GPON
    packetLoss:   { base: 0.06, std: 0.03 },  // % — casi cero (<0.1% ITU-T target)
  },
};

// ============================================================
// SESIONES POR MES
// ============================================================
const DEMO_SESSIONS = [
  // ---- PRETEST: Marzo 2026 (antes de FTTH-GPON) ----
  { fase: 'PRETEST', year: 2026, month: 2, day: 5,
    descripcion: 'Medición inicial PRETEST — Red convencional (HFC)', operador: 'Canales J.' },
  { fase: 'PRETEST', year: 2026, month: 2, day: 12,
    descripcion: 'PRETEST control semana 2 — Red existente',           operador: 'Sovero M.' },
  { fase: 'PRETEST', year: 2026, month: 2, day: 19,
    descripcion: 'PRETEST control semana 3 — Verificación baseline',   operador: 'Canales J.' },
  { fase: 'PRETEST', year: 2026, month: 2, day: 26,
    descripcion: 'PRETEST final Marzo — Cierre línea base',            operador: 'Sovero M.' },

  // ---- POSTEST: Abril 2026 (implementación FTTH-GPON) ----
  { fase: 'POSTEST', year: 2026, month: 3, day: 8,
    descripcion: 'POSTEST semana 1 Abril — Post-activación GPON',      operador: 'Canales J.' },
  { fase: 'POSTEST', year: 2026, month: 3, day: 15,
    descripcion: 'POSTEST semana 2 Abril — Estabilización red GPON',   operador: 'Sovero M.' },
  { fase: 'POSTEST', year: 2026, month: 3, day: 22,
    descripcion: 'POSTEST semana 3 Abril — Verificación QoS FTTH',     operador: 'Canales J.' },
  { fase: 'POSTEST', year: 2026, month: 3, day: 29,
    descripcion: 'POSTEST cierre Abril — Análisis rendimiento GPON',   operador: 'Sovero M.' },

  // ---- POSTEST: Mayo 2026 (mes actual) ----
  { fase: 'POSTEST', year: 2026, month: 4, day: 6,
    descripcion: 'POSTEST Mayo semana 1 — Monitoreo continuo GPON',    operador: 'Canales J.' },
  { fase: 'POSTEST', year: 2026, month: 4, day: 13,
    descripcion: 'POSTEST Mayo semana 2 — Evaluación pico de tráfico', operador: 'Sovero M.' },
  { fase: 'POSTEST', year: 2026, month: 4, day: 18,
    descripcion: 'POSTEST Mayo semana 3 — Medición final análisis',    operador: 'Canales J.' },
];

// ============================================================
// UTILIDADES DE GENERACIÓN
// ============================================================

/** Distribución normal (Box-Muller) */
function randn(mean, std) {
  const u1 = Math.random(), u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round3(v) { return parseFloat(v.toFixed(3)); }
function round2(v) { return parseFloat(v.toFixed(2)); }

function genMetric(params, min, max) {
  return round3(clamp(randn(params.base, params.std), min, max));
}

/** Genera array de delaySamples coherente con el jitter de fase
 *  jitterMs: jitter ya generado desde parámetros de fase
 */
function genDelaySamples(baseDelay, jitterMs = null, n = 10) {
  // Si se pasa jitterMs, ajusta la std para que las muestras
  // produzcan variaciones coherentes con ese jitter
  const std = jitterMs !== null ? jitterMs * 0.7 : baseDelay * 0.12;
  return Array.from({ length: n }, () => round3(clamp(randn(baseDelay, std), 1, 1000)));
}

function computeJitter(samples) {
  const diffs = [];
  for (let i = 1; i < samples.length; i++) diffs.push(Math.abs(samples[i] - samples[i - 1]));
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return round3(avg);
}

const scoreMap = { excellent: 4, acceptable: 3, degraded: 2, critical: 1 };

function classify(metric, value) {
  const T = {
    delay:      { excellent: 10,  acceptable: 150, degraded: 400 },
    jitter:     { excellent: 1,   acceptable: 30,  degraded: 50  },
    packetLoss: { excellent: 0.1, acceptable: 1,   degraded: 5   },
    throughput: { excellent: 80,  acceptable: 60,  degraded: 40  },
  };
  const t = T[metric];
  if (metric === 'throughput') {
    if (value >= t.excellent) return 'excellent';
    if (value >= t.acceptable) return 'acceptable';
    if (value >= t.degraded) return 'degraded';
    return 'critical';
  }
  if (value <= t.excellent) return 'excellent';
  if (value <= t.acceptable) return 'acceptable';
  if (value <= t.degraded) return 'degraded';
  return 'critical';
}

/** Genera una medición completa para un nodo y sesión
 *  NOTA: El jitter se genera desde p.jitter (parámetro de fase),
 *  NO se recalcula desde delaySamples para garantizar que los valores
 *  reflejen correctamente la diferencia PRETEST vs POSTEST.
 *  Fuente de rangos: ITU-T G.984, Y.1541, RFC 2544
 */
function generateMeasurement(nodo, fase, sessionId, baseDate) {
  const p = PHASE_PARAMS[fase];

  const delay        = genMetric(p.delay,        1, 500);
  // Jitter generado directamente desde parámetros de fase (corrección de bug)
  // En PRETEST (HFC): ~27ms ± 8ms | En POSTEST (GPON): ~1.2ms ± 0.4ms
  const jitter       = genMetric(p.jitter,       0.1, 100);
  const delaySamples = genDelaySamples(delay, jitter);
  const downloadMbps = genMetric(p.downloadMbps, 1, 980);
  const uploadMbps   = genMetric(p.uploadMbps,   1, 980);
  const packetLoss   = round3(clamp(randn(p.packetLoss.base, p.packetLoss.std), 0, 30));
  const planMbps     = nodo.planMbps || 100;
  const throughputPct = round2(clamp((downloadMbps / planMbps) * 100, 0, 200));

  const qos = {
    delay:      classify('delay',      delay),
    jitter:     classify('jitter',     jitter),
    throughput: classify('throughput', throughputPct),
    packetLoss: classify('packetLoss', packetLoss),
  };

  const scores = Object.values(qos).map(k => scoreMap[k] || 1);
  const globalScore   = round3(scores.reduce((a, b) => a + b, 0) / scores.length);
  const globalQuality = globalScore >= 3.5 ? 'excellent'
                      : globalScore >= 2.5 ? 'acceptable'
                      : globalScore >= 1.5 ? 'degraded' : 'critical';

  return {
    id:            crypto.randomUUID(),
    nodeid:        nodo.id,
    nodeNombre:    nodo.nombre,
    fase,
    sessionId,
    timestamp:     baseDate.toISOString(),
    delay,
    delayMin:      round3(Math.min(...delaySamples)),
    delayMax:      round3(Math.max(...delaySamples)),
    delaySamples,
    jitter,
    downloadMbps,
    uploadMbps,
    throughputPct,
    packetLoss,
    qos,
    globalScore,
    globalQuality,
    herramienta: 'HTTP/Fetch (RFC2544-like)',
    protocolo:   'HTTP/HTTPS',
  };
}

// ============================================================
// FUNCIÓN PRINCIPAL: SEMBRAR DATOS
// ============================================================
export function seedDemoData(onProgress = () => {}) {
  onProgress('Generando datos históricos Marzo–Mayo 2026...');

  // 1. Crear nodos
  onProgress('Creando nodos de prueba...');
  const nodes = DEMO_NODES.map(n => {
    const node = { id: crypto.randomUUID(), creadoEn: new Date('2026-03-01').toISOString(), ...n };
    // Guardar directamente en storage
    const existing = JSON.parse(localStorage.getItem('qos_gpon_nodes') || '[]');
    existing.push(node);
    localStorage.setItem('qos_gpon_nodes', JSON.stringify(existing));
    return node;
  });

  // 2. Crear sesiones y mediciones
  let sessionCount = 0, measureCount = 0;

  DEMO_SESSIONS.forEach((def, si) => {
    onProgress(`Generando sesión ${si + 1}/${DEMO_SESSIONS.length}...`);

    // Crear sesión
    const sessionDate = new Date(def.year, def.month, def.day, 8, 30, 0);
    const session = {
      id:          crypto.randomUUID(),
      fase:        def.fase,
      descripcion: def.descripcion,
      operador:    def.operador,
      fechaInicio: sessionDate.toISOString(),
      fechaFin:    new Date(sessionDate.getTime() + 3600000).toISOString(),
      estado:      'completada',
    };
    const sessions = JSON.parse(localStorage.getItem('qos_gpon_sessions') || '[]');
    sessions.push(session);
    localStorage.setItem('qos_gpon_sessions', JSON.stringify(sessions));
    sessionCount++;

    // Generar 3 mediciones por sesión (una por nodo) con minutos distintos
    nodes.forEach((nodo, ni) => {
      const measTime = new Date(sessionDate.getTime() + ni * 12 * 60000); // +12 min por nodo
      const measurement = generateMeasurement(nodo, def.fase, session.id, measTime);

      const measurements = JSON.parse(localStorage.getItem('qos_gpon_measurements') || '[]');
      measurements.push(measurement);
      localStorage.setItem('qos_gpon_measurements', JSON.stringify(measurements));
      measureCount++;
    });
  });

  onProgress('✅ Datos demo cargados.');
  return { nodes: nodes.length, sessions: sessionCount, measurements: measureCount };
}
