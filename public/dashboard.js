const navDbName = document.getElementById('navDbName');
const refreshBtn = document.getElementById('refreshBtn');

const kpiHoyLabel = document.getElementById('kpiHoyLabel');
const kpiHoyMonto = document.getElementById('kpiHoyMonto');
const kpiHoyCantidad = document.getElementById('kpiHoyCantidad');
const kpiMesLabel = document.getElementById('kpiMesLabel');
const kpiMesMonto = document.getElementById('kpiMesMonto');
const kpiMesCantidad = document.getElementById('kpiMesCantidad');
const kpiAnioLabel = document.getElementById('kpiAnioLabel');
const kpiTotalMonto = document.getElementById('kpiTotalMonto');
const kpiUtilidad = document.getElementById('kpiUtilidad');
const kpiStockBajo = document.getElementById('kpiStockBajo');
const kpiTotalProductos = document.getElementById('kpiTotalProductos');

const annualIncomeTitle = document.getElementById('annualIncomeTitle');
const annualIncomeBadge = document.getElementById('annualIncomeBadge');
const annualIncomeChartContainer = document.getElementById('annualIncomeChartContainer');

const monthCompTitle = document.getElementById('monthCompTitle');
const monthCompSubtitle = document.getElementById('monthCompSubtitle');
const monthCompBadge = document.getElementById('monthCompBadge');
const monthCompChartContainer = document.getElementById('monthCompChartContainer');

const lowStockBadge = document.getElementById('lowStockBadge');
const lowStockTableBody = document.getElementById('lowStockTableBody');
const countStockAll = document.getElementById('countStockAll');
const countStockCritico = document.getElementById('countStockCritico');
const countStockPrecaucion = document.getElementById('countStockPrecaucion');
const countStockSugerencia = document.getElementById('countStockSugerencia');
const stockTabButtons = document.querySelectorAll('.stock-tab-btn');

const topProductsBadge = document.getElementById('topProductsBadge');
const topProductsTableBody = document.getElementById('topProductsTableBody');
const recentSalesTableBody = document.getElementById('recentSalesTableBody');

let cachedDashboardStockAlerts = [];
let activeStockAlertFilter = 'ALL';

const sectionInicio = document.getElementById('section-inicio');
const sectionInventario = document.getElementById('section-inventario');
const sectionVentas = document.getElementById('section-ventas');
const sectionKardex = document.getElementById('section-kardex');
const sectionClientes = document.getElementById('section-clientes');
const sectionPlaceholder = document.getElementById('section-placeholder');
const moduleTitle = document.getElementById('moduleTitle');
const moduleDesc = document.getElementById('moduleDesc');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const navLinks = document.querySelectorAll('.nav-link');
const downloadActiveDbBtn = document.getElementById('downloadActiveDbBtn');
const closeDbSessionBtn = document.getElementById('closeDbSessionBtn');

// Elementos de la sección Inventario
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

const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatCurrency(val) {
  return currencyFormatter.format(Number(val) || 0);
}

