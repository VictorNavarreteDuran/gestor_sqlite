import {
  formatCurrency,
  formatNumber,
  escapeHtml,
  formatCompactCurrency,
} from '../utils/formatters.js';
import { updateNavDbLabel } from '../components/navbar.js';

let activeFinanceMonths = 1;

const finPeriodSubtitle = document.getElementById('finPeriodSubtitle');
const financePeriodBtns = document.querySelectorAll('[data-fin-months]');
const refreshFinanceBtn = document.getElementById('refreshFinanceBtn');

const finKpiIngresosLabel = document.getElementById('finKpiIngresosLabel');
const finKpiIngresosMonto = document.getElementById('finKpiIngresosMonto');
const finKpiIngresosMeta = document.getElementById('finKpiIngresosMeta');

const finKpiEgresosLabel = document.getElementById('finKpiEgresosLabel');
const finKpiEgresosMonto = document.getElementById('finKpiEgresosMonto');
const finKpiEgresosMeta = document.getElementById('finKpiEgresosMeta');

const finKpiIvaLabel = document.getElementById('finKpiIvaLabel');
const finKpiIvaMonto = document.getElementById('finKpiIvaMonto');
const finKpiIvaMeta = document.getElementById('finKpiIvaMeta');

const finKpiMermaLabel = document.getElementById('finKpiMermaLabel');
const finKpiMermaMonto = document.getElementById('finKpiMermaMonto');
const finKpiMermaMeta = document.getElementById('finKpiMermaMeta');

const finChartTitle = document.getElementById('finChartTitle');
const finChartBadge = document.getElementById('finChartBadge');
const finChartContainer = document.getElementById('finChartContainer');

const finIngresosBadge = document.getElementById('finIngresosBadge');
const finIngNeto = document.getElementById('finIngNeto');
const finIngIva = document.getElementById('finIngIva');
const finIngDescuentos = document.getElementById('finIngDescuentos');
const finIngTotalBruto = document.getElementById('finIngTotalBruto');
const finIngresosBreakdownBody = document.getElementById('finIngresosBreakdownBody');

const finEgresosBadge = document.getElementById('finEgresosBadge');
const finEgrComprasNeto = document.getElementById('finEgrComprasNeto');
const finEgrComprasIva = document.getElementById('finEgrComprasIva');
const finEgrComprasBruto = document.getElementById('finEgrComprasBruto');
const finEgrKardexIn = document.getElementById('finEgrKardexIn');
const finEgrCostoVentas = document.getElementById('finEgrCostoVentas');
const finEgrMermas = document.getElementById('finEgrMermas');
const finEgrTotalConsolidado = document.getElementById('finEgrTotalConsolidado');
const finEgresosBreakdownBody = document.getElementById('finEgresosBreakdownBody');

const finMonthlyTableBadge = document.getElementById('finMonthlyTableBadge');
const finMonthlyTableBody = document.getElementById('finMonthlyTableBody');

const finIvaStatusBadge = document.getElementById('finIvaStatusBadge');
const finTaxIvaDebito = document.getElementById('finTaxIvaDebito');
const finTaxIvaCredito = document.getElementById('finTaxIvaCredito');
const finTaxIvaMerma = document.getElementById('finTaxIvaMerma');
const finTaxIvaResultadoRow = document.getElementById('finTaxIvaResultadoRow');
const finTaxIvaResultadoLabel = document.getElementById('finTaxIvaResultadoLabel');
const finTaxIvaResultadoValor = document.getElementById('finTaxIvaResultadoValor');
const finLossByTypeBody = document.getElementById('finLossByTypeBody');

const finMermaTotalBadge = document.getElementById('finMermaTotalBadge');
const finMermaHistoryBody = document.getElementById('finMermaHistoryBody');

