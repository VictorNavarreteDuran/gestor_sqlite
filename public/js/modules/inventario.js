import { formatCurrency, formatNumber, escapeHtml } from '../utils/formatters.js';
import { updateNavDbLabel } from '../components/navbar.js';
import {
  getInventorySectionData,
  searchInventoryProducts,
} from '../db/repositories/inventory.repo.js';

const refreshInventoryBtn = document.getElementById('refreshInventoryBtn');
const invUrgentLimit = document.getElementById('invUrgentLimit');
const invUrgentBadge = document.getElementById('invUrgentBadge');
const invUrgentTableBody = document.getElementById('invUrgentTableBody');

const invSlowLimit = document.getElementById('invSlowLimit');
const invSlowBadge = document.getElementById('invSlowBadge');
const invSlowTableBody = document.getElementById('invSlowTableBody');

const invTopLimit = document.getElementById('invTopLimit');
const invTopBadge = document.getElementById('invTopBadge');
const invTopTableBody = document.getElementById('invTopTableBody');

const invSearchForm = document.getElementById('invSearchForm');
const invSearchInput = document.getElementById('invSearchInput');
const invCategoryFilter = document.getElementById('invCategoryFilter');
const invUnitFilter = document.getElementById('invUnitFilter');
const invStatusFilter = document.getElementById('invStatusFilter');
const invLimitFilter = document.getElementById('invLimitFilter');
const invResetBtn = document.getElementById('invResetBtn');
const invSearchCountBadge = document.getElementById('invSearchCountBadge');
const invSearchResultsBody = document.getElementById('invSearchResultsBody');

const DEFAULT_INVENTORY_PARAMS = {
  q: '',
  id_categoria: '',
  unidad_medida: '',
  activo: '1',
  limite: '50',
  limiteUrgente: '20',
  limiteBajaRotacion: '10',
  limiteTop: '10',
};

function renderInvUrgentStock(products = []) {
  if (invUrgentBadge) invUrgentBadge.textContent = `${products.length} urgente(s)`;
  if (!invUrgentTableBody) return;

  if (!products.length) {
    invUrgentTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">No hay productos con stock de urgencia según los parámetros actuales.</td>
      </tr>
    `;
    return;
  }

  invUrgentTableBody.innerHTML = products
    .map((p) => {
      const stockActual = Number(p.stock_actual) || 0;
      const deficit = Number(p.deficit_stock) || 0;
      const urgenciaBadge =
        stockActual <= 0
          ? '<span class="status-tag danger">AGOTADO</span>'
          : '<span class="status-tag warning">URGENTE</span>';

      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">SKU: ${escapeHtml(p.sku || 'S/N')} · Cód: ${escapeHtml(p.codigo_barras || 'S/N')}</div>
          </td>
          <td>${escapeHtml(p.categoria)}</td>
          <td class="text-right font-mono">${formatNumber(p.stock_actual)} ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono">${formatNumber(p.stock_minimo)} ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono">${deficit > 0 ? formatNumber(deficit) : '0'} ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono">${formatCurrency(p.costo_reposicion_estimado)}</td>
          <td>${urgenciaBadge}</td>
        </tr>
      `;
    })
    .join('');
}