function formatNumber(val) {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCompactCurrency(val) {
  const num = Number(val) || 0;
  if (Math.abs(num) >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `$${Math.round(num / 1000)}k`;
  }
  return `$${Math.round(num)}`;
}

function getTrendMeta(actualVal, prevVal) {
  const act = Number(actualVal) || 0;
  const prev = Number(prevVal) || 0;
  const diff = act - prev;

  if (prev === 0 && act === 0) {
    return {
      direction: 'flat',
      label: 'Sin variación',
      shortLabel: '0%',
      pct: 0,
      diff: 0,
      colorClass: 'neutral',
      strokeColor: '#94a3b8',
      arrow: '→',
    };
  }
  if (prev === 0 && act > 0) {
    return {
      direction: 'up',
      label: 'En Ascenso',
      shortLabel: '+100%',
      pct: 100,
      diff,
      colorClass: 'up',
      strokeColor: '#10b981',
      arrow: '▲',
    };
  }

  const pct = ((act - prev) / Math.abs(prev)) * 100;
  if (diff > 0) {
    return {
      direction: 'up',
      label: 'En Ascenso',
      shortLabel: `+${pct.toFixed(1)}%`,
      pct,
      diff,
      colorClass: 'up',
      strokeColor: '#10b981',
      arrow: '▲',
    };
  }
  if (diff < 0) {
    return {
      direction: 'down',
      label: 'En Descenso',
      shortLabel: `${pct.toFixed(1)}%`,
      pct,
      diff,
      colorClass: 'down',
      strokeColor: '#ef4444',
      arrow: '▼',
    };
  }
  return {
    direction: 'flat',
    label: 'Estable',
    shortLabel: '0.0%',
    pct: 0,
    diff: 0,
    colorClass: 'neutral',
    strokeColor: '#94a3b8',
    arrow: '→',
  };
}

function renderAnnualIncomeTable(months = [], totals = {}, periodInfo = {}) {
  const anio = periodInfo.anioActual || totals.anio || new Date().getFullYear();
  if (annualIncomeTitle) {
    annualIncomeTitle.textContent = `Gráfico de Ingresos del Año (${anio})`;
  }
  if (annualIncomeBadge) {
    annualIncomeBadge.textContent = `${formatCurrency(totals.total_venta || 0)} en ${anio}`;
  }

  if (!annualIncomeChartContainer) return;

  if (!months.length) {
    annualIncomeChartContainer.innerHTML = `
      <div class="empty-cell">No hay datos de ingresos anuales disponibles.</div>
    `;
    return;
  }

  const currentIdx = months.findIndex((m) => m.es_mes_actual);
  const activeIdx = currentIdx >= 0 ? currentIdx : months.length - 1;
  const currentMonthObj = months[activeIdx] || { mes_nombre: 'Actual', total_venta: 0 };
  const prevMonthObj = activeIdx > 0 ? months[activeIdx - 1] : { mes_nombre: 'Anterior', total_venta: 0 };
  const annualTrend = getTrendMeta(currentMonthObj.total_venta, prevMonthObj.total_venta);

  const maxVenta = Math.max(...months.map((m) => Number(m.total_venta) || 0), 1);
  const mejorMes = months.reduce(
    (best, m) => ((Number(m.total_venta) || 0) > (Number(best.total_venta) || 0) ? m : best),
    months[0]
  );

  // Dimensiones del gráfico SVG
  const svgW = 640;
  const svgH = 230;
  const padL = 48;
  const padR = 20;
  const padT = 28;
  const padB = 38;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const stepX = plotW / months.length;

  const points = months.map((m, idx) => {
    const val = Number(m.total_venta) || 0;
    const util = Number(m.utilidad_estimada) || 0;
    const x = padL + stepX * idx + stepX / 2;
    const ratio = maxVenta > 0 ? val / maxVenta : 0;
    const y = padT + plotH - ratio * plotH;
    const barH = Math.max(ratio * plotH, val > 0 ? 4 : 1);
    const barY = padT + plotH - barH;

    const prevVal = idx > 0 ? Number(months[idx - 1].total_venta) || 0 : val;
    const stepTrend = idx === 0 ? 'flat' : val > prevVal ? 'up' : val < prevVal ? 'down' : 'flat';

    return {
      ...m,
      idx,
      val,
      util,
      x,
      y,
      barH,
      barY,
      stepTrend,
      shortName: String(m.mes_nombre || '').slice(0, 3),
    };
  });

  // Polilínea de tendencia hasta el último mes con movimiento o mes actual
  const lastLineIdx = Math.max(
    activeIdx,
    points.reduce((acc, p, i) => (p.val > 0 ? i : acc), 0)
  );
  const linePoints = points.slice(0, lastLineIdx + 1);
  const polylineCoords = linePoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaCoords =
    linePoints.length > 1
      ? `${linePoints[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} ${polylineCoords} ${linePoints[
          linePoints.length - 1
        ].x.toFixed(1)},${(padT + plotH).toFixed(1)}`
      : '';

  // Líneas guía horizontales
  const gridLevels = [0, 0.5, 1];
  const gridSvg = gridLevels
    .map((lvl) => {
      const gy = padT + plotH - lvl * plotH;
      const labelVal = formatCompactCurrency(lvl * maxVenta);
      return `
        <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${svgW - padR}" y2="${gy.toFixed(1)}" stroke="rgba(148, 163, 184, 0.16)" stroke-dasharray="3 3" />
        <text x="${padL - 6}" y="${(gy + 4).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="monospace">${escapeHtml(labelVal)}</text>
      `;
    })
    .join('');

  // Segmentos coloreados según ascenso (verde) o descenso (rojo) entre cada mes
  const segmentsSvg = linePoints
    .slice(1)
    .map((curr, i) => {
      const prev = linePoints[i];
      const segColor =
        curr.val > prev.val ? '#10b981' : curr.val < prev.val ? '#ef4444' : '#60a5fa';
      return `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${curr.x.toFixed(1)}" y2="${curr.y.toFixed(1)}" stroke="${segColor}" stroke-width="2.8" stroke-linecap="round" />`;
    })
    .join('');

  // Barras y nodos de cada mes
  const barsAndNodesSvg = points
    .map((p) => {
      const barWidth = Math.min(26, stepX * 0.58);
      const bx = p.x - barWidth / 2;
      const barFill = p.es_mes_actual
        ? 'rgba(59, 130, 246, 0.45)'
        : p.stepTrend === 'up'
        ? 'rgba(16, 185, 129, 0.28)'
        : p.stepTrend === 'down'
        ? 'rgba(239, 68, 68, 0.25)'
        : 'rgba(148, 163, 184, 0.18)';
      const barStroke = p.es_mes_actual
        ? '#60a5fa'
        : p.stepTrend === 'up'
        ? '#10b981'
        : p.stepTrend === 'down'
        ? '#ef4444'
        : '#475569';

      const nodeColor =
        p.stepTrend === 'up' ? '#10b981' : p.stepTrend === 'down' ? '#ef4444' : '#60a5fa';
      const showNode = p.idx <= lastLineIdx;
      const arrowGlyph =
        p.idx > 0 && p.idx <= lastLineIdx && (p.val > 0 || points[p.idx - 1].val > 0)
          ? p.stepTrend === 'up'
            ? '▲'
            : p.stepTrend === 'down'
            ? '▼'
            : ''
          : '';

      return `
        <g class="chart-month-group">
          <title>${escapeHtml(p.mes_nombre)} ${escapeHtml(anio)}: ${formatCurrency(p.val)} (${p.cantidad_ventas} ventas · Utilidad: ${formatCurrency(p.util)})</title>
          <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="4" fill="${barFill}" stroke="${barStroke}" stroke-width="1" />
          ${
            showNode
              ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.es_mes_actual ? 5 : 3.8}" fill="${nodeColor}" stroke="#0f172a" stroke-width="1.5" />`
              : ''
          }
          ${
            arrowGlyph
              ? `<text x="${p.x.toFixed(1)}" y="${Math.max(12, p.y - 8).toFixed(1)}" text-anchor="middle" fill="${nodeColor}" font-size="9" font-weight="700">${arrowGlyph}</text>`
              : ''
          }
          <text x="${p.x.toFixed(1)}" y="${svgH - 18}" text-anchor="middle" fill="${p.es_mes_actual ? '#60a5fa' : '#cbd5e1'}" font-size="10.5" font-weight="${p.es_mes_actual ? '700' : '500'}">${escapeHtml(p.shortName)}</text>
          <text x="${p.x.toFixed(1)}" y="${svgH - 5}" text-anchor="middle" fill="#64748b" font-size="9" font-family="monospace">${p.val > 0 ? escapeHtml(formatCompactCurrency(p.val)) : '$0'}</text>
        </g>
      `;
    })
    .join('');

  annualIncomeChartContainer.innerHTML = `
    <div class="trend-banner ${annualTrend.colorClass}">
      <div class="trend-banner-main">
        <span class="trend-direction-pill ${annualTrend.colorClass}">
          ${annualTrend.arrow} ${escapeHtml(annualTrend.label)} (${escapeHtml(annualTrend.shortLabel)})
        </span>
        <span class="trend-banner-text">
          <strong>${escapeHtml(currentMonthObj.mes_nombre)}:</strong> ${formatCurrency(currentMonthObj.total_venta)}
          vs. <strong>${escapeHtml(prevMonthObj.mes_nombre)}:</strong> ${formatCurrency(prevMonthObj.total_venta)}
        </span>
      </div>
      <div class="trend-legend">
        <span class="legend-item"><i class="legend-dot up"></i> Ascenso (▲)</span>
        <span class="legend-item"><i class="legend-dot down"></i> Descenso (▼)</span>
        <span class="legend-item"><i class="legend-dot current"></i> Mes Actual</span>
      </div>
    </div>

    <div class="svg-chart-wrapper">
      <svg viewBox="0 0 ${svgW} ${svgH}" class="comparison-svg-chart" role="img" aria-label="Gráfico de evolución anual de ingresos">
        <defs>
          <linearGradient id="annualAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${annualTrend.strokeColor}" stop-opacity="0.26" />
            <stop offset="100%" stop-color="${annualTrend.strokeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridSvg}
        ${areaCoords ? `<polygon points="${areaCoords}" fill="url(#annualAreaGrad)" />` : ''}
        ${segmentsSvg}
        ${barsAndNodesSvg}
      </svg>
    </div>

    <div class="chart-summary-strip">
      <div class="chart-summary-item">
        <span class="chart-summary-label">Total Ingresos ${escapeHtml(anio)}</span>
        <strong class="chart-summary-value text-emerald font-mono">${formatCurrency(totals.total_venta || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Utilidad Est. ${escapeHtml(anio)}</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(totals.utilidad_estimada || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Ventas Completadas</span>
        <strong class="chart-summary-value font-mono">${totals.cantidad_ventas || 0} doc(s)</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Mejor Mes (${escapeHtml(mejorMes?.mes_nombre || '—')})</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(mejorMes?.total_venta || 0)}</strong>
      </div>
    </div>
  `;
}

function renderMonthComparisonTable(comp = {}) {
  const mesActualLabel = comp.mesActualLabel || 'Mes Actual';
  const mesPasadoLabel = comp.mesPasadoLabel || 'Mes Pasado';
  const mesActualNombre = comp.mesActualNombre || 'Mes Actual';
  const mesPasadoNombre = comp.mesPasadoNombre || 'Mes Pasado';
  const act = comp.actual || {};
  const pas = comp.pasado || {};

  if (monthCompTitle) {
    monthCompTitle.textContent = `Gráfico Comparativo: ${mesActualNombre} vs. ${mesPasadoNombre}`;
  }
  if (monthCompSubtitle) {
    monthCompSubtitle.textContent = `Curva de ascenso o descenso entre ${mesPasadoLabel} y ${mesActualLabel}`;
  }

  const mainTrend = getTrendMeta(act.total_venta || 0, pas.total_venta || 0);
  if (monthCompBadge) {
    monthCompBadge.textContent = `${mainTrend.arrow} ${mainTrend.label} (${mainTrend.shortLabel})`;
    monthCompBadge.className =
      mainTrend.direction === 'up'
        ? 'panel-badge success-badge'
        : mainTrend.direction === 'down'
        ? 'panel-badge danger'
        : 'panel-badge info';
  }

  if (!monthCompChartContainer) return;

  // Mini gráfico SVG de pendiente (Slope Chart) para Ingresos Totales y Utilidad
  const maxMain = Math.max(
    Number(pas.total_venta) || 0,
    Number(act.total_venta) || 0,
    1
  );
  const slopeW = 560;
  const slopeH = 128;
  const xLeft = 135;
  const xRight = slopeW - 135;
  const yTop = 24;
  const yBot = slopeH - 28;
  const plotSlopeH = yBot - yTop;

  const yPasVenta = yBot - ((Number(pas.total_venta) || 0) / maxMain) * plotSlopeH;
  const yActVenta = yBot - ((Number(act.total_venta) || 0) / maxMain) * plotSlopeH;

  const yPasUtil = yBot - (Math.max(0, Number(pas.utilidad_estimada) || 0) / maxMain) * plotSlopeH;
  const yActUtil = yBot - (Math.max(0, Number(act.utilidad_estimada) || 0) / maxMain) * plotSlopeH;

  const diffSign = mainTrend.diff > 0 ? '+' : '';

  const metrics = [
    {
      label: 'Ingresos Totales (Bruto)',
      pasado: Number(pas.total_venta) || 0,
      actual: Number(act.total_venta) || 0,
      format: formatCurrency,
    },
    {
      label: 'Ventas Netas (Sin IVA)',
      pasado: Number(pas.subtotal_neto) || 0,
      actual: Number(act.subtotal_neto) || 0,
      format: formatCurrency,
    },
    {
      label: 'Utilidad Estimada (Histórica)',
      pasado: Number(pas.utilidad_estimada) || 0,
      actual: Number(act.utilidad_estimada) || 0,
      format: formatCurrency,
    },
    {
      label: 'Ticket Promedio',
      pasado: Number(pas.ticket_promedio) || 0,
      actual: Number(act.ticket_promedio) || 0,
      format: formatCurrency,
    },
    {
      label: 'Cantidad de Ventas (Docs)',
      pasado: Number(pas.cantidad_ventas) || 0,
      actual: Number(act.cantidad_ventas) || 0,
      format: (v) => `${Math.round(Number(v) || 0)} vta(s)`,
    },
    {
      label: 'Unidades Vendidas',
      pasado: Number(pas.unidades_vendidas) || 0,
      actual: Number(act.unidades_vendidas) || 0,
      format: (v) => `${formatNumber(v)} unid.`,
    },
  ];

  const barsHtml = metrics
    .map((m) => {
      const t = getTrendMeta(m.actual, m.pasado);
      const maxVal = Math.max(Math.abs(m.pasado), Math.abs(m.actual), 1);
      const pasPct = Math.min(100, Math.max(4, (Math.abs(m.pasado) / maxVal) * 100));
      const actPct = Math.min(100, Math.max(4, (Math.abs(m.actual) / maxVal) * 100));
      const dSign = t.diff > 0 ? '+' : '';
      const diffFormatted = m.format(t.diff);

      return `
        <div class="comp-metric-card">
          <div class="comp-metric-header">
            <span class="comp-metric-title">${escapeHtml(m.label)}</span>
            <span class="trend-direction-pill sm ${t.colorClass}">
              ${t.arrow} ${escapeHtml(t.label)} (${escapeHtml(t.shortLabel)} · ${dSign}${escapeHtml(diffFormatted)})
            </span>
          </div>
          <div class="comp-bars-pair">
            <div class="comp-bar-row">
              <span class="comp-bar-period">${escapeHtml(mesPasadoNombre)}</span>
              <div class="comp-bar-track">
                <div class="comp-bar-fill prev" style="width: ${m.pasado > 0 ? pasPct.toFixed(1) : 0}%"></div>
              </div>
              <span class="comp-bar-amount font-mono">${escapeHtml(m.format(m.pasado))}</span>
            </div>
            <div class="comp-bar-row">
              <span class="comp-bar-period current">${escapeHtml(mesActualNombre)}</span>
              <div class="comp-bar-track">
                <div class="comp-bar-fill ${t.colorClass}" style="width: ${m.actual > 0 ? actPct.toFixed(1) : 0}%"></div>
              </div>
              <span class="comp-bar-amount font-mono current">${escapeHtml(m.format(m.actual))}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  monthCompChartContainer.innerHTML = `
    <div class="trend-banner ${mainTrend.colorClass}">
      <div class="trend-banner-main">
        <span class="trend-direction-pill ${mainTrend.colorClass}">
          ${mainTrend.arrow} Ingresos ${escapeHtml(mainTrend.label)} (${escapeHtml(mainTrend.shortLabel)})
        </span>
        <span class="trend-banner-text">
          Diferencia vs. ${escapeHtml(mesPasadoNombre)}:
          <strong class="font-mono">${diffSign}${formatCurrency(mainTrend.diff)}</strong>
        </span>
      </div>
    </div>

    <div class="svg-chart-wrapper slope-chart-wrapper">
      <svg viewBox="0 0 ${slopeW} ${slopeH}" class="comparison-svg-chart" role="img" aria-label="Curva de ascenso o descenso entre mes pasado y mes actual">
        <line x1="${xLeft}" y1="${yTop}" x2="${xLeft}" y2="${yBot}" stroke="rgba(148, 163, 184, 0.25)" stroke-dasharray="3 3" />
        <line x1="${xRight}" y1="${yTop}" x2="${xRight}" y2="${yBot}" stroke="rgba(148, 163, 184, 0.25)" stroke-dasharray="3 3" />

        <!-- Línea de Utilidad Estimada -->
        <line x1="${xLeft}" y1="${yPasUtil.toFixed(1)}" x2="${xRight}" y2="${yActUtil.toFixed(1)}" stroke="#a855f7" stroke-width="2" stroke-dasharray="4 3" />
        <circle cx="${xLeft}" cy="${yPasUtil.toFixed(1)}" r="4" fill="#a855f7" />
        <circle cx="${xRight}" cy="${yActUtil.toFixed(1)}" r="4" fill="#a855f7" />

        <!-- Línea principal de Ingresos (Ascenso / Descenso) -->
        <line x1="${xLeft}" y1="${yPasVenta.toFixed(1)}" x2="${xRight}" y2="${yActVenta.toFixed(1)}" stroke="${mainTrend.strokeColor}" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="${xLeft}" cy="${yPasVenta.toFixed(1)}" r="5.5" fill="#94a3b8" stroke="#0f172a" stroke-width="1.5" />
        <circle cx="${xRight}" cy="${yActVenta.toFixed(1)}" r="6.5" fill="${mainTrend.strokeColor}" stroke="#0f172a" stroke-width="1.5" />

        <!-- Etiquetas Izquierda (Mes Pasado) -->
        <text x="${xLeft - 12}" y="${yPasVenta.toFixed(1)}" text-anchor="end" fill="#e2e8f0" font-size="11" font-weight="700" font-family="monospace">${escapeHtml(formatCurrency(pas.total_venta || 0))}</text>
        <text x="${xLeft}" y="${slopeH - 7}" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="600">${escapeHtml(mesPasadoLabel)}</text>

        <!-- Etiqueta central de pendiente -->
        <text x="${(xLeft + xRight) / 2}" y="${((yPasVenta + yActVenta) / 2 - 10).toFixed(1)}" text-anchor="middle" fill="${mainTrend.strokeColor}" font-size="11.5" font-weight="700">
          ${mainTrend.arrow} ${escapeHtml(mainTrend.label)} (${escapeHtml(mainTrend.shortLabel)})
        </text>

        <!-- Etiquetas Derecha (Mes Actual) -->
        <text x="${xRight + 12}" y="${yActVenta.toFixed(1)}" text-anchor="start" fill="${mainTrend.strokeColor}" font-size="11.5" font-weight="700" font-family="monospace">${escapeHtml(formatCurrency(act.total_venta || 0))}</text>
        <text x="${xRight}" y="${slopeH - 7}" text-anchor="middle" fill="#60a5fa" font-size="11" font-weight="700">${escapeHtml(mesActualLabel)}</text>
      </svg>
    </div>

    <div class="comp-metrics-grid">
      ${barsHtml}
    </div>
  `;
}

function renderLowStock(products = [], summary = {}) {
  cachedDashboardStockAlerts = Array.isArray(products) ? products : [];

  const criticoCount =
    summary.stockCriticoCount ??
    cachedDashboardStockAlerts.filter((p) => p.categoria_aviso === 'CRITICO').length;
  const precaucionCount =
    summary.stockPrecaucionCount ??
    cachedDashboardStockAlerts.filter((p) => p.categoria_aviso === 'PRECAUCION').length;
  const sugerenciaCount =
    summary.stockSugerenciaCount ??
    cachedDashboardStockAlerts.filter((p) => p.categoria_aviso === 'SUGERENCIA').length;
  const totalAvisos = criticoCount + precaucionCount + sugerenciaCount;

  if (countStockAll) countStockAll.textContent = String(cachedDashboardStockAlerts.length);
  if (countStockCritico) countStockCritico.textContent = String(criticoCount);
  if (countStockPrecaucion) countStockPrecaucion.textContent = String(precaucionCount);
  if (countStockSugerencia) countStockSugerencia.textContent = String(sugerenciaCount);

  lowStockBadge.textContent = `${totalAvisos} aviso(s): ${criticoCount} crít. · ${precaucionCount} prec. · ${sugerenciaCount} sug.`;
  lowStockBadge.className =
    criticoCount > 0
      ? 'panel-badge danger'
      : precaucionCount > 0
      ? 'panel-badge warning'
      : 'panel-badge info';

  const filtered =
    activeStockAlertFilter === 'ALL'
      ? cachedDashboardStockAlerts
      : cachedDashboardStockAlerts.filter((p) => p.categoria_aviso === activeStockAlertFilter);

  if (!filtered.length) {
    const emptyMsg =
      activeStockAlertFilter === 'ALL'
        ? 'No hay productos en rango de aviso de stock (Crítico, Precaución o Sugerencia).'
        : `No hay productos en la categoría "${activeStockAlertFilter}" en este momento.`;
    lowStockTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">${escapeHtml(emptyMsg)}</td>
      </tr>
    `;
    return;
  }

  lowStockTableBody.innerHTML = filtered
    .map((p) => {
      const stockActual = Number(p.stock_actual) || 0;
      const stockMinimo = Number(p.stock_minimo) || 0;
      const diff = stockActual - stockMinimo;
      const diffSign = diff > 0 ? '+' : '';
      const pisoCritico = Math.max(0, stockMinimo - 7);
      const techoSugerencia = stockMinimo + 7;

      let statusBadge = '';
      let diffClass = '';
      if (p.categoria_aviso === 'CRITICO') {
        statusBadge =
          stockActual <= 0
            ? '<span class="status-tag danger">Crítico (Agotado)</span>'
            : '<span class="status-tag danger">Crítico (-7 mín.)</span>';
        diffClass = 'text-danger';
      } else if (p.categoria_aviso === 'PRECAUCION') {
        statusBadge = '<span class="status-tag warning">Precaución (Bajo/En mín.)</span>';
        diffClass = 'text-amber';
      } else {
        statusBadge = '<span class="status-tag info">Sugerencia (+7 mín.)</span>';
        diffClass = 'text-emerald';
      }

      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">${escapeHtml(p.sku || p.codigo_barras || `ID #${p.id_producto}`)}</div>
          </td>
          <td>${escapeHtml(p.categoria)}</td>
          <td class="text-right font-mono"><strong>${formatNumber(stockActual)}</strong> ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono">
            <div>${formatNumber(stockMinimo)} ${escapeHtml(p.unidad_medida)}</div>
            <div class="cell-secondary">Rango: ${formatNumber(pisoCritico)} a ${formatNumber(techoSugerencia)}</div>
          </td>
          <td class="text-right font-mono ${diffClass}">${diffSign}${formatNumber(diff)} ${escapeHtml(p.unidad_medida)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    })
    .join('');
}

stockTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeStockAlertFilter = btn.dataset.alertFilter || 'ALL';
    stockTabButtons.forEach((b) => b.classList.toggle('active', b === btn));
    renderLowStock(cachedDashboardStockAlerts);
  });
});

