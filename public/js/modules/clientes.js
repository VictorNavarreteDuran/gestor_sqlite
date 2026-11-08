import {
  formatCurrency,
  escapeHtml,
  showFeedback,
} from '../utils/formatters.js';
import { updateNavDbLabel } from '../components/navbar.js';

const refreshClientsBtn = document.getElementById('refreshClientsBtn');
const clientForm = document.getElementById('clientForm');
const clientFormTitle = document.getElementById('clientFormTitle');
const cliId = document.getElementById('cliId');
const cliNombre = document.getElementById('cliNombre');
const cliRut = document.getElementById('cliRut');
const cliGiro = document.getElementById('cliGiro');
const cliTelefono = document.getElementById('cliTelefono');
const cliEmail = document.getElementById('cliEmail');
const cliDireccion = document.getElementById('cliDireccion');
const cliFeedback = document.getElementById('cliFeedback');
const cliSubmitBtn = document.getElementById('cliSubmitBtn');
const cliCancelEditBtn = document.getElementById('cliCancelEditBtn');
const clientsCountBadge = document.getElementById('clientsCountBadge');
const clientsTableBody = document.getElementById('clientsTableBody');
const clientSearchForm = document.getElementById('clientSearchForm');
const clientSearchInput = document.getElementById('clientSearchInput');
const clientClearSearchBtn = document.getElementById('clientClearSearchBtn');

let cachedClientsList = [];

function resetClientForm() {
  if (cliId) cliId.value = '';
  if (clientForm) clientForm.reset();
  if (clientFormTitle) clientFormTitle.textContent = 'Registrar / Rectificar Cliente';
  if (cliSubmitBtn) cliSubmitBtn.textContent = 'Guardar Cliente en .db';
}

