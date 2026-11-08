import {
  formatCurrency,
  formatNumber,
  escapeHtml,
  showFeedback,
  isIntegerOnlyUnit,
  blockDecimalKeystrokesOnIntegerInput,
  sanitizeIntegerInputValue,
} from '../utils/formatters.js';
import { updateNavDbLabel } from '../components/navbar.js';

const stockActiveUser = document.getElementById('stockActiveUser');
const refreshStockMgmtBtn = document.getElementById('refreshStockMgmtBtn');

const stockActiveActionBadge = document.getElementById('stockActiveActionBadge');
const stockActionChoiceBtns = document.querySelectorAll('[data-stock-action]');
const closeStockPanelBtns = document.querySelectorAll('[data-close-stock-panel]');
const panelNewProduct = document.getElementById('panelNewProduct');
const panelStockEntry = document.getElementById('panelStockEntry');
const panelStockLoss = document.getElementById('panelStockLoss');

const formNewProduct = document.getElementById('formNewProduct');
const npNombre = document.getElementById('npNombre');
const npUnidad = document.getElementById('npUnidad');
const npSku = document.getElementById('npSku');
const npBarcode = document.getElementById('npBarcode');
const npCategoria = document.getElementById('npCategoria');
const npNuevaCategoria = document.getElementById('npNuevaCategoria');
const npCosto = document.getElementById('npCosto');
const npPrecioNeto = document.getElementById('npPrecioNeto');
const npExento = document.getElementById('npExento');
const npPrecioFinal = document.getElementById('npPrecioFinal');
const npStockMinimo = document.getElementById('npStockMinimo');
const npStockMinimoLabel = document.getElementById('npStockMinimoLabel');
const npStockInicial = document.getElementById('npStockInicial');
const npStockInicialLabel = document.getElementById('npStockInicialLabel');
const npDescripcion = document.getElementById('npDescripcion');
const npFeedback = document.getElementById('npFeedback');
const npSubmitBtn = document.getElementById('npSubmitBtn');

const formStockEntry = document.getElementById('formStockEntry');
const seProductSearchInput = document.getElementById('seProductSearchInput');
const seProductSearchResults = document.getElementById('seProductSearchResults');
const seSelectedProductInfo = document.getElementById('seSelectedProductInfo');
const seProducto = document.getElementById('seProducto');
const seTipo = document.getElementById('seTipo');
const seCantidad = document.getElementById('seCantidad');
const seCantidadLabel = document.getElementById('seCantidadLabel');
const seCostoUnitario = document.getElementById('seCostoUnitario');
const seReferencia = document.getElementById('seReferencia');
const seMotivo = document.getElementById('seMotivo');
const seFeedback = document.getElementById('seFeedback');
const seSubmitBtn = document.getElementById('seSubmitBtn');

const formStockLoss = document.getElementById('formStockLoss');
const slProductSearchInput = document.getElementById('slProductSearchInput');
const slProductSearchResults = document.getElementById('slProductSearchResults');
const slSelectedProductInfo = document.getElementById('slSelectedProductInfo');
const slProducto = document.getElementById('slProducto');
const slTipo = document.getElementById('slTipo');
const slCantidad = document.getElementById('slCantidad');
const slCantidadLabel = document.getElementById('slCantidadLabel');
const slReferencia = document.getElementById('slReferencia');
const slMotivo = document.getElementById('slMotivo');
const slFeedback = document.getElementById('slFeedback');
const slSubmitBtn = document.getElementById('slSubmitBtn');

const kardexFilterTipo = document.getElementById('kardexFilterTipo');
const kardexFilterLimit = document.getElementById('kardexFilterLimit');
const kardexCountBadge = document.getElementById('kardexCountBadge');
const kardexTableBody = document.getElementById('kardexTableBody');

const MAX_PRODUCT_SELECT_OPTIONS = 120;

let cachedStockProducts = [];
let activeStockAction = null;