function renderTopSelling(products = []) {
  const topFive = products.slice(0, 5);
  topProductsBadge.textContent = `Top ${topFive.length} de 5`;
  if (!topFive.length) {
    topProductsTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Aún no se registran ventas completadas para mostrar los 5 productos más vendidos.</td>
      </tr>
    `;
    return;
  }

  topProductsTableBody.innerHTML = topFive
    .map(
      (p, idx) => `
        <tr>
          <td><span class="rank-badge">${idx + 1}</span></td>
          <td>
            <div class="cell-primary">${escapeHtml(p.nombre)}</div>
            <div class="cell-secondary">${escapeHtml(p.sku || `ID #${p.id_producto}`)} · ${p.num_ventas} venta(s)</div>
          </td>
          <td class="text-right font-mono">${formatNumber(p.total_vendido)} ${escapeHtml(p.unidad_medida)}</td>
          <td class="text-right font-mono text-emerald">${formatCurrency(p.ingresos_generados)}</td>
        </tr>
      `
    )
    .join('');
}

function renderRecentSales(sales) {
  if (!sales || !sales.length) {
    recentSalesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">No hay ventas registradas en la base de datos.</td>
      </tr>
    `;
    return;
  }

  recentSalesTableBody.innerHTML = sales
    .map((v) => {
      const estadoClass =
        v.estado === 'COMPLETADA' ? 'success' : v.estado === 'ANULADA' ? 'danger' : 'warning';
      const folio = v.folio_documento ? `#${v.folio_documento}` : `#${v.id_venta}`;
      return `
        <tr>
          <td>
            <div class="cell-primary">${escapeHtml(v.tipo_documento)} ${escapeHtml(folio)}</div>
          </td>
          <td>${escapeHtml(v.cliente)}</td>
          <td class="cell-secondary">${escapeHtml(v.fecha_venta)}</td>
          <td><span class="status-tag ${estadoClass}">${escapeHtml(v.estado)}</span></td>
          <td class="text-right font-mono">${formatCurrency(v.total_venta)}</td>
        </tr>
      `;
    })
    .join('');
}

