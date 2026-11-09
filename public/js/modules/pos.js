import {
  formatCurrency,
  formatNumber,
  escapeHtml,
  showFeedback,
} from '../utils/formatters.js';
import { updateNavDbLabel } from '../components/navbar.js';
import {
  getSalesSectionData,
  registerSaleTransaction,
  searchPosProducts,
} from '../db/repositories/sales.repo.js';

const posActiveUser = document.getElementById('posActiveUser');
const refreshSalesBtn = document.getElementById('refreshSalesBtn');

const posSearchForm = document.getElementById('posSearchForm');
const posSearchInput = document.getElementById('posSearchInput');
const posCategoryFilter = document.getElementById('posCategoryFilter');
const posStockFilter = document.getElementById('posStockFilter');
const posClearSearchBtn = document.getElementById('posClearSearchBtn');
const posProductsCountBadge = document.getElementById('posProductsCountBadge');
const posProductsTableBody = document.getElementById('posProductsTableBody');

const posCartBadge = document.getElementById('posCartBadge');
const posClearCartBtn = document.getElementById('posClearCartBtn');
const posCartTableBody = document.getElementById('posCartTableBody');

const posDiscountType = document.getElementById('posDiscountType');
const posDiscountInputLabel = document.getElementById('posDiscountInputLabel');
const posDiscountInput = document.getElementById('posDiscountInput');
const posDiscountComputedDisplay = document.getElementById('posDiscountComputedDisplay');
const posQuickDiscountBtns = document.querySelectorAll('[data-discount-pct]');

const posSummarySubtotalBruto = document.getElementById('posSummarySubtotalBruto');
const posSummaryDescuentoGlobal = document.getElementById('posSummaryDescuentoGlobal');
const posSummaryNeto = document.getElementById('posSummaryNeto');
const posSummaryIva = document.getElementById('posSummaryIva');
const posSummaryTotalVenta = document.getElementById('posSummaryTotalVenta');

const posCheckoutForm = document.getElementById('posCheckoutForm');
const posTipoDoc = document.getElementById('posTipoDoc');
const posFolioDoc = document.getElementById('posFolioDoc');
const posClienteSelect = document.getElementById('posClienteSelect');
const posMetodoPago = document.getElementById('posMetodoPago');
const posReferenciaPago = document.getElementById('posReferenciaPago');
const posEstadoVenta = document.getElementById('posEstadoVenta');
const posFeedback = document.getElementById('posFeedback');
const posSubmitSaleBtn = document.getElementById('posSubmitSaleBtn');

const posHistoryCountBadge = document.getElementById('posHistoryCountBadge');
const posSalesHistoryBody = document.getElementById('posSalesHistoryBody');

let posCatalogProducts = [];
let posCart = [];