function renderInvSlowMoving(products = []) {
  if (invSlowBadge) invSlowBadge.textContent = `${products.length} artículo(s)`;
  if (!invSlowTableBody) return;

  if (!products.length) {
    invSlowTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No hay artículos de baja rotación para mostrar.</td>
      </tr>
    `;
    return;
  }

  invSlowTableBody.innerHTML = products
    .map((p) => {
      const fechaIngreso = p.fecha_ingreso_stock || 'Sin registro';
      const refIngreso = p.referencia_ingreso
        ? `${p.referencia_ingreso} (+${formatNumber(p.cantidad_ultimo_ingreso)} ${p.unidad_medida})`
        : 'Stock inicial / Base';

      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">SKU: ${escapeHtml(p.sku || 'S/N')} · Inmovilizado: ${formatCurrency(p.valor_stock_inmovilizado)}</div>
          </td>
          <td>${escapeHtml(p.categoria)}</td>
          <td class="text-right font-mono">${formatNumber(p.total_vendido)} ${escapeHtml(p.unidad_medida)} (${p.num_ventas} vta.)</td>
          <td class="text-right font-mono">${formatNumber(p.stock_actual)} ${escapeHtml(p.unidad_medida)}</td>
          <td class="font-mono">${escapeHtml(fechaIngreso)}</td>
          <td class="cell-secondary">${escapeHtml(refIngreso)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderInvTopSelling(products = []) {
  if (invTopBadge) invTopBadge.textContent = `${products.length} producto(s)`;
  if (!invTopTableBody) return;

  if (!products.length) {
    invTopTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No se encontraron ventas completadas para calcular los productos más vendidos.</td>
      </tr>
    `;
    return;
  }

  invTopTableBody.innerHTML = products
    .map((p, idx) => {
      const bajoMinimo = Number(p.stock_actual) <= Number(p.stock_minimo);
      return `
        <tr>
          <td><span class="rank-badge">${idx + 1}</span></td>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">SKU: ${escapeHtml(p.sku || 'S/N')} · ${escapeHtml(p.categoria)} · ${p.num_ventas} venta(s)</div>
          </td>
          <td class="text-right font-mono">${formatNumber(p.total_vendido)} ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(p.ingresos_generados)}</td>
          <td class="text-right font-mono">${formatCurrency(p.utilidad_historica)}</td>
          <td class="text-right font-mono">
            ${formatNumber(p.stock_actual)} ${escapeHtml(p.unidad_medida)}
            ${bajoMinimo ? '<span class="status-tag warning" title="Stock en o bajo el mínimo">!</span>' : ''}
          </td>
        </tr>
      `;
    })
    .join('');
}