function updateNavDbLabel(dbMeta) {
  if (!dbMeta) return;
  const suffix = dbMeta.hasDirectFileHandle ? ' (Edición directa en PC)' : ' (Local en navegador)';
  navDbName.textContent = `${dbMeta.originalName}${suffix}`;
}

async function loadDashboard() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Actualizando...';

  try {
    const data = await window.LocalSqliteEngine.getDashboardData();
    updateNavDbLabel(data.database);

    const s = data.salesSummary || {};
    const p = data.periodInfo || {};

    if (kpiHoyLabel) {
      kpiHoyLabel.textContent = p.hoyLabel
        ? `Ingresos del Día (${p.hoyLabel})`
        : 'Ingresos del Día (Hoy)';
    }
    kpiHoyMonto.textContent = formatCurrency(s.hoyMonto);
    kpiHoyCantidad.textContent = `${s.hoyCantidad} venta(s) completada(s) hoy`;

    if (kpiMesLabel) {
      kpiMesLabel.textContent = p.mesActualLabel
        ? `Ingresos de ${p.mesActualLabel}`
        : 'Ingresos del Mes';
    }
    kpiMesMonto.textContent = formatCurrency(s.mesMonto);
    kpiMesCantidad.textContent = `${s.mesCantidad} documento(s) en ${p.mesActualNombre || 'este mes'} (${p.mesPasadoNombre || 'mes ant.'}: ${formatCurrency(s.mesPasadoMonto)})`;

    if (kpiAnioLabel) {
      kpiAnioLabel.textContent = p.anioActual
        ? `Ingresos del Año ${p.anioActual}`
        : 'Ingresos del Año';
    }
    kpiTotalMonto.textContent = formatCurrency(s.anioMonto ?? s.totalMonto);
    kpiUtilidad.textContent = `Utilidad ${p.anioActual || 'anual'}: ${formatCurrency(s.anioUtilidad ?? s.utilidadEstimada)} (${s.anioCantidad ?? s.totalCantidad} ventas)`;

    kpiStockBajo.textContent = s.stockTotalAvisos ?? s.totalStockBajo;
    kpiTotalProductos.textContent = `${s.stockCriticoCount || 0} crítico · ${s.stockPrecaucionCount || 0} precaución · ${s.stockSugerenciaCount || 0} sugerencia (de ${s.totalProductosActivos} activos)`;

    renderAnnualIncomeTable(data.annualIncomeByMonth || [], data.annualTotals || {}, p);
    renderMonthComparisonTable(data.monthComparison || {});
    renderLowStock(data.lowStockProducts || [], s);
    renderTopSelling(data.topSellingProducts || []);
    renderRecentSales(data.recentSales || []);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    navDbName.textContent = 'Sin archivo DB cargado';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Actualizar datos';
  }
}

