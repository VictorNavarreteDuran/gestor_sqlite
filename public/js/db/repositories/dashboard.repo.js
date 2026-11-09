import {
  MESES_NOMBRES_ES,
} from '../constants.js';
import {
  activeFileMeta,
  ensureLoadedInTab,
  listUserTables,
  queryAll,
  queryGet,
  requireActiveDb,
} from '../engine.js';

// ==========================================
// CONSULTAS DEL PANEL DE INICIO (DASHBOARD)
// ==========================================

export async function getDashboardData() {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const existingTables = new Set(listUserTables(db));

  const now = new Date();
  const anioActual = String(now.getFullYear());
  const mesActualIdx = now.getMonth();
  const mesActualNum = String(mesActualIdx + 1).padStart(2, '0');
  const mesActualKey = `${anioActual}-${mesActualNum}`;
  const mesActualNombre = MESES_NOMBRES_ES[mesActualIdx];
  const mesActualLabel = `${mesActualNombre} ${anioActual}`;

  const prevDate = new Date(now.getFullYear(), mesActualIdx - 1, 1);
  const anioPasado = String(prevDate.getFullYear());
  const mesPasadoIdx = prevDate.getMonth();
  const mesPasadoNum = String(mesPasadoIdx + 1).padStart(2, '0');
  const mesPasadoKey = `${anioPasado}-${mesPasadoNum}`;
  const mesPasadoNombre = MESES_NOMBRES_ES[mesPasadoIdx];
  const mesPasadoLabel = `${mesPasadoNombre} ${anioPasado}`;

  const diaHoyNum = String(now.getDate()).padStart(2, '0');
  const hoyKey = `${anioActual}-${mesActualNum}-${diaHoyNum}`;
  const hoyLabel = `${now.getDate()} de ${mesActualNombre} de ${anioActual}`;

  // Límites de rango ISO (SARGables) para aprovechar el índice B-Tree idx_ventas_estado_fecha(estado, fecha_venta)
  const tomorrowDate = new Date(now.getFullYear(), mesActualIdx, now.getDate() + 1);
  const mananaKey = `${tomorrowDate.getFullYear()}-${String(
    tomorrowDate.getMonth() + 1
  ).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  // Rango de los 30 días anteriores al día de hoy (desde hoy - 30 días hasta ayer inclusive)
  const prev30StartDate = new Date(now.getFullYear(), mesActualIdx, now.getDate() - 30);
  const prev30StartKey = `${prev30StartDate.getFullYear()}-${String(
    prev30StartDate.getMonth() + 1
  ).padStart(2, '0')}-${String(prev30StartDate.getDate()).padStart(2, '0')}`;
  const prev30EndDate = new Date(now.getFullYear(), mesActualIdx, now.getDate() - 1);
  const prev30EndKey = `${prev30EndDate.getFullYear()}-${String(
    prev30EndDate.getMonth() + 1
  ).padStart(2, '0')}-${String(prev30EndDate.getDate()).padStart(2, '0')}`;
  const prev30RangeLabel = `${String(prev30StartDate.getDate()).padStart(2, '0')}/${String(
    prev30StartDate.getMonth() + 1
  ).padStart(2, '0')}/${prev30StartDate.getFullYear()} al ${String(
    prev30EndDate.getDate()
  ).padStart(2, '0')}/${String(prev30EndDate.getMonth() + 1).padStart(
    2,
    '0'
  )}/${prev30EndDate.getFullYear()}`;
  const prev30ShortRangeLabel = `${String(prev30StartDate.getDate()).padStart(
    2,
    '0'
  )} ${MESES_NOMBRES_ES[prev30StartDate.getMonth()].slice(0, 3)} – ${String(
    prev30EndDate.getDate()
  ).padStart(2, '0')} ${MESES_NOMBRES_ES[prev30EndDate.getMonth()].slice(0, 3)}`;

  const nextMonthDate = new Date(now.getFullYear(), mesActualIdx + 1, 1);
  const mesSiguienteKey = `${nextMonthDate.getFullYear()}-${String(
    nextMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const mesActualInicioIso = `${mesActualKey}-01`;
  const mesSiguienteInicioIso = `${mesSiguienteKey}-01`;
  const mesPasadoInicioIso = `${mesPasadoKey}-01`;
  const anioInicioIso = `${anioActual}-01-01`;
  const anioFinExclusivoIso = `${Number(anioActual) + 1}-01-01`;

  // Rango de los últimos 13 meses (desde el mismo mes del año pasado hasta el mes actual inclusive)
  const start13MonthsDate = new Date(now.getFullYear(), mesActualIdx - 12, 1);
  const start13MonthsAnio = String(start13MonthsDate.getFullYear());
  const start13MonthsMesIdx = start13MonthsDate.getMonth();
  const start13MonthsMesNum = String(start13MonthsMesIdx + 1).padStart(2, '0');
  const start13MonthsKey = `${start13MonthsAnio}-${start13MonthsMesNum}`;
  const start13MonthsInicioIso = `${start13MonthsKey}-01`;
  const rango13MesesLabel = `${MESES_NOMBRES_ES[start13MonthsMesIdx].slice(0, 3)} ${start13MonthsAnio} – ${mesActualNombre.slice(0, 3)} ${anioActual}`;

  const periodInfo = {
    hoyKey,
    hoyLabel,
    anioActual,
    mesActualNum,
    mesActualKey,
    mesActualNombre,
    mesActualLabel,
    anioPasado,
    mesPasadoNum,
    mesPasadoKey,
    mesPasadoNombre,
    mesPasadoLabel,
    start13MonthsKey,
    rango13MesesLabel,
  };

  const salesSummary = {
    hoyMonto: 0,
    hoyCantidad: 0,
    mesMonto: 0,
    mesCantidad: 0,
    mesPasadoMonto: 0,
    mesPasadoCantidad: 0,
    anioMonto: 0,
    anioCantidad: 0,
    anioUtilidad: 0,
    totalMonto: 0,
    totalCantidad: 0,
    utilidadEstimada: 0,
    ticketPromedio: 0,
    totalProductosActivos: 0,
    totalStockBajo: 0,
    stockCriticoCount: 0,
    stockPrecaucionCount: 0,
    stockSugerenciaCount: 0,
    stockTotalAvisos: 0,
  };

  let lowStockProducts = [];
  let topSellingProducts = [];
  let recentSales = [];
  let annualIncomeByMonth = [];
  const annualTotals = {
    anio: anioActual,
    rango_label: rango13MesesLabel,
    cantidad_ventas: 0,
    subtotal_neto: 0,
    total_iva: 0,
    descuento_global: 0,
    total_venta: 0,
    unidades_vendidas: 0,
    utilidad_estimada: 0,
  };

  const monthComparison = {
    mesActualLabel,
    mesPasadoLabel,
    mesActualNombre,
    mesPasadoNombre,
    actual: {
      cantidad_ventas: 0,
      subtotal_neto: 0,
      total_iva: 0,
      descuento_global: 0,
      total_venta: 0,
      ticket_promedio: 0,
      unidades_vendidas: 0,
      utilidad_estimada: 0,
    },
    pasado: {
      cantidad_ventas: 0,
      subtotal_neto: 0,
      total_iva: 0,
      descuento_global: 0,
      total_venta: 0,
      ticket_promedio: 0,
      unidades_vendidas: 0,
      utilidad_estimada: 0,
    },
  };

  const previous30DaysComparison = {
    hoyKey,
    hoyLabel,
    rangoInicioKey: prev30StartKey,
    rangoFinKey: prev30EndKey,
    rangoLabel: prev30RangeLabel,
    rangoCortoLabel: prev30ShortRangeLabel,
    dias: [],
    hoy: {
      cantidad_ventas: 0,
      subtotal_neto: 0,
      total_iva: 0,
      descuento_global: 0,
      total_venta: 0,
      ticket_promedio: 0,
      unidades_vendidas: 0,
      utilidad_estimada: 0,
    },
    ayer: {
      fecha_key: prev30EndKey,
      cantidad_ventas: 0,
      total_venta: 0,
      utilidad_estimada: 0,
    },
    acumulado30Dias: {
      dias_con_ventas: 0,
      cantidad_ventas: 0,
      subtotal_neto: 0,
      total_iva: 0,
      descuento_global: 0,
      total_venta: 0,
      promedio_diario_venta: 0,
      promedio_diario_utilidad: 0,
      promedio_diario_ventas_docs: 0,
      promedio_diario_unidades: 0,
      ticket_promedio: 0,
      unidades_vendidas: 0,
      utilidad_estimada: 0,
    },
  };

  if (existingTables.has('ventas')) {
    const hoy = queryGet(
      db,
      `SELECT COALESCE(SUM(total_venta), 0) AS monto,
              COALESCE(SUM(subtotal_neto), 0) AS neto,
              COALESCE(SUM(total_iva), 0) AS iva,
              COALESCE(SUM(descuento_global), 0) AS descuento,
              COUNT(*) AS cantidad
       FROM ventas
       WHERE estado = 'COMPLETADA' AND fecha_venta >= ? AND fecha_venta < ?`,
      [hoyKey, mananaKey]
    );

    const mes = queryGet(
      db,
      `SELECT COALESCE(SUM(total_venta), 0) AS monto,
              COALESCE(SUM(subtotal_neto), 0) AS neto,
              COALESCE(SUM(total_iva), 0) AS iva,
              COALESCE(SUM(descuento_global), 0) AS descuento,
              COUNT(*) AS cantidad
       FROM ventas
       WHERE estado = 'COMPLETADA' AND fecha_venta >= ? AND fecha_venta < ?`,
      [mesActualInicioIso, mesSiguienteInicioIso]
    );

    const mesPasado = queryGet(
      db,
      `SELECT COALESCE(SUM(total_venta), 0) AS monto,
              COALESCE(SUM(subtotal_neto), 0) AS neto,
              COALESCE(SUM(total_iva), 0) AS iva,
              COALESCE(SUM(descuento_global), 0) AS descuento,
              COUNT(*) AS cantidad
       FROM ventas
       WHERE estado = 'COMPLETADA' AND fecha_venta >= ? AND fecha_venta < ?`,
      [mesPasadoInicioIso, mesActualInicioIso]
    );

    const total = queryGet(
      db,
      `SELECT COALESCE(SUM(total_venta), 0) AS monto, COUNT(*) AS cantidad
       FROM ventas
       WHERE estado = 'COMPLETADA'`
    );

    salesSummary.hoyMonto = Number(hoy?.monto) || 0;
    salesSummary.hoyCantidad = Number(hoy?.cantidad) || 0;
    salesSummary.mesMonto = Number(mes?.monto) || 0;
    salesSummary.mesCantidad = Number(mes?.cantidad) || 0;
    salesSummary.mesPasadoMonto = Number(mesPasado?.monto) || 0;
    salesSummary.mesPasadoCantidad = Number(mesPasado?.cantidad) || 0;
    salesSummary.totalMonto = Number(total?.monto) || 0;
    salesSummary.totalCantidad = Number(total?.cantidad) || 0;
    salesSummary.ticketPromedio =
      salesSummary.totalCantidad > 0 ? salesSummary.totalMonto / salesSummary.totalCantidad : 0;

    previous30DaysComparison.hoy.cantidad_ventas = salesSummary.hoyCantidad;
    previous30DaysComparison.hoy.subtotal_neto = Number(hoy?.neto) || 0;
    previous30DaysComparison.hoy.total_iva = Number(hoy?.iva) || 0;
    previous30DaysComparison.hoy.descuento_global = Number(hoy?.descuento) || 0;
    previous30DaysComparison.hoy.total_venta = salesSummary.hoyMonto;
    previous30DaysComparison.hoy.ticket_promedio =
      salesSummary.hoyCantidad > 0 ? salesSummary.hoyMonto / salesSummary.hoyCantidad : 0;

    // Desglose diario de los 30 días anteriores al día de hoy (prev30StartKey <= fecha_venta < hoyKey)
    const ventasPrev30Rows = queryAll(
      db,
      `SELECT SUBSTR(fecha_venta, 1, 10) AS fecha_dia,
              COUNT(*) AS cantidad_ventas,
              COALESCE(SUM(subtotal_neto), 0) AS subtotal_neto,
              COALESCE(SUM(total_iva), 0) AS total_iva,
              COALESCE(SUM(descuento_global), 0) AS descuento_global,
              COALESCE(SUM(total_venta), 0) AS total_venta
       FROM ventas
       WHERE estado = 'COMPLETADA' AND fecha_venta >= ? AND fecha_venta < ?
       GROUP BY SUBSTR(fecha_venta, 1, 10)
       ORDER BY fecha_dia ASC`,
      [prev30StartKey, hoyKey]
    );

    const detallePrev30Map = new Map();
    if (existingTables.has('detalle_ventas')) {
      const detallePrev30Rows = queryAll(
        db,
        `SELECT SUBSTR(v.fecha_venta, 1, 10) AS fecha_dia,
                COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad_estimada
         FROM ventas v
         INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
         WHERE v.estado = 'COMPLETADA' AND v.fecha_venta >= ? AND v.fecha_venta < ?
         GROUP BY SUBSTR(v.fecha_venta, 1, 10)`,
        [prev30StartKey, hoyKey]
      );
      for (const r of detallePrev30Rows) {
        detallePrev30Map.set(String(r.fecha_dia), {
          unidades_vendidas: Number(r.unidades_vendidas) || 0,
          utilidad_estimada: Number(r.utilidad_estimada) || 0,
        });
      }

      const hoyDetalleRow = queryGet(
        db,
        `SELECT COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad_estimada
         FROM ventas v
         INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
         WHERE v.estado = 'COMPLETADA' AND v.fecha_venta >= ? AND v.fecha_venta < ?`,
        [hoyKey, mananaKey]
      );
      previous30DaysComparison.hoy.unidades_vendidas = Number(hoyDetalleRow?.unidades_vendidas) || 0;
      previous30DaysComparison.hoy.utilidad_estimada = Number(hoyDetalleRow?.utilidad_estimada) || 0;
    }

    const ventasPrev30Map = new Map();
    for (const r of ventasPrev30Rows) {
      ventasPrev30Map.set(String(r.fecha_dia), r);
    }

    const dias30List = [];
    for (let offset = 30; offset >= 1; offset--) {
      const dObj = new Date(now.getFullYear(), mesActualIdx, now.getDate() - offset);
      const fKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(
        dObj.getDate()
      ).padStart(2, '0')}`;
      const diaStr = String(dObj.getDate()).padStart(2, '0');
      const mesStr = String(dObj.getMonth() + 1).padStart(2, '0');
      const mesCorto = MESES_NOMBRES_ES[dObj.getMonth()].slice(0, 3);

      const vRow = ventasPrev30Map.get(fKey);
      const dRow = detallePrev30Map.get(fKey);

      const cantidad_ventas = Number(vRow?.cantidad_ventas) || 0;
      const subtotal_neto = Number(vRow?.subtotal_neto) || 0;
      const total_iva = Number(vRow?.total_iva) || 0;
      const descuento_global = Number(vRow?.descuento_global) || 0;
      const total_venta = Number(vRow?.total_venta) || 0;
      const unidades_vendidas = Number(dRow?.unidades_vendidas) || 0;
      const utilidad_estimada = Number(dRow?.utilidad_estimada) || 0;

      if (cantidad_ventas > 0 || total_venta > 0) {
        previous30DaysComparison.acumulado30Dias.dias_con_ventas += 1;
      }
      previous30DaysComparison.acumulado30Dias.cantidad_ventas += cantidad_ventas;
      previous30DaysComparison.acumulado30Dias.subtotal_neto += subtotal_neto;
      previous30DaysComparison.acumulado30Dias.total_iva += total_iva;
      previous30DaysComparison.acumulado30Dias.descuento_global += descuento_global;
      previous30DaysComparison.acumulado30Dias.total_venta += total_venta;
      previous30DaysComparison.acumulado30Dias.unidades_vendidas += unidades_vendidas;
      previous30DaysComparison.acumulado30Dias.utilidad_estimada += utilidad_estimada;

      const dayItem = {
        fecha_key: fKey,
        etiqueta_corta: `${diaStr}/${mesStr}`,
        etiqueta_larga: `${dObj.getDate()} ${mesCorto} ${dObj.getFullYear()}`,
        es_ayer: offset === 1,
        cantidad_ventas,
        subtotal_neto,
        total_iva,
        descuento_global,
        total_venta,
        unidades_vendidas,
        utilidad_estimada,
      };
      dias30List.push(dayItem);

      if (offset === 1) {
        previous30DaysComparison.ayer = {
          fecha_key: fKey,
          etiqueta_corta: dayItem.etiqueta_corta,
          etiqueta_larga: dayItem.etiqueta_larga,
          cantidad_ventas,
          total_venta,
          utilidad_estimada,
        };
      }
    }

    previous30DaysComparison.dias = dias30List;
    previous30DaysComparison.acumulado30Dias.promedio_diario_venta =
      previous30DaysComparison.acumulado30Dias.total_venta / 30;
    previous30DaysComparison.acumulado30Dias.promedio_diario_utilidad =
      previous30DaysComparison.acumulado30Dias.utilidad_estimada / 30;
    previous30DaysComparison.acumulado30Dias.promedio_diario_ventas_docs =
      previous30DaysComparison.acumulado30Dias.cantidad_ventas / 30;
    previous30DaysComparison.acumulado30Dias.promedio_diario_unidades =
      previous30DaysComparison.acumulado30Dias.unidades_vendidas / 30;
    previous30DaysComparison.acumulado30Dias.ticket_promedio =
      previous30DaysComparison.acumulado30Dias.cantidad_ventas > 0
        ? previous30DaysComparison.acumulado30Dias.total_venta /
          previous30DaysComparison.acumulado30Dias.cantidad_ventas
        : 0;

    monthComparison.actual.cantidad_ventas = salesSummary.mesCantidad;
    monthComparison.actual.subtotal_neto = Number(mes?.neto) || 0;
    monthComparison.actual.total_iva = Number(mes?.iva) || 0;
    monthComparison.actual.descuento_global = Number(mes?.descuento) || 0;
    monthComparison.actual.total_venta = salesSummary.mesMonto;
    monthComparison.actual.ticket_promedio =
      salesSummary.mesCantidad > 0 ? salesSummary.mesMonto / salesSummary.mesCantidad : 0;

    monthComparison.pasado.cantidad_ventas = salesSummary.mesPasadoCantidad;
    monthComparison.pasado.subtotal_neto = Number(mesPasado?.neto) || 0;
    monthComparison.pasado.total_iva = Number(mesPasado?.iva) || 0;
    monthComparison.pasado.descuento_global = Number(mesPasado?.descuento) || 0;
    monthComparison.pasado.total_venta = salesSummary.mesPasadoMonto;
    monthComparison.pasado.ticket_promedio =
      salesSummary.mesPasadoCantidad > 0
        ? salesSummary.mesPasadoMonto / salesSummary.mesPasadoCantidad
        : 0;

    // Desglose mensual de los últimos 13 meses (desde hace 12 meses hasta el mes actual inclusive) usando rango indexado
    const ventasPorMesRows = queryAll(
      db,
      `SELECT SUBSTR(fecha_venta, 1, 7) AS periodo_ym,
              COUNT(*) AS cantidad_ventas,
              COALESCE(SUM(subtotal_neto), 0) AS subtotal_neto,
              COALESCE(SUM(total_iva), 0) AS total_iva,
              COALESCE(SUM(descuento_global), 0) AS descuento_global,
              COALESCE(SUM(total_venta), 0) AS total_venta
       FROM ventas
       WHERE estado = 'COMPLETADA' AND fecha_venta >= ? AND fecha_venta < ?
       GROUP BY SUBSTR(fecha_venta, 1, 7)
       ORDER BY periodo_ym ASC`,
      [start13MonthsInicioIso, mesSiguienteInicioIso]
    );

    const detallePorMesMap = new Map();
    if (existingTables.has('detalle_ventas')) {
      const detallePorMesRows = queryAll(
        db,
        `SELECT SUBSTR(v.fecha_venta, 1, 7) AS periodo_ym,
                COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
                COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad_estimada
         FROM ventas v
         INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
         WHERE v.estado = 'COMPLETADA' AND v.fecha_venta >= ? AND v.fecha_venta < ?
         GROUP BY SUBSTR(v.fecha_venta, 1, 7)`,
        [start13MonthsInicioIso, mesSiguienteInicioIso]
      );
      for (const r of detallePorMesRows) {
        detallePorMesMap.set(String(r.periodo_ym), {
          unidades_vendidas: Number(r.unidades_vendidas) || 0,
          utilidad_estimada: Number(r.utilidad_estimada) || 0,
        });
      }
    }

    const ventasPorMesMap = new Map();
    for (const r of ventasPorMesRows) {
      ventasPorMesMap.set(String(r.periodo_ym), r);
    }

    const months13List = [];
    for (let mOffset = 12; mOffset >= 0; mOffset--) {
      const mDate = new Date(now.getFullYear(), mesActualIdx - mOffset, 1);
      const mAnio = String(mDate.getFullYear());
      const mIdx = mDate.getMonth();
      const mNum = String(mIdx + 1).padStart(2, '0');
      const ymKey = `${mAnio}-${mNum}`;
      const nombreMes = MESES_NOMBRES_ES[mIdx];
      const shortYear = mAnio.slice(-2);

      const vRow = ventasPorMesMap.get(ymKey);
      const dRow = detallePorMesMap.get(ymKey);

      const cantidad_ventas = Number(vRow?.cantidad_ventas) || 0;
      const subtotal_neto = Number(vRow?.subtotal_neto) || 0;
      const total_iva = Number(vRow?.total_iva) || 0;
      const descuento_global = Number(vRow?.descuento_global) || 0;
      const total_venta = Number(vRow?.total_venta) || 0;
      const unidades_vendidas = Number(dRow?.unidades_vendidas) || 0;
      const utilidad_estimada = Number(dRow?.utilidad_estimada) || 0;

      annualTotals.cantidad_ventas += cantidad_ventas;
      annualTotals.subtotal_neto += subtotal_neto;
      annualTotals.total_iva += total_iva;
      annualTotals.descuento_global += descuento_global;
      annualTotals.total_venta += total_venta;
      annualTotals.unidades_vendidas += unidades_vendidas;
      annualTotals.utilidad_estimada += utilidad_estimada;

      if (mAnio === anioActual) {
        salesSummary.anioMonto += total_venta;
        salesSummary.anioCantidad += cantidad_ventas;
        salesSummary.anioUtilidad += utilidad_estimada;
      }

      months13List.push({
        periodo_ym: ymKey,
        anio: mAnio,
        mes_num: mNum,
        mes_nombre: nombreMes,
        mes_etiqueta_larga: `${nombreMes} ${mAnio}`,
        mes_etiqueta_corta: `${nombreMes.slice(0, 3)}'${shortYear}`,
        es_mes_actual: mOffset === 0,
        es_mismo_mes_anio_anterior: mOffset === 12,
        cantidad_ventas,
        subtotal_neto,
        total_iva,
        descuento_global,
        total_venta,
        unidades_vendidas,
        utilidad_estimada,
      });
    }

    annualIncomeByMonth = months13List;

    if (existingTables.has('clientes')) {
      recentSales = queryAll(
        db,
        `SELECT v.id_venta, v.tipo_documento, v.folio_documento, v.fecha_venta,
                v.total_venta, v.estado, COALESCE(c.nombre, 'Cliente General') AS cliente
         FROM ventas v
         LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
         ORDER BY v.fecha_venta DESC, v.id_venta DESC
         LIMIT 6`
      );
    }
  }

  if (existingTables.has('detalle_ventas') && existingTables.has('ventas')) {
    const utilidad = queryGet(
      db,
      `SELECT COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad
       FROM ventas v
       INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
       WHERE v.estado = 'COMPLETADA'`
    );
    salesSummary.utilidadEstimada = Number(utilidad?.utilidad) || 0;

    const compDetalleRows = queryAll(
      db,
      `SELECT SUBSTR(v.fecha_venta, 1, 7) AS periodo,
              COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
              COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad_estimada
       FROM ventas v
       INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
       WHERE v.estado = 'COMPLETADA'
         AND v.fecha_venta >= ?
         AND v.fecha_venta < ?
       GROUP BY SUBSTR(v.fecha_venta, 1, 7)`,
      [mesPasadoInicioIso, mesSiguienteInicioIso]
    );

    for (const r of compDetalleRows) {
      if (r.periodo === mesActualKey) {
        monthComparison.actual.unidades_vendidas = Number(r.unidades_vendidas) || 0;
        monthComparison.actual.utilidad_estimada = Number(r.utilidad_estimada) || 0;
      } else if (r.periodo === mesPasadoKey) {
        monthComparison.pasado.unidades_vendidas = Number(r.unidades_vendidas) || 0;
        monthComparison.pasado.utilidad_estimada = Number(r.utilidad_estimada) || 0;
      }
    }
  }

  if (existingTables.has('productos')) {
    // Clasificación de avisos de stock con margen de ±7 unidades respecto al stock_minimo:
    // - CRITICO: 7 o más productos por debajo del stock mínimo (o stock_actual <= 0)
    // - PRECAUCION: en el stock mínimo o hasta 7 productos por debajo (stock_minimo - 7 < stock_actual <= stock_minimo)
    // - SUGERENCIA: hasta 7 productos por arriba del stock mínimo (stock_minimo < stock_actual <= stock_minimo + 7)
    const prodStats = queryGet(
      db,
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo,
              COALESCE(SUM(CASE WHEN stock_actual <= 0 OR stock_actual <= (stock_minimo - 7) THEN 1 ELSE 0 END), 0) AS critico,
              COALESCE(SUM(CASE WHEN stock_actual > 0 AND stock_actual > (stock_minimo - 7) AND stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS precaucion,
              COALESCE(SUM(CASE WHEN stock_actual > stock_minimo AND stock_actual <= (stock_minimo + 7) THEN 1 ELSE 0 END), 0) AS sugerencia
       FROM productos
       WHERE activo = 1`
    );

    salesSummary.totalProductosActivos = Number(prodStats?.total) || 0;
    salesSummary.totalStockBajo = Number(prodStats?.bajo) || 0;
    salesSummary.stockCriticoCount = Number(prodStats?.critico) || 0;
    salesSummary.stockPrecaucionCount = Number(prodStats?.precaucion) || 0;
    salesSummary.stockSugerenciaCount = Number(prodStats?.sugerencia) || 0;
    salesSummary.stockTotalAvisos =
      salesSummary.stockCriticoCount +
      salesSummary.stockPrecaucionCount +
      salesSummary.stockSugerenciaCount;

    const hasCategorias = existingTables.has('categorias');
    lowStockProducts = queryAll(
      db,
      hasCategorias
        ? `SELECT p.id_producto, p.sku, p.codigo_barras, p.nombre, p.unidad_medida,
                  p.stock_actual, p.stock_minimo, p.precio_venta_final,
                  (p.stock_actual - p.stock_minimo) AS diferencia_minimo,
                  CASE
                    WHEN p.stock_actual <= 0 OR p.stock_actual <= (p.stock_minimo - 7) THEN 'CRITICO'
                    WHEN p.stock_actual <= p.stock_minimo THEN 'PRECAUCION'
                    ELSE 'SUGERENCIA'
                  END AS categoria_aviso,
                  COALESCE(c.nombre, 'Sin categoría') AS categoria
           FROM productos p
           LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
           WHERE p.activo = 1 AND p.stock_actual <= (p.stock_minimo + 7)
           ORDER BY
             CASE
               WHEN p.stock_actual <= 0 OR p.stock_actual <= (p.stock_minimo - 7) THEN 1
               WHEN p.stock_actual <= p.stock_minimo THEN 2
               ELSE 3
             END ASC,
             (p.stock_actual - p.stock_minimo) ASC,
             p.stock_actual ASC
           LIMIT 30`
        : `SELECT p.id_producto, p.sku, p.codigo_barras, p.nombre, p.unidad_medida,
                  p.stock_actual, p.stock_minimo, p.precio_venta_final,
                  (p.stock_actual - p.stock_minimo) AS diferencia_minimo,
                  CASE
                    WHEN p.stock_actual <= 0 OR p.stock_actual <= (p.stock_minimo - 7) THEN 'CRITICO'
                    WHEN p.stock_actual <= p.stock_minimo THEN 'PRECAUCION'
                    ELSE 'SUGERENCIA'
                  END AS categoria_aviso,
                  'Sin categoría' AS categoria
           FROM productos p
           WHERE p.activo = 1 AND p.stock_actual <= (p.stock_minimo + 7)
           ORDER BY
             CASE
               WHEN p.stock_actual <= 0 OR p.stock_actual <= (p.stock_minimo - 7) THEN 1
               WHEN p.stock_actual <= p.stock_minimo THEN 2
               ELSE 3
             END ASC,
             (p.stock_actual - p.stock_minimo) ASC,
             p.stock_actual ASC
           LIMIT 30`
    );
  }

  if (
    existingTables.has('detalle_ventas') &&
    existingTables.has('ventas') &&
    existingTables.has('productos')
  ) {
    // Solo muestra los 5 productos más vendidos de la tienda
    topSellingProducts = queryAll(
      db,
      `SELECT p.id_producto, p.sku, p.nombre, p.unidad_medida, p.stock_actual, p.precio_venta_final,
              COALESCE(SUM(dv.cantidad), 0) AS total_vendido,
              COALESCE(SUM(dv.subtotal), 0) AS ingresos_generados,
              COUNT(DISTINCT dv.id_venta) AS num_ventas
       FROM detalle_ventas dv
       INNER JOIN ventas v ON v.id_venta = dv.id_venta
       INNER JOIN productos p ON p.id_producto = dv.id_producto
       WHERE v.estado = 'COMPLETADA'
       GROUP BY p.id_producto
       ORDER BY total_vendido DESC, ingresos_generados DESC
       LIMIT 5`
    );
  }

  return {
    database: { ...activeFileMeta },
    periodInfo,
    salesSummary,
    annualIncomeByMonth,
    annualTotals,
    monthComparison,
    previous30DaysComparison,
    lowStockProducts,
    topSellingProducts,
    recentSales,
  };
}