function renderFinanceComparisonChart(series = [], totals = {}, periodLabel = '') {
  if (!finChartContainer) return;

  if (finChartTitle) {
    finChartTitle.textContent = `Evolución Mensual: Ingresos vs. Egresos y Pérdidas (${periodLabel})`;
  }
  if (finChartBadge) {
    finChartBadge.textContent = `${series.length} mes(es) analizado(s)`;
  }

  if (!series.length) {
    finChartContainer.innerHTML = `<div class="empty-cell">No hay datos financieros para el período seleccionado.</div>`;
    return;
  }

  const maxVal = Math.max(
    ...series.map((m) =>
      Math.max(
        Number(m.ingresos_brutos) || 0,
        Number(m.egresos_operativos_mes) || 0,
        Number(m.costo_perdida_total) || 0
      )
    ),
    1
  );

  const svgW = 680;
  const svgH = 225;
  const padL = 54;
  const padR = 20;
  const padT = 26;
  const padB = 40;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const groupW = plotW / series.length;

  const gridLevels = [0, 0.5, 1];
  const gridSvg = gridLevels
    .map((lvl) => {
      const gy = padT + plotH - lvl * plotH;
      const labelVal = formatCompactCurrency(lvl * maxVal);
      return `
        <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${svgW - padR}" y2="${gy.toFixed(1)}" stroke="rgba(148, 163, 184, 0.16)" stroke-dasharray="3 3" />
        <text x="${padL - 6}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9.5" font-family="monospace">${escapeHtml(labelVal)}</text>
      `;
    })
    .join('');

  const barsSvg = series
    .map((m, idx) => {
      const ing = Number(m.ingresos_brutos) || 0;
      const egr = Number(m.egresos_operativos_mes) || 0;
      const mer = Number(m.costo_perdida_total) || 0;

      const centerX = padL + groupW * idx + groupW / 2;
      const singleBarW = Math.max(6, Math.min(22, groupW * 0.24));
      const gap = 3;
      const totalClusterW = singleBarW * 3 + gap * 2;
      const startX = centerX - totalClusterW / 2;

      const hIng = Math.max((ing / maxVal) * plotH, ing > 0 ? 4 : 1.5);
      const yIng = padT + plotH - hIng;

      const hEgr = Math.max((egr / maxVal) * plotH, egr > 0 ? 4 : 1.5);
      const yEgr = padT + plotH - hEgr;

      const hMer = Math.max((mer / maxVal) * plotH, mer > 0 ? 4 : 1.5);
      const yMer = padT + plotH - hMer;

      return `
        <g class="chart-fin-group">
          <title>${escapeHtml(m.etiqueta_larga)} — Ingresos: ${formatCurrency(ing)} | Egresos: ${formatCurrency(egr)} | Pérdidas Merma: ${formatCurrency(mer)}</title>
          <rect x="${startX.toFixed(1)}" y="${yIng.toFixed(1)}" width="${singleBarW.toFixed(1)}" height="${hIng.toFixed(1)}" rx="3" fill="rgba(16, 185, 129, 0.55)" stroke="#10b981" stroke-width="1" />
          <rect x="${(startX + singleBarW + gap).toFixed(1)}" y="${yEgr.toFixed(1)}" width="${singleBarW.toFixed(1)}" height="${hEgr.toFixed(1)}" rx="3" fill="rgba(245, 158, 11, 0.52)" stroke="#f59e0b" stroke-width="1" />
          <rect x="${(startX + (singleBarW + gap) * 2).toFixed(1)}" y="${yMer.toFixed(1)}" width="${singleBarW.toFixed(1)}" height="${hMer.toFixed(1)}" rx="3" fill="rgba(239, 68, 68, 0.55)" stroke="#ef4444" stroke-width="1" />
          <text x="${centerX.toFixed(1)}" y="${svgH - 18}" text-anchor="middle" fill="${m.es_mes_actual ? '#60a5fa' : '#cbd5e1'}" font-size="9.5" font-weight="${m.es_mes_actual ? '700' : '500'}">${escapeHtml(m.etiqueta_corta)}</text>
          <text x="${centerX.toFixed(1)}" y="${svgH - 5}" text-anchor="middle" fill="#64748b" font-size="8.5" font-family="monospace">${ing > 0 ? escapeHtml(formatCompactCurrency(ing)) : '$0'}</text>
        </g>
      `;
    })
    .join('');

  const balanceGlobal = Number(totals.balance_flujo_caja) || 0;
  const balClass = balanceGlobal > 0 ? 'up' : balanceGlobal < 0 ? 'down' : 'neutral';
  const balSign = balanceGlobal > 0 ? '+' : '';

  finChartContainer.innerHTML = `
    <div class="trend-banner ${balClass}">
      <div class="trend-banner-main">
        <span class="trend-direction-pill ${balClass}">
          Balance Ingresos vs. Egresos: ${balSign}${formatCurrency(balanceGlobal)}
        </span>
        <span class="trend-banner-text">
          <strong>Ingresos:</strong> ${formatCurrency(totals.ingresos_brutos || 0)} ·
          <strong>Egresos:</strong> ${formatCurrency(totals.egresos_operativos_totales || 0)} ·
          <strong>Pérdidas Merma:</strong> ${formatCurrency(totals.costo_perdida_total || 0)}
        </span>
      </div>
      <div class="trend-legend">
        <span class="legend-item"><i class="legend-dot up"></i> Ingresos Brutos</span>
        <span class="legend-item"><i class="legend-dot" style="background: #f59e0b;"></i> Egresos / Costos</span>
        <span class="legend-item"><i class="legend-dot down"></i> Pérdidas Merma</span>
      </div>
    </div>

    <div class="svg-chart-wrapper">
      <svg viewBox="0 0 ${svgW} ${svgH}" class="comparison-svg-chart" role="img" aria-label="Gráfico comparativo de ingresos, egresos y mermas">
        ${gridSvg}
        ${barsSvg}
      </svg>
    </div>

    <div class="chart-summary-strip">
      <div class="chart-summary-item">
        <span class="chart-summary-label">Ingresos Brutos (${totals.periodMonths || 1}M)</span>
        <strong class="chart-summary-value text-emerald font-mono">${formatCurrency(totals.ingresos_brutos || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Egresos Operativos (${totals.periodMonths || 1}M)</span>
        <strong class="chart-summary-value text-amber font-mono">${formatCurrency(totals.egresos_operativos_totales || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Utilidad Neta Real (Tras Mermas)</span>
        <strong class="chart-summary-value ${Number(totals.utilidad_neta_despues_mermas) >= 0 ? 'text-emerald' : 'text-danger'} font-mono">${formatCurrency(totals.utilidad_neta_despues_mermas || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Pérdida Total por Mermas</span>
        <strong class="chart-summary-value text-danger font-mono">${formatCurrency(totals.costo_perdida_total || 0)}</strong>
      </div>
    </div>
  `;
}