function setActiveStockActionPanel(action) {
  const nextAction = activeStockAction === action ? null : action;
  activeStockAction = nextAction;

  const panelsMap = {
    new: panelNewProduct,
    entry: panelStockEntry,
    loss: panelStockLoss,
  };

  const labelsMap = {
    new: { text: 'Formulario: Producto Nuevo', cls: 'panel-badge info' },
    entry: { text: 'Formulario: Ingresar Nuevo Stock', cls: 'panel-badge success-badge' },
    loss: { text: 'Formulario: Ingresar Mermas / Pérdidas', cls: 'panel-badge danger' },
  };

  Object.entries(panelsMap).forEach(([key, panelEl]) => {
    if (!panelEl) return;
    panelEl.classList.toggle('hidden', key !== nextAction);
  });

  stockActionChoiceBtns.forEach((btn) => {
    const isSelected = btn.dataset.stockAction === nextAction;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-expanded', isSelected ? 'true' : 'false');
  });

  if (stockActiveActionBadge) {
    if (nextAction && labelsMap[nextAction]) {
      stockActiveActionBadge.textContent = labelsMap[nextAction].text;
      stockActiveActionBadge.className = labelsMap[nextAction].cls;
    } else {
      stockActiveActionBadge.textContent = 'Selecciona una acción';
      stockActiveActionBadge.className = 'panel-badge info';
    }
  }

  if (nextAction === 'new' && npNombre) {
    setTimeout(() => npNombre.focus(), 40);
  } else if (nextAction === 'entry' && seProductSearchInput) {
    setTimeout(() => seProductSearchInput.focus(), 40);
  } else if (nextAction === 'loss' && slProductSearchInput) {
    setTimeout(() => slProductSearchInput.focus(), 40);
  }
}

function syncNewProductQuantityStepByUnit() {
  const unit = npUnidad ? npUnidad.value : 'UN';
  const isIntUnit = isIntegerOnlyUnit(unit);
  const stepVal = isIntUnit ? '1' : '0.01';
  const inputModeVal = isIntUnit ? 'numeric' : 'decimal';

  if (npStockMinimo) {
    npStockMinimo.step = stepVal;
    npStockMinimo.setAttribute('inputmode', inputModeVal);
    if (isIntUnit) sanitizeIntegerInputValue(npStockMinimo);
  }
  if (npStockInicial) {
    npStockInicial.step = stepVal;
    npStockInicial.setAttribute('inputmode', inputModeVal);
    if (isIntUnit) sanitizeIntegerInputValue(npStockInicial);
  }
  if (npStockMinimoLabel) {
    npStockMinimoLabel.textContent = isIntUnit
      ? `Stock Mínimo (${unit} entero, sin decimales) *`
      : `Stock Mínimo (${unit}) *`;
  }
  if (npStockInicialLabel) {
    npStockInicialLabel.textContent = isIntUnit
      ? `Stock Inicial (${unit} entero, sin decimales) *`
      : `Stock Inicial (${unit}) *`;
  }
}

function configureStockQuantityInputForProduct(inputEl, labelEl, prod, baseLabelText) {
  if (!inputEl) return;
  const unit = prod ? prod.unidad_medida : 'UN';
  const isIntUnit = isIntegerOnlyUnit(unit);

  if (isIntUnit) {
    inputEl.step = '1';
    inputEl.min = '1';
    inputEl.setAttribute('inputmode', 'numeric');
    inputEl.placeholder = `Ingresa cantidad entera en ${unit} (sin decimales)`;
    sanitizeIntegerInputValue(inputEl);
  } else {
    inputEl.step = '0.01';
    inputEl.min = '0.01';
    inputEl.setAttribute('inputmode', 'decimal');
    inputEl.placeholder = `Ingresa cantidad en ${unit} (ej: 1.5)`;
  }

  if (labelEl) {
    labelEl.textContent = prod
      ? isIntUnit
        ? `${baseLabelText} (${unit} — solo enteros, sin decimales) *`
        : `${baseLabelText} (${unit}) *`
      : `${baseLabelText} (> 0) *`;
  }
}

