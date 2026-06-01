/**
 * reliability.js — Confiabilidad y Validación del Instrumento
 * Reemplaza Alfa de Cronbach por métodos técnicos cuantitativos:
 *   - Coeficiente de Variación (CV%) → repetibilidad
 *   - Correlación de Pearson        → test-retest
 *   - t-Student pareado             → significancia pretest-postest
 *   - Validación por criterio       → umbrales ITU-T G.114/Y.1541
 */

import { loadMeasurements, loadSessions, computeStats } from './storage.js';

// ============================================================
// CÁLCULOS ESTADÍSTICOS
// ============================================================
function pearsonR(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  const mx = x.slice(0,n).reduce((a,b)=>a+b,0)/n;
  const my = y.slice(0,n).reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++){
    num  += (x[i]-mx)*(y[i]-my);
    dx2  += (x[i]-mx)**2;
    dy2  += (y[i]-my)**2;
  }
  const denom = Math.sqrt(dx2*dy2);
  return denom===0 ? null : parseFloat((num/denom).toFixed(4));
}

function tStudentPaired(pre, post) {
  const n = Math.min(pre.length, post.length);
  if (n < 2) return null;
  const diffs = pre.slice(0,n).map((v,i) => v - post[i]);
  const dMean = diffs.reduce((a,b)=>a+b,0)/n;
  const dStd  = Math.sqrt(diffs.map(d=>(d-dMean)**2).reduce((a,b)=>a+b,0)/(n-1));
  const t     = dMean / (dStd / Math.sqrt(n));
  return { t: parseFloat(t.toFixed(4)), n, dMean: parseFloat(dMean.toFixed(4)), dStd: parseFloat(dStd.toFixed(4)) };
}

function cv(values) {
  if (!values || values.length < 2) return null;
  const avg = values.reduce((a,b)=>a+b,0)/values.length;
  const std = Math.sqrt(values.map(v=>(v-avg)**2).reduce((a,b)=>a+b,0)/values.length);
  return avg===0 ? null : parseFloat(((std/avg)*100).toFixed(2));
}

function classifyCV(cvVal) {
  if (cvVal === null) return { label:'Sin datos', cls:'idle' };
  if (cvVal <= 5)  return { label:`CV ${cvVal}% — Excelente repetibilidad`, cls:'excellent' };
  if (cvVal <= 10) return { label:`CV ${cvVal}% — Aceptable`, cls:'acceptable' };
  if (cvVal <= 20) return { label:`CV ${cvVal}% — Moderada`, cls:'degraded' };
  return               { label:`CV ${cvVal}% — Alta variabilidad`, cls:'critical' };
}

function classifyR(r) {
  if (r === null) return { label:'Sin datos suficientes', cls:'idle' };
  const a = Math.abs(r);
  if (a >= 0.90) return { label:`r = ${r} — Muy alta correlación`, cls:'excellent' };
  if (a >= 0.70) return { label:`r = ${r} — Alta correlación`, cls:'acceptable' };
  if (a >= 0.50) return { label:`r = ${r} — Moderada`, cls:'degraded' };
  return               { label:`r = ${r} — Baja correlación`, cls:'critical' };
}

// Validación por criterio externo ITU-T
const ITU = {
  delay:      { threshold: 150, unit:'ms', label:'Delay', direction:'lower' },
  jitter:     { threshold: 30,  unit:'ms', label:'Jitter', direction:'lower' },
  packetLoss: { threshold: 1,   unit:'%',  label:'Packet Loss', direction:'lower' },
  throughputPct: { threshold: 60, unit:'%', label:'Throughput', direction:'higher' },
};

