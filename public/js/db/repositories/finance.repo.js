import {
  MESES_NOMBRES_ES,
} from '../constants.js';
import {
  activeFileMeta,
  ensureLoadedInTab,
  listUserTables,
  queryAll,
  requireActiveDb,
} from '../engine.js';

// ==========================================
// SECCIÓN FINANZAS (INGRESOS, EGRESOS, IVA Y PÉRDIDAS POR MERMA / BAJA DE PRODUCTO)
// Soporta ventanas de: 1 (Mes actual), 3, 6 y 12 meses.
// ==========================================
export async function getFinanceSectionData(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const existingTables = new Set(listUserTables(db));

  const allowedPeriods = [1, 3, 6, 12];
  const requestedMonths = Number(params.meses ?? params.periodMonths ?? 1);
  const periodMonths = allowedPeriods.includes(requestedMonths) ? requestedMonths : 1;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  // Mes inicial del rango solicitado (1 = solo mes actual; 3 = últimos 3 meses; 6 = últimos 6; 12 = últimos 12)
  const startMonthDate = new Date(currentYear, currentMonthIdx - (periodMonths - 1), 1);
  const startYear = String(startMonthDate.getFullYear());
  const startMonthNum = String(startMonthDate.getMonth() + 1).padStart(2, '0');
  const startMonthIso = `${startYear}-${startMonthNum}-01`;

  // Límite superior exclusivo (inicio del mes siguiente al actual)
  const nextMonthDate = new Date(currentYear, currentMonthIdx + 1, 1);
  const nextYear = String(nextMonthDate.getFullYear());
  const nextMonthNum = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
  const endMonthExclusiveIso = `${nextYear}-${nextMonthNum}-01`;

  const currentMonthName = MESES_NOMBRES_ES[currentMonthIdx];
  const startMonthName = MESES_NOMBRES_ES[startMonthDate.getMonth()];
  const periodLabel =
    periodMonths === 1
      ? `Mes Actual (${currentMonthName} ${currentYear})`
      : `Últimos ${periodMonths} Meses (${startMonthName.slice(0, 3)} ${startYear} – ${currentMonthName.slice(0, 3)} ${currentYear})`;

  // Mapas por mes YYYY-MM
  const ventasByMonthMap = new Map();
  const costoVentasByMonthMap = new Map();
  const comprasByMonthMap = new Map();
  const entradasSinDocByMonthMap = new Map();
  const mermasByMonthMap = new Map();

  // 1. Ingresos y Débito Fiscal IVA desde tabla `ventas` (estado = 'COMPLETADA')
  let ventasPorTipoDoc = [];
  let ventasPorMetodoPago = [];
  if (existingTables.has('ventas')) {
    const ventasRows = queryAll(
      db,
      `SELECT SUBSTR(fecha_venta, 1, 7) AS periodo_ym,
              COUNT(*) AS cantidad_ventas,
              COALESCE(SUM(subtotal_neto), 0) AS ventas_neto,
              COALESCE(SUM(total_iva), 0) AS iva_debito_ventas,
              COALESCE(SUM(descuento_global), 0) AS descuento_global,
              COALESCE(SUM(total_venta), 0) AS ingresos_brutos
       FROM ventas
       WHERE estado = 'COMPLETADA'
         AND fecha_venta >= ?
         AND fecha_venta < ?
       GROUP BY SUBSTR(fecha_venta, 1, 7)
       ORDER BY periodo_ym ASC`,
      [startMonthIso, endMonthExclusiveIso]
    );
    for (const r of ventasRows) {
      ventasByMonthMap.set(String(r.periodo_ym), r);
    }

    ventasPorTipoDoc = queryAll(
      db,
      `SELECT tipo_documento,
              COUNT(*) AS cantidad_docs,
              COALESCE(SUM(subtotal_neto), 0) AS subtotal_neto,
              COALESCE(SUM(total_iva), 0) AS total_iva,
              COALESCE(SUM(descuento_global), 0) AS descuento_global,
              COALESCE(SUM(total_venta), 0) AS total_venta
       FROM ventas
       WHERE estado = 'COMPLETADA'
         AND fecha_venta >= ?
         AND fecha_venta < ?
       GROUP BY tipo_documento
       ORDER BY total_venta DESC`,
      [startMonthIso, endMonthExclusiveIso]
    );

    if (existingTables.has('pagos_venta')) {
      ventasPorMetodoPago = queryAll(
        db,
        `SELECT pv.metodo_pago,
                COUNT(DISTINCT pv.id_venta) AS cantidad_ventas,
                COALESCE(SUM(pv.monto), 0) AS monto_recaudado
         FROM pagos_venta pv
         INNER JOIN ventas v ON v.id_venta = pv.id_venta
         WHERE v.estado = 'COMPLETADA'
           AND v.fecha_venta >= ?
           AND v.fecha_venta < ?
         GROUP BY pv.metodo_pago
         ORDER BY monto_recaudado DESC`,
        [startMonthIso, endMonthExclusiveIso]
      );
    }
  }

  // 2. Costo histórico de ventas (COGS) desde `detalle_ventas`
  if (existingTables.has('detalle_ventas') && existingTables.has('ventas')) {
    const cogsRows = queryAll(
      db,
      `SELECT SUBSTR(v.fecha_venta, 1, 7) AS periodo_ym,
              COALESCE(SUM(dv.cantidad), 0) AS unidades_vendidas,
              COALESCE(SUM(dv.costo_unitario_historico * dv.cantidad), 0) AS costo_ventas_historico
       FROM ventas v
       INNER JOIN detalle_ventas dv ON dv.id_venta = v.id_venta
       WHERE v.estado = 'COMPLETADA'
         AND v.fecha_venta >= ?
         AND v.fecha_venta < ?
       GROUP BY SUBSTR(v.fecha_venta, 1, 7)`,
      [startMonthIso, endMonthExclusiveIso]
    );
    for (const r of cogsRows) {
      costoVentasByMonthMap.set(String(r.periodo_ym), r);
    }
  }

  // 3. Egresos por Compras y Crédito Fiscal IVA desde tabla `compras` (estado = 'RECIBIDA')
  let comprasPorTipoDoc = [];
  if (existingTables.has('compras')) {
    const comprasRows = queryAll(
      db,
      `SELECT SUBSTR(fecha_emision, 1, 7) AS periodo_ym,
              COUNT(*) AS cantidad_compras,
              COALESCE(SUM(total_neto), 0) AS compras_neto,
              COALESCE(SUM(total_iva), 0) AS iva_credito_compras,
              COALESCE(SUM(total_compra), 0) AS egresos_compras_bruto
       FROM compras
       WHERE estado = 'RECIBIDA'
         AND fecha_emision >= ?
         AND fecha_emision < ?
       GROUP BY SUBSTR(fecha_emision, 1, 7)
       ORDER BY periodo_ym ASC`,
      [startMonthIso, endMonthExclusiveIso]
    );
    for (const r of comprasRows) {
      comprasByMonthMap.set(String(r.periodo_ym), r);
    }

    comprasPorTipoDoc = queryAll(
      db,
      `SELECT tipo_documento,
              COUNT(*) AS cantidad_docs,
              COALESCE(SUM(total_neto), 0) AS total_neto,
              COALESCE(SUM(total_iva), 0) AS total_iva,
              COALESCE(SUM(total_compra), 0) AS total_compra
       FROM compras
       WHERE estado = 'RECIBIDA'
         AND fecha_emision >= ?
         AND fecha_emision < ?
       GROUP BY tipo_documento
       ORDER BY total_compra DESC`,
      [startMonthIso, endMonthExclusiveIso]
    );
  }

  // 4. Entradas de bodega directas por Kardex (`ENTRADA_COMPRA`) y Pérdidas por Merma / Baja de Producto (`MERMA`, `AJUSTE_NEGATIVO`)
  let resumenPerdidasPorTipo = [];
  let detalleMovimientosPerdida = [];
  let topProductosPerdida = [];

  if (existingTables.has('movimientos_inventario') && existingTables.has('productos')) {
    // Entradas de compra registradas directamente en Kardex que no provienen de una orden en tabla `compras`
    const entradasKardexRows = queryAll(
      db,
      `SELECT SUBSTR(mi.fecha, 1, 7) AS periodo_ym,
              COUNT(*) AS cant_ingresos_kardex,
              COALESCE(SUM(mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)), 0) AS costo_entradas_kardex
       FROM movimientos_inventario mi
       INNER JOIN productos p ON p.id_producto = mi.id_producto
       WHERE mi.tipo_movimiento = 'ENTRADA_COMPRA'
         AND mi.fecha >= ?
         AND mi.fecha < ?
         AND (mi.referencia_origen IS NULL OR UPPER(mi.referencia_origen) NOT LIKE 'COMPRA #%')
       GROUP BY SUBSTR(mi.fecha, 1, 7)`,
      [startMonthIso, endMonthExclusiveIso]
    );
    for (const r of entradasKardexRows) {
      entradasSinDocByMonthMap.set(String(r.periodo_ym), r);
    }

    // Pérdidas mensuales por MERMA y AJUSTE_NEGATIVO
    const perdidasMensualesRows = queryAll(
      db,
      `SELECT SUBSTR(mi.fecha, 1, 7) AS periodo_ym,
              COUNT(*) AS eventos_perdida,
              COALESCE(SUM(mi.cantidad), 0) AS unidades_perdidas,
              COALESCE(SUM(CASE WHEN mi.tipo_movimiento = 'MERMA' THEN mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0) ELSE 0 END), 0) AS costo_merma,
              COALESCE(SUM(CASE WHEN mi.tipo_movimiento = 'AJUSTE_NEGATIVO' THEN mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0) ELSE 0 END), 0) AS costo_ajuste_negativo,
              COALESCE(SUM(mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)), 0) AS costo_perdida_total,
              COALESCE(SUM(CASE WHEN p.exento_iva = 0 THEN (mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)) * 0.19 ELSE 0 END), 0) AS iva_estimado_perdida
       FROM movimientos_inventario mi
       INNER JOIN productos p ON p.id_producto = mi.id_producto
       WHERE mi.tipo_movimiento IN ('MERMA', 'AJUSTE_NEGATIVO')
         AND mi.fecha >= ?
         AND mi.fecha < ?
       GROUP BY SUBSTR(mi.fecha, 1, 7)`,
      [startMonthIso, endMonthExclusiveIso]
    );
    for (const r of perdidasMensualesRows) {
      mermasByMonthMap.set(String(r.periodo_ym), r);
    }

    resumenPerdidasPorTipo = queryAll(
      db,
      `SELECT mi.tipo_movimiento,
              COUNT(*) AS cantidad_eventos,
              COALESCE(SUM(mi.cantidad), 0) AS total_unidades,
              COALESCE(SUM(mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)), 0) AS costo_neto_perdido,
              COALESCE(SUM(CASE WHEN p.exento_iva = 0 THEN (mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)) * 0.19 ELSE 0 END), 0) AS iva_asociado_perdido,
              COALESCE(SUM(mi.cantidad * COALESCE(p.precio_venta_final, 0)), 0) AS ingreso_potencial_no_percibido
       FROM movimientos_inventario mi
       INNER JOIN productos p ON p.id_producto = mi.id_producto
       WHERE mi.tipo_movimiento IN ('MERMA', 'AJUSTE_NEGATIVO')
         AND mi.fecha >= ?
         AND mi.fecha < ?
       GROUP BY mi.tipo_movimiento
       ORDER BY costo_neto_perdido DESC`,
      [startMonthIso, endMonthExclusiveIso]
    );

    topProductosPerdida = queryAll(
      db,
      `SELECT p.id_producto,
              p.nombre AS producto_nombre,
              p.sku AS producto_sku,
              p.unidad_medida,
              COUNT(*) AS eventos,
              COALESCE(SUM(mi.cantidad), 0) AS unidades_perdidas,
              COALESCE(SUM(mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)), 0) AS costo_total_perdido,
              COALESCE(SUM(mi.cantidad * COALESCE(p.precio_venta_final, 0)), 0) AS valor_venta_perdido
       FROM movimientos_inventario mi
       INNER JOIN productos p ON p.id_producto = mi.id_producto
       WHERE mi.tipo_movimiento IN ('MERMA', 'AJUSTE_NEGATIVO')
         AND mi.fecha >= ?
         AND mi.fecha < ?
       GROUP BY p.id_producto
       ORDER BY costo_total_perdido DESC
       LIMIT 10`,
      [startMonthIso, endMonthExclusiveIso]
    );

    const hasUsuarios = existingTables.has('usuarios');
    detalleMovimientosPerdida = queryAll(
      db,
      hasUsuarios
        ? `SELECT mi.id_movimiento,
                  mi.id_producto,
                  p.nombre AS producto_nombre,
                  p.sku AS producto_sku,
                  p.unidad_medida,
                  p.exento_iva,
                  mi.tipo_movimiento,
                  mi.cantidad,
                  COALESCE(mi.costo_unitario, p.costo_promedio, 0) AS costo_unitario_aplicado,
                  (mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)) AS costo_total_perdida,
                  (mi.cantidad * COALESCE(p.precio_venta_final, 0)) AS valor_venta_perdido,
                  mi.referencia_origen,
                  mi.motivo,
                  mi.fecha,
                  COALESCE(u.nombre, 'Usuario #' || mi.id_usuario) AS usuario_nombre
           FROM movimientos_inventario mi
           INNER JOIN productos p ON p.id_producto = mi.id_producto
           LEFT JOIN usuarios u ON u.id_usuario = mi.id_usuario
           WHERE mi.tipo_movimiento IN ('MERMA', 'AJUSTE_NEGATIVO')
             AND mi.fecha >= ?
             AND mi.fecha < ?
           ORDER BY mi.fecha DESC, mi.id_movimiento DESC
           LIMIT 40`
        : `SELECT mi.id_movimiento,
                  mi.id_producto,
                  p.nombre AS producto_nombre,
                  p.sku AS producto_sku,
                  p.unidad_medida,
                  p.exento_iva,
                  mi.tipo_movimiento,
                  mi.cantidad,
                  COALESCE(mi.costo_unitario, p.costo_promedio, 0) AS costo_unitario_aplicado,
                  (mi.cantidad * COALESCE(mi.costo_unitario, p.costo_promedio, 0)) AS costo_total_perdida,
                  (mi.cantidad * COALESCE(p.precio_venta_final, 0)) AS valor_venta_perdido,
                  mi.referencia_origen,
                  mi.motivo,
                  mi.fecha,
                  ('Usuario #' || mi.id_usuario) AS usuario_nombre
           FROM movimientos_inventario mi
           INNER JOIN productos p ON p.id_producto = mi.id_producto
           WHERE mi.tipo_movimiento IN ('MERMA', 'AJUSTE_NEGATIVO')
             AND mi.fecha >= ?
             AND mi.fecha < ?
           ORDER BY mi.fecha DESC, mi.id_movimiento DESC
           LIMIT 40`,
      [startMonthIso, endMonthExclusiveIso]
    );
  }

  // Construir serie cronológica mes a mes para el rango seleccionado (1, 3, 6 o 12 meses)
  const monthlySeries = [];
  const totals = {
    periodMonths,
    periodLabel,
    startMonthIso,
    // Ingresos
    cantidad_ventas: 0,
    unidades_vendidas: 0,
    ventas_neto: 0,
    iva_debito_ventas: 0,
    descuento_global: 0,
    ingresos_brutos: 0,
    // Egresos y Costos Separados
    cantidad_compras: 0,
    compras_neto: 0,
    iva_credito_compras: 0,
    egresos_compras_bruto: 0,
    costo_entradas_kardex_sin_doc: 0,
    costo_ventas_historico: 0,
    // Pérdidas por Merma / Baja de Producto
    eventos_perdida: 0,
    unidades_perdidas: 0,
    costo_merma: 0,
    costo_ajuste_negativo: 0,
    costo_perdida_total: 0,
    iva_estimado_perdida: 0,
    // Consolidados de Egresos y Resultado
    egresos_operativos_totales: 0,
    balance_flujo_caja: 0,
    utilidad_neta_despues_mermas: 0,
    // Resumen IVA
    iva_neto_a_pagar: 0,
    remanente_credito_iva: 0,
  };

  for (let mOffset = periodMonths - 1; mOffset >= 0; mOffset--) {
    const mDate = new Date(currentYear, currentMonthIdx - mOffset, 1);
    const mYear = String(mDate.getFullYear());
    const mIdx = mDate.getMonth();
    const mNum = String(mIdx + 1).padStart(2, '0');
    const ymKey = `${mYear}-${mNum}`;
    const mName = MESES_NOMBRES_ES[mIdx];
    const shortYear = mYear.slice(-2);

    const vRow = ventasByMonthMap.get(ymKey);
    const cogsRow = costoVentasByMonthMap.get(ymKey);
    const compRow = comprasByMonthMap.get(ymKey);
    const kardexInRow = entradasSinDocByMonthMap.get(ymKey);
    const mermaRow = mermasByMonthMap.get(ymKey);

    const cantidad_ventas = Number(vRow?.cantidad_ventas) || 0;
    const ventas_neto = Number(vRow?.ventas_neto) || 0;
    const iva_debito_ventas = Number(vRow?.iva_debito_ventas) || 0;
    const descuento_global = Number(vRow?.descuento_global) || 0;
    const ingresos_brutos = Number(vRow?.ingresos_brutos) || 0;

    const unidades_vendidas = Number(cogsRow?.unidades_vendidas) || 0;
    const costo_ventas_historico = Number(cogsRow?.costo_ventas_historico) || 0;

    const cantidad_compras = Number(compRow?.cantidad_compras) || 0;
    const compras_neto = Number(compRow?.compras_neto) || 0;
    const iva_credito_compras = Number(compRow?.iva_credito_compras) || 0;
    const egresos_compras_bruto = Number(compRow?.egresos_compras_bruto) || 0;

    const costo_entradas_kardex_sin_doc = Number(kardexInRow?.costo_entradas_kardex) || 0;

    const eventos_perdida = Number(mermaRow?.eventos_perdida) || 0;
    const unidades_perdidas = Number(mermaRow?.unidades_perdidas) || 0;
    const costo_merma = Number(mermaRow?.costo_merma) || 0;
    const costo_ajuste_negativo = Number(mermaRow?.costo_ajuste_negativo) || 0;
    const costo_perdida_total = Number(mermaRow?.costo_perdida_total) || 0;
    const iva_estimado_perdida = Number(mermaRow?.iva_estimado_perdida) || 0;

    // Egresos totales del mes (separados de ingresos):
    // Si existen compras documentadas o entradas de bodega, suma compras + entradas sin doc + pérdidas por merma;
    // además calcula el egreso económico (Costo de Ventas + Pérdidas por Merma + Compras documentadas/bodega).
    const adquisicion_inventario_mes = egresos_compras_bruto + costo_entradas_kardex_sin_doc;
    const egresos_operativos_mes =
      adquisicion_inventario_mes > 0
        ? adquisicion_inventario_mes + costo_perdida_total
        : costo_ventas_historico + costo_perdida_total;

    const utilidad_bruta_ventas = ventas_neto - costo_ventas_historico;
    const utilidad_neta_despues_mermas = utilidad_bruta_ventas - costo_perdida_total;
    const balance_mes = ingresos_brutos - egresos_operativos_mes;
    const diferencia_iva_mes = iva_debito_ventas - iva_credito_compras;

    totals.cantidad_ventas += cantidad_ventas;
    totals.unidades_vendidas += unidades_vendidas;
    totals.ventas_neto += ventas_neto;
    totals.iva_debito_ventas += iva_debito_ventas;
    totals.descuento_global += descuento_global;
    totals.ingresos_brutos += ingresos_brutos;

    totals.cantidad_compras += cantidad_compras;
    totals.compras_neto += compras_neto;
    totals.iva_credito_compras += iva_credito_compras;
    totals.egresos_compras_bruto += egresos_compras_bruto;
    totals.costo_entradas_kardex_sin_doc += costo_entradas_kardex_sin_doc;
    totals.costo_ventas_historico += costo_ventas_historico;

    totals.eventos_perdida += eventos_perdida;
    totals.unidades_perdidas += unidades_perdidas;
    totals.costo_merma += costo_merma;
    totals.costo_ajuste_negativo += costo_ajuste_negativo;
    totals.costo_perdida_total += costo_perdida_total;
    totals.iva_estimado_perdida += iva_estimado_perdida;

    totals.egresos_operativos_totales += egresos_operativos_mes;
    totals.utilidad_neta_despues_mermas += utilidad_neta_despues_mermas;

    monthlySeries.push({
      periodo_ym: ymKey,
      anio: mYear,
      mes_num: mNum,
      mes_nombre: mName,
      etiqueta_larga: `${mName} ${mYear}`,
      etiqueta_corta: `${mName.slice(0, 3)}'${shortYear}`,
      es_mes_actual: mOffset === 0,
      // Ingresos
      cantidad_ventas,
      unidades_vendidas,
      ventas_neto,
      iva_debito_ventas,
      descuento_global,
      ingresos_brutos,
      // Egresos y Costos
      cantidad_compras,
      compras_neto,
      iva_credito_compras,
      egresos_compras_bruto,
      costo_entradas_kardex_sin_doc,
      adquisicion_inventario_mes,
      costo_ventas_historico,
      // Mermas y Pérdidas
      eventos_perdida,
      unidades_perdidas,
      costo_merma,
      costo_ajuste_negativo,
      costo_perdida_total,
      iva_estimado_perdida,
      // Consolidados del mes
      egresos_operativos_mes,
      utilidad_bruta_ventas,
      utilidad_neta_despues_mermas,
      balance_mes,
      diferencia_iva_mes,
    });
  }

  totals.balance_flujo_caja = totals.ingresos_brutos - totals.egresos_operativos_totales;
  const diffIvaTotal = totals.iva_debito_ventas - totals.iva_credito_compras;
  totals.iva_neto_a_pagar = diffIvaTotal > 0 ? diffIvaTotal : 0;
  totals.remanente_credito_iva = diffIvaTotal < 0 ? Math.abs(diffIvaTotal) : 0;

  return {
    database: { ...activeFileMeta },
    periodMonths,
    periodLabel,
    totals,
    monthlySeries,
    ventasPorTipoDoc,
    ventasPorMetodoPago,
    comprasPorTipoDoc,
    resumenPerdidasPorTipo,
    topProductosPerdida,
    detalleMovimientosPerdida,
  };
}