const moduleDescriptions = {
  ventas: {
    title: 'Registro de Ventas y Pagos',
    desc: 'Emisión de boletas, facturas y tickets internos con soporte para medios de pago mixtos.',
  },
  compras: {
    title: 'Compras e Ingresos de Bodega',
    desc: 'Registro de facturas de proveedores, guías de despacho y actualización de costos unitarios.',
  },
  kardex: {
    title: 'Kardex de Movimientos de Inventario',
    desc: 'Historial inmutable de entradas, salidas, devoluciones, ajustes de inventario y mermas.',
  },
  clientes: {
    title: 'Directorio de Clientes y Proveedores',
    desc: 'Administración de RUT, razón social, giro comercial y datos de contacto.',
  },
};

// ==========================================
// SECCIÓN INVENTARIO (Parámetros predeterminados)
// ==========================================
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
  invUrgentBadge.textContent = `${products.length} urgente(s)`;
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
  invSlowBadge.textContent = `${products.length} artículo(s)`;
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
  invTopBadge.textContent = `${products.length} producto(s)`;
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
  const currentVal = invCategoryFilter.value;
  invCategoryFilter.innerHTML =
    '<option value="">Todas las categorías (Predet.)</option>' +
    categories
      .map(
        (c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`
      )
      .join('');
  invCategoryFilter.value = currentVal;
}

function renderInvSearchResults(searchResult = { total: 0, items: [] }) {
  const items = searchResult.items || [];
  const total = searchResult.total ?? items.length;
  invSearchCountBadge.textContent = `${items.length} de ${total} encontrado(s)`;

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

async function loadInventorySection() {
  refreshInventoryBtn.disabled = true;
  refreshInventoryBtn.textContent = 'Actualizando...';

  try {
    const data = await window.LocalSqliteEngine.getInventorySectionData({
      q: invSearchInput.value.trim() || DEFAULT_INVENTORY_PARAMS.q,
      id_categoria: invCategoryFilter.value || DEFAULT_INVENTORY_PARAMS.id_categoria,
      unidad_medida: invUnitFilter.value || DEFAULT_INVENTORY_PARAMS.unidad_medida,
      activo: invStatusFilter.value || DEFAULT_INVENTORY_PARAMS.activo,
      limite: invLimitFilter.value || DEFAULT_INVENTORY_PARAMS.limite,
      limiteUrgente: invUrgentLimit.value || DEFAULT_INVENTORY_PARAMS.limiteUrgente,
      limiteBajaRotacion: invSlowLimit.value || DEFAULT_INVENTORY_PARAMS.limiteBajaRotacion,
      limiteTop: invTopLimit.value || DEFAULT_INVENTORY_PARAMS.limiteTop,
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
    invSearchResultsBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-cell">${escapeHtml(err.message)}</td>
      </tr>
    `;
  } finally {
    refreshInventoryBtn.disabled = false;
    refreshInventoryBtn.textContent = 'Actualizar inventario';
  }
}

