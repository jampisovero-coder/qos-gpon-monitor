/**
 * comparison.js — Módulo Pretest vs Postest
 * Sistema de Monitoreo QoS FTTH-GPON
 * Diseño de investigación: Cuantitativo pretest-postest (Campbell & Stanley)
 */

import { loadSessions, loadMeasurements, computeStats, exportMeasurementsCSV } from './storage.js';
import { renderComparisonChart, renderRadarChart, buildStatsFromMeasurements } from './charts.js';
import { STATUS_LABELS, classify } from './monitor.js';

// ============================================================
// RENDERIZAR SELECTOR DE SESIONES
// ============================================================
export function renderSessionSelectors(preSelectId, postSelectId) {
  const sessions = loadSessions();
  const pretestSessions  = sessions.filter(s => s.fase === 'PRETEST');
  const postestSessions  = sessions.filter(s => s.fase === 'POSTEST');

  const opts = (arr) => arr.length
    ? arr.map(s => `<option value="${s.id}">${s.descripcion || s.fase} — ${formatDate(s.fechaInicio)}</option>`).join('')
    : `<option value="">No hay sesiones</option>`;

  const preSel  = document.getElementById(preSelectId);
  const postSel = document.getElementById(postSelectId);
  if (preSel)  preSel.innerHTML  = `<option value="">-- Sesión PRETEST --</option>${opts(pretestSessions)}`;
  if (postSel) postSel.innerHTML = `<option value="">-- Sesión POSTEST --</option>${opts(postestSessions)}`;
}

// ============================================================
// RENDERIZAR PANEL DE COMPARATIVA
// ============================================================
export function renderComparisonPanel(containerId, preSessionId, postSessionId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!preSessionId || !postSessionId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚖️</div>
        <p>Selecciona una sesión PRETEST y una POSTEST para ver la comparativa.</p>
      </div>`;
    return;
  }

  const preMeasurements  = loadMeasurements(preSessionId);
  const postMeasurements = loadMeasurements(postSessionId);

  if (!preMeasurements.length || !postMeasurements.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>Una de las sesiones no tiene mediciones registradas.</p></div>`;
    return;
  }

  const preStats  = buildStatsFromMeasurements(preMeasurements);
  const postStats = buildStatsFromMeasurements(postMeasurements);

  container.innerHTML = buildComparisonHTML(preStats, postStats, preMeasurements, postMeasurements);

  // Gráficos
  renderComparisonChart('compBarChart', preStats, postStats);
  renderRadarChart('compPreRadar',  preMeasurements);
  renderRadarChart('compPostRadar', postMeasurements);

  // Exportar
  document.getElementById('btnExportComparison')?.addEventListener('click', () => {
    exportMeasurementsCSV(
      [...preMeasurements, ...postMeasurements],
      `comparativa_pretest_postest_${Date.now()}.csv`
    );
  });
}

// ============================================================
// HTML DE COMPARATIVA
// ============================================================
function buildComparisonHTML(preStats, postStats, preMeas, postMeas) {
  const metrics = [
    { key: 'delay',       label: 'Delay',       unit: 'ms',   invertGood: true },
    { key: 'jitter',      label: 'Jitter',      unit: 'ms',   invertGood: true },
    { key: 'packetLoss',  label: 'Packet Loss',  unit: '%',   invertGood: true },
    { key: 'downloadMbps', label: 'Throughput DL', unit: 'Mbps', invertGood: false },
  ];

  const rows = metrics.map(m => {
    const pre  = preStats[m.key];
    const post = postStats[m.key];
    const diff = post.avg - pre.avg;
    const pct  = pre.avg !== 0 ? ((diff / pre.avg) * 100).toFixed(1) : '∞';
    const improved = m.invertGood ? diff < 0 : diff > 0;
    const diffClass = diff === 0 ? 'diff-neutral' : (improved ? 'diff-positive' : 'diff-negative');
    const arrow = diff === 0 ? '→' : (improved ? '↓' : '↑');
    const label = improved ? 'Mejora' : (diff === 0 ? 'Sin cambio' : 'Degradación');

    return `
      <tr>
        <td style="color:#f0f4f8;font-weight:600">${m.label}</td>
        <td>${pre.avg} ${m.unit}</td>
        <td>${pre.min} / ${pre.max}</td>
        <td>${post.avg} ${m.unit}</td>
        <td>${post.min} / ${post.max}</td>
        <td class="${diffClass}">
          ${arrow} ${Math.abs(diff).toFixed(3)} ${m.unit}
          <span style="font-size:0.7rem;opacity:0.7">(${pct}%)</span>
        </td>
        <td><span class="badge ${improved ? 'badge-excellent' : 'badge-critical'}">${label}</span></td>
      </tr>`;
  }).join('');

  const preQuality  = avgGlobalScore(preMeas);
  const postQuality = avgGlobalScore(postMeas);

  return `
    <div class="section-header" style="margin-bottom:20px">
      <div>
        <h2>Comparativa PRETEST vs POSTEST</h2>
        <p class="section-subtitle">Diseño experimental cuantitativo — Instrumento: Ficha Técnica Automatizada</p>
      </div>
      <button class="btn btn-secondary" id="btnExportComparison">📥 Exportar CSV</button>
    </div>

    <div class="stats-row">
      <div class="stat-chip">PRETEST: <strong>${preMeas.length}</strong> medición(es)</div>
      <div class="stat-chip">POSTEST: <strong>${postMeas.length}</strong> medición(es)</div>
      <div class="stat-chip">Score PRE: <strong>${preQuality}</strong></div>
      <div class="stat-chip">Score POST: <strong>${postQuality}</strong></div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
              <th>PRE Avg</th>
              <th>PRE Min/Max</th>
              <th>POST Avg</th>
              <th>POST Min/Max</th>
              <th>Diferencia</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="comparison-grid">
      <div class="chart-card">
        <div class="chart-title">Comparativa por Métrica</div>
        <div class="chart-container" style="height:280px"><canvas id="compBarChart"></canvas></div>
      </div>
      <div style="display:grid;gap:16px">
        <div class="chart-card">
          <div class="chart-title">Perfil QoS — PRETEST</div>
          <div class="chart-container" style="height:180px"><canvas id="compPreRadar"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Perfil QoS — POSTEST</div>
          <div class="chart-container" style="height:180px"><canvas id="compPostRadar"></canvas></div>
        </div>
      </div>
    </div>`;
}

function avgGlobalScore(measurements) {
  if (!measurements.length) return '—';
  const avg = measurements.reduce((a, m) => a + (m.globalScore || 0), 0) / measurements.length;
  return avg.toFixed(2);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
