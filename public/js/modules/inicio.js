import {
  formatCurrency,
  formatNumber,
  escapeHtml,
  formatCompactCurrency,
  getTrendMeta,
} from '../utils/formatters.js';
import { updateNavDbLabel, setNavDbStatusText } from '../components/navbar.js';

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
const stockTabButtons = document.querySelectorAll('#stockAlertTabs [data-alert-filter]');

const topProductsBadge = document.getElementById('topProductsBadge');
const topProductsTableBody = document.getElementById('topProductsTableBody');
const recentSalesTableBody = document.getElementById('recentSalesTableBody');

let cachedDashboardStockAlerts = [];
let activeStockAlertFilter = 'ALL';

function renderAnnualIncomeTable(months = [], totals = {}, periodInfo = {}) {
  const rango13Label =
    periodInfo.rango13MesesLabel || totals.rango_label || 'Últimos 13 Meses';
  if (annualIncomeTitle) {
    annualIncomeTitle.textContent = `Gráfico de Ingresos: Últimos 13 Meses (${rango13Label})`;
  }
  if (annualIncomeBadge) {
    annualIncomeBadge.textContent = `${formatCurrency(totals.total_venta || 0)} (13 meses)`;
  }

  if (!annualIncomeChartContainer) return;

  if (!months.length) {
    annualIncomeChartContainer.innerHTML = `
      <div class="empty-cell">No hay datos de ingresos en los últimos 13 meses.</div>
    `;
    return;
  }

  const currentIdx = months.findIndex((m) => m.es_mes_actual);
  const activeIdx = currentIdx >= 0 ? currentIdx : months.length - 1;
  const currentMonthObj = months[activeIdx] || {
    mes_nombre: 'Actual',
    mes_etiqueta_larga: 'Mes Actual',
    total_venta: 0,
  };
  const prevMonthObj =
    activeIdx > 0
      ? months[activeIdx - 1]
      : { mes_nombre: 'Anterior', mes_etiqueta_larga: 'Mes Anterior', total_venta: 0 };
  const sameMonthLastYearObj =
    months[0] || { mes_nombre: 'Año Ant.', mes_etiqueta_larga: 'Hace 12 meses', total_venta: 0 };

  const annualTrend = getTrendMeta(currentMonthObj.total_venta, prevMonthObj.total_venta);
  const yoyTrend = getTrendMeta(currentMonthObj.total_venta, sameMonthLastYearObj.total_venta);

  const maxVenta = Math.max(...months.map((m) => Number(m.total_venta) || 0), 1);
  const mejorMes = months.reduce(
    (best, m) => ((Number(m.total_venta) || 0) > (Number(best.total_venta) || 0) ? m : best),
    months[0]
  );

  // Dimensiones del gráfico SVG (13 meses)
  const svgW = 640;
  const svgH = 230;
  const padL = 48;
  const padR = 16;
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

    const shortYear = m.anio ? String(m.anio).slice(-2) : '';
    const shortName =
      m.mes_etiqueta_corta ||
      (shortYear
        ? `${String(m.mes_nombre || '').slice(0, 3)}'${shortYear}`
        : String(m.mes_nombre || '').slice(0, 3));
    const fullLabel = m.mes_etiqueta_larga || `${m.mes_nombre || ''} ${m.anio || ''}`.trim();

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
      shortName,
      fullLabel,
    };
  });

  // Polilínea de tendencia a lo largo de los 13 meses
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
      return `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${curr.x.toFixed(1)}" y2="${curr.y.toFixed(1)}" stroke="${segColor}" stroke-width="2.6" stroke-linecap="round" />`;
    })
    .join('');

  // Barras y nodos de cada uno de los 13 meses
  const barsAndNodesSvg = points
    .map((p) => {
      const barWidth = Math.min(23, stepX * 0.58);
      const bx = p.x - barWidth / 2;
      const barFill = p.es_mes_actual
        ? 'rgba(59, 130, 246, 0.45)'
        : p.es_mismo_mes_anio_anterior
        ? 'rgba(168, 85, 247, 0.32)'
        : p.stepTrend === 'up'
        ? 'rgba(16, 185, 129, 0.28)'
        : p.stepTrend === 'down'
        ? 'rgba(239, 68, 68, 0.25)'
        : 'rgba(148, 163, 184, 0.18)';
      const barStroke = p.es_mes_actual
        ? '#60a5fa'
        : p.es_mismo_mes_anio_anterior
        ? '#c084fc'
        : p.stepTrend === 'up'
        ? '#10b981'
        : p.stepTrend === 'down'
        ? '#ef4444'
        : '#475569';

      const nodeColor = p.es_mes_actual
        ? '#60a5fa'
        : p.es_mismo_mes_anio_anterior
        ? '#c084fc'
        : p.stepTrend === 'up'
        ? '#10b981'
        : p.stepTrend === 'down'
        ? '#ef4444'
        : '#60a5fa';
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
          <title>${escapeHtml(p.fullLabel)}: ${formatCurrency(p.val)} (${p.cantidad_ventas} ventas · Utilidad: ${formatCurrency(p.util)})</title>
          <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="4" fill="${barFill}" stroke="${barStroke}" stroke-width="1" />
          ${
            showNode
              ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.es_mes_actual ? 4.8 : 3.6}" fill="${nodeColor}" stroke="#0f172a" stroke-width="1.5" />`
              : ''
          }
          ${
            arrowGlyph
              ? `<text x="${p.x.toFixed(1)}" y="${Math.max(12, p.y - 8).toFixed(1)}" text-anchor="middle" fill="${nodeColor}" font-size="8.5" font-weight="700">${arrowGlyph}</text>`
              : ''
          }
          <text x="${p.x.toFixed(1)}" y="${svgH - 18}" text-anchor="middle" fill="${p.es_mes_actual ? '#60a5fa' : p.es_mismo_mes_anio_anterior ? '#c084fc' : '#cbd5e1'}" font-size="9.2" font-weight="${p.es_mes_actual || p.es_mismo_mes_anio_anterior ? '700' : '500'}">${escapeHtml(p.shortName)}</text>
          <text x="${p.x.toFixed(1)}" y="${svgH - 5}" text-anchor="middle" fill="#64748b" font-size="8.3" font-family="monospace">${p.val > 0 ? escapeHtml(formatCompactCurrency(p.val)) : '$0'}</text>
        </g>
      `;
    })
    .join('');

  const currLabel = currentMonthObj.mes_etiqueta_larga || currentMonthObj.mes_nombre;
  const prevLabel = prevMonthObj.mes_etiqueta_larga || prevMonthObj.mes_nombre;
  const yoyLabel = sameMonthLastYearObj.mes_etiqueta_larga || sameMonthLastYearObj.mes_nombre;

  annualIncomeChartContainer.innerHTML = `
    <div class="trend-banner ${annualTrend.colorClass}">
      <div class="trend-banner-main">
        <span class="trend-direction-pill ${annualTrend.colorClass}">
          ${annualTrend.arrow} ${escapeHtml(annualTrend.label)} (${escapeHtml(annualTrend.shortLabel)})
        </span>
        <span class="trend-banner-text">
          <strong>${escapeHtml(currLabel)}:</strong> ${formatCurrency(currentMonthObj.total_venta)}
          vs. <strong>${escapeHtml(prevLabel)}:</strong> ${formatCurrency(prevMonthObj.total_venta)}
          · Interanual vs. <strong>${escapeHtml(yoyLabel)}:</strong> ${formatCurrency(sameMonthLastYearObj.total_venta)} (${yoyTrend.arrow} ${escapeHtml(yoyTrend.shortLabel)})
        </span>
      </div>
      <div class="trend-legend">
        <span class="legend-item"><i class="legend-dot up"></i> Ascenso (▲)</span>
        <span class="legend-item"><i class="legend-dot down"></i> Descenso (▼)</span>
        <span class="legend-item"><i class="legend-dot current"></i> Mes Actual</span>
      </div>
    </div>

    <div class="svg-chart-wrapper">
      <svg viewBox="0 0 ${svgW} ${svgH}" class="comparison-svg-chart" role="img" aria-label="Gráfico de evolución de ingresos de los últimos 13 meses">
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
        <span class="chart-summary-label">Total Ingresos (13 Meses)</span>
        <strong class="chart-summary-value text-emerald font-mono">${formatCurrency(totals.total_venta || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Utilidad Est. (13 Meses)</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(totals.utilidad_estimada || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Ventas (13 Meses)</span>
        <strong class="chart-summary-value font-mono">${totals.cantidad_ventas || 0} doc(s)</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Mejor Mes (${escapeHtml(mejorMes?.mes_etiqueta_corta || mejorMes?.mes_nombre || '—')})</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(mejorMes?.total_venta || 0)}</strong>
      </div>
    </div>
  `;
}

function renderMonthComparisonTable(comp30 = {}) {
  const dias = Array.isArray(comp30.dias) ? comp30.dias : [];
  const hoy = comp30.hoy || {};
  const ayer = comp30.ayer || {};
  const acum = comp30.acumulado30Dias || {};
  const rangoCorto = comp30.rangoCortoLabel || '30 días anteriores';
  const rangoLargo = comp30.rangoLabel || '30 días previos al día de hoy';
  const hoyLabel = comp30.hoyLabel || 'Hoy';

  if (monthCompTitle) {
    monthCompTitle.textContent = `Gráfico Comparativo: 30 Días Anteriores a Hoy (${rangoCorto})`;
  }
  if (monthCompSubtitle) {
    monthCompSubtitle.textContent = `Evolución diaria de los 30 días previos (${rangoLargo}) vs. Hoy (${hoyLabel})`;
  }

  const hoyVenta = Number(hoy.total_venta) || 0;
  const prom30Venta = Number(acum.promedio_diario_venta) || 0;
  const ayerVenta = Number(ayer.total_venta) || 0;
  const mainTrend = getTrendMeta(hoyVenta, prom30Venta);
  const vsAyerTrend = getTrendMeta(hoyVenta, ayerVenta);

  if (monthCompBadge) {
    monthCompBadge.textContent = `Hoy vs. Prom. 30d: ${mainTrend.arrow} ${mainTrend.shortLabel}`;
    monthCompBadge.className =
      mainTrend.direction === 'up'
        ? 'panel-badge success-badge'
        : mainTrend.direction === 'down'
        ? 'panel-badge danger'
        : 'panel-badge info';
  }

  if (!monthCompChartContainer) return;

  if (!dias.length) {
    monthCompChartContainer.innerHTML = `
      <div class="empty-cell">No hay datos suficientes para graficar los 30 días anteriores a hoy.</div>
    `;
    return;
  }

  // Serie completa de 31 puntos: los 30 días anteriores + Hoy como punto de comparación final
  const hoyDateParts = String(comp30.hoyKey || '').split('-');
  const hoyShortTag =
    hoyDateParts.length === 3 ? `${hoyDateParts[2]}/${hoyDateParts[1]}` : 'Hoy';

  const chartSeries = [
    ...dias.map((d) => ({
      ...d,
      es_hoy: false,
    })),
    {
      fecha_key: comp30.hoyKey || 'HOY',
      etiqueta_corta: 'HOY',
      etiqueta_larga: `Hoy (${hoyLabel})`,
      es_ayer: false,
      es_hoy: true,
      cantidad_ventas: Number(hoy.cantidad_ventas) || 0,
      subtotal_neto: Number(hoy.subtotal_neto) || 0,
      total_iva: Number(hoy.total_iva) || 0,
      total_venta: hoyVenta,
      unidades_vendidas: Number(hoy.unidades_vendidas) || 0,
      utilidad_estimada: Number(hoy.utilidad_estimada) || 0,
    },
  ];

  const maxDailyVenta = Math.max(
    ...chartSeries.map((d) => Number(d.total_venta) || 0),
    prom30Venta,
    1
  );

  const mejorDia30 = dias.reduce(
    (best, d) => ((Number(d.total_venta) || 0) > (Number(best.total_venta) || 0) ? d : best),
    dias[0]
  );

  // Dimensiones del gráfico SVG de los 30 días anteriores + Hoy
  const svgW = 640;
  const svgH = 215;
  const padL = 48;
  const padR = 18;
  const padT = 24;
  const padB = 38;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const stepX = plotW / chartSeries.length;

  const points = chartSeries.map((d, idx) => {
    const val = Number(d.total_venta) || 0;
    const util = Number(d.utilidad_estimada) || 0;
    const x = padL + stepX * idx + stepX / 2;
    const ratio = maxDailyVenta > 0 ? val / maxDailyVenta : 0;
    const y = padT + plotH - ratio * plotH;
    const barH = Math.max(ratio * plotH, val > 0 ? 4 : 1.5);
    const barY = padT + plotH - barH;
    const prevVal = idx > 0 ? Number(chartSeries[idx - 1].total_venta) || 0 : val;
    const stepTrend = idx === 0 ? 'flat' : val > prevVal ? 'up' : val < prevVal ? 'down' : 'flat';

    return {
      ...d,
      idx,
      val,
      util,
      x,
      y,
      barH,
      barY,
      stepTrend,
    };
  });

  const polylineCoords = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaCoords =
    points.length > 1
      ? `${points[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} ${polylineCoords} ${points[
          points.length - 1
        ].x.toFixed(1)},${(padT + plotH).toFixed(1)}`
      : '';

  // Líneas guía horizontales
  const gridLevels = [0, 0.5, 1];
  const gridSvg = gridLevels
    .map((lvl) => {
      const gy = padT + plotH - lvl * plotH;
      const labelVal = formatCompactCurrency(lvl * maxDailyVenta);
      return `
        <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${svgW - padR}" y2="${gy.toFixed(1)}" stroke="rgba(148, 163, 184, 0.16)" stroke-dasharray="3 3" />
        <text x="${padL - 6}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9.5" font-family="monospace">${escapeHtml(labelVal)}</text>
      `;
    })
    .join('');

  // Línea horizontal de Promedio Diario de los 30 días anteriores
  const avgRatio = maxDailyVenta > 0 ? Math.min(1, prom30Venta / maxDailyVenta) : 0;
  const avgY = padT + plotH - avgRatio * plotH;
  const avgLineSvg =
    prom30Venta > 0
      ? `
        <line x1="${padL}" y1="${avgY.toFixed(1)}" x2="${svgW - padR}" y2="${avgY.toFixed(1)}" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="5 4" />
        <text x="${svgW - padR - 4}" y="${Math.max(padT + 10, avgY - 4).toFixed(1)}" text-anchor="end" fill="#fbbf24" font-size="9" font-weight="600" font-family="monospace">Prom. 30d: ${escapeHtml(formatCompactCurrency(prom30Venta))}</text>
      `
      : '';

  // Segmentos de curva entre cada día
  const segmentsSvg = points
    .slice(1)
    .map((curr, i) => {
      const prev = points[i];
      const segColor = curr.es_hoy
        ? '#3b82f6'
        : curr.val > prev.val
        ? '#10b981'
        : curr.val < prev.val
        ? '#ef4444'
        : '#64748b';
      return `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${curr.x.toFixed(1)}" y2="${curr.y.toFixed(1)}" stroke="${segColor}" stroke-width="${curr.es_hoy ? '2.6' : '1.9'}" stroke-linecap="round" />`;
    })
    .join('');

  // Índices de etiquetas en eje X para evitar solapamiento (cada 5 días + Ayer + Hoy)
  const labelIndices = new Set([0, 5, 10, 15, 20, 25, 29, 30]);

  const barsAndNodesSvg = points
    .map((p) => {
      const barWidth = Math.max(6, Math.min(13, stepX * 0.66));
      const bx = p.x - barWidth / 2;
      const barFill = p.es_hoy
        ? 'rgba(59, 130, 246, 0.55)'
        : p.es_ayer
        ? 'rgba(168, 85, 247, 0.38)'
        : p.val >= prom30Venta && p.val > 0
        ? 'rgba(16, 185, 129, 0.28)'
        : p.val > 0
        ? 'rgba(239, 68, 68, 0.24)'
        : 'rgba(148, 163, 184, 0.14)';
      const barStroke = p.es_hoy
        ? '#60a5fa'
        : p.es_ayer
        ? '#c084fc'
        : p.val >= prom30Venta && p.val > 0
        ? '#10b981'
        : p.val > 0
        ? '#ef4444'
        : '#334155';
      const nodeColor = p.es_hoy
        ? '#60a5fa'
        : p.es_ayer
        ? '#c084fc'
        : p.stepTrend === 'up'
        ? '#10b981'
        : p.stepTrend === 'down'
        ? '#ef4444'
        : '#94a3b8';

      const showXLabel = labelIndices.has(p.idx);
      const xLabelText = p.es_hoy ? `HOY (${hoyShortTag})` : p.etiqueta_corta;

      return `
        <g class="chart-day-group">
          <title>${escapeHtml(p.etiqueta_larga)}: ${formatCurrency(p.val)} (${p.cantidad_ventas} venta(s) · ${formatNumber(p.unidades_vendidas)} unid. · Utilidad: ${formatCurrency(p.util)})</title>
          <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="2.5" fill="${barFill}" stroke="${barStroke}" stroke-width="0.9" />
          ${
            p.val > 0 || p.es_hoy || p.es_ayer
              ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.es_hoy ? 4.4 : p.es_ayer ? 3.5 : 2.5}" fill="${nodeColor}" stroke="#0f172a" stroke-width="1.2" />`
              : ''
          }
          ${
            showXLabel
              ? `<text x="${p.x.toFixed(1)}" y="${svgH - 14}" text-anchor="${p.es_hoy ? 'end' : 'middle'}" fill="${p.es_hoy ? '#60a5fa' : p.es_ayer ? '#c084fc' : '#cbd5e1'}" font-size="${p.es_hoy ? '9.5' : '9'}" font-weight="${p.es_hoy || p.es_ayer ? '700' : '500'}">${escapeHtml(xLabelText)}</text>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  const diffSign = mainTrend.diff > 0 ? '+' : '';
  const diffAyerSign = vsAyerTrend.diff > 0 ? '+' : '';

  const metrics = [
    {
      label: 'Ingresos Diarios (Hoy vs. Prom. 30d)',
      prevLabel: 'Prom. 30d',
      currLabel: 'Hoy',
      pasado: prom30Venta,
      actual: hoyVenta,
      format: formatCurrency,
    },
    {
      label: `Ingresos: Hoy vs. Ayer (${ayer.etiqueta_corta || 'Ayer'})`,
      prevLabel: 'Ayer',
      currLabel: 'Hoy',
      pasado: ayerVenta,
      actual: hoyVenta,
      format: formatCurrency,
    },
    {
      label: 'Utilidad Estimada (Hoy vs. Prom. 30d)',
      prevLabel: 'Prom. 30d',
      currLabel: 'Hoy',
      pasado: Number(acum.promedio_diario_utilidad) || 0,
      actual: Number(hoy.utilidad_estimada) || 0,
      format: formatCurrency,
    },
    {
      label: 'Ticket Promedio (Hoy vs. 30 días ant.)',
      prevLabel: '30 días ant.',
      currLabel: 'Hoy',
      pasado: Number(acum.ticket_promedio) || 0,
      actual: Number(hoy.ticket_promedio) || 0,
      format: formatCurrency,
    },
    {
      label: 'Ventas Completadas (Hoy vs. Prom. 30d)',
      prevLabel: 'Prom. 30d',
      currLabel: 'Hoy',
      pasado: Number(acum.promedio_diario_ventas_docs) || 0,
      actual: Number(hoy.cantidad_ventas) || 0,
      format: (v) => `${formatNumber(v)} vta(s)`,
    },
    {
      label: 'Unidades Vendidas (Hoy vs. Prom. 30d)',
      prevLabel: 'Prom. 30d',
      currLabel: 'Hoy',
      pasado: Number(acum.promedio_diario_unidades) || 0,
      actual: Number(hoy.unidades_vendidas) || 0,
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
              ${t.arrow} ${escapeHtml(t.shortLabel)} (${dSign}${escapeHtml(diffFormatted)})
            </span>
          </div>
          <div class="comp-bars-pair">
            <div class="comp-bar-row">
              <span class="comp-bar-period">${escapeHtml(m.prevLabel)}</span>
              <div class="comp-bar-track">
                <div class="comp-bar-fill prev" style="width: ${m.pasado > 0 ? pasPct.toFixed(1) : 0}%"></div>
              </div>
              <span class="comp-bar-amount font-mono">${escapeHtml(m.format(m.pasado))}</span>
            </div>
            <div class="comp-bar-row">
              <span class="comp-bar-period current">${escapeHtml(m.currLabel)}</span>
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
          ${mainTrend.arrow} Hoy vs. Prom. 30 días: ${escapeHtml(mainTrend.label)} (${escapeHtml(mainTrend.shortLabel)})
        </span>
        <span class="trend-banner-text">
          <strong>Hoy:</strong> ${formatCurrency(hoyVenta)} ·
          <strong>Prom. 30d:</strong> ${formatCurrency(prom30Venta)} (${diffSign}${formatCurrency(mainTrend.diff)}) ·
          <strong>Ayer:</strong> ${formatCurrency(ayerVenta)} (${diffAyerSign}${formatCurrency(vsAyerTrend.diff)})
        </span>
      </div>
      <div class="trend-legend">
        <span class="legend-item"><i class="legend-dot up"></i> Sobre prom.</span>
        <span class="legend-item"><i class="legend-dot down"></i> Bajo prom.</span>
        <span class="legend-item"><i class="legend-dot current"></i> Hoy</span>
      </div>
    </div>

    <div class="svg-chart-wrapper">
      <svg viewBox="0 0 ${svgW} ${svgH}" class="comparison-svg-chart" role="img" aria-label="Gráfico comparativo de los 30 días anteriores al día de hoy">
        <defs>
          <linearGradient id="prev30AreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${mainTrend.strokeColor}" stop-opacity="0.24" />
            <stop offset="100%" stop-color="${mainTrend.strokeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridSvg}
        ${areaCoords ? `<polygon points="${areaCoords}" fill="url(#prev30AreaGrad)" />` : ''}
        ${avgLineSvg}
        ${segmentsSvg}
        ${barsAndNodesSvg}
      </svg>
    </div>

    <div class="chart-summary-strip">
      <div class="chart-summary-item">
        <span class="chart-summary-label">Acumulado 30 Días Ant.</span>
        <strong class="chart-summary-value text-emerald font-mono">${formatCurrency(acum.total_venta || 0)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Promedio Diario (30d)</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(prom30Venta)}</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Días Activos / Ventas</span>
        <strong class="chart-summary-value font-mono">${acum.dias_con_ventas || 0}/30 días (${acum.cantidad_ventas || 0} docs)</strong>
      </div>
      <div class="chart-summary-item">
        <span class="chart-summary-label">Mejor Día (${escapeHtml(mejorDia30?.etiqueta_corta || '—')})</span>
        <strong class="chart-summary-value font-mono">${formatCurrency(mejorDia30?.total_venta || 0)}</strong>
      </div>
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

  if (lowStockBadge) {
    lowStockBadge.textContent = `${totalAvisos} aviso(s): ${criticoCount} crít. · ${precaucionCount} prec. · ${sugerenciaCount} sug.`;
    lowStockBadge.className =
      criticoCount > 0
        ? 'panel-badge danger'
        : precaucionCount > 0
        ? 'panel-badge warning'
        : 'panel-badge info';
  }

  if (!lowStockTableBody) return;

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

function renderTopSelling(products = []) {
  const topFive = products.slice(0, 5);
  if (topProductsBadge) {
    topProductsBadge.textContent = `Top ${topFive.length} de 5`;
  }
  if (!topProductsTableBody) return;

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
  if (!recentSalesTableBody) return;

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

export async function loadDashboard() {
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Actualizando...';
  }

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
    if (kpiHoyMonto) kpiHoyMonto.textContent = formatCurrency(s.hoyMonto);
    if (kpiHoyCantidad) kpiHoyCantidad.textContent = `${s.hoyCantidad} venta(s) completada(s) hoy`;

    if (kpiMesLabel) {
      kpiMesLabel.textContent = p.mesActualLabel
        ? `Ingresos de ${p.mesActualLabel}`
        : 'Ingresos del Mes';
    }
    if (kpiMesMonto) kpiMesMonto.textContent = formatCurrency(s.mesMonto);
    if (kpiMesCantidad) {
      kpiMesCantidad.textContent = `${s.mesCantidad} documento(s) en ${p.mesActualNombre || 'este mes'} (${p.mesPasadoNombre || 'mes ant.'}: ${formatCurrency(s.mesPasadoMonto)})`;
    }

    if (kpiAnioLabel) {
      kpiAnioLabel.textContent = p.anioActual
        ? `Ingresos del Año ${p.anioActual}`
        : 'Ingresos del Año';
    }
    if (kpiTotalMonto) kpiTotalMonto.textContent = formatCurrency(s.anioMonto ?? s.totalMonto);
    if (kpiUtilidad) {
      kpiUtilidad.textContent = `Utilidad ${p.anioActual || 'anual'}: ${formatCurrency(s.anioUtilidad ?? s.utilidadEstimada)} (${s.anioCantidad ?? s.totalCantidad} ventas)`;
    }

    if (kpiStockBajo) kpiStockBajo.textContent = s.stockTotalAvisos ?? s.totalStockBajo;
    if (kpiTotalProductos) {
      kpiTotalProductos.textContent = `${s.stockCriticoCount || 0} crítico · ${s.stockPrecaucionCount || 0} precaución · ${s.stockSugerenciaCount || 0} sugerencia (de ${s.totalProductosActivos} activos)`;
    }

    renderAnnualIncomeTable(data.annualIncomeByMonth || [], data.annualTotals || {}, p);
    renderMonthComparisonTable(data.previous30DaysComparison || {});
    renderLowStock(data.lowStockProducts || [], s);
    renderTopSelling(data.topSellingProducts || []);
    renderRecentSales(data.recentSales || []);
  } catch (err) {
    if (err && err.status === 404) {
      window.location.href = '/';
      return;
    }
    setNavDbStatusText('Sin archivo DB cargado');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Actualizar datos';
    }
  }
}

export function initInicioModule() {
  stockTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeStockAlertFilter = btn.dataset.alertFilter || 'ALL';
      stockTabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      renderLowStock(cachedDashboardStockAlerts);
    });
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDashboard);
  }
}