async function executeProductSearch() {
  try {
    const result = await window.LocalSqliteEngine.searchInventoryProducts({
      q: invSearchInput.value.trim() || DEFAULT_INVENTORY_PARAMS.q,
      id_categoria: invCategoryFilter.value || DEFAULT_INVENTORY_PARAMS.id_categoria,
      unidad_medida: invUnitFilter.value || DEFAULT_INVENTORY_PARAMS.unidad_medida,
      activo: invStatusFilter.value || DEFAULT_INVENTORY_PARAMS.activo,
      limite: invLimitFilter.value || DEFAULT_INVENTORY_PARAMS.limite,
    });
    renderInvSearchResults(result);
  } catch (_) {}
}

let searchDebounceTimer = null;
invSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(executeProductSearch, 250);
});

invSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  executeProductSearch();
});

[invCategoryFilter, invUnitFilter, invStatusFilter, invLimitFilter].forEach((selectEl) => {
  selectEl.addEventListener('change', executeProductSearch);
});

[invUrgentLimit, invSlowLimit, invTopLimit].forEach((selectEl) => {
  selectEl.addEventListener('change', loadInventorySection);
});

invResetBtn.addEventListener('click', () => {
  invSearchInput.value = DEFAULT_INVENTORY_PARAMS.q;
  invCategoryFilter.value = DEFAULT_INVENTORY_PARAMS.id_categoria;
  invUnitFilter.value = DEFAULT_INVENTORY_PARAMS.unidad_medida;
  invStatusFilter.value = DEFAULT_INVENTORY_PARAMS.activo;
  invLimitFilter.value = DEFAULT_INVENTORY_PARAMS.limite;
  invUrgentLimit.value = DEFAULT_INVENTORY_PARAMS.limiteUrgente;
  invSlowLimit.value = DEFAULT_INVENTORY_PARAMS.limiteBajaRotacion;
  invTopLimit.value = DEFAULT_INVENTORY_PARAMS.limiteTop;
  loadInventorySection();
});

refreshInventoryBtn.addEventListener('click', loadInventorySection);

// ==========================================
// SECCIÓN GESTIÓN DE STOCK, PRODUCTOS Y MERMAS (KARDEX)
// ==========================================
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
const npStockInicial = document.getElementById('npStockInicial');
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
const slReferencia = document.getElementById('slReferencia');
const slMotivo = document.getElementById('slMotivo');
const slFeedback = document.getElementById('slFeedback');
const slSubmitBtn = document.getElementById('slSubmitBtn');

const kardexFilterTipo = document.getElementById('kardexFilterTipo');
const kardexFilterLimit = document.getElementById('kardexFilterLimit');
const kardexCountBadge = document.getElementById('kardexCountBadge');
const kardexTableBody = document.getElementById('kardexTableBody');

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

function showFeedback(boxEl, type, message) {
  boxEl.className = `status-box ${type}`;
  boxEl.textContent = message;
  boxEl.classList.remove('hidden');
}

function updateCalculatedPrecioFinal() {
  const neto = Number(npPrecioNeto.value) || 0;
  const exento = Number(npExento.value) === 1;
  npPrecioFinal.value = exento ? Math.round(neto) : Math.round(neto * 1.19);
}

npPrecioNeto.addEventListener('input', updateCalculatedPrecioFinal);
npExento.addEventListener('change', updateCalculatedPrecioFinal);

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

const MAX_PRODUCT_SELECT_OPTIONS = 120;

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
  seProducto.innerHTML = buildProductOptionsHtml(cachedStockProducts, prod ? prod.id_producto : '');
  seProducto.value = prod ? String(prod.id_producto) : '';
  if (prod) {
    seCostoUnitario.value = prod.costo_promedio ?? 0;
    if (seProductSearchResults) seProductSearchResults.classList.add('hidden');
    if (seCantidad) seCantidad.focus();
  }
  updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
}

function selectProductForStockLoss(prodId) {
  const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prodId));
  slProducto.innerHTML = buildProductOptionsHtml(cachedStockProducts, prod ? prod.id_producto : '');
  slProducto.value = prod ? String(prod.id_producto) : '';
  if (prod) {
    slCantidad.max = prod.stock_actual > 0 ? prod.stock_actual : '';
    if (slProductSearchResults) slProductSearchResults.classList.add('hidden');
    if (slCantidad) slCantidad.focus();
  } else {
    slCantidad.removeAttribute('max');
  }
  updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
}

