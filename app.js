/**
 * app.js — Orquestador Principal
 * Sistema de Monitoreo QoS FTTH-GPON
 * Tesis: Ingeniería de Sistemas / Telecomunicaciones
 *
 * NOTA: Sistema 100% técnico. Sin encuestas, sin SERVQUAL, sin Likert.
 * Técnica: Observación técnica automatizada
 * Instrumento: Ficha técnica automatizada
 * Diseño: Cuantitativo comparativo evaluativo
 * Diagnóstico de red actual contrastado con estándares ITU-T G.984
 */

import { runFullMeasurement, classify, STATUS_LABELS } from './modules/monitor.js';
import { saveMeasurement, loadMeasurements, createSession, loadSessions,
         updateSession, deleteSession, exportMeasurementsCSV, exportAllJSON,
         loadNodes } from './modules/storage.js';
import { renderTimelineChart, renderRadarChart, renderHistogram,
         buildStatsFromMeasurements } from './modules/charts.js';
import { renderNodeList, renderNodeForm, populateNodeSelect } from './modules/nodes.js';
import { renderSessionSelectors, renderComparisonPanel } from './modules/comparison.js';
import { seedDemoData } from './modules/seeder.js';
import { renderReliabilityPanel } from './modules/reliability.js';
import { abrirFichaTecnica } from './modules/fichaTecnica.js';

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentPage    = 'dashboard';
let activePhase    = 'PRETEST'; // 'PRETEST' | 'POSTEST'
let currentSession = null;      // sesión activa de medición
let isMeasuring    = false;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPhaseToggle();
  initTopbarActions();
  initDashboard();
  initNodes();
  initMeasure();
  initHistory();
  initComparison();
  updatePhaseBadge();
});

// ============================================================
// NAVEGACIÓN
// ============================================================
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Mostrar la página destino
  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.getElementById(`nav-${page}`);
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('fade-in'); }
  if (navEl)  navEl.classList.add('active');

  const titles = {
    dashboard:   'Dashboard QoS',
    nodes:       'Nodos de Prueba',
    measure:     'Ejecutar Medición',
    history:     'Historial de Mediciones',
    comparison:  'Análisis Comparativo',
    reliability: 'Confiabilidad del Instrumento',
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  currentPage = page;

  // Refrescar datos al navegar
  if (page === 'dashboard')   refreshDashboard();
  if (page === 'nodes')        refreshNodes();
  if (page === 'measure')      refreshMeasureSelects();
  if (page === 'history')      refreshHistory();
  if (page === 'comparison')   refreshComparison();
  if (page === 'reliability')  renderReliabilityPanel('reliabilityPanel');
}

// ============================================================
// FASE TOGGLE (PRETEST / POSTEST)
// ============================================================
function initPhaseToggle() {
  document.getElementById('phaseBadge').addEventListener('click', () => {
    document.getElementById('phaseModal').style.display = 'flex';
  });
  document.getElementById('setPhasePretest').addEventListener('click', () => {
    activePhase = 'PRETEST';
    closePhaseModal();
    updatePhaseBadge();
    document.getElementById('measFase').value = 'PRETEST';
    showToast('Modo: Diagnóstico de Red Actual');
    if (currentPage === 'dashboard') refreshDashboard();
  });
  document.getElementById('setPhasePostest').addEventListener('click', () => {
    activePhase = 'POSTEST';
    closePhaseModal();
    updatePhaseBadge();
    document.getElementById('measFase').value = 'POSTEST';
    showToast('Modo: Proyección Estándar GPON');
    if (currentPage === 'dashboard') refreshDashboard();
  });
  document.getElementById('closePhaseModal').addEventListener('click', closePhaseModal);
}

function closePhaseModal() {
  document.getElementById('phaseModal').style.display = 'none';
}

function updatePhaseBadge() {
  const badge = document.getElementById('phaseBadge');
  const phaseLabels = { PRETEST: 'DIAGNÓSTICO', POSTEST: 'PROYECCIÓN GPON' };
  badge.textContent = `FASE: ${phaseLabels[activePhase] || activePhase}`;
  badge.className = `phase-badge ${activePhase.toLowerCase()}`;
}