function renderClientsTable(clientes = [], totalClientes = clientes.length, searchQuery = '') {
  cachedClientsList = clientes;

  if (clientsCountBadge) {
    if (searchQuery) {
      clientsCountBadge.textContent = `${clientes.length} de ${totalClientes} encontrado(s)`;
    } else {
      clientsCountBadge.textContent = `Últimos ${clientes.length} (de ${totalClientes})`;
    }
  }

  if (!clientsTableBody) return;

  if (!clientes.length) {
    const emptyMsg = searchQuery
      ? `No se encontraron clientes que coincidan con "${escapeHtml(searchQuery)}".`
      : 'No hay clientes registrados en este archivo .db.';
    clientsTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">${emptyMsg}</td>
      </tr>
    `;
    return;
  }

  clientsTableBody.innerHTML = clientes
    .map(
      (c) => `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(c.nombre)}</div>
            <div class="cell-secondary font-mono">RUT: ${escapeHtml(c.rut_identificacion || 'S/R')} · Giro: ${escapeHtml(c.giro || '—')}</div>
          </td>
          <td>
            <div class="cell-primary">${escapeHtml(c.email || 'Sin email')}</div>
            <div class="cell-secondary">${escapeHtml(c.telefono || 'Sin teléfono')} · ${escapeHtml(c.direccion || 'Sin dirección')}</div>
          </td>
          <td class="text-right font-mono">
            <div>${c.total_compras || 0} doc(s)</div>
            <div class="cell-secondary">${formatCurrency(c.monto_historico || 0)}</div>
          </td>
          <td class="text-right">
            <div style="display: inline-flex; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-xs" data-cli-edit="${c.id_cliente}" title="Editar / Rectificar datos del cliente (Art. 5 Ley 21.719)">✏️ Editar</button>
              <button type="button" class="btn btn-primary btn-xs" data-cli-export="${c.id_cliente}" title="Derecho de Portabilidad y Acceso (Arts. 4 y 9 Ley 21.719)">Portabilidad JSON</button>
              <button type="button" class="btn btn-danger btn-xs" data-cli-delete="${c.id_cliente}" title="Derecho de Supresión (Art. 6 Ley 21.719)">Suprimir</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

export async function loadClientsSection() {
  if (!refreshClientsBtn) return;
  refreshClientsBtn.disabled = true;
  try {
    const searchQuery = clientSearchInput ? clientSearchInput.value.trim() : '';
    const data = await window.LocalSqliteEngine.getClientsAndSuppliersData({
      q: searchQuery,
      limite: 5,
    });
    if (data.database?.originalName) {
      updateNavDbLabel(data.database);
    }
    const lista = data.clientes || [];
    const total = data.totalClientes ?? lista.length;
    renderClientsTable(lista, total, searchQuery);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
  } finally {
    refreshClientsBtn.disabled = false;
  }
}

export function initClientesModule() {
  let clientSearchDebounce = null;

  if (clientSearchInput) {
    clientSearchInput.addEventListener('input', () => {
      clearTimeout(clientSearchDebounce);
      clientSearchDebounce = setTimeout(loadClientsSection, 220);
    });
  }

  if (clientSearchForm) {
    clientSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loadClientsSection();
    });
  }

  if (clientClearSearchBtn) {
    clientClearSearchBtn.addEventListener('click', () => {
      if (clientSearchInput) clientSearchInput.value = '';
      loadClientsSection();
    });
  }

  if (clientForm) {
    clientForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (cliSubmitBtn) cliSubmitBtn.disabled = true;
      if (cliFeedback) cliFeedback.classList.add('hidden');
      try {
        const res = await window.LocalSqliteEngine.saveClientRecord({
          id_cliente: cliId.value || null,
          nombre: cliNombre.value,
          rut_identificacion: cliRut.value,
          giro: cliGiro.value,
          telefono: cliTelefono.value,
          email: cliEmail.value,
          direccion: cliDireccion.value,
        });
        showFeedback(
          cliFeedback,
          'success',
          `Datos del cliente guardados en ${res.savedToFile || 'tu archivo .db local'}.`
        );
        resetClientForm();
        await loadClientsSection();
      } catch (err) {
        showFeedback(cliFeedback, 'error', err.message);
      } finally {
        if (cliSubmitBtn) cliSubmitBtn.disabled = false;
      }
    });
  }

  if (cliCancelEditBtn) {
    cliCancelEditBtn.addEventListener('click', () => {
      resetClientForm();
      if (cliFeedback) cliFeedback.classList.add('hidden');
    });
  }

  if (refreshClientsBtn) {
    refreshClientsBtn.addEventListener('click', loadClientsSection);
  }

  if (clientsTableBody) {
    clientsTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-cli-edit]');
      if (editBtn) {
        const c = cachedClientsList.find((x) => Number(x.id_cliente) === Number(editBtn.dataset.cliEdit));
        if (c) {
          cliId.value = c.id_cliente;
          cliNombre.value = c.nombre || '';
          cliRut.value = c.rut_identificacion || '';
          cliGiro.value = c.giro || '';
          cliTelefono.value = c.telefono || '';
          cliEmail.value = c.email || '';
          cliDireccion.value = c.direccion || '';
          clientFormTitle.textContent = `Editando Cliente #${c.id_cliente}: ${c.nombre}`;
          cliSubmitBtn.textContent = 'Guardar Cambios (Editar)';
          showFeedback(
            cliFeedback,
            'success',
            `Editando a "${c.nombre}". Modifica los campos necesarios y presiona "Guardar Cambios (Editar)".`
          );
          cliNombre.focus();
          clientForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
      }

      const exportBtn = e.target.closest('[data-cli-export]');
      if (exportBtn) {
        try {
          await window.LocalSqliteEngine.exportClientPersonalData(Number(exportBtn.dataset.cliExport));
        } catch (err) {
          showFeedback(cliFeedback, 'error', err.message);
        }
        return;
      }

      const delBtn = e.target.closest('[data-cli-delete]');
      if (delBtn) {
        const id = Number(delBtn.dataset.cliDelete);
        const c = cachedClientsList.find((x) => Number(x.id_cliente) === id);
        if (
          window.confirm(
            `¿Confirmas suprimir los datos personales de "${c ? c.nombre : id}" de tu archivo .db? (Las ventas históricas conservarán sus montos con id_cliente = NULL).`
          )
        ) {
          try {
            await window.LocalSqliteEngine.deleteClientRecord(id);
            await loadClientsSection();
          } catch (err) {
            showFeedback(cliFeedback, 'error', err.message);
          }
        }
      }
    });
  }
}
