/**
 * nodes.js — Gestión de Nodos / Puntos de Prueba
 * Sistema de Monitoreo QoS FTTH-GPON
 */

import { createNode, loadNodes, deleteNode, saveNode } from './storage.js';

// ============================================================
// RENDER LISTA DE NODOS
// ============================================================
export function renderNodeList(containerId, onEdit, onDelete) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const nodes = loadNodes();
  if (!nodes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📡</div>
        <p>No hay nodos registrados.<br>Agrega un punto de prueba para comenzar.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="node-grid">
      ${nodes.map(n => renderNodeCard(n)).join('')}
    </div>`;

  nodes.forEach(n => {
    document.getElementById(`edit-node-${n.id}`)?.addEventListener('click', () => onEdit(n));
    document.getElementById(`del-node-${n.id}`)?.addEventListener('click', () => {
      if (confirm(`¿Eliminar nodo "${n.nombre}"?`)) {
        deleteNode(n.id);
        renderNodeList(containerId, onEdit, onDelete);
        onDelete?.(n.id);
      }
    });
  });
}

function renderNodeCard(n) {
  const tipoColor = {
    ONU: '#00d4ff', OLT: '#7c3aed', Gateway: '#10b981', Host: '#f59e0b',
  }[n.tipo] || '#94a3b8';

  return `
    <div class="node-card fade-in">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="node-name">${n.nombre}</div>
          <div class="node-ip">${n.ipObjetivo || '—'}</div>
        </div>
        <span class="badge" style="background:${tipoColor}22;color:${tipoColor}">${n.tipo || 'Nodo'}</span>
      </div>
      <div class="node-meta">
        ${n.ubicacion ? `📍 ${n.ubicacion}` : ''}
        ${n.oltAsociada ? `<br>🔗 OLT: ${n.oltAsociada}` : ''}
        ${n.puertoGpon ? ` · Puerto: ${n.puertoGpon}` : ''}
        ${n.planMbps ? `<br>📶 Plan: ${n.planMbps} Mbps` : ''}
      </div>
      <div class="node-actions">
        <button class="btn btn-secondary btn-sm" id="edit-node-${n.id}">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" id="del-node-${n.id}">🗑 Eliminar</button>
      </div>
    </div>`;
}

// ============================================================
// FORMULARIO DE NODO
// ============================================================
export function renderNodeForm(formId, nodeData = null, onSave) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>Nombre del Nodo *</label>
        <input id="nf-nombre" type="text" placeholder="Ej. ONT-Sector-A" value="${nodeData?.nombre || ''}" required>
      </div>
      <div class="form-group">
        <label>Tipo de Nodo</label>
        <select id="nf-tipo">
          <option value="ONU" ${nodeData?.tipo==='ONU'?'selected':''}>ONU / ONT</option>
          <option value="OLT" ${nodeData?.tipo==='OLT'?'selected':''}>OLT</option>
          <option value="Gateway" ${nodeData?.tipo==='Gateway'?'selected':''}>Gateway / Router</option>
          <option value="Host" ${nodeData?.tipo==='Host'?'selected':''}>Host de prueba</option>
        </select>
      </div>
      <div class="form-group">
        <label>IP / Host Objetivo</label>
        <input id="nf-ip" type="text" placeholder="Ej. 192.168.1.1 o google.com" value="${nodeData?.ipObjetivo || ''}">
      </div>
      <div class="form-group">
        <label>Plan Contratado (Mbps)</label>
        <input id="nf-plan" type="number" min="1" placeholder="Ej. 100" value="${nodeData?.planMbps || ''}">
      </div>
      <div class="form-group">
        <label>Ubicación</label>
        <input id="nf-ubicacion" type="text" placeholder="Ej. Av. Lima 123, Ate" value="${nodeData?.ubicacion || ''}">
      </div>
      <div class="form-group">
        <label>OLT Asociada</label>
        <input id="nf-olt" type="text" placeholder="Ej. LIM_UCAM_OLT_1" value="${nodeData?.oltAsociada || ''}">
      </div>
      <div class="form-group">
        <label>Puerto GPON</label>
        <input id="nf-puerto" type="text" placeholder="Ej. 0/1/3" value="${nodeData?.puertoGpon || ''}">
      </div>
      <div class="form-group">
        <label>ONT ID</label>
        <input id="nf-ontid" type="text" placeholder="Ej. 15" value="${nodeData?.ontId || ''}">
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button type="button" class="btn btn-primary" id="nf-save">💾 Guardar Nodo</button>
      <button type="button" class="btn btn-secondary" id="nf-cancel">Cancelar</button>
    </div>`;

  document.getElementById('nf-save').addEventListener('click', () => {
    const nombre = document.getElementById('nf-nombre').value.trim();
    if (!nombre) { alert('El nombre del nodo es obligatorio.'); return; }

    const data = {
      ...(nodeData || {}),
      nombre,
      tipo:        document.getElementById('nf-tipo').value,
      ipObjetivo:  document.getElementById('nf-ip').value.trim(),
      planMbps:    parseFloat(document.getElementById('nf-plan').value) || 100,
      ubicacion:   document.getElementById('nf-ubicacion').value.trim(),
      oltAsociada: document.getElementById('nf-olt').value.trim(),
      puertoGpon:  document.getElementById('nf-puerto').value.trim(),
      ontId:       document.getElementById('nf-ontid').value.trim(),
    };

    if (nodeData?.id) {
      saveNode({ ...nodeData, ...data });
    } else {
      createNode(data);
    }
    onSave?.();
  });

  document.getElementById('nf-cancel').addEventListener('click', () => {
    form.innerHTML = '';
    onSave?.();
  });
}

// ============================================================
// POPULATE SELECT DE NODOS
// ============================================================
export function populateNodeSelect(selectId, placeholder = 'Seleccione un nodo') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const nodes = loadNodes();
  sel.innerHTML = `<option value="">-- ${placeholder} --</option>` +
    nodes.map(n => `<option value="${n.id}">${n.nombre} (${n.tipo || 'Nodo'})</option>`).join('');
}