// ============================================================
// TOPBAR ACTIONS
// ============================================================
function initTopbarActions() {
  document.getElementById('btnExportJSON').addEventListener('click', () => {
    exportAllJSON(`qos_backup_${Date.now()}.json`);
    showToast('Backup JSON exportado.');
  });

  document.getElementById('btnExportPrePos').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = 'Pre_Pos_QoS (1).xlsx';
    link.download = 'Pre_Pos_QoS (1).xlsx';
    link.click();
    showToast('Descargando archivo Pre_Pos_QoS (1)...');
  });

  document.getElementById('btnFichaTecnica').addEventListener('click', () => {
    window.abrirFichaTecnicaDesdeResultado();
  });

  document.getElementById('btnClearData').addEventListener('click', () => {
    if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return;
    ['qos_gpon_nodes', 'qos_gpon_sessions', 'qos_gpon_measurements'].forEach(k => localStorage.removeItem(k));
    showToast('Datos eliminados.');
    refreshDashboard(); refreshNodes(); refreshHistory();
  });

  document.getElementById('btnSeedData').addEventListener('click', () => {
    const result = seedDemoData((msg) => showToast(msg));
    if (result) {
      showToast(`✅ ${result.measurements} mediciones cargadas (${result.nodes} nodos, ${result.sessions} sesiones)`);
      refreshDashboard();
      refreshNodes();
      refreshHistory();
      refreshComparison();
    }
  });
}

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
  document.getElementById('btnQuickMeasure').addEventListener('click', () => navigateTo('measure'));
  document.getElementById('dashMetricSelect').addEventListener('change', () => refreshDashboard());
  refreshDashboard();
}

function refreshDashboard() {
  const allMeasurements = loadMeasurements();
  const measurements = allMeasurements.filter(m => m.fase === activePhase);
  const last = measurements[measurements.length - 1];

  if (last) {
    updateMetricCard('delay',      last.delay,       last.qos?.delay);
    updateMetricCard('jitter',     last.jitter,      last.qos?.jitter);
    updateMetricCard('throughput', last.downloadMbps, last.qos?.throughput);
    updateMetricCard('loss',       last.packetLoss,  last.qos?.packetLoss);
  } else {
    updateMetricCard('delay',      '—', 'idle');
    updateMetricCard('jitter',     '—', 'idle');
    updateMetricCard('throughput', '—', 'idle');
    updateMetricCard('loss',       '—', 'idle');
  }

  const metric = document.getElementById('dashMetricSelect')?.value || 'delay';
  const recent = measurements.slice(-20);
  
  if (recent.length) {
    renderTimelineChart('dashTimelineChart', recent, metric);
    renderRadarChart('dashRadarChart', recent);
  } else {
    renderTimelineChart('dashTimelineChart', [], metric);
    renderRadarChart('dashRadarChart', []);
  }

  renderRecentTable('dashRecentTable', measurements.slice(-8).reverse());
}

function updateMetricCard(metric, value, qos) {
  const idMap = { delay: 'dash-delay', jitter: 'dash-jitter', throughput: 'dash-throughput', loss: 'dash-loss' };
  const dotMap = { delay: 'dot-delay', jitter: 'dot-jitter', throughput: 'dot-throughput', loss: 'dot-loss' };
  const lblMap = { delay: 'lbl-delay', jitter: 'lbl-jitter', throughput: 'lbl-throughput', loss: 'lbl-loss' };
  const el  = document.getElementById(idMap[metric]);
  const dot = document.getElementById(dotMap[metric]);
  const lbl = document.getElementById(lblMap[metric]);
  if (!el) return;
  el.textContent  = value !== undefined ? value : '—';
  dot.className   = `status-dot ${qos || 'idle'}`;
  lbl.textContent = STATUS_LABELS[qos] || 'Sin datos';
  lbl.style.color = qosColor(qos);
}

function qosColor(q) {
  return { excellent: '#10b981', acceptable: '#f59e0b', degraded: '#f97316', critical: '#ef4444' }[q] || '#475569';
}