let seSearchDebounce = null;
if (seProductSearchInput) {
  seProductSearchInput.addEventListener('input', () => {
    clearTimeout(seSearchDebounce);
    seSearchDebounce = setTimeout(() => {
      const q = seProductSearchInput.value;
      const matches = filterStockProductsByQuery(q);
      seProducto.innerHTML = buildProductOptionsHtml(matches, seProducto.value);
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
      slProducto.innerHTML = buildProductOptionsHtml(matches, slProducto.value);
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

function renderKardexMovements(movimientos = []) {
  kardexCountBadge.textContent = `${movimientos.length} movimiento(s)`;
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

  const prevCat = npCategoria.value;
  npCategoria.innerHTML =
    '<option value="">Sin categoría</option>' +
    categorias
      .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`)
      .join('');
  npCategoria.value = prevCat;

  const prevSeProd = seProducto.value;
  const prevSlProd = slProducto.value;

  const seFiltered = filterStockProductsByQuery(seProductSearchInput ? seProductSearchInput.value : '');
  const slFiltered = filterStockProductsByQuery(slProductSearchInput ? slProductSearchInput.value : '');

  seProducto.innerHTML = buildProductOptionsHtml(seFiltered, prevSeProd);
  slProducto.innerHTML = buildProductOptionsHtml(slFiltered, prevSlProd);

  if (prevSeProd) {
    seProducto.value = prevSeProd;
    const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prevSeProd));
    updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
  } else {
    updateSelectedProductInfoPill(seSelectedProductInfo, null, 'entry');
  }

  if (prevSlProd) {
    slProducto.value = prevSlProd;
    const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(prevSlProd));
    updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
  } else {
    updateSelectedProductInfoPill(slSelectedProductInfo, null, 'loss');
  }
}

seProducto.addEventListener('change', () => {
  const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(seProducto.value));
  if (prod) {
    seCostoUnitario.value = prod.costo_promedio ?? 0;
  }
  updateSelectedProductInfoPill(seSelectedProductInfo, prod, 'entry');
});

slProducto.addEventListener('change', () => {
  const prod = cachedStockProducts.find((p) => String(p.id_producto) === String(slProducto.value));
  if (prod) {
    slCantidad.max = prod.stock_actual > 0 ? prod.stock_actual : '';
  } else {
    slCantidad.removeAttribute('max');
  }
  updateSelectedProductInfoPill(slSelectedProductInfo, prod, 'loss');
});

async function loadStockManagementSection() {
  refreshStockMgmtBtn.disabled = true;
  refreshStockMgmtBtn.textContent = 'Actualizando...';

  try {
    const data = await window.LocalSqliteEngine.getStockManagementData({
      tipo_movimiento: kardexFilterTipo.value || '',
      limite: kardexFilterLimit.value || '30',
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
    kardexTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">${escapeHtml(err.message)}</td>
      </tr>
    `;
  } finally {
    refreshStockMgmtBtn.disabled = false;
    refreshStockMgmtBtn.textContent = 'Actualizar datos';
  }
}

formNewProduct.addEventListener('submit', async (e) => {
  e.preventDefault();
  npSubmitBtn.disabled = true;
  npFeedback.classList.add('hidden');

  try {
    const payload = {
      nombre: npNombre.value.trim(),
      unidad_medida: npUnidad.value,
      sku: npSku.value.trim() || null,
      codigo_barras: npBarcode.value.trim() || null,
      id_categoria: npCategoria.value || null,
      nueva_categoria: npNuevaCategoria.value.trim() || null,
      costo_promedio: Number(npCosto.value) || 0,
      precio_neto: Number(npPrecioNeto.value) || 0,
      exento_iva: Number(npExento.value) === 1 ? 1 : 0,
      precio_venta_final: Number(npPrecioFinal.value) || 0,
      stock_minimo: Number(npStockMinimo.value) || 0,
      stock_inicial: Number(npStockInicial.value) || 0,
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
    npCosto.value = '0';
    npPrecioNeto.value = '0';
    npPrecioFinal.value = '0';
    npStockMinimo.value = '5';
    npStockInicial.value = '0';
    await loadStockManagementSection();
  } catch (err) {
    showFeedback(npFeedback, 'error', err.message);
  } finally {
    npSubmitBtn.disabled = false;
  }
});

formStockEntry.addEventListener('submit', async (e) => {
  e.preventDefault();
  seSubmitBtn.disabled = true;
  seFeedback.classList.add('hidden');

  try {
    const payload = {
      id_producto: Number(seProducto.value),
      id_usuario: stockActiveUser.value || null,
      tipo_movimiento: seTipo.value,
      cantidad: Number(seCantidad.value),
      costo_unitario: seCostoUnitario.value !== '' ? Number(seCostoUnitario.value) : null,
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
    await loadStockManagementSection();
  } catch (err) {
    showFeedback(seFeedback, 'error', err.message);
  } finally {
    seSubmitBtn.disabled = false;
  }
});

formStockLoss.addEventListener('submit', async (e) => {
  e.preventDefault();
  slSubmitBtn.disabled = true;
  slFeedback.classList.add('hidden');

  try {
    const payload = {
      id_producto: Number(slProducto.value),
      id_usuario: stockActiveUser.value || null,
      tipo_movimiento: slTipo.value,
      cantidad: Number(slCantidad.value),
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
    slSubmitBtn.disabled = false;
  }
});

[kardexFilterTipo, kardexFilterLimit].forEach((el) => {
  el.addEventListener('change', loadStockManagementSection);
});

refreshStockMgmtBtn.addEventListener('click', loadStockManagementSection);

// ==========================================
// SECCIÓN INGRESO DE VENTAS (POS)
// ==========================================
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
  posProductsCountBadge.textContent = `${products.length} producto(s)`;

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

  const rawDiscountVal = Math.max(0, Number(posDiscountInput.value) || 0);
  let descuentoGlobalMonto = 0;

  if (posDiscountType.value === 'PERCENT') {
    const pct = Math.min(100, rawDiscountVal);
    descuentoGlobalMonto = Number(Math.round((subtotalArticulos * pct) / 100));
  } else {
    descuentoGlobalMonto = Number(Math.min(subtotalArticulos, rawDiscountVal).toFixed(2));
  }

  const totalVenta = Number(Math.max(0, subtotalArticulos - descuentoGlobalMonto).toFixed(2));
  const factorGlobal = subtotalArticulos > 0 ? totalVenta / subtotalArticulos : 0;
  const subtotalNeto = Number((netoBruto * factorGlobal).toFixed(2));
  const totalIva = Number(Math.max(0, totalVenta - subtotalNeto).toFixed(2));

  posDiscountComputedDisplay.textContent = `-${formatCurrency(descuentoGlobalMonto)}`;
  posSummarySubtotalBruto.textContent = formatCurrency(subtotalArticulos);
  posSummaryDescuentoGlobal.textContent = `-${formatCurrency(descuentoGlobalMonto)}`;
  posSummaryNeto.textContent = formatCurrency(subtotalNeto);
  posSummaryIva.textContent = formatCurrency(totalIva);
  posSummaryTotalVenta.textContent = formatCurrency(totalVenta);

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
  posCartBadge.textContent = `${posCart.length} línea(s) (${formatNumber(totalUnidades)} unid.)`;

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
  posFeedback.classList.add('hidden');

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
  posHistoryCountBadge.textContent = `${ventas.length} venta(s)`;
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

  const prevUser = posActiveUser.value;
  posActiveUser.innerHTML = usuarios
    .map(
      (u) => `<option value="${u.id_usuario}">${escapeHtml(u.nombre)} (${escapeHtml(u.rol)})</option>`
    )
    .join('');
  if (prevUser && usuarios.some((u) => String(u.id_usuario) === String(prevUser))) {
    posActiveUser.value = prevUser;
  }

  const prevCat = posCategoryFilter.value;
  posCategoryFilter.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categorias
      .map((c) => `<option value="${c.id_categoria}">${escapeHtml(c.nombre)}</option>`)
      .join('');
  posCategoryFilter.value = prevCat;

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

async function loadSalesSection() {
  refreshSalesBtn.disabled = true;
  refreshSalesBtn.textContent = 'Actualizando...';

  try {
    const data = await window.LocalSqliteEngine.getSalesSectionData({
      q: posSearchInput.value.trim(),
      id_categoria: posCategoryFilter.value || '',
      solo_con_stock: posStockFilter.value || '0',
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
    posProductsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td>
      </tr>
    `;
  } finally {
    refreshSalesBtn.disabled = false;
    refreshSalesBtn.textContent = 'Actualizar catálogo';
  }
}

async function executePosCatalogSearch() {
  try {
    const productos = await window.LocalSqliteEngine.searchPosProducts({
      q: posSearchInput.value.trim(),
      id_categoria: posCategoryFilter.value || '',
      solo_con_stock: posStockFilter.value || '0',
      limite_productos: '60',
    });
    renderPosProducts(productos || []);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    posProductsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td>
      </tr>
    `;
  }
}

let posSearchDebounce = null;
posSearchInput.addEventListener('input', () => {
  clearTimeout(posSearchDebounce);
  posSearchDebounce = setTimeout(executePosCatalogSearch, 180);
});

posSearchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearTimeout(posSearchDebounce);
  await executePosCatalogSearch();

  // Si el usuario buscó un SKU o código de barras exacto (o quedó 1 único producto con stock), lo agrega directo
  const term = posSearchInput.value.trim().toLowerCase();
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

[posCategoryFilter, posStockFilter].forEach((el) => {
  el.addEventListener('change', executePosCatalogSearch);
});

posClearSearchBtn.addEventListener('click', () => {
  posSearchInput.value = '';
  posCategoryFilter.value = '';
  posStockFilter.value = '0';
  executePosCatalogSearch();
});

refreshSalesBtn.addEventListener('click', loadSalesSection);

// Delegación de eventos para agregar productos desde la tabla del buscador
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

// Delegación de eventos en el carrito de venta actual (cambiar cantidad, descuento línea o eliminar)
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

posClearCartBtn.addEventListener('click', () => {
  posCart = [];
  posDiscountInput.value = '0';
  posFeedback.classList.add('hidden');
  renderPosCart();
});

// Controles de descuento en la venta total
posDiscountType.addEventListener('change', () => {
  if (posDiscountType.value === 'PERCENT') {
    posDiscountInputLabel.textContent = 'Porcentaje de Descuento (%)';
    posDiscountInput.max = '100';
  } else {
    posDiscountInputLabel.textContent = 'Valor del Descuento ($)';
    posDiscountInput.removeAttribute('max');
  }
  calculatePosTotals();
});

posDiscountInput.addEventListener('input', calculatePosTotals);

posQuickDiscountBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const pct = Number(btn.dataset.discountPct) || 0;
    if (pct === 0) {
      posDiscountType.value = 'AMOUNT';
      posDiscountInputLabel.textContent = 'Valor del Descuento ($)';
      posDiscountInput.value = '0';
    } else {
      posDiscountType.value = 'PERCENT';
      posDiscountInputLabel.textContent = 'Porcentaje de Descuento (%)';
      posDiscountInput.value = String(pct);
    }
    calculatePosTotals();
  });
});

// Confirmar y registrar venta (Transacción atómica)
posCheckoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  posFeedback.classList.add('hidden');

  if (!posCart.length) {
    showFeedback(posFeedback, 'error', 'Debes agregar al menos un producto a la venta antes de confirmar.');
    return;
  }

  posSubmitSaleBtn.disabled = true;
  posSubmitSaleBtn.textContent = 'Procesando venta...';

  try {
    const totals = calculatePosTotals();

    const payload = {
      id_cliente: posClienteSelect.value ? Number(posClienteSelect.value) : null,
      id_usuario: posActiveUser.value ? Number(posActiveUser.value) : null,
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

    const data = await window.LocalSqliteEngine.registerSaleTransaction(payload);

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
    posDiscountInput.value = '0';
    posFolioDoc.value = '';
    posReferenciaPago.value = '';
    await loadSalesSection();
  } catch (err) {
    showFeedback(posFeedback, 'error', err.message);
  } finally {
    posSubmitSaleBtn.disabled = false;
    posSubmitSaleBtn.textContent = 'Confirmar y Registrar Venta';
  }
});

// ==========================================
// SECCIÓN CLIENTES Y DERECHOS ARSOP+ (LEY 21.719)
// ==========================================
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
  cliId.value = '';
  clientForm.reset();
  clientFormTitle.textContent = 'Registrar / Rectificar Cliente';
  cliSubmitBtn.textContent = 'Guardar Cliente en .db';
}

function renderClientsTable(clientes = [], totalClientes = clientes.length, searchQuery = '') {
  cachedClientsList = clientes;

  if (searchQuery) {
    clientsCountBadge.textContent = `${clientes.length} de ${totalClientes} encontrado(s)`;
  } else {
    clientsCountBadge.textContent = `Últimos ${clientes.length} (de ${totalClientes})`;
  }

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

async function loadClientsSection() {
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
    cliSubmitBtn.disabled = true;
    cliFeedback.classList.add('hidden');
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
      cliSubmitBtn.disabled = false;
    }
  });

  cliCancelEditBtn.addEventListener('click', () => {
    resetClientForm();
    cliFeedback.classList.add('hidden');
  });

  refreshClientsBtn.addEventListener('click', loadClientsSection);

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

// Acciones de barra superior: Descargar .db local y Cerrar sesión en navegador
if (downloadActiveDbBtn) {
  downloadActiveDbBtn.addEventListener('click', async () => {
    try {
      await window.LocalSqliteEngine.downloadActiveDatabaseFile();
    } catch (err) {
      window.alert(err.message || 'No se pudo descargar el archivo .db');
    }
  });
}

if (closeDbSessionBtn) {
  closeDbSessionBtn.addEventListener('click', async () => {
    await window.LocalSqliteEngine.clearSession();
    window.location.href = '/';
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.dataset.section;

    navLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');

    sectionInicio.classList.add('hidden');
    sectionInventario.classList.add('hidden');
    sectionVentas.classList.add('hidden');
    sectionKardex.classList.add('hidden');
    if (sectionClientes) sectionClientes.classList.add('hidden');
    sectionPlaceholder.classList.add('hidden');

    if (section === 'inicio') {
      sectionInicio.classList.remove('hidden');
      loadDashboard();
    } else if (section === 'inventario') {
      sectionInventario.classList.remove('hidden');
      loadInventorySection();
    } else if (section === 'ventas') {
      sectionVentas.classList.remove('hidden');
      loadSalesSection();
    } else if (section === 'kardex') {
      sectionKardex.classList.remove('hidden');
      loadStockManagementSection();
    } else if (section === 'clientes' && sectionClientes) {
      sectionClientes.classList.remove('hidden');
      loadClientsSection();
    } else {
      const info = moduleDescriptions[section] || { title: section, desc: '' };
      moduleTitle.textContent = info.title;
      moduleDesc.textContent = info.desc;
      sectionPlaceholder.classList.remove('hidden');
    }
  });
});

backToHomeBtn.addEventListener('click', () => {
  navLinks.forEach((l) => l.classList.toggle('active', l.dataset.section === 'inicio'));
  sectionPlaceholder.classList.add('hidden');
  sectionInventario.classList.add('hidden');
  sectionVentas.classList.add('hidden');
  sectionKardex.classList.add('hidden');
  if (sectionClientes) sectionClientes.classList.add('hidden');
  sectionInicio.classList.remove('hidden');
});

refreshBtn.addEventListener('click', loadDashboard);

loadDashboard();

