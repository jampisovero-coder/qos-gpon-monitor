/**
 * charts.js — Visualización de Métricas QoS
 * Sistema de Monitoreo FTTH-GPON
 * Usa Chart.js (global)
 */

import { QOS_THRESHOLDS, STATUS_LABELS } from './monitor.js';
import { computeStats } from './storage.js';

// Paleta
const C = {
  cyan:   '#00d4ff',
  purple: '#7c3aed',
  green:  '#10b981',
  yellow: '#f59e0b',
  red:    '#ef4444',
  orange: '#f97316',
  grid:   'rgba(255,255,255,0.06)',
  text:   '#94a3b8',
};

// Registro de instancias para destruir antes de re-renderizar
const _charts = {};

function destroyIfExists(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}

function baseOptions(title = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: C.text, font: { family: 'JetBrains Mono', size: 11 } } },
      title: { display: !!title, text: title, color: C.text, font: { size: 13, weight: '600' } },
      tooltip: {
        backgroundColor: '#0d1321',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#f0f4f8',
        bodyColor: C.text,
      },
    },
    scales: {
      x: { ticks: { color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
      y: { ticks: { color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
    },
  };
}

// ============================================================
// GRÁFICO DE LÍNEA DE TIEMPO (Dashboard principal)
// ============================================================
export function renderTimelineChart(canvasId, measurements, metric) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx || !measurements.length) return;

  const labels = measurements.map((m, i) => `#${i + 1}`);
  const metricMap = {
    delay:      { key: 'delay',        label: 'Delay (ms)',         color: C.cyan,   threshold: QOS_THRESHOLDS.delay.acceptable },
    jitter:     { key: 'jitter',       label: 'Jitter (ms)',        color: '#a855f7', threshold: QOS_THRESHOLDS.jitter.acceptable },
    throughput: { key: 'downloadMbps', label: 'Throughput (Mbps)',  color: C.green,  threshold: null },
    packetLoss: { key: 'packetLoss',   label: 'Packet Loss (%)',    color: C.yellow, threshold: QOS_THRESHOLDS.packetLoss.acceptable },
  };

  const m = metricMap[metric] || metricMap.delay;
  const data = measurements.map(meas => meas[m.key]);

  const datasets = [{
    label: m.label,
    data,
    borderColor: m.color,
    backgroundColor: m.color + '22',
    borderWidth: 2,
    pointRadius: 4,
    pointBackgroundColor: m.color,
    fill: true,
    tension: 0.4,
  }];

  if (m.threshold) {
    datasets.push({
      label: 'Umbral ITU-T',
      data: new Array(labels.length).fill(m.threshold),
      borderColor: C.red + '80',
      borderDash: [6, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: baseOptions(),
  });
}

// ============================================================
// GRÁFICO COMPARATIVO PRETEST vs POSTEST (Bar)
// ============================================================
export function renderComparisonChart(canvasId, pretestStats, postestStats) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const labels = ['Delay (ms)', 'Jitter (ms)', 'Packet Loss (%)', 'Throughput DL (Mbps)'];
  const preData  = [pretestStats.delay.avg,  pretestStats.jitter.avg,  pretestStats.packetLoss.avg,  pretestStats.downloadMbps.avg];
  const postData = [postestStats.delay.avg, postestStats.jitter.avg, postestStats.packetLoss.avg, postestStats.downloadMbps.avg];

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'PRETEST',  data: preData,  backgroundColor: C.purple + 'bb', borderColor: C.purple, borderWidth: 1 },
        { label: 'POSTEST',  data: postData, backgroundColor: C.green  + 'bb', borderColor: C.green,  borderWidth: 1 },
      ],
    },
    options: {
      ...baseOptions('Comparativa PRETEST vs POSTEST'),
      plugins: {
        ...baseOptions().plugins,
        legend: { labels: { color: C.text } },
      },
    },
  });
}

// ============================================================
// RADAR — Perfil QoS de una sesión
// ============================================================
export function renderRadarChart(canvasId, measurements) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx || !measurements.length) return;

  // Normalizar a 0-100 (100 = mejor)
  const delays      = measurements.map(m => m.delay);
  const jitters     = measurements.map(m => m.jitter);
  const losses      = measurements.map(m => m.packetLoss);
  const throughputs = measurements.map(m => m.throughputPct);

  const norm = (arr, threshold, invert = true) => {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const score = invert ? Math.max(0, 100 - (avg / threshold) * 100) : Math.min(100, avg);
    return parseFloat(score.toFixed(1));
  };

  const delayScore      = norm(delays,      QOS_THRESHOLDS.delay.acceptable);
  const jitterScore     = norm(jitters,     QOS_THRESHOLDS.jitter.acceptable);
  const lossScore       = norm(losses,      QOS_THRESHOLDS.packetLoss.acceptable);
  const throughputScore = norm(throughputs, 100, false);

  _charts[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Delay', 'Jitter', 'Packet Loss', 'Throughput'],
      datasets: [
        {
          label: 'Perfil QoS Medido',
          data: [delayScore, jitterScore, lossScore, throughputScore],
          backgroundColor: C.cyan + '33',
          borderColor: C.cyan,
          borderWidth: 2,
          pointBackgroundColor: C.cyan,
        },
        {
          label: 'Calidad Óptima',
          data: [100, 100, 100, 100],
          backgroundColor: C.green + '11',
          borderColor: C.green + '44',
          borderDash: [5, 5],
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { color: C.text, backdropColor: 'transparent', stepSize: 25 },
          grid:  { color: C.grid },
          angleLines: { color: C.grid },
          pointLabels: { color: C.text, font: { size: 11 } },
        },
      },
      plugins: {
        legend: { labels: { color: C.text } },
        tooltip: baseOptions().plugins.tooltip,
      },
    },
  });
}

// ============================================================
// HISTOGRAMA de distribución de delays
// ============================================================
export function renderHistogram(canvasId, measurements) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx || !measurements.length) return;

  const values = measurements.map(m => m.delay);
  const bins   = [0, 10, 50, 100, 150, 200, 400, Infinity];
  const counts = new Array(bins.length - 1).fill(0);
  values.forEach(v => {
    for (let i = 0; i < bins.length - 1; i++) {
      if (v >= bins[i] && v < bins[i + 1]) { counts[i]++; break; }
    }
  });
  const labels   = ['0-10ms', '10-50ms', '50-100ms', '100-150ms', '150-200ms', '200-400ms', '>400ms'];
  const bgColors = [C.green, C.green, C.yellow, C.yellow, C.orange, C.red, C.red].map(c => c + 'cc');

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Frecuencia de Delay', data: counts, backgroundColor: bgColors }] },
    options: { ...baseOptions('Distribución de Latencia') },
  });
}

// ============================================================
// UTILS: calcular stats por métrica para comparison
// ============================================================
export function buildStatsFromMeasurements(measurements) {
  return {
    delay:       computeStats(measurements.map(m => m.delay)),
    jitter:      computeStats(measurements.map(m => m.jitter)),
    packetLoss:  computeStats(measurements.map(m => m.packetLoss)),
    downloadMbps: computeStats(measurements.map(m => m.downloadMbps)),
    uploadMbps:  computeStats(measurements.map(m => m.uploadMbps)),
  };
}
