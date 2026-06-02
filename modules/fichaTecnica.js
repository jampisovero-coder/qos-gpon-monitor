/**
 * fichaTecnica.js — Generador de Ficha Técnica imprimible
 * Sistema de Monitoreo QoS FTTH-GPON
 * Instrumento de recolección de datos para tesis de investigación
 */

import { STATUS_LABELS } from './monitor.js';

export function generarFichaHTML(medicion, nodo) {
  const fase = medicion.fase === 'PRETEST' ? 'DIAGNÓSTICO' : 'PROYECCIÓN GPON';
  const ts = new Date(medicion.timestamp);
  const fecha = ts.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora = ts.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const qosClases = { excellent: 'excelente', acceptable: 'aceptable', degraded: 'degradado', critical: 'critico' };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha Técnica — ${fase}</title>
  <style>
    @page { margin: 2.5cm 3cm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 0;
    }
    .ficha {
      max-width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .header h2 {
      font-size: 12pt;
      font-weight: 400;
      font-style: italic;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 11pt;
      color: #333;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 30px;
      margin-bottom: 24px;
      padding: 16px;
      border: 1px solid #000;
      background: #f8f8f8;
    }
    .meta-item {
      font-size: 11pt;
    }
    .meta-item strong {
      font-weight: 600;
    }
    .title-section {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 16px;
      padding: 6px;
      border: 1px solid #000;
      background: #eaeaea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px 12px;
      text-align: left;
      font-size: 11pt;
    }
    th {
      background: #eaeaea;
      font-weight: 700;
      text-align: center;
    }
    td { vertical-align: middle; }
    td.center { text-align: center; }
    .clasificacion {
      display: inline-block;
      padding: 2px 12px;
      font-weight: 700;
      font-size: 10pt;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .clasificacion.excelente { background: #d4edda; color: #155724; border: 1px solid #155724; }
    .clasificacion.aceptable  { background: #fff3cd; color: #856404; border: 1px solid #856404; }
    .clasificacion.degradado  { background: #ffe8cc; color: #8a4b0a; border: 1px solid #8a4b0a; }
    .clasificacion.critico    { background: #f8d7da; color: #721c24; border: 1px solid #721c24; }
    .score-box {
      text-align: center;
      padding: 12px;
      border: 2px solid #000;
      margin-bottom: 24px;
      background: #f8f8f8;
    }
    .score-box .score-value {
      font-size: 24pt;
      font-weight: 700;
    }
    .score-box .score-label {
      font-size: 11pt;
      margin-top: 4px;
    }
    .observaciones {
      border: 1px solid #000;
      padding: 12px;
      min-height: 60px;
      margin-bottom: 24px;
      font-size: 11pt;
    }
    .footer {
      text-align: center;
      font-size: 10pt;
      color: #555;
      border-top: 1px solid #000;
      padding-top: 12px;
      margin-top: 30px;
    }
    .no-print { display: none; }
    @media print {
      .no-print { display: none !important; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="ficha">
    <div class="header">
      <h1>Ficha de Registro de Datos Técnicos</h1>
      <h2>Instrumento de Recolección de Datos — Observación Técnica Automatizada</h2>
      <p>Tesis: Evaluación de una red FTTH-GPON para mejorar la QoS en Santa Anita</p>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><strong>Fase:</strong> ${fase}</div>
      <div class="meta-item"><strong>Fecha:</strong> ${fecha}</div>
      <div class="meta-item"><strong>Nodo:</strong> ${nodo?.nombre || medicion.nodeNombre || '—'}</div>
      <div class="meta-item"><strong>Hora:</strong> ${hora}</div>
      <div class="meta-item"><strong>ID Medición:</strong> ${medicion.id.slice(0, 12)}…</div>
      <div class="meta-item"><strong>Plan Contratado:</strong> ${nodo?.planMbps || 100} Mbps</div>
      <div class="meta-item"><strong>Herramienta:</strong> qos-gpon-monitor v2.0</div>
      <div class="meta-item"><strong>Protocolo:</strong> ${medicion.protocolo || 'HTTP/HTTPS'}</div>
    </div>

    <div class="title-section">Resultados de Indicadores QoS</div>

    <table>
      <thead>
        <tr>
          <th style="width:20%">Indicador</th>
          <th style="width:18%">Valor Medido</th>
          <th style="width:18%">Rango (Min–Max)</th>
          <th style="width:22%">Clasificación</th>
          <th style="width:22%">Umbral ITU-T</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Delay</strong></td>
          <td class="center">${medicion.delay} ms</td>
          <td class="center">${medicion.delayMin} – ${medicion.delayMax} ms</td>
          <td class="center"><span class="clasificacion ${qosClases[medicion.qos?.delay]}">${STATUS_LABELS[medicion.qos?.delay]}</span></td>
          <td class="center">&lt; 10 ms Excelente<br>&lt; 150 ms Aceptable</td>
        </tr>
        <tr>
          <td><strong>Jitter</strong></td>
          <td class="center">${medicion.jitter} ms</td>
          <td class="center">—</td>
          <td class="center"><span class="clasificacion ${qosClases[medicion.qos?.jitter]}">${STATUS_LABELS[medicion.qos?.jitter]}</span></td>
          <td class="center">&lt; 1 ms Excelente<br>&lt; 30 ms Aceptable</td>
        </tr>
        <tr>
          <td><strong>Throughput</strong></td>
          <td class="center">${medicion.downloadMbps} Mbps</td>
          <td class="center">${medicion.throughputPct}% del plan</td>
          <td class="center"><span class="clasificacion ${qosClases[medicion.qos?.throughput]}">${STATUS_LABELS[medicion.qos?.throughput]}</span></td>
          <td class="center">&gt; 80% Excelente<br>&gt; 60% Aceptable</td>
        </tr>
        <tr>
          <td><strong>Packet Loss</strong></td>
          <td class="center">${medicion.packetLoss}%</td>
          <td class="center">—</td>
          <td class="center"><span class="clasificacion ${qosClases[medicion.qos?.packetLoss]}">${STATUS_LABELS[medicion.qos?.packetLoss]}</span></td>
          <td class="center">&lt; 0.1% Excelente<br>&lt; 1% Aceptable</td>
        </tr>
      </tbody>
    </table>

    <div class="score-box">
      <div class="score-value">${medicion.globalScore}/4.0</div>
      <div class="score-label">
        Calidad Global:
        <span class="clasificacion ${qosClases[medicion.globalQuality]}">${STATUS_LABELS[medicion.globalQuality]}</span>
      </div>
    </div>

    <div class="title-section">Observaciones</div>
    <div class="observaciones">
      ${medicion.descripcion || 'Medición realizada según metodología RFC 2544.'}
    </div>

    <div class="title-section">Referencias Técnicas</div>
    <table>
      <thead>
        <tr>
          <th>Estándar</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>ITU-T G.984</td><td>Redes ópticas pasivas GPON (2.5 Gbps / 1.25 Gbps)</td></tr>
        <tr><td>ITU-T Y.1541</td><td>Objetivos de calidad de servicio para redes IP</td></tr>
        <tr><td>RFC 2544</td><td>Metodología de benchmarking de dispositivos de red</td></tr>
        <tr><td>RFC 3550</td><td>Cálculo de jitter para flujos RTP</td></tr>
      </tbody>
    </table>

    <div class="footer">
      <p>qos-gpon-monitor v2.0 — Herramienta de monitoreo autorizada para fines de investigación académica</p>
      <p>Universidad — Ingeniería de Sistemas · Tesis FTTH-GPON</p>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px;font-family:sans-serif;">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#1a73e8;color:#fff;border:none;border-radius:4px;">🖨 Imprimir / Guardar PDF</button>
    <button onclick="window.close()" style="padding:10px 30px;font-size:14px;cursor:pointer;background:#ddd;color:#000;border:none;border-radius:4px;margin-left:10px;">✕ Cerrar</button>
  </div>
</body>
</html>`;
}


export function abrirFichaTecnica(medicion, nodo) {
  const html = generarFichaHTML(medicion, nodo);
  const ventana = window.open('', '_blank', 'width=800,height=700,scrollbars=yes');
  if (!ventana) {
    alert('Permite ventanas emergentes para ver la Ficha Técnica.');
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
}