function filterStockProductsByQuery(rawQuery = '') {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return cachedStockProducts;
  return cachedStockProducts.filter((p) => {
    const nombre = String(p.nombre || '').toLowerCase();
    const sku = String(p.sku || '').toLowerCase();
    const barcode = String(p.codigo_barras || '').toLowerCase();
    const idStr = `#${p.id_producto}`;
    return (
      nombre.includes(q) ||
      sku.includes(q) ||
      barcode.includes(q) ||
      idStr.includes(q)
    );
  });
}

function buildProductOptionsHtml(products, selectedId = '') {
  const list = Array.isArray(products) ? products : [];
  const sliced = list.slice(0, MAX_PRODUCT_SELECT_OPTIONS);
  if (
    selectedId &&
    !sliced.some((p) => String(p.id_producto) === String(selectedId))
  ) {
    const selectedObj = cachedStockProducts.find(
      (p) => String(p.id_producto) === String(selectedId)
    );
    if (selectedObj) {
      sliced.unshift(selectedObj);
    }
  }

  return (
    '<option value="">Selecciona un producto...</option>' +
    sliced
      .map(
        (p) =>
          `<option value="${p.id_producto}" ${
            String(p.id_producto) === String(selectedId) ? 'selected' : ''
          }>${escapeHtml(p.nombre)} (${escapeHtml(
            p.sku || p.codigo_barras || `ID #${p.id_producto}`
          )}) — Stock: ${formatNumber(p.stock_actual)} ${escapeHtml(p.unidad_medida)}</option>`
      )
      .join('')
  );
}

function updateSelectedProductInfoPill(pillEl, prod, mode = 'entry') {
  if (!pillEl) return;
  if (!prod) {
    pillEl.classList.add('hidden');
    pillEl.innerHTML = '';
    return;
  }
  const stockActual = Number(prod.stock_actual) || 0;
  const badgeCls =
    mode === 'loss' && stockActual <= 0 ? 'danger' : stockActual <= 0 ? 'warning' : 'success';
  pillEl.className = `selected-product-pill ${badgeCls}`;
  pillEl.innerHTML = `
    <span><strong>Seleccionado:</strong> ${escapeHtml(prod.nombre)}</span>
    <span class="font-mono">SKU: ${escapeHtml(prod.sku || 'S/N')} · Cód: ${escapeHtml(prod.codigo_barras || '—')}</span>
    <span class="font-mono">Stock actual: <strong>${formatNumber(stockActual)} ${escapeHtml(prod.unidad_medida)}</strong></span>
  `;
}

function renderStockProductQuickResults(resultsEl, matches, query, onSelectId) {
  if (!resultsEl) return;
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
    return;
  }

  resultsEl.classList.remove('hidden');
  if (!matches.length) {
    resultsEl.innerHTML = `<div class="stock-search-empty">No se encontraron productos para "${escapeHtml(trimmed)}".</div>`;
    return;
  }

  resultsEl.innerHTML = matches
    .slice(0, 8)
    .map(
      (p) => `
        <button type="button" class="stock-search-result-item" data-pick-prod-id="${p.id_producto}">
          <div class="stock-search-result-main">
            <strong>${escapeHtml(p.nombre)}</strong>
            <span class="font-mono">${escapeHtml(p.sku || p.codigo_barras || `ID #${p.id_producto}`)}</span>
          </div>
          <span class="stock-search-result-stock font-mono">
            Stock: <strong>${formatNumber(p.stock_actual)} ${escapeHtml(p.unidad_medida)}</strong>
          </span>
        </button>
      `
    )
    .join('');

  resultsEl.querySelectorAll('[data-pick-prod-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onSelectId(btn.dataset.pickProdId);
    });
  });
}

function selectProductForStockEntry(prodId) {
  const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prodId));
  if (seProducto) {
    seProducto.innerHTML = buildProductOptionsHtml(cachedStockProducts, prod ? prod.id_producto : '');
    seProducto.value = prod ? String(prod.id_producto) : '';
  }
  configureStockQuantityInputForProduct(seCantidad, seCantidadLabel, prod, 'Cantidad a Ingresar');
  if (seCantidad) seCantidad.value = '';
  if (seCostoUnitario) {
    seCostoUnitario.value = '';
    seCostoUnitario.placeholder = prod
      ? `Ingresa costo unitario (actual: $${Math.round(Number(prod.costo_promedio) || 0)})`
      : 'Ingresa costo unitario en $';
  }
  if (prod) {
    if (seProductSearchResults) seProductSearchResults.classList.add('hidden');
    if (seCantidad) seCantidad.focus();
  }
  updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
}

function selectProductForStockLoss(prodId) {
  const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prodId));
  if (slProducto) {
    slProducto.innerHTML = buildProductOptionsHtml(cachedStockProducts, prod ? prod.id_producto : '');
    slProducto.value = prod ? String(prod.id_producto) : '';
  }
  configureStockQuantityInputForProduct(slCantidad, slCantidadLabel, prod, 'Cantidad a Descontar');
  if (slCantidad) slCantidad.value = '';
  if (prod) {
    const maxStock = Number(prod.stock_actual) || 0;
    if (slCantidad) {
      slCantidad.max =
        maxStock > 0
          ? isIntegerOnlyUnit(prod.unidad_medida)
            ? Math.floor(maxStock)
            : maxStock
          : '';
    }
    if (slProductSearchResults) slProductSearchResults.classList.add('hidden');
    if (slCantidad) slCantidad.focus();
  } else if (slCantidad) {
    slCantidad.removeAttribute('max');
  }
  updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
}

function renderKardexMovements(movimientos = []) {
  if (kardexCountBadge) kardexCountBadge.textContent = `${movimientos.length} movimiento(s)`;
  if (!kardexTableBody) return;

  if (!movimientos.length) {
    kardexTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">No hay movimientos de inventario registrados para los filtros seleccionados.</td>
      </tr>
    `;
    return;
  }

  const entradaTypes = new Set(['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION_CLIENTE']);

  kardexTableBody.innerHTML = movimientos
    .map((m) => {
      const isEntrada = entradaTypes.has(m.tipo_movimiento);
      const badgeClass =
        m.tipo_movimiento === 'MERMA' || m.tipo_movimiento === 'AJUSTE_NEGATIVO'
          ? 'danger'
          : isEntrada
          ? 'success'
          : 'warning';
      const signo = isEntrada ? '+' : '-';

      return `
        <tr>
          <td>
            <div class="cell-primary font-mono">#${m.id_movimiento}</div>
            <div class="cell-secondary">${escapeHtml(m.fecha)}</div>
          </td>
          <td>
            <div class="cell-primary">${escapeHtml(m.producto_nombre)}</div>
            <div class="cell-secondary">SKU: ${escapeHtml(m.producto_sku || 'S/N')}</div>
          </td>
          <td><span class="status-tag ${badgeClass}">${escapeHtml(m.tipo_movimiento)}</span></td>
          <td class="text-right font-mono ${isEntrada ? 'text-emerald' : ''}">
            ${signo}${formatNumber(m.cantidad)} ${escapeHtml(m.unidad_medida)}
          </td>
          <td class="text-right font-mono">
            ${formatNumber(m.stock_anterior)} → <strong>${formatNumber(m.stock_resultante)}</strong> ${escapeHtml(m.unidad_medida)}
          </td>
          <td class="text-right font-mono">${formatCurrency(m.costo_unitario)}</td>
          <td>
            <div class="cell-primary">${escapeHtml(m.referencia_origen || '—')}</div>
            <div class="cell-secondary">${escapeHtml(m.motivo || 'Sin motivo')}</div>
          </td>
          <td>${escapeHtml(m.usuario_nombre)}</td>
        </tr>
      `;
    })
    .join('');
}