function renderFinanceSection(data = {}) {
  const t = data.totals || {};
  const series = data.monthlySeries || [];
  const pLabel = data.periodLabel || 'Mes Actual';
  const pMonths = Number(data.periodMonths) || 1;
  const tagPeriodo = pMonths === 1 ? 'del Mes' : `(${pMonths} Meses)`;

  if (finPeriodSubtitle) {
    finPeriodSubtitle.textContent = `Mostrando ${pLabel}: ingresos y egresos por separado, balance de IVA (19%) y pérdidas por merma o baja de producto.`;
  }

  // 1. KPIs superiores
  if (finKpiIngresosLabel) finKpiIngresosLabel.textContent = `Ingresos ${tagPeriodo} (Bruto)`;
  if (finKpiIngresosMonto) finKpiIngresosMonto.textContent = formatCurrency(t.ingresos_brutos);
  if (finKpiIngresosMeta) {
    finKpiIngresosMeta.textContent = `Neto: ${formatCurrency(t.ventas_neto)} · ${t.cantidad_ventas || 0} venta(s) (${formatNumber(t.unidades_vendidas)} unid.)`;
  }

  if (finKpiEgresosLabel) finKpiEgresosLabel.textContent = `Egresos ${tagPeriodo} (Por Separado)`;
  if (finKpiEgresosMonto) finKpiEgresosMonto.textContent = formatCurrency(t.egresos_operativos_totales);
  if (finKpiEgresosMeta) {
    finKpiEgresosMeta.textContent = `Compras: ${formatCurrency(t.egresos_compras_bruto)} · Costo vtas: ${formatCurrency(t.costo_ventas_historico)}`;
  }

  if (finKpiIvaLabel) finKpiIvaLabel.textContent = `Balance de IVA ${tagPeriodo}`;
  const ivaPorPagar = Number(t.iva_neto_a_pagar) || 0;
  const ivaRemanente = Number(t.remanente_credito_iva) || 0;
  if (finKpiIvaMonto) {
    if (ivaRemanente > 0) {
      finKpiIvaMonto.textContent = `-${formatCurrency(ivaRemanente)}`;
      finKpiIvaMonto.className = 'kpi-value text-emerald';
    } else {
      finKpiIvaMonto.textContent = formatCurrency(ivaPorPagar);
      finKpiIvaMonto.className = 'kpi-value';
    }
  }
  if (finKpiIvaMeta) {
    finKpiIvaMeta.textContent = `Débito: ${formatCurrency(t.iva_debito_ventas)} · Crédito: ${formatCurrency(t.iva_credito_compras)}`;
  }

  if (finKpiMermaLabel) finKpiMermaLabel.textContent = `Pérdidas por Merma ${tagPeriodo}`;
  if (finKpiMermaMonto) finKpiMermaMonto.textContent = formatCurrency(t.costo_perdida_total);
  if (finKpiMermaMeta) {
    finKpiMermaMeta.textContent = `${t.eventos_perdida || 0} evento(s) · ${formatNumber(t.unidades_perdidas)} unid. dadas de baja`;
  }

  // 2. Gráfico comparativo mensual
  renderFinanceComparisonChart(series, t, pLabel);

  // 3. Panel Izquierdo: Ingresos por separado
  if (finIngresosBadge) finIngresosBadge.textContent = `${formatCurrency(t.ingresos_brutos)} bruto`;
  if (finIngNeto) finIngNeto.textContent = formatCurrency(t.ventas_neto);
  if (finIngIva) finIngIva.textContent = formatCurrency(t.iva_debito_ventas);
  if (finIngDescuentos) finIngDescuentos.textContent = `-${formatCurrency(t.descuento_global)}`;
  if (finIngTotalBruto) finIngTotalBruto.textContent = formatCurrency(t.ingresos_brutos);

  if (finIngresosBreakdownBody) {
    const docsRows = data.ventasPorTipoDoc || [];
    const pagosRows = data.ventasPorMetodoPago || [];
    const htmlRows = [];

    for (const d of docsRows) {
      htmlRows.push(`
        <tr>
          <td>
            <div class="cell-primary">Doc: ${escapeHtml(d.tipo_documento)}</div>
            <div class="cell-secondary">Documento tributario / interno</div>
          </td>
          <td class="text-right font-mono">${d.cantidad_docs} doc(s)</td>
          <td class="text-right font-mono">${formatCurrency(d.subtotal_neto)}</td>
          <td class="text-right font-mono">${formatCurrency(d.total_iva)}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(d.total_venta)}</td>
        </tr>
      `);
    }

    for (const p of pagosRows) {
      htmlRows.push(`
        <tr>
          <td>
            <div class="cell-primary">Pago: ${escapeHtml(p.metodo_pago)}</div>
            <div class="cell-secondary">Recaudación en caja (<code>pagos_venta</code>)</div>
          </td>
          <td class="text-right font-mono">${p.cantidad_ventas} vta(s)</td>
          <td class="text-right font-mono cell-secondary">—</td>
          <td class="text-right font-mono cell-secondary">—</td>
          <td class="text-right font-mono">${formatCurrency(p.monto_recaudado)}</td>
        </tr>
      `);
    }

    finIngresosBreakdownBody.innerHTML = htmlRows.length
      ? htmlRows.join('')
      : `<tr><td colspan="5" class="empty-cell">Sin ingresos registrados en este período.</td></tr>`;
  }

  // 4. Panel Derecho: Egresos por separado
  if (finEgresosBadge) finEgresosBadge.textContent = `${formatCurrency(t.egresos_operativos_totales)} egresos`;
  if (finEgrComprasNeto) finEgrComprasNeto.textContent = formatCurrency(t.compras_neto);
  if (finEgrComprasIva) finEgrComprasIva.textContent = formatCurrency(t.iva_credito_compras);
  if (finEgrComprasBruto) finEgrComprasBruto.textContent = formatCurrency(t.egresos_compras_bruto);
  if (finEgrKardexIn) finEgrKardexIn.textContent = formatCurrency(t.costo_entradas_kardex_sin_doc);
  if (finEgrCostoVentas) finEgrCostoVentas.textContent = formatCurrency(t.costo_ventas_historico);
  if (finEgrMermas) finEgrMermas.textContent = formatCurrency(t.costo_perdida_total);
  if (finEgrTotalConsolidado) finEgrTotalConsolidado.textContent = formatCurrency(t.egresos_operativos_totales);

  if (finEgresosBreakdownBody) {
    const comprasDocs = data.comprasPorTipoDoc || [];
    const egrRows = [];

    for (const c of comprasDocs) {
      egrRows.push(`
        <tr>
          <td>
            <div class="cell-primary">Compra: ${escapeHtml(c.tipo_documento)}</div>
            <div class="cell-secondary">Órdenes recibidas en tabla <code>compras</code></div>
          </td>
          <td class="text-right font-mono">${c.cantidad_docs} doc(s)</td>
          <td class="text-right font-mono">${formatCurrency(c.total_neto)}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(c.total_iva)}</td>
          <td class="text-right font-mono text-amber">${formatCurrency(c.total_compra)}</td>
        </tr>
      `);
    }

    if (Number(t.costo_entradas_kardex_sin_doc) > 0) {
      egrRows.push(`
        <tr>
          <td>
            <div class="cell-primary">Entradas de Bodega Directas (<code>ENTRADA_COMPRA</code>)</div>
            <div class="cell-secondary">Reposición de inventario registrada directamente en Kardex</div>
          </td>
          <td class="text-right font-mono">Kardex</td>
          <td class="text-right font-mono">${formatCurrency(t.costo_entradas_kardex_sin_doc)}</td>
          <td class="text-right font-mono cell-secondary">$0</td>
          <td class="text-right font-mono text-amber">${formatCurrency(t.costo_entradas_kardex_sin_doc)}</td>
        </tr>
      `);
    }

    if (Number(t.costo_ventas_historico) > 0) {
      egrRows.push(`
        <tr>
          <td>
            <div class="cell-primary">Costo Histórico de Mercadería Vendida</div>
            <div class="cell-secondary">Suma de <code>costo_unitario_historico * cantidad</code> en ventas</div>
          </td>
          <td class="text-right font-mono">${formatNumber(t.unidades_vendidas)} unid.</td>
          <td class="text-right font-mono">${formatCurrency(t.costo_ventas_historico)}</td>
          <td class="text-right font-mono cell-secondary">—</td>
          <td class="text-right font-mono">${formatCurrency(t.costo_ventas_historico)}</td>
        </tr>
      `);
    }

    if (Number(t.costo_perdida_total) > 0) {
      egrRows.push(`
        <tr>
          <td>
            <div class="cell-primary text-danger">Pérdidas por Merma / Baja de Producto</div>
            <div class="cell-secondary">Merma (${formatCurrency(t.costo_merma)}) + Ajuste Negativo (${formatCurrency(t.costo_ajuste_negativo)})</div>
          </td>
          <td class="text-right font-mono">${t.eventos_perdida} baja(s)</td>
          <td class="text-right font-mono text-danger">${formatCurrency(t.costo_perdida_total)}</td>
          <td class="text-right font-mono text-danger">${formatCurrency(t.iva_estimado_perdida)}</td>
          <td class="text-right font-mono text-danger">${formatCurrency(t.costo_perdida_total)}</td>
        </tr>
      `);
    }

    finEgresosBreakdownBody.innerHTML = egrRows.length
      ? egrRows.join('')
      : `<tr><td colspan="5" class="empty-cell">Sin egresos ni costos registrados en este período.</td></tr>`;
  }

  // 5. Tabla Mensual Desglosada (1, 3, 6 o 12 meses)
  if (finMonthlyTableBadge) {
    finMonthlyTableBadge.textContent = `${series.length} mes(es)`;
  }
  if (finMonthlyTableBody) {
    if (!series.length) {
      finMonthlyTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">No hay períodos mensuales para mostrar.</td></tr>`;
    } else {
      finMonthlyTableBody.innerHTML = series
        .slice()
        .reverse()
        .map((m) => {
          const utilClass =
            Number(m.utilidad_neta_despues_mermas) > 0
              ? 'text-emerald'
              : Number(m.utilidad_neta_despues_mermas) < 0
              ? 'text-danger'
              : '';
          return `
            <tr>
              <td>
                <div class="cell-primary">${escapeHtml(m.etiqueta_larga)} ${m.es_mes_actual ? '<span class="status-tag info">Actual</span>' : ''}</div>
                <div class="cell-secondary">${m.cantidad_ventas} venta(s) · ${m.cantidad_compras} compra(s) · ${m.eventos_perdida} merma(s)</div>
              </td>
              <td class="text-right font-mono">${formatCurrency(m.ventas_neto)}</td>
              <td class="text-right font-mono text-amber">${formatCurrency(m.iva_debito_ventas)}</td>
              <td class="text-right font-mono text-emerald"><strong>${formatCurrency(m.ingresos_brutos)}</strong></td>
              <td class="text-right font-mono text-amber">${formatCurrency(m.adquisicion_inventario_mes)}</td>
              <td class="text-right font-mono text-emerald">${formatCurrency(m.iva_credito_compras)}</td>
              <td class="text-right font-mono">${formatCurrency(m.costo_ventas_historico)}</td>
              <td class="text-right font-mono ${Number(m.costo_perdida_total) > 0 ? 'text-danger' : ''}">${formatCurrency(m.costo_perdida_total)}</td>
              <td class="text-right font-mono ${utilClass}"><strong>${formatCurrency(m.utilidad_neta_despues_mermas)}</strong></td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 6. Estado de IVA y Resumen de Pérdidas por Tipo
  if (finTaxIvaDebito) finTaxIvaDebito.textContent = formatCurrency(t.iva_debito_ventas);
  if (finTaxIvaCredito) finTaxIvaCredito.textContent = formatCurrency(t.iva_credito_compras);
  if (finTaxIvaMerma) finTaxIvaMerma.textContent = formatCurrency(t.iva_estimado_perdida);

  if (ivaRemanente > 0) {
    if (finIvaStatusBadge) {
      finIvaStatusBadge.textContent = 'Remanente Crédito Fiscal a Favor';
      finIvaStatusBadge.className = 'panel-badge success-badge';
    }
    if (finTaxIvaResultadoLabel) {
      finTaxIvaResultadoLabel.textContent = 'Remanente de Crédito Fiscal IVA a Favor:';
    }
    if (finTaxIvaResultadoValor) {
      finTaxIvaResultadoValor.textContent = formatCurrency(ivaRemanente);
    }
    if (finTaxIvaResultadoRow) {
      finTaxIvaResultadoRow.style.color = '#34d399';
    }
  } else {
    if (finIvaStatusBadge) {
      finIvaStatusBadge.textContent = ivaPorPagar > 0 ? 'IVA Neto a Pagar (F29)' : 'IVA en $0';
      finIvaStatusBadge.className = ivaPorPagar > 0 ? 'panel-badge warning' : 'panel-badge info';
    }
    if (finTaxIvaResultadoLabel) {
      finTaxIvaResultadoLabel.textContent = 'IVA Neto Determinado a Pagar (Débito - Crédito):';
    }
    if (finTaxIvaResultadoValor) {
      finTaxIvaResultadoValor.textContent = formatCurrency(ivaPorPagar);
    }
    if (finTaxIvaResultadoRow) {
      finTaxIvaResultadoRow.style.color = ivaPorPagar > 0 ? '#fbbf24' : '#34d399';
    }
  }

  if (finLossByTypeBody) {
    const lossTypes = data.resumenPerdidasPorTipo || [];
    if (!lossTypes.length) {
      finLossByTypeBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">No se registran mermas ni bajas de producto (<code>MERMA</code> / <code>AJUSTE_NEGATIVO</code>) en este período.</td>
        </tr>
      `;
    } else {
      finLossByTypeBody.innerHTML = lossTypes
        .map((lt) => {
          const badgeClass = lt.tipo_movimiento === 'MERMA' ? 'danger' : 'warning';
          const labelTipo =
            lt.tipo_movimiento === 'MERMA'
              ? 'MERMA (Daño / Vencimiento / Robo)'
              : 'AJUSTE_NEGATIVO (Faltante de Inventario)';
          return `
            <tr>
              <td>
                <span class="status-tag ${badgeClass}">${escapeHtml(lt.tipo_movimiento)}</span>
                <div class="cell-secondary">${escapeHtml(labelTipo)}</div>
              </td>
              <td class="text-right font-mono">${lt.cantidad_eventos} evento(s)</td>
              <td class="text-right font-mono">${formatNumber(lt.total_unidades)} unid.</td>
              <td class="text-right font-mono text-danger"><strong>${formatCurrency(lt.costo_neto_perdido)}</strong></td>
              <td class="text-right font-mono text-amber">${formatCurrency(lt.ingreso_potencial_no_percibido)}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // 7. Historial detallado de pérdidas por merma o pérdida de producto
  if (finMermaTotalBadge) {
    finMermaTotalBadge.textContent = `${formatCurrency(t.costo_perdida_total)} en pérdidas (${t.eventos_perdida || 0})`;
  }
  if (finMermaHistoryBody) {
    const lossItems = data.detalleMovimientosPerdida || [];
    if (!lossItems.length) {
      finMermaHistoryBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">Sin movimientos de merma o pérdida de productos en el período seleccionado.</td>
        </tr>
      `;
    } else {
      finMermaHistoryBody.innerHTML = lossItems
        .map((item) => {
          const tagClass = item.tipo_movimiento === 'MERMA' ? 'danger' : 'warning';
          return `
            <tr>
              <td>
                <div class="cell-primary font-mono">${escapeHtml(item.fecha)}</div>
                <div><span class="status-tag ${tagClass}">${escapeHtml(item.tipo_movimiento)}</span></div>
              </td>
              <td>
                <div class="cell-primary">${escapeHtml(item.producto_nombre)}</div>
                <div class="cell-secondary">SKU: ${escapeHtml(item.producto_sku || `ID #${item.id_producto}`)}</div>
              </td>
              <td>
                <div class="cell-primary">${escapeHtml(item.motivo || 'Sin motivo')}</div>
                <div class="cell-secondary">${escapeHtml(item.referencia_origen || 'Kardex')} · ${escapeHtml(item.usuario_nombre)}</div>
              </td>
              <td class="text-right font-mono">-${formatNumber(item.cantidad)} ${escapeHtml(item.unidad_medida)}</td>
              <td class="text-right font-mono">${formatCurrency(item.costo_unitario_aplicado)}</td>
              <td class="text-right font-mono text-danger"><strong>${formatCurrency(item.costo_total_perdida)}</strong></td>
            </tr>
          `;
        })
        .join('');
    }
  }
}

export async function loadFinanceSection(months = activeFinanceMonths) {
  activeFinanceMonths = [1, 3, 6, 12].includes(Number(months)) ? Number(months) : 1;

  financePeriodBtns.forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.finMonths) === activeFinanceMonths);
  });

  if (refreshFinanceBtn) {
    refreshFinanceBtn.disabled = true;
    refreshFinanceBtn.textContent = 'Actualizando...';
  }

  try {
    const data = await window.LocalSqliteEngine.getFinanceSectionData({
      meses: activeFinanceMonths,
    });
    if (data.database?.originalName) {
      updateNavDbLabel(data.database);
    }
    renderFinanceSection(data);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
  } finally {
    if (refreshFinanceBtn) {
      refreshFinanceBtn.disabled = false;
      refreshFinanceBtn.textContent = 'Actualizar finanzas';
    }
  }
}

export function initFinanzasModule() {
  financePeriodBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedMonths = Number(btn.dataset.finMonths) || 1;
      loadFinanceSection(selectedMonths);
    });
  });

  if (refreshFinanceBtn) {
    refreshFinanceBtn.addEventListener('click', () => loadFinanceSection(activeFinanceMonths));
  }
}