function renderPosProducts(products = []) {
  posCatalogProducts = products;
  if (posProductsCountBadge) posProductsCountBadge.textContent = `${products.length} producto(s)`;
  if (!posProductsTableBody) return;

  if (!products.length) {
    posProductsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">No se encontraron productos con esos filtros.</td>
      </tr>
    `;
    return;
  }

  posProductsTableBody.innerHTML = products
    .map((p) => {
      const stockActual = Number(p.stock_actual) || 0;
      const stockMinimo = Number(p.stock_minimo) || 0;
      const sinStock = stockActual <= 0;
      const bajoStock = !sinStock && stockActual <= stockMinimo;

      const stockTag = sinStock
        ? '<span class="status-tag danger">Agotado (0)</span>'
        : bajoStock
        ? `<span class="status-tag warning">${formatNumber(stockActual)} ${escapeHtml(p.unidad_medida)}</span>`
        : `<span class="status-tag success">${formatNumber(stockActual)} ${escapeHtml(p.unidad_medida)}</span>`;

      const ivaText = Number(p.exento_iva) === 1 ? 'Exento' : 'IVA incl.';
      const stepVal = p.unidad_medida === 'UN' || p.unidad_medida === 'CAJA' ? '1' : '0.1';

      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary font-mono">SKU: ${escapeHtml(p.sku || 'S/N')} · Cód: ${escapeHtml(p.codigo_barras || '—')}</div>
          </td>
          <td>
            <div>${escapeHtml(p.categoria)}</div>
            <div class="cell-secondary">${escapeHtml(p.unidad_medida)} · ${ivaText}</div>
          </td>
          <td class="text-right font-mono">${stockTag}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(p.precio_venta_final)}</td>
          <td class="text-right">
            <div class="pos-add-controls">
              <input
                type="number"
                step="${stepVal}"
                min="0.01"
                value="1"
                class="pos-qty-input font-mono"
                id="posQty_${p.id_producto}"
                ${sinStock ? 'disabled' : ''}
              />
              <button
                type="button"
                class="btn btn-primary btn-xs"
                data-add-prod-id="${p.id_producto}"
                ${sinStock ? 'disabled title="Sin stock disponible"' : ''}
              >
                + Agregar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function calculatePosTotals() {
  let subtotalArticulos = 0;
  let netoBruto = 0;
  let ivaBruto = 0;

  for (const item of posCart) {
    const brutoLinea = Number((item.cantidad * item.precio_unitario_venta).toFixed(2));
    const descLinea = Math.min(brutoLinea, Math.max(0, Number(item.descuento_linea) || 0));
    const subtotalLinea = Number((brutoLinea - descLinea).toFixed(2));
    item.subtotal = subtotalLinea;

    subtotalArticulos = Number((subtotalArticulos + subtotalLinea).toFixed(2));

    const esExento = Number(item.exento_iva) === 1;
    const netoItem = esExento ? subtotalLinea : Number((subtotalLinea / 1.19).toFixed(2));
    const ivaItem = esExento ? 0 : Number((subtotalLinea - netoItem).toFixed(2));

    netoBruto = Number((netoBruto + netoItem).toFixed(2));
    ivaBruto = Number((ivaBruto + ivaItem).toFixed(2));
  }

  const rawDiscountVal = Math.max(0, Number(posDiscountInput?.value) || 0);
  let descuentoGlobalMonto = 0;

  if (posDiscountType?.value === 'PERCENT') {
    const pct = Math.min(100, rawDiscountVal);
    descuentoGlobalMonto = Number(Math.round((subtotalArticulos * pct) / 100));
  } else {
    descuentoGlobalMonto = Number(Math.min(subtotalArticulos, rawDiscountVal).toFixed(2));
  }

  const totalVenta = Number(Math.max(0, subtotalArticulos - descuentoGlobalMonto).toFixed(2));
  const factorGlobal = subtotalArticulos > 0 ? totalVenta / subtotalArticulos : 0;
  const subtotalNeto = Number((netoBruto * factorGlobal).toFixed(2));
  const totalIva = Number(Math.max(0, totalVenta - subtotalNeto).toFixed(2));

  if (posDiscountComputedDisplay) posDiscountComputedDisplay.textContent = `-${formatCurrency(descuentoGlobalMonto)}`;
  if (posSummarySubtotalBruto) posSummarySubtotalBruto.textContent = formatCurrency(subtotalArticulos);
  if (posSummaryDescuentoGlobal) posSummaryDescuentoGlobal.textContent = `-${formatCurrency(descuentoGlobalMonto)}`;
  if (posSummaryNeto) posSummaryNeto.textContent = formatCurrency(subtotalNeto);
  if (posSummaryIva) posSummaryIva.textContent = formatCurrency(totalIva);
  if (posSummaryTotalVenta) posSummaryTotalVenta.textContent = formatCurrency(totalVenta);

  return {
    subtotalArticulos,
    descuentoGlobalMonto,
    subtotalNeto,
    totalIva,
    totalVenta,
  };
}

function renderPosCart() {
  const totalUnidades = posCart.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  if (posCartBadge) posCartBadge.textContent = `${posCart.length} línea(s) (${formatNumber(totalUnidades)} unid.)`;
  if (!posCartTableBody) return;

  if (!posCart.length) {
    posCartTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Selecciona o busca productos en el panel izquierdo para agregarlos a la venta.</td>
      </tr>
    `;
    calculatePosTotals();
    return;
  }

  calculatePosTotals();

  posCartTableBody.innerHTML = posCart
    .map((item) => {
      const stepVal = item.unidad_medida === 'UN' || item.unidad_medida === 'CAJA' ? '1' : '0.1';
      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(item.nombre)}</div>
            <div class="cell-secondary font-mono">
              ${escapeHtml(item.sku || `ID #${item.id_producto}`)} · Stock máx: ${formatNumber(item.stock_disponible)} ${escapeHtml(item.unidad_medida)}
            </div>
          </td>
          <td class="text-right font-mono">${formatCurrency(item.precio_unitario_venta)}</td>
          <td class="text-right">
            <input
              type="number"
              step="${stepVal}"
              min="0.01"
              max="${item.stock_disponible}"
              value="${item.cantidad}"
              class="pos-qty-input font-mono"
              data-cart-qty-id="${item.id_producto}"
            />
          </td>
          <td class="text-right">
            <input
              type="number"
              step="1"
              min="0"
              value="${item.descuento_linea || 0}"
              class="pos-qty-input font-mono"
              data-cart-disc-id="${item.id_producto}"
            />
          </td>
          <td class="text-right font-mono text-emerald">${formatCurrency(item.subtotal)}</td>
          <td class="text-right">
            <button
              type="button"
              class="btn-remove-line"
              data-cart-remove-id="${item.id_producto}"
              title="Quitar producto de la venta"
            >
              ✕
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function addProductToPosCart(product, requestedQty = 1) {
  if (!product) return;
  if (posFeedback) posFeedback.classList.add('hidden');

  const stockDisp = Number(product.stock_actual) || 0;
  if (stockDisp <= 0) {
    showFeedback(posFeedback, 'error', `El producto "${product.nombre}" no tiene stock disponible.`);
    return;
  }

  const qtyToAdd = Number(requestedQty);
  if (Number.isNaN(qtyToAdd) || qtyToAdd <= 0) {
    showFeedback(posFeedback, 'error', 'La cantidad a vender debe ser mayor a 0.');
    return;
  }

  const existing = posCart.find((it) => it.id_producto === product.id_producto);
  if (existing) {
    const nuevaCantidad = Number((existing.cantidad + qtyToAdd).toFixed(4));
    if (nuevaCantidad > stockDisp) {
      showFeedback(
        posFeedback,
        'error',
        `No puedes superar el stock disponible de "${product.nombre}" (${stockDisp} ${product.unidad_medida}).`
      );
      return;
    }
    existing.cantidad = nuevaCantidad;
    existing.stock_disponible = stockDisp;
  } else {
    if (qtyToAdd > stockDisp) {
      showFeedback(
        posFeedback,
        'error',
        `Cantidad solicitada (${qtyToAdd}) supera el stock disponible de "${product.nombre}" (${stockDisp} ${product.unidad_medida}).`
      );
      return;
    }
    posCart.push({
      id_producto: product.id_producto,
      sku: product.sku,
      nombre: product.nombre,
      unidad_medida: product.unidad_medida,
      precio_unitario_venta: Number(product.precio_venta_final) || 0,
      costo_unitario_historico: Number(product.costo_promedio) || 0,
      exento_iva: Number(product.exento_iva) === 1 ? 1 : 0,
      stock_disponible: stockDisp,
      cantidad: Number(qtyToAdd.toFixed(4)),
      descuento_linea: 0,
      subtotal: Number((qtyToAdd * (Number(product.precio_venta_final) || 0)).toFixed(2)),
    });
  }

  renderPosCart();
}

function renderPosSalesHistory(ventas = []) {
  if (posHistoryCountBadge) posHistoryCountBadge.textContent = `${ventas.length} venta(s)`;
  if (!posSalesHistoryBody) return;

  if (!ventas.length) {
    posSalesHistoryBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">Aún no se han registrado ventas en esta base de datos.</td>
      </tr>
    `;
    return;
  }

  posSalesHistoryBody.innerHTML = ventas
    .map((v) => {
      const estadoClass =
        v.estado === 'COMPLETADA' ? 'success' : v.estado === 'ANULADA' ? 'danger' : 'warning';
      const folioText = v.folio_documento ? `#${v.folio_documento}` : `ID #${v.id_venta}`;
      const dctoGlobal = Number(v.descuento_global) || 0;

      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(v.tipo_documento)}</div>
            <div class="cell-secondary font-mono">${escapeHtml(folioText)}</div>
          </td>
          <td class="cell-secondary font-mono">${escapeHtml(v.fecha_venta)}</td>
          <td>
            <div class="cell-primary">${escapeHtml(v.cliente_nombre)}</div>
            <div class="cell-secondary">Cajero: ${escapeHtml(v.usuario_nombre)}</div>
          </td>
          <td>
            <div class="cell-primary">${formatNumber(v.total_items)} unid.</div>
            <div class="cell-secondary">${escapeHtml(v.resumen_productos || '—')}</div>
          </td>
          <td><span class="status-tag info">${escapeHtml(v.metodos_pago)}</span></td>
          <td class="text-right font-mono">
            <div>Neto: ${formatCurrency(v.subtotal_neto)}</div>
            <div class="cell-secondary">IVA: ${formatCurrency(v.total_iva)}</div>
          </td>
          <td class="text-right font-mono">
            ${dctoGlobal > 0 ? `<span class="status-tag warning">-${formatCurrency(dctoGlobal)}</span>` : '—'}
          </td>
          <td class="text-right font-mono text-emerald">${formatCurrency(v.total_venta)}</td>
          <td><span class="status-tag ${estadoClass}">${escapeHtml(v.estado)}</span></td>
        </tr>
      `;
    })
    .join('');
}

function populatePosSelectors(data) {
  const usuarios = data.usuarios || [];
  const categorias = data.categorias || [];
  const clientes = data.clientes || [];

  if (posActiveUser) {
    const prevUser = posActiveUser.value;
    posActiveUser.innerHTML = usuarios
      .map(
        (u) => `<option value="${u.id_usuario}">${escapeHtml(u.nombre)} (${escapeHtml(u.rol)})</option>`
      )
      .join('');
    if (prevUser && usuarios.some((u) => String(u.id_usuario) === String(prevUser))) {
      posActiveUser.value = prevUser;
    }
  }

  if (posCategoryFilter) {
    const prevCat = posCategoryFilter.value;
    posCategoryFilter.innerHTML =
      '<option value="">Todas las categorías</option>' +
      categorias
        .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`)
        .join('');
    posCategoryFilter.value = prevCat;
  }

  if (posClienteSelect) {
    const prevCli = posClienteSelect.value;
    posClienteSelect.innerHTML =
      '<option value="">Cliente General (Sin RUT)</option>' +
      clientes
        .map(
          (cl) =>
            `<option value="${cl.id_cliente}">${escapeHtml(cl.nombre)} ${
              cl.rut_identificacion ? `(${escapeHtml(cl.rut_identificacion)})` : ''
            }</option>`
        )
        .join('');
    posClienteSelect.value = prevCli;
  }
}