function populateStockManagementSelectors(data) {
  const usuarios = data.usuarios || [];
  const categorias = data.categorias || [];
  cachedStockProducts = data.productos || [];

  if (stockActiveUser) {
    const prevUser = stockActiveUser.value;
    stockActiveUser.innerHTML = usuarios
      .map(
        (u) =>
          `<option value="${u.id_usuario}">${escapeHtml(u.nombre)} (${escapeHtml(u.rol)})</option>`
      )
      .join('');
    if (prevUser && usuarios.some((u) => String(u.id_usuario) === String(prevUser))) {
      stockActiveUser.value = prevUser;
    }
  }

  if (npCategoria) {
    const prevCat = npCategoria.value;
    npCategoria.innerHTML =
      '<option value="">Sin categoría</option>' +
      categorias
        .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`)
        .join('');
    npCategoria.value = prevCat;
  }

  const prevSeProd = seProducto ? seProducto.value : '';
  const prevSlProd = slProducto ? slProducto.value : '';

  const seFiltered = filterStockProductsByQuery(seProductSearchInput ? seProductSearchInput.value : '');
  const slFiltered = filterStockProductsByQuery(slProductSearchInput ? slProductSearchInput.value : '');

  if (seProducto) seProducto.innerHTML = buildProductOptionsHtml(seFiltered, prevSeProd);
  if (slProducto) slProducto.innerHTML = buildProductOptionsHtml(slFiltered, prevSlProd);

  if (prevSeProd && seProducto) {
    seProducto.value = prevSeProd;
    const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prevSeProd));
    configureStockQuantityInputForProduct(seCantidad, seCantidadLabel, prod, 'Cantidad a Ingresar');
    updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
  } else {
    configureStockQuantityInputForProduct(seCantidad, seCantidadLabel, null, 'Cantidad a Ingresar');
    updateSelectedProductInfoPill(seSelectedProductInfo, null, 'entry');
  }

  if (prevSlProd && slProducto) {
    slProducto.value = prevSlProd;
    const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prevSlProd));
    configureStockQuantityInputForProduct(slCantidad, slCantidadLabel, prod, 'Cantidad a Descontar');
    updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
  } else {
    configureStockQuantityInputForProduct(slCantidad, slCantidadLabel, null, 'Cantidad a Descontar');
    updateSelectedProductInfoPill(slSelectedProductInfo, null, 'loss');
  }
}

export async function loadStockManagementSection() {
  if (refreshStockMgmtBtn) {
    refreshStockMgmtBtn.disabled = true;
    refreshStockMgmtBtn.textContent = 'Actualizando...';
  }

  try {
    const data = await window.LocalSqliteEngine.getStockManagementData({
      tipo_movimiento: kardexFilterTipo?.value || '',
      limite: kardexFilterLimit?.value || '30',
    });

    if (data.database?.originalName) {
      updateNavDbLabel(data.database);
    }

    populateStockManagementSelectors(data);
    renderKardexMovements(data.movimientos || []);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    if (kardexTableBody) {
      kardexTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-cell">${escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  } finally {
    if (refreshStockMgmtBtn) {
      refreshStockMgmtBtn.disabled = false;
      refreshStockMgmtBtn.textContent = 'Actualizar datos';
    }
  }
}

export function initKardexModule() {
  stockActionChoiceBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveStockActionPanel(btn.dataset.stockAction);
    });
  });

  closeStockPanelBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeStockAction) {
        setActiveStockActionPanel(activeStockAction);
      }
    });
  });

  // Todos los precios y costos en Gestión de Stock deben ser enteros sin punto flotante
  [npCosto, npPrecioNeto, npPrecioFinal, seCostoUnitario].forEach((priceEl) => {
    if (!priceEl) return;
    priceEl.addEventListener('keydown', blockDecimalKeystrokesOnIntegerInput);
    priceEl.addEventListener('input', () => sanitizeIntegerInputValue(priceEl));
  });

  if (npUnidad) {
    npUnidad.addEventListener('change', syncNewProductQuantityStepByUnit);
  }

  [npStockMinimo, npStockInicial].forEach((qtyEl) => {
    if (!qtyEl) return;
    qtyEl.addEventListener('keydown', (e) => {
      if (isIntegerOnlyUnit(npUnidad ? npUnidad.value : 'UN')) {
        blockDecimalKeystrokesOnIntegerInput(e);
      } else if (e.key === 'e' || e.key === 'E' || e.key === '-') {
        e.preventDefault();
      }
    });
    qtyEl.addEventListener('input', () => {
      if (isIntegerOnlyUnit(npUnidad ? npUnidad.value : 'UN')) {
        sanitizeIntegerInputValue(qtyEl);
      }
    });
  });

  if (seCantidad) {
    seCantidad.addEventListener('keydown', (e) => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(seProducto?.value));
      if (isIntegerOnlyUnit(prod ? prod.unidad_medida : 'UN')) {
        blockDecimalKeystrokesOnIntegerInput(e);
      } else if (e.key === 'e' || e.key === 'E' || e.key === '-') {
        e.preventDefault();
      }
    });
    seCantidad.addEventListener('input', () => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(seProducto?.value));
      if (isIntegerOnlyUnit(prod ? prod.unidad_medida : 'UN')) {
        sanitizeIntegerInputValue(seCantidad);
      }
    });
  }

  if (slCantidad) {
    slCantidad.addEventListener('keydown', (e) => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(slProducto?.value));
      if (isIntegerOnlyUnit(prod ? prod.unidad_medida : 'UN')) {
        blockDecimalKeystrokesOnIntegerInput(e);
      } else if (e.key === 'e' || e.key === 'E' || e.key === '-') {
        e.preventDefault();
      }
    });
    slCantidad.addEventListener('input', () => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(slProducto?.value));
      if (isIntegerOnlyUnit(prod ? prod.unidad_medida : 'UN')) {
        sanitizeIntegerInputValue(slCantidad);
      }
    });
  }

  syncNewProductQuantityStepByUnit();

  let seSearchDebounce = null;
  if (seProductSearchInput) {
    seProductSearchInput.addEventListener('input', () => {
      clearTimeout(seSearchDebounce);
      seSearchDebounce = setTimeout(() => {
        const q = seProductSearchInput.value;
        const matches = filterStockProductsByQuery(q);
        if (seProducto) seProducto.innerHTML = buildProductOptionsHtml(matches, seProducto.value);
        renderStockProductQuickResults(seProductSearchResults, matches, q, (pickedId) => {
          selectProductForStockEntry(pickedId);
          const picked = cachedStockProducts.find((p) => String(p.id_producto) === String(pickedId));
          if (picked) seProductSearchInput.value = picked.nombre;
        });
      }, 160);
    });

    seProductSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const matches = filterStockProductsByQuery(seProductSearchInput.value);
        if (matches.length > 0) {
          e.preventDefault();
          selectProductForStockEntry(matches[0].id_producto);
          seProductSearchInput.value = matches[0].nombre;
        }
      }
    });
  }

  let slSearchDebounce = null;
  if (slProductSearchInput) {
    slProductSearchInput.addEventListener('input', () => {
      clearTimeout(slSearchDebounce);
      slSearchDebounce = setTimeout(() => {
        const q = slProductSearchInput.value;
        const matches = filterStockProductsByQuery(q);
        if (slProducto) slProducto.innerHTML = buildProductOptionsHtml(matches, slProducto.value);
        renderStockProductQuickResults(slProductSearchResults, matches, q, (pickedId) => {
          selectProductForStockLoss(pickedId);
          const picked = cachedStockProducts.find((p) => String(p.id_producto) === String(pickedId));
          if (picked) slProductSearchInput.value = picked.nombre;
        });
      }, 160);
    });

    slProductSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const matches = filterStockProductsByQuery(slProductSearchInput.value);
        if (matches.length > 0) {
          e.preventDefault();
          selectProductForStockLoss(matches[0].id_producto);
          slProductSearchInput.value = matches[0].nombre;
        }
      }
    });
  }

  if (seProducto) {
    seProducto.addEventListener('change', () => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(seProducto.value));
      configureStockQuantityInputForProduct(seCantidad, seCantidadLabel, prod, 'Cantidad a Ingresar');
      if (seCostoUnitario) {
        seCostoUnitario.value = '';
        seCostoUnitario.placeholder = prod
          ? `Ingresa costo unitario (actual: $${Math.round(Number(prod.costo_promedio) || 0)})`
          : 'Ingresa costo unitario en $';
      }
      updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
    });
  }

  if (slProducto) {
    slProducto.addEventListener('change', () => {
      const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(slProducto.value));
      configureStockQuantityInputForProduct(slCantidad, slCantidadLabel, prod, 'Cantidad a Descontar');
      if (prod && slCantidad) {
        const maxStock = Number(prod.stock_actual) || 0;
        slCantidad.max =
          maxStock > 0
            ? isIntegerOnlyUnit(prod.unidad_medida)
              ? Math.floor(maxStock)
              : maxStock
            : '';
      } else if (slCantidad) {
        slCantidad.removeAttribute('max');
      }
      updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
    });
  }

  if (formNewProduct) {
    formNewProduct.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (npSubmitBtn) npSubmitBtn.disabled = true;
      if (npFeedback) npFeedback.classList.add('hidden');

      try {
        if (
          npCosto.value.trim() === '' ||
          npPrecioNeto.value.trim() === '' ||
          npPrecioFinal.value.trim() === '' ||
          npStockMinimo.value.trim() === '' ||
          npStockInicial.value.trim() === ''
        ) {
          throw new Error('Debes ingresar manualmente todos los precios y cantidades del producto.');
        }

        const costoVal = Number(npCosto.value);
        const netoVal = Number(npPrecioNeto.value);
        const finalVal = Number(npPrecioFinal.value);
        const minVal = Number(npStockMinimo.value);
        const iniVal = Number(npStockInicial.value);

        if (
          !Number.isInteger(costoVal) ||
          !Number.isInteger(netoVal) ||
          !Number.isInteger(finalVal)
        ) {
          throw new Error('Los precios y costos no deben tener decimales ni punto flotante.');
        }

        if (isIntegerOnlyUnit(npUnidad.value) && (!Number.isInteger(minVal) || !Number.isInteger(iniVal))) {
          throw new Error(
            `Los productos catalogados por ${npUnidad.value} no permiten decimales ni punto flotante en stock.`
          );
        }

        const payload = {
          nombre: npNombre.value.trim(),
          unidad_medida: npUnidad.value,
          sku: npSku.value.trim() || null,
          codigo_barras: npBarcode.value.trim() || null,
          id_categoria: npCategoria.value || null,
          nueva_categoria: npNuevaCategoria.value.trim() || null,
          costo_promedio: costoVal,
          precio_neto: netoVal,
          exento_iva: Number(npExento.value) === 1 ? 1 : 0,
          precio_venta_final: finalVal,
          stock_minimo: minVal,
          stock_inicial: iniVal,
          descripcion: npDescripcion.value.trim() || null,
          id_usuario: stockActiveUser.value || null,
        };

        const data = await window.LocalSqliteEngine.createProductWithInitialStock(payload);
        const syncNote = data.wroteDirectlyToDisk
          ? `guardado directamente en tu archivo local "${data.savedToFile}"`
          : `actualizado en "${data.savedToFile}" (en tu navegador)`;

        showFeedback(
          npFeedback,
          'success',
          `Producto "${data.producto.nombre}" ${syncNote} (Stock actual: ${data.producto.stock_actual} ${data.producto.unidad_medida}).`
        );
        formNewProduct.reset();
        syncNewProductQuantityStepByUnit();
        await loadStockManagementSection();
      } catch (err) {
        showFeedback(npFeedback, 'error', err.message);
      } finally {
        if (npSubmitBtn) npSubmitBtn.disabled = false;
      }
    });
  }

  if (formStockEntry) {
    formStockEntry.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (seSubmitBtn) seSubmitBtn.disabled = true;
      if (seFeedback) seFeedback.classList.add('hidden');

      try {
        if (seCantidad.value.trim() === '' || seCostoUnitario.value.trim() === '') {
          throw new Error('Debes ingresar manualmente tanto la cantidad como el costo unitario.');
        }

        const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(seProducto.value));
        const cantVal = Number(seCantidad.value);
        const costoVal = Number(seCostoUnitario.value);

        if (!Number.isInteger(costoVal) || costoVal < 0) {
          throw new Error('El costo unitario debe ser un número entero (sin punto flotante).');
        }

        if (prod && isIntegerOnlyUnit(prod.unidad_medida) && !Number.isInteger(cantVal)) {
          throw new Error(
            `El producto "${prod.nombre}" se mide en ${prod.unidad_medida}: la cantidad debe ser un número entero sin decimales.`
          );
        }

        const payload = {
          id_producto: Number(seProducto.value),
          id_usuario: stockActiveUser.value || null,
          tipo_movimiento: seTipo.value,
          cantidad: cantVal,
          costo_unitario: costoVal,
          referencia_origen: seReferencia.value.trim() || 'INGRESO BODEGA',
          motivo: seMotivo.value.trim() || 'Reposición de stock',
        };

        const data = await window.LocalSqliteEngine.registerStockEntry(payload);

        showFeedback(
          seFeedback,
          'success',
          `Stock actualizado en ${data.savedToFile || 'tu archivo .db local'} para "${data.producto.nombre}": ${data.stock_anterior} → ${data.stock_resultante} ${data.producto.unidad_medida}.`
        );
        seCantidad.value = '';
        seCostoUnitario.value = '';
        await loadStockManagementSection();
      } catch (err) {
        showFeedback(seFeedback, 'error', err.message);
      } finally {
        if (seSubmitBtn) seSubmitBtn.disabled = false;
      }
    });
  }

  if (formStockLoss) {
    formStockLoss.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (slSubmitBtn) slSubmitBtn.disabled = true;
      if (slFeedback) slFeedback.classList.add('hidden');

      try {
        if (slCantidad.value.trim() === '') {
          throw new Error('Debes ingresar manualmente la cantidad de merma o pérdida.');
        }

        const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(slProducto.value));
        const cantVal = Number(slCantidad.value);

        if (prod && isIntegerOnlyUnit(prod.unidad_medida) && !Number.isInteger(cantVal)) {
          throw new Error(
            `El producto "${prod.nombre}" está catalogado en ${prod.unidad_medida}: no se permiten decimales ni punto flotante al registrar mermas o pérdidas.`
          );
        }

        const payload = {
          id_producto: Number(slProducto.value),
          id_usuario: stockActiveUser.value || null,
          tipo_movimiento: slTipo.value,
          cantidad: cantVal,
          referencia_origen: slReferencia.value.trim() || 'ACTA DE MERMA',
          motivo: slMotivo.value.trim(),
        };

        const data = await window.LocalSqliteEngine.registerStockLossOrMerma(payload);

        showFeedback(
          slFeedback,
          'success',
          `Merma/baja guardada en ${data.savedToFile || 'tu archivo .db local'} para "${data.producto.nombre}": ${data.stock_anterior} → ${data.stock_resultante} ${data.producto.unidad_medida}.`
        );
        slCantidad.value = '';
        slMotivo.value = '';
        await loadStockManagementSection();
      } catch (err) {
        showFeedback(slFeedback, 'error', err.message);
      } finally {
        if (slSubmitBtn) slSubmitBtn.disabled = false;
      }
    });
  }

  [kardexFilterTipo, kardexFilterLimit].forEach((el) => {
    if (el) el.addEventListener('change', loadStockManagementSection);
  });

  if (refreshStockMgmtBtn) {
    refreshStockMgmtBtn.addEventListener('click', loadStockManagementSection);
  }
}