function renderRecentTable(containerId, measurements) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!measurements.length) {
    c.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>Ejecuta una medición para ver resultados aquí.</p></div>`;
    return;
  }
  c.innerHTML = `
    <table>
      <thead><tr>
        <th>Timestamp</th><th>Nodo</th><th>Fase</th>
        <th>Delay (ms)</th><th>Jitter (ms)</th><th>DL (Mbps)</th><th>Loss (%)</th><th>Calidad</th>
      </tr></thead>
      <tbody>
        ${measurements.map(m => `
          <tr>
            <td>${formatTs(m.timestamp)}</td>
            <td style="color:var(--text-primary)">${m.nodeNombre || '—'}</td>
            <td><span class="badge badge-${m.fase?.toLowerCase()}">${m.fase || '—'}</span></td>
            <td>${m.delay}</td><td>${m.jitter}</td>
            <td>${m.downloadMbps}</td><td>${m.packetLoss}</td>
            <td><span class="badge badge-${m.globalQuality}">${STATUS_LABELS[m.globalQuality] || '—'}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ============================================================
// NODOS
// ============================================================
function initNodes() {
  document.getElementById('btnAddNode').addEventListener('click', () => {
    const fc = document.getElementById('nodeFormContainer');
    document.getElementById('nodeFormTitle').textContent = 'Nuevo Nodo';
    fc.style.display = 'block';
    renderNodeForm('nodeFormInner', null, () => {
      fc.style.display = 'none';
      refreshNodes();
      showToast('Nodo guardado correctamente.');
    });
  });
}

function refreshNodes() {
  renderNodeList('nodeListContainer',
    (node) => {
      const fc = document.getElementById('nodeFormContainer');
      document.getElementById('nodeFormTitle').textContent = 'Editar Nodo';
      fc.style.display = 'block';
      renderNodeForm('nodeFormInner', node, () => {
        fc.style.display = 'none';
        refreshNodes();
        showToast('Nodo actualizado.');
      });
    },
    () => { refreshNodes(); }
  );
}

// ============================================================
// MEDICIÓN
// ============================================================
function initMeasure() {
  document.getElementById('measFase').value = activePhase;
  document.getElementById('btnStartMeasure').addEventListener('click', startMeasurement);
  refreshMeasureSelects();
}

function refreshMeasureSelects() {
  populateNodeSelect('measNodeSelect', 'Selecciona nodo de prueba');
  document.getElementById('measFase').value = activePhase;
}

async function startMeasurement() {
  if (isMeasuring) return;

  const fase     = document.getElementById('measFase').value;
  const nodeId   = document.getElementById('measNodeSelect').value;
  const desc     = document.getElementById('measDesc').value.trim();
  const operador = document.getElementById('measOperador').value.trim();

  const nodes = loadNodes();
  const nodo  = nodes.find(n => n.id === nodeId) || { id: 'default', nombre: 'Nodo Genérico', planMbps: 100 };

  isMeasuring = true;
  const btn   = document.getElementById('btnStartMeasure');
  btn.disabled = true;
  btn.classList.add('btn-running');
  btn.textContent = '⏳ Midiendo...';

  // Crear sesión
  currentSession = createSession({ fase, descripcion: desc || `Medición ${fase}`, operador });

  // Resetear vivos
  ['live-delay', 'live-jitter', 'live-throughput', 'live-loss'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  document.getElementById('measResultCard').classList.add('hidden');

  try {
    const result = await runFullMeasurement(nodo, fase, (step, total, label) => {
      const pct = Math.round((step / total) * 100);
      document.getElementById('measProgressBar').style.width  = `${pct}%`;
      document.getElementById('measProgressLabel').textContent = label;

      // Actualizar parciales si ya hay data
      if (step >= 1) {
        // delay se completa en step 1, jitter en step 2
      }
    });

    // Mostrar resultados en vivo
    document.getElementById('live-delay').textContent      = `${result.delay} ms`;
    document.getElementById('live-jitter').textContent     = `${result.jitter} ms`;
    document.getElementById('live-throughput').textContent = `${result.downloadMbps} Mbps`;
    document.getElementById('live-loss').textContent       = `${result.packetLoss} %`;

    // Guardar
    saveMeasurement(result, currentSession.id);
    updateSession(currentSession.id, { fechaFin: new Date().toISOString(), estado: 'completada' });

    // Mostrar card de resultado
    showMeasurementResult(result);
    document.getElementById('measProgressLabel').textContent = '✅ Medición completada exitosamente.';
    document.getElementById('measProgressBar').style.width   = '100%';

    showToast(`Medición ${fase} guardada correctamente.`);
    activePhase = fase;
    updatePhaseBadge();
    refreshDashboard();

  } catch (err) {
    document.getElementById('measProgressLabel').textContent = '❌ Error durante la medición.';
    showToast('Error en la medición. Revisa tu conexión.');
    console.error(err);
  }

  isMeasuring  = false;
  btn.disabled = false;
  btn.classList.remove('btn-running');
  btn.textContent = '▶ Iniciar Medición Automática';
}

function showMeasurementResult(r) {
  const card = document.getElementById('measResultCard');
  card.classList.remove('hidden');
  document.getElementById('measResultContent').innerHTML = `
    <div class="metrics-grid" style="margin-top:12px">
      <div class="metric-card delay">
        <div class="metric-label">Delay Promedio</div>
        <div><span class="metric-value delay-color">${r.delay}</span><span class="metric-unit">ms</span></div>
        <div class="metric-status">
          <span class="status-dot ${r.qos.delay}"></span>
          <span style="color:${qosColor(r.qos.delay)}">${STATUS_LABELS[r.qos.delay]}</span>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Min: ${r.delayMin} · Max: ${r.delayMax} ms</div>
      </div>
      <div class="metric-card jitter">
        <div class="metric-label">Jitter</div>
        <div><span class="metric-value jitter-color">${r.jitter}</span><span class="metric-unit">ms</span></div>
        <div class="metric-status">
          <span class="status-dot ${r.qos.jitter}"></span>
          <span style="color:${qosColor(r.qos.jitter)}">${STATUS_LABELS[r.qos.jitter]}</span>
        </div>
      </div>
      <div class="metric-card throughput">
        <div class="metric-label">Throughput DL / UL</div>
        <div><span class="metric-value throughput-color">${r.downloadMbps}</span><span class="metric-unit">Mbps ↓</span></div>
        <div style="font-family:var(--font-mono);font-size:0.9rem;color:#6ee7b7">${r.uploadMbps} Mbps ↑</div>
        <div class="metric-status">
          <span class="status-dot ${r.qos.throughput}"></span>
          <span style="color:${qosColor(r.qos.throughput)}">${r.throughputPct}% del plan · ${STATUS_LABELS[r.qos.throughput]}</span>
        </div>
      </div>
      <div class="metric-card loss">
        <div class="metric-label">Packet Loss</div>
        <div><span class="metric-value loss-color">${r.packetLoss}</span><span class="metric-unit">%</span></div>
        <div class="metric-status">
          <span class="status-dot ${r.qos.packetLoss}"></span>
          <span style="color:${qosColor(r.qos.packetLoss)}">${STATUS_LABELS[r.qos.packetLoss]}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;align-items:center">
      <div class="stat-chip">Fase: <strong>${r.fase}</strong></div>
      <div class="stat-chip">Score Global: <strong>${r.globalScore}/4</strong></div>
      <div class="stat-chip">Calidad: <strong style="color:${qosColor(r.globalQuality)}">${STATUS_LABELS[r.globalQuality]}</strong></div>
      <div class="stat-chip">Herramienta: <strong>${r.herramienta}</strong></div>
      <button class="btn btn-secondary btn-sm" onclick="exportSingleCSV('${r.id}')">📥 Exportar CSV</button>
      <button class="btn btn-primary btn-sm" onclick="abrirFichaTecnicaDesdeResultado()">📄 Generar Ficha Técnica</button>
    </div>`;
  card.scrollIntoView({ behavior: 'smooth' });
}

// Acceso global para onclick inline
window.exportSingleCSV = function(id) {
  const all = loadMeasurements();
  const m   = all.find(x => x.id === id);
  if (m) exportMeasurementsCSV([m], `medicion_${m.fase}_${Date.now()}.csv`);
};

// Abrir Ficha Técnica desde botón en historial
window.abrirFichaTecnicaDesdeHistorial = function(id) {
  const all = loadMeasurements();
  const m   = all.find(x => x.id === id);
  if (!m) { showToast('Medición no encontrada.'); return; }
  const nodes = loadNodes();
  const nodo  = nodes.find(n => n.id === m.nodeid);
  abrirFichaTecnica(m, nodo);
};

// Abrir Ficha Técnica desde resultado de medición o topbar
window.abrirFichaTecnicaDesdeResultado = function() {
  let all = loadMeasurements();
  // Si no hay mediciones, cargar demo automáticamente
  if (!all.length) {
    const result = seedDemoData((msg) => {});
    if (result) {
      all = loadMeasurements();
      showToast('✅ Datos demo cargados para generar ficha.');
    }
  }
  const last = all[all.length - 1];
  if (!last) { alert('No hay mediciones. Ejecuta una medición primero.'); return; }
  const nodes = loadNodes();
  const nodo  = nodes.find(n => n.id === last.nodeid);
  abrirFichaTecnica(last, nodo);
};

// ============================================================
// HISTORIAL
// ============================================================
function initHistory() {
  document.getElementById('btnExportHistorial').addEventListener('click', () => {
    const measurements = loadMeasurements();
    if (!measurements.length) { showToast('No hay mediciones para exportar.'); return; }
    exportMeasurementsCSV(measurements, `historial_qos_${Date.now()}.csv`);
    showToast('CSV exportado correctamente.');
  });

  document.getElementById('histFaseFilter').addEventListener('change', refreshHistory);
  document.getElementById('histNodeFilter').addEventListener('change',  refreshHistory);
}

function refreshHistory() {
  let measurements = loadMeasurements();

  // Filtros
  const fase = document.getElementById('histFaseFilter').value;
  const node = document.getElementById('histNodeFilter').value;
  if (fase) measurements = measurements.filter(m => m.fase === fase);
  if (node) measurements = measurements.filter(m => m.nodeid === node);

  // Poblar filtro de nodos
  const nodesSeen = [...new Set(loadMeasurements().map(m => m.nodeid))];
  const nodes     = loadNodes().filter(n => nodesSeen.includes(n.id));
  const nodeSel   = document.getElementById('histNodeFilter');
  const curVal    = nodeSel.value;
  nodeSel.innerHTML = `<option value="">Todos los nodos</option>` +
    nodes.map(n => `<option value="${n.id}" ${n.id === curVal ? 'selected' : ''}>${n.nombre}</option>`).join('');

  // Stats
  renderHistStats(measurements);

  // Tabla
  const table = document.getElementById('histTable');
  if (!measurements.length) {
    table.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No hay mediciones con los filtros seleccionados.</p></div>`;
  } else {
    table.innerHTML = `
      <table>
        <thead><tr>
          <th>#</th><th>Timestamp</th><th>Sesión</th><th>Nodo</th><th>Fase</th>
          <th>Delay</th><th>Jitter</th><th>DL Mbps</th><th>Loss %</th><th>Score</th><th>Calidad</th><th>Acción</th>
        </tr></thead>
        <tbody>
          ${[...measurements].reverse().map((m, i) => `
            <tr>
              <td style="color:var(--text-muted)">${measurements.length - i}</td>
              <td>${formatTs(m.timestamp)}</td>
              <td style="font-size:0.7rem;color:var(--text-muted)">${(m.sessionId || '').slice(0,8)}…</td>
              <td style="color:var(--text-primary)">${m.nodeNombre || '—'}</td>
              <td><span class="badge badge-${m.fase?.toLowerCase()}">${m.fase}</span></td>
              <td>${m.delay} ms</td><td>${m.jitter} ms</td>
              <td>${m.downloadMbps}</td><td>${m.packetLoss}</td>
              <td style="font-family:var(--font-mono)">${m.globalScore}</td>
              <td><span class="badge badge-${m.globalQuality}">${STATUS_LABELS[m.globalQuality] || '—'}</span></td>
              <td><button class="btn btn-secondary btn-sm" style="font-size:0.7rem;padding:3px 8px" onclick="abrirFichaTecnicaDesdeHistorial('${m.id}')">📄 Ficha</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // Gráfico
  if (measurements.length) {
    renderTimelineChart('histTimelineChart', measurements.slice(-30), 'delay');
  }
}

function renderHistStats(measurements) {
  const c = document.getElementById('histStats');
  if (!c) return;
  const pre  = measurements.filter(m => m.fase === 'PRETEST').length;
  const post = measurements.filter(m => m.fase === 'POSTEST').length;
  const avgDelay = measurements.length
    ? (measurements.reduce((a, m) => a + m.delay, 0) / measurements.length).toFixed(2) : '—';

  c.innerHTML = `
    <div class="stat-chip">Total: <strong>${measurements.length}</strong></div>
    <div class="stat-chip">PRETEST: <strong>${pre}</strong></div>
    <div class="stat-chip">POSTEST: <strong>${post}</strong></div>
    <div class="stat-chip">Delay Promedio: <strong>${avgDelay} ms</strong></div>`;
}

// ============================================================
// COMPARATIVA
// ============================================================
function initComparison() {
  document.getElementById('btnRunComparison').addEventListener('click', () => {
    const preId  = document.getElementById('compPreSelect').value;
    const postId = document.getElementById('compPostSelect').value;
    renderComparisonPanel('comparisonPanel', preId, postId);
  });
}

function refreshComparison() {
  renderSessionSelectors('compPreSelect', 'compPostSelect');
}

// ============================================================
// UTILIDADES
// ============================================================
function formatTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 3000);
}