export async function loadSalesSection() {
  if (refreshSalesBtn) {
    refreshSalesBtn.disabled = true;
    refreshSalesBtn.textContent = 'Actualizando...';
  }

  try {
    const data = await getSalesSectionData({
      q: posSearchInput?.value.trim() || '',
      id_categoria: posCategoryFilter?.value || '',
      solo_con_stock: posStockFilter?.value || '0',
      limite_productos: '60',
      limite_ventas: '25',
    });

    if (data.database?.originalName) {
      updateNavDbLabel(data.database);
    }

    populatePosSelectors(data);
    renderPosProducts(data.productos || []);
    renderPosSalesHistory(data.ventasRecientes || []);
    renderPosCart();
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    if (posProductsTableBody) {
      posProductsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  } finally {
    if (refreshSalesBtn) {
      refreshSalesBtn.disabled = false;
      refreshSalesBtn.textContent = 'Actualizar catálogo';
    }
  }
}

async function executePosCatalogSearch() {
  try {
    const productos = await searchPosProducts({
      q: posSearchInput?.value.trim() || '',
      id_categoria: posCategoryFilter?.value || '',
      solo_con_stock: posStockFilter?.value || '0',
      limite_productos: '60',
    });
    renderPosProducts(productos || []);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    if (posProductsTableBody) {
      posProductsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  }
}

export function initPosModule() {
  let posSearchDebounce = null;

  if (posSearchInput) {
    posSearchInput.addEventListener('input', () => {
      clearTimeout(posSearchDebounce);
      posSearchDebounce = setTimeout(executePosCatalogSearch, 180);
    });
  }

  if (posSearchForm) {
    posSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearTimeout(posSearchDebounce);
      await executePosCatalogSearch();

      // Si el usuario buscó un SKU o código de barras exacto (o quedó 1 único producto con stock), lo agrega directo
      const term = posSearchInput?.value.trim().toLowerCase() || '';
      if (!term) return;
      const exactMatch = posCatalogProducts.find(
        (p) =>
          (p.sku && p.sku.toLowerCase() === term) ||
          (p.codigo_barras && p.codigo_barras.toLowerCase() === term)
      );
      if (exactMatch) {
        addProductToPosCart(exactMatch, 1);
        posSearchInput.select();
      } else if (posCatalogProducts.length === 1) {
        addProductToPosCart(posCatalogProducts[0], 1);
      }
    });
  }

  [posCategoryFilter, posStockFilter].forEach((el) => {
    if (el) el.addEventListener('change', executePosCatalogSearch);
  });

  if (posClearSearchBtn) {
    posClearSearchBtn.addEventListener('click', () => {
      if (posSearchInput) posSearchInput.value = '';
      if (posCategoryFilter) posCategoryFilter.value = '';
      if (posStockFilter) posStockFilter.value = '0';
      executePosCatalogSearch();
    });
  }

  if (refreshSalesBtn) {
    refreshSalesBtn.addEventListener('click', loadSalesSection);
  }

  // Delegación de eventos para agregar productos desde la tabla del buscador
  if (posProductsTableBody) {
    posProductsTableBody.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-prod-id]');
      if (!addBtn) return;

      const prodId = Number(addBtn.dataset.addProdId);
      const product = posCatalogProducts.find((p) => p.id_producto === prodId);
      if (!product) return;

      const qtyInput = document.getElementById(`posQty_${prodId}`);
      const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
      addProductToPosCart(product, qty);
    });
  }

  // Delegación de eventos en el carrito de venta actual (cambiar cantidad, descuento línea o eliminar)
  if (posCartTableBody) {
    posCartTableBody.addEventListener('input', (e) => {
      const qtyInput = e.target.closest('[data-cart-qty-id]');
      if (qtyInput) {
        const prodId = Number(qtyInput.dataset.cartQtyId);
        const item = posCart.find((it) => it.id_producto === prodId);
        if (item) {
          let val = Number(qtyInput.value);
          if (Number.isNaN(val) || val <= 0) val = 0.01;
          if (val > item.stock_disponible) {
            val = item.stock_disponible;
            qtyInput.value = val;
          }
          item.cantidad = val;
          renderPosCart();
        }
        return;
      }

      const discInput = e.target.closest('[data-cart-disc-id]');
      if (discInput) {
        const prodId = Number(discInput.dataset.cartDiscId);
        const item = posCart.find((it) => it.id_producto === prodId);
        if (item) {
          const maxBruto = Number((item.cantidad * item.precio_unitario_venta).toFixed(2));
          let val = Math.max(0, Number(discInput.value) || 0);
          if (val > maxBruto) {
            val = maxBruto;
            discInput.value = val;
          }
          item.descuento_linea = val;
          renderPosCart();
        }
      }
    });

    posCartTableBody.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-cart-remove-id]');
      if (!removeBtn) return;
      const prodId = Number(removeBtn.dataset.cartRemoveId);
      posCart = posCart.filter((it) => it.id_producto !== prodId);
      renderPosCart();
    });
  }

  if (posClearCartBtn) {
    posClearCartBtn.addEventListener('click', () => {
      posCart = [];
      if (posDiscountInput) posDiscountInput.value = '0';
      if (posFeedback) posFeedback.classList.add('hidden');
      renderPosCart();
    });
  }

  // Controles de descuento en la venta total
  if (posDiscountType) {
    posDiscountType.addEventListener('change', () => {
      if (posDiscountType.value === 'PERCENT') {
        if (posDiscountInputLabel) posDiscountInputLabel.textContent = 'Porcentaje de Descuento (%)';
        if (posDiscountInput) posDiscountInput.max = '100';
      } else {
        if (posDiscountInputLabel) posDiscountInputLabel.textContent = 'Valor del Descuento ($)';
        if (posDiscountInput) posDiscountInput.removeAttribute('max');
      }
      calculatePosTotals();
    });
  }

  if (posDiscountInput) {
    posDiscountInput.addEventListener('input', calculatePosTotals);
  }

  posQuickDiscountBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = Number(btn.dataset.discountPct) || 0;
      if (pct === 0) {
        if (posDiscountType) posDiscountType.value = 'AMOUNT';
        if (posDiscountInputLabel) posDiscountInputLabel.textContent = 'Valor del Descuento ($)';
        if (posDiscountInput) posDiscountInput.value = '0';
      } else {
        if (posDiscountType) posDiscountType.value = 'PERCENT';
        if (posDiscountInputLabel) posDiscountInputLabel.textContent = 'Porcentaje de Descuento (%)';
        if (posDiscountInput) posDiscountInput.value = String(pct);
      }
      calculatePosTotals();
    });
  });

  // Confirmar y registrar venta (Transacción atómica)
  if (posCheckoutForm) {
    posCheckoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (posFeedback) posFeedback.classList.add('hidden');

      if (!posCart.length) {
        showFeedback(posFeedback, 'error', 'Debes agregar al menos un producto a la venta antes de confirmar.');
        return;
      }

      if (posSubmitSaleBtn) {
        posSubmitSaleBtn.disabled = true;
        posSubmitSaleBtn.textContent = 'Procesando venta...';
      }

      try {
        const totals = calculatePosTotals();

        const payload = {
          id_cliente: posClienteSelect?.value ? Number(posClienteSelect.value) : null,
          id_usuario: posActiveUser?.value ? Number(posActiveUser.value) : null,
          tipo_documento: posTipoDoc.value,
          folio_documento: posFolioDoc.value.trim() || null,
          descuento_global: totals.descuentoGlobalMonto,
          estado: posEstadoVenta.value,
          metodo_pago: posMetodoPago.value,
          referencia_transaccion: posReferenciaPago.value.trim() || null,
          items: posCart.map((it) => ({
            id_producto: it.id_producto,
            cantidad: Number(it.cantidad),
            descuento_linea: Number(it.descuento_linea) || 0,
          })),
        };

        const data = await registerSaleTransaction(payload);

        const dctoMsg =
          Number(data.venta.descuento_global) > 0
            ? ` (Descuento total aplicado: -${formatCurrency(data.venta.descuento_global)})`
            : '';

        showFeedback(
          posFeedback,
          'success',
          `Venta #${data.venta.id_venta} (${data.venta.tipo_documento}) por ${formatCurrency(
            data.venta.total_venta
          )}${dctoMsg} registrada y guardada en ${data.savedToFile || 'tu archivo .db local'}.`
        );

        posCart = [];
        if (posDiscountInput) posDiscountInput.value = '0';
        if (posFolioDoc) posFolioDoc.value = '';
        if (posReferenciaPago) posReferenciaPago.value = '';
        await loadSalesSection();
      } catch (err) {
        showFeedback(posFeedback, 'error', err.message);
      } finally {
        if (posSubmitSaleBtn) {
          posSubmitSaleBtn.disabled = false;
          posSubmitSaleBtn.textContent = 'Confirmar y Registrar Venta';
        }
      }
    });
  }
}