function populateCategoryOptions(categories = []) {
  if (!invCategoryFilter) return;
  const currentVal = invCategoryFilter.value;
  invCategoryFilter.innerHTML =
    '<option value="">Todas las categorías (Predet.)</option>' +
    categories
      .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`)
      .join('');
  invCategoryFilter.value = currentVal;
}

function renderInvSearchResults(searchResult = { total: 0, items: [] }) {
  const items = searchResult.items || [];
  const total = searchResult.total ?? items.length;
  if (invSearchCountBadge) invSearchCountBadge.textContent = `${items.length} de ${total} encontrado(s)`;
  if (!invSearchResultsBody) return;

  if (!items.length) {
    invSearchResultsBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-cell">No se encontraron productos que coincidan con los parámetros de búsqueda.</td>
      </tr>
    `;
    return;
  }

  invSearchResultsBody.innerHTML = items
    .map((p) => {
      const exentoTag =
        Number(p.exento_iva) === 1
          ? '<span class="status-tag warning">Exento (1)</span>'
          : '<span class="status-tag info">Afecto (0)</span>';

      const stockActual = Number(p.stock_actual) || 0;
      const stockMinimo = Number(p.stock_minimo) || 0;
      let estadoHtml = '';

      if (Number(p.activo) === 0) {
        estadoHtml = '<span class="status-tag danger">Inactivo (0)</span>';
      } else if (stockActual <= 0) {
        estadoHtml = '<span class="status-tag danger">Sin Stock</span>';
      } else if (stockActual <= stockMinimo) {
        estadoHtml = '<span class="status-tag warning">Stock Urgente</span>';
      } else {
        estadoHtml = '<span class="status-tag success">Activo (1)</span>';
      }

      return `
        <tr>
          <td>
            <div class="cell-primary font-mono">${escapeHtml(p.sku || `ID #${p.id_producto}`)}</div>
            <div class="cell-secondary font-mono">Cód: ${escapeHtml(p.codigo_barras || '—')}</div>
          </td>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">${escapeHtml(p.descripcion || 'Sin descripción')}</div>
          </td>
          <td>${escapeHtml(p.categoria)}</td>
          <td class="font-mono">${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono">${formatCurrency(p.costo_promedio)}</td>
          <td class="text-right font-mono">${formatCurrency(p.precio_neto)}</td>
          <td>${exentoTag}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(p.precio_venta_final)}</td>
          <td class="text-right font-mono">${formatNumber(p.stock_actual)}</td>
          <td class="text-right font-mono">${formatNumber(p.stock_minimo)}</td>
          <td>${estadoHtml}</td>
        </tr>
      `;
    })
    .join('');
}

export async function loadInventorySection() {
  if (refreshInventoryBtn) {
    refreshInventoryBtn.disabled = true;
    refreshInventoryBtn.textContent = 'Actualizando...';
  }

  try {
    const data = await getInventorySectionData({
      q: invSearchInput?.value.trim() || DEFAULT_INVENTORY_PARAMS.q,
      id_categoria: invCategoryFilter?.value || DEFAULT_INVENTORY_PARAMS.id_categoria,
      unidad_medida: invUnitFilter?.value || DEFAULT_INVENTORY_PARAMS.unidad_medida,
      activo: invStatusFilter?.value || DEFAULT_INVENTORY_PARAMS.activo,
      limite: invLimitFilter?.value || DEFAULT_INVENTORY_PARAMS.limite,
      limiteUrgente: invUrgentLimit?.value || DEFAULT_INVENTORY_PARAMS.limiteUrgente,
      limiteBajaRotacion: invSlowLimit?.value || DEFAULT_INVENTORY_PARAMS.limiteBajaRotacion,
      limiteTop: invTopLimit?.value || DEFAULT_INVENTORY_PARAMS.limiteTop,
    });

    if (data.database?.originalName) {
      updateNavDbLabel(data.database);
    }

    populateCategoryOptions(data.categories || []);
    renderInvUrgentStock(data.urgentStock || []);
    renderInvSlowMoving(data.slowMoving || []);
    renderInvTopSelling(data.topSelling || []);
    renderInvSearchResults(data.searchResult || { total: 0, items: [] });
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    if (invSearchResultsBody) {
      invSearchResultsBody.innerHTML = `
        <tr>
          <td colspan="11" class="empty-cell">${escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  } finally {
    if (refreshInventoryBtn) {
      refreshInventoryBtn.disabled = false;
      refreshInventoryBtn.textContent = 'Actualizar inventario';
    }
  }
}

async function executeProductSearch() {
  try {
    const result = await searchInventoryProducts({
      q: invSearchInput?.value.trim() || DEFAULT_INVENTORY_PARAMS.q,
      id_categoria: invCategoryFilter?.value || DEFAULT_INVENTORY_PARAMS.id_categoria,
      unidad_medida: invUnitFilter?.value || DEFAULT_INVENTORY_PARAMS.unidad_medida,
      activo: invStatusFilter?.value || DEFAULT_INVENTORY_PARAMS.activo,
      limite: invLimitFilter?.value || DEFAULT_INVENTORY_PARAMS.limite,
    });
    renderInvSearchResults(result);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    if (invSearchResultsBody) {
      invSearchResultsBody.innerHTML = `
        <tr>
          <td colspan="11" class="empty-cell">${escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  }
}

export function initInventarioModule() {
  let searchDebounceTimer = null;

  if (invSearchInput) {
    invSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(executeProductSearch, 250);
    });
  }

  if (invSearchForm) {
    invSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeProductSearch();
    });
  }

  [invCategoryFilter, invUnitFilter, invStatusFilter, invLimitFilter].forEach((selectEl) => {
    if (selectEl) selectEl.addEventListener('change', executeProductSearch);
  });

  [invUrgentLimit, invSlowLimit, invTopLimit].forEach((selectEl) => {
    if (selectEl) selectEl.addEventListener('change', loadInventorySection);
  });

  if (invResetBtn) {
    invResetBtn.addEventListener('click', () => {
      if (invSearchInput) invSearchInput.value = DEFAULT_INVENTORY_PARAMS.q;
      if (invCategoryFilter) invCategoryFilter.value = DEFAULT_INVENTORY_PARAMS.id_categoria;
      if (invUnitFilter) invUnitFilter.value = DEFAULT_INVENTORY_PARAMS.unidad_medida;
      if (invStatusFilter) invStatusFilter.value = DEFAULT_INVENTORY_PARAMS.activo;
      if (invLimitFilter) invLimitFilter.value = DEFAULT_INVENTORY_PARAMS.limite;
      if (invUrgentLimit) invUrgentLimit.value = DEFAULT_INVENTORY_PARAMS.limiteUrgente;
      if (invSlowLimit) invSlowLimit.value = DEFAULT_INVENTORY_PARAMS.limiteBajaRotacion;
      if (invTopLimit) invTopLimit.value = DEFAULT_INVENTORY_PARAMS.limiteTop;
      loadInventorySection();
    });
  }

  if (refreshInventoryBtn) {
    refreshInventoryBtn.addEventListener('click', loadInventorySection);
  }
}