// ============================================================
// RENDERIZADO PRINCIPAL
// ============================================================
export function renderReliabilityPanel(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const allMeas    = loadMeasurements();
  const preMeas    = allMeas.filter(m => m.fase === 'PRETEST');
  const postMeas   = allMeas.filter(m => m.fase === 'POSTEST');

  if (allMeas.length < 4) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🔬</div>
      <p>Se necesitan al menos 4 mediciones (PRETEST + POSTEST) para calcular confiabilidad.</p></div>`;
    return;
  }

  const metrics = ['delay','jitter','packetLoss','downloadMbps'];
  const metricLabels = { delay:'Delay (ms)', jitter:'Jitter (ms)', packetLoss:'Packet Loss (%)', downloadMbps:'Throughput DL (Mbps)' };

  // CV por métrica en cada fase
  const cvPre  = {};
  const cvPost = {};
  metrics.forEach(m => {
    cvPre[m]  = cv(preMeas.map(x=>x[m]));
    cvPost[m] = cv(postMeas.map(x=>x[m]));
  });

  // Correlación de Pearson (test-retest dentro del mismo tipo)
  const rPre  = pearsonR(preMeas.slice(0,-1).map(m=>m.delay), preMeas.slice(1).map(m=>m.delay));
  const rPost = pearsonR(postMeas.slice(0,-1).map(m=>m.delay), postMeas.slice(1).map(m=>m.delay));

  // t-Student pareado (delay PRE vs POST)
  const minN = Math.min(preMeas.length, postMeas.length);
  const tResult = tStudentPaired(
    preMeas.slice(0,minN).map(m=>m.delay),
    postMeas.slice(0,minN).map(m=>m.delay)
  );

  // Validación ITU-T: % de mediciones dentro del umbral
  function pctWithinThreshold(meas, metric) {
    if (!meas.length) return null;
    const { threshold, direction } = ITU[metric] || {};
    if (!threshold) return null;
    const ok = meas.filter(m => direction==='lower' ? m[metric]<=threshold : m[metric]>=threshold).length;
    return parseFloat(((ok/meas.length)*100).toFixed(1));
  }

  container.innerHTML = `
    <div class="section-header" style="margin-bottom:20px">
      <div>
        <h2>Validación y Confiabilidad del Instrumento</h2>
        <p class="section-subtitle">Métodos estadísticos cuantitativos · Reemplaza Alfa de Cronbach</p>
      </div>
    </div>

    <!-- FUNDAMENTO TEÓRICO -->
    <div class="card reliability-theory" style="margin-bottom:20px;border-left:3px solid var(--accent-cyan)">
      <div class="card-title">📚 Marco Metodológico</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:12px">
        <div class="theory-item">
          <div class="theory-title">Confiabilidad (Repetibilidad)</div>
          <div class="theory-desc">Coeficiente de Variación (CV%) mide la dispersión relativa de mediciones repetidas bajo las mismas condiciones. CV &lt; 5% = excelente.</div>
          <div class="theory-ref">Ref: ISO 5725-2 · Accuracy of measurement methods</div>
        </div>
        <div class="theory-item">
          <div class="theory-title">Consistencia (Test-Retest)</div>
          <div class="theory-desc">Correlación de Pearson (r) entre mediciones consecutivas del mismo nodo. r &gt; 0.90 indica alta consistencia temporal del instrumento.</div>
          <div class="theory-ref">Ref: Campbell & Stanley (1963) · Experimental Designs</div>
        </div>
        <div class="theory-item">
          <div class="theory-title">Validez por Criterio Externo</div>
          <div class="theory-desc">% de mediciones que cumplen umbrales ITU-T G.114/Y.1541. Sustituye validez de constructo. Patrón de referencia internacional.</div>
          <div class="theory-ref">Ref: ITU-T G.114, Y.1541 · RFC 4594</div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 1: COEFICIENTE DE VARIACIÓN -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">1. Coeficiente de Variación (CV%) — Repetibilidad del Instrumento</div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:8px 0 16px">Medida de dispersión relativa. CV bajo = instrumento consistente. <strong>Reemplaza el Alfa de Cronbach para instrumentos técnicos.</strong></p>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Métrica</th><th>CV% PRETEST</th><th>Interpretación PRE</th><th>CV% POSTEST</th><th>Interpretación POST</th></tr></thead>
          <tbody>
            ${metrics.map(m => {
              const pre  = classifyCV(cvPre[m]);
              const post = classifyCV(cvPost[m]);
              return `<tr>
                <td style="color:var(--text-primary);font-weight:600">${metricLabels[m]}</td>
                <td style="font-family:var(--font-mono)">${cvPre[m] !== null ? cvPre[m]+'%' : '—'}</td>
                <td><span class="badge badge-${pre.cls}">${pre.label}</span></td>
                <td style="font-family:var(--font-mono)">${cvPost[m] !== null ? cvPost[m]+'%' : '—'}</td>
                <td><span class="badge badge-${post.cls}">${post.label}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="insight-box" style="margin-top:12px">
        💡 <strong>Criterio de aceptación:</strong> CV% ≤ 10% indica que el instrumento de medición (Ficha Técnica Automatizada) produce resultados <strong>confiables y repetibles</strong> bajo las mismas condiciones de red.
      </div>
    </div>

    <!-- SECCIÓN 2: CORRELACIÓN DE PEARSON (TEST-RETEST) -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">2. Correlación de Pearson (r) — Consistencia Temporal (Test-Retest)</div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:8px 0 16px">Mide si mediciones consecutivas del mismo tipo producen valores consistentes. Confirma estabilidad temporal del instrumento.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${[
          { label:'PRETEST — Correlación entre sesiones', r: rPre,  n: preMeas.length },
          { label:'POSTEST — Correlación entre sesiones', r: rPost, n: postMeas.length },
        ].map(({label, r, n}) => {
          const cls = classifyR(r);
          return `<div class="reliability-card">
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px">${label}</div>
            <div style="font-family:var(--font-mono);font-size:2rem;color:var(--accent-cyan)">${r !== null ? r : '—'}</div>
            <div class="metric-status"><span class="status-dot ${cls.cls}"></span><span style="font-size:0.8rem">${cls.label}</span></div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">n = ${n} mediciones | Variable: Delay (ms)</div>
          </div>`;
        }).join('')}
      </div>
      <div class="insight-box" style="margin-top:12px">
        💡 <strong>Criterio:</strong> r ≥ 0.90 = alta confiabilidad test-retest. Si r ≥ 0.70, el instrumento es <strong>adecuado para investigación</strong> (Hernández Sampieri, 2014).
      </div>
    </div>

    <!-- SECCIÓN 3: t-STUDENT PAREADO -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">3. Prueba t-Student Pareada — Significancia Estadística del Cambio</div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:8px 0 16px">Confirma si la diferencia entre PRETEST y POSTEST es estadísticamente significativa (α = 0.05). Prueba la hipótesis de investigación.</p>
      ${tResult ? `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px">
        <div class="reliability-card text-center">
          <div style="font-size:0.7rem;color:var(--text-muted)">Estadístico t</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;color:var(--accent-cyan)">${tResult.t}</div>
        </div>
        <div class="reliability-card text-center">
          <div style="font-size:0.7rem;color:var(--text-muted)">N pares</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;color:#a855f7">${tResult.n}</div>
        </div>
        <div class="reliability-card text-center">
          <div style="font-size:0.7rem;color:var(--text-muted)">Diferencia media (Δ)</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;color:var(--accent-green)">${tResult.dMean} ms</div>
        </div>
        <div class="reliability-card text-center">
          <div style="font-size:0.7rem;color:var(--text-muted)">Desv. estándar dif.</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;color:var(--accent-yellow)">${tResult.dStd}</div>
        </div>
      </div>
      <div class="insight-box ${Math.abs(tResult.t) > 2.0 ? 'insight-success' : 'insight-warning'}">
        ${Math.abs(tResult.t) > 2.0
          ? `✅ <strong>|t| = ${Math.abs(tResult.t)} > valor crítico (~2.0, α=0.05)</strong> → La diferencia PRETEST–POSTEST es <strong>estadísticamente significativa</strong>. Se rechaza H₀. La implementación FTTH-GPON produjo un cambio real en la calidad de servicio.`
          : `⚠️ <strong>|t| = ${Math.abs(tResult.t)}</strong> → La diferencia no alcanza significancia estadística con los datos actuales. Se recomienda aumentar el número de mediciones.`}
      </div>` : '<p style="color:var(--text-muted)">Se requieren mediciones pareadas para calcular t-Student.</p>'}
    </div>

    <!-- SECCIÓN 4: VALIDACIÓN ITU-T -->
    <div class="card">
      <div class="card-title">4. Validación por Criterio Externo — Cumplimiento ITU-T G.114 / Y.1541</div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:8px 0 16px">% de mediciones dentro del umbral aceptable según estándar internacional. Valida que el instrumento mide lo que debe medir.</p>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Métrica</th><th>Umbral ITU-T</th><th>% PRETEST OK</th><th>% POSTEST OK</th><th>Mejora</th></tr></thead>
          <tbody>
            ${Object.entries(ITU).map(([key, cfg]) => {
              const pPre  = pctWithinThreshold(preMeas, key);
              const pPost = pctWithinThreshold(postMeas, key);
              const delta = pPre !== null && pPost !== null ? (pPost - pPre).toFixed(1) : null;
              const cls   = pPost >= 80 ? 'excellent' : pPost >= 60 ? 'acceptable' : 'degraded';
              return `<tr>
                <td style="color:var(--text-primary);font-weight:600">${cfg.label}</td>
                <td style="font-family:var(--font-mono)">${cfg.direction==='lower'?'&lt;':'&gt;'} ${cfg.threshold} ${cfg.unit}</td>
                <td><span class="badge badge-${pPre>=80?'excellent':pPre>=60?'acceptable':'critical'}">${pPre !== null ? pPre+'%' : '—'}</span></td>
                <td><span class="badge badge-${cls}">${pPost !== null ? pPost+'%' : '—'}</span></td>
                <td style="color:${delta>=0?'#10b981':'#ef4444'};font-family:var(--font-mono)">${delta !== null ? (delta>=0?'+':'')+delta+'pp' : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="insight-box" style="margin-top:12px">
        💡 <strong>Validez de criterio externo:</strong> Sustituye a la "validez de constructo" de SERVQUAL. Un instrumento técnico es válido cuando sus mediciones concuerdan con estándares internacionales reconocidos (ITU-T, ISO, RFC).
      </div>
    </div>`;
}
