import {
  activeFileMeta,
  ensureLoadedInTab,
  queryAll,
  queryGet,
  requireActiveDb,
} from '../engine.js';

// ==========================================
// CONSULTAS DE INVENTARIO
// ==========================================
export function getInventoryTopSellingSync(
  db,
  { estadoVenta = 'COMPLETADA', soloActivos = 1, limite = 10 } = {}
) {
  const estadoParam = ['COMPLETADA', 'ANULADA', 'PENDIENTE'].includes(estadoVenta)
    ? estadoVenta
    : 'COMPLETADA';
  const activoParam = Number(soloActivos) === 0 ? 0 : 1;
  const limiteParam = Math.max(1, Math.min(100, Number(limite) || 10));

  return queryAll(
    db,
    `SELECT
      p.id_producto,
      p.sku,
      p.codigo_barras,
      p.nombre,
      COALESCE(c.nombre, 'Sin categoría') AS categoria,
      p.unidad_medida,
      p.costo_promedio,
      p.precio_neto,
      p.exento_iva,
      p.precio_venta_final,
      p.stock_actual,
      p.stock_minimo,
      p.activo,
      COALESCE(SUM(dv.cantidad), 0) AS total_vendido,
      COALESCE(SUM(dv.subtotal), 0) AS ingresos_generados,
      COALESCE(SUM(dv.subtotal - (dv.costo_unitario_historico * dv.cantidad)), 0) AS utilidad_historica,
      COUNT(DISTINCT dv.id_venta) AS num_ventas
    FROM detalle_ventas dv
    INNER JOIN ventas v ON v.id_venta = dv.id_venta
    INNER JOIN productos p ON p.id_producto = dv.id_producto
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE v.estado = ?
      AND p.activo = ?
    GROUP BY p.id_producto
    ORDER BY total_vendido DESC, ingresos_generados DESC
    LIMIT ?`,
    [estadoParam, activoParam, limiteParam]
  );
}

export function getInventoryUrgentStockSync(
  db,
  { soloActivos = 1, factorUmbral = 1.0, limite = 20 } = {}
) {
  const activoParam = Number(soloActivos) === 0 ? 0 : 1;
  const factorParam = Number(factorUmbral) > 0 ? Number(factorUmbral) : 1.0;
  const limiteParam = Math.max(1, Math.min(100, Number(limite) || 20));

  return queryAll(
    db,
    `SELECT
      p.id_producto,
      p.sku,
      p.codigo_barras,
      p.nombre,
      p.descripcion,
      p.id_categoria,
      COALESCE(c.nombre, 'Sin categoría') AS categoria,
      p.unidad_medida,
      p.costo_promedio,
      p.precio_neto,
      p.exento_iva,
      p.precio_venta_final,
      p.stock_actual,
      p.stock_minimo,
      ROUND(p.stock_minimo - p.stock_actual, 2) AS deficit_stock,
      ROUND(
        CASE
          WHEN (p.stock_minimo - p.stock_actual) > 0
          THEN (p.stock_minimo - p.stock_actual) * p.costo_promedio
          ELSE 0
        END,
        2
      ) AS costo_reposicion_estimado,
      p.activo,
      p.actualizado_en
    FROM productos p
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE p.activo = ?
      AND p.stock_actual <= (p.stock_minimo * ?)
    ORDER BY
      CASE WHEN p.stock_actual <= 0 THEN 0 ELSE 1 END ASC,
      (p.stock_minimo - p.stock_actual) DESC,
      p.stock_actual ASC
    LIMIT ?`,
    [activoParam, factorParam, limiteParam]
  );
}

export function getInventorySlowMovingSync(
  db,
  {
    estadoVenta = 'COMPLETADA',
    soloActivos = 1,
    tipoIngreso = 'ENTRADA_COMPRA',
    limite = 10,
  } = {}
) {
  const estadoParam = ['COMPLETADA', 'ANULADA', 'PENDIENTE'].includes(estadoVenta)
    ? estadoVenta
    : 'COMPLETADA';
  const activoParam = Number(soloActivos) === 0 ? 0 : 1;
  const tiposPermitidos = ['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION_CLIENTE'];
  const tipoIngresoParam = tiposPermitidos.includes(tipoIngreso) ? tipoIngreso : 'ENTRADA_COMPRA';
  const limiteParam = Math.max(1, Math.min(100, Number(limite) || 10));

  return queryAll(
    db,
    `SELECT
      p.id_producto,
      p.sku,
      p.codigo_barras,
      p.nombre,
      COALESCE(c.nombre, 'Sin categoría') AS categoria,
      p.unidad_medida,
      p.stock_actual,
      p.stock_minimo,
      p.costo_promedio,
      p.precio_venta_final,
      ROUND(p.stock_actual * p.costo_promedio, 2) AS valor_stock_inmovilizado,
      COALESCE(v_stats.total_vendido, 0) AS total_vendido,
      COALESCE(v_stats.num_ventas, 0) AS num_ventas,
      v_stats.ultima_venta,
      COALESCE(k_stats.fecha_ultimo_ingreso, k_stats.fecha_cualquier_ingreso, p.actualizado_en) AS fecha_ingreso_stock,
      COALESCE(k_stats.cantidad_ultimo_ingreso, 0) AS cantidad_ultimo_ingreso,
      k_stats.referencia_ingreso
    FROM productos p
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    LEFT JOIN (
      SELECT
        dv.id_producto,
        SUM(dv.cantidad) AS total_vendido,
        COUNT(DISTINCT dv.id_venta) AS num_ventas,
        MAX(v.fecha_venta) AS ultima_venta
      FROM detalle_ventas dv
      INNER JOIN ventas v ON v.id_venta = dv.id_venta
      WHERE v.estado = ?
      GROUP BY dv.id_producto
    ) v_stats ON v_stats.id_producto = p.id_producto
    LEFT JOIN (
      SELECT
        mi.id_producto,
        MAX(CASE WHEN mi.tipo_movimiento = ? THEN mi.fecha END) AS fecha_ultimo_ingreso,
        MAX(CASE WHEN mi.tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO') THEN mi.fecha END) AS fecha_cualquier_ingreso,
        (
          SELECT m2.cantidad
          FROM movimientos_inventario m2
          WHERE m2.id_producto = mi.id_producto
            AND m2.tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO')
          ORDER BY m2.fecha DESC, m2.id_movimiento DESC
          LIMIT 1
        ) AS cantidad_ultimo_ingreso,
        (
          SELECT m2.referencia_origen
          FROM movimientos_inventario m2
          WHERE m2.id_producto = mi.id_producto
            AND m2.tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO')
          ORDER BY m2.fecha DESC, m2.id_movimiento DESC
          LIMIT 1
        ) AS referencia_ingreso
      FROM movimientos_inventario mi
      GROUP BY mi.id_producto
    ) k_stats ON k_stats.id_producto = p.id_producto
    WHERE p.activo = ?
    ORDER BY
      COALESCE(v_stats.total_vendido, 0) ASC,
      p.stock_actual DESC,
      fecha_ingreso_stock ASC
    LIMIT ?`,
    [estadoParam, tipoIngresoParam, activoParam, limiteParam]
  );
}

export function searchInventoryProductsSync(
  db,
  {
    termino = '',
    idCategoria = null,
    unidadMedida = null,
    soloActivos = 1,
    limite = 50,
    offset = 0,
  } = {}
) {
  const cleanTerm = String(termino ?? '').trim();
  const likePattern = `%${cleanTerm}%`;

  const categoriaParam =
    idCategoria !== null && idCategoria !== '' && !Number.isNaN(Number(idCategoria))
      ? Number(idCategoria)
      : null;

  const unidadesPermitidas = ['UN', 'KG', 'LT', 'MT', 'CAJA'];
  const unidadParam =
    unidadMedida && unidadesPermitidas.includes(String(unidadMedida).toUpperCase())
      ? String(unidadMedida).toUpperCase()
      : null;

  const activoParam =
    soloActivos === null || soloActivos === 'ALL' || soloActivos === ''
      ? null
      : Number(soloActivos) === 0
      ? 0
      : 1;

  const limiteParam = Math.max(1, Math.min(200, Number(limite) || 50));
  const offsetParam = Math.max(0, Number(offset) || 0);

  const items = queryAll(
    db,
    `SELECT
      p.id_producto,
      p.sku,
      p.codigo_barras,
      p.nombre,
      p.descripcion,
      p.id_categoria,
      COALESCE(c.nombre, 'Sin categoría') AS categoria,
      p.unidad_medida,
      p.costo_promedio,
      p.precio_neto,
      p.exento_iva,
      p.precio_venta_final,
      p.stock_actual,
      p.stock_minimo,
      p.activo,
      p.actualizado_en
    FROM productos p
    LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE (? = '' OR p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ? OR p.descripcion LIKE ?)
      AND (? IS NULL OR p.id_categoria = ?)
      AND (? IS NULL OR p.unidad_medida = ?)
      AND (? IS NULL OR p.activo = ?)
    ORDER BY p.nombre ASC, p.id_producto ASC
    LIMIT ? OFFSET ?`,
    [
      cleanTerm,
      likePattern,
      likePattern,
      likePattern,
      likePattern,
      categoriaParam,
      categoriaParam,
      unidadParam,
      unidadParam,
      activoParam,
      activoParam,
      limiteParam,
      offsetParam,
    ]
  );

  const countRow = queryGet(
    db,
    `SELECT COUNT(*) AS total
     FROM productos p
     WHERE (? = '' OR p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ? OR p.descripcion LIKE ?)
       AND (? IS NULL OR p.id_categoria = ?)
       AND (? IS NULL OR p.unidad_medida = ?)
       AND (? IS NULL OR p.activo = ?)`,
    [
      cleanTerm,
      likePattern,
      likePattern,
      likePattern,
      likePattern,
      categoriaParam,
      categoriaParam,
      unidadParam,
      unidadParam,
      activoParam,
      activoParam,
    ]
  );

  return {
    total: Number(countRow?.total) || 0,
    limite: limiteParam,
    offset: offsetParam,
    items,
  };
}

export async function getInventorySectionData(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const topSelling = getInventoryTopSellingSync(db, {
    estadoVenta: params.estadoVenta || 'COMPLETADA',
    soloActivos: params.soloActivos !== undefined ? Number(params.soloActivos) : 1,
    limite: params.limiteTop !== undefined ? Number(params.limiteTop) : 10,
  });

  const urgentStock = getInventoryUrgentStockSync(db, {
    soloActivos: params.soloActivos !== undefined ? Number(params.soloActivos) : 1,
    factorUmbral: params.factorUmbral !== undefined ? Number(params.factorUmbral) : 1.0,
    limite: params.limiteUrgente !== undefined ? Number(params.limiteUrgente) : 20,
  });

  const slowMoving = getInventorySlowMovingSync(db, {
    estadoVenta: params.estadoVenta || 'COMPLETADA',
    soloActivos: params.soloActivos !== undefined ? Number(params.soloActivos) : 1,
    tipoIngreso: params.tipoIngreso || 'ENTRADA_COMPRA',
    limite: params.limiteBajaRotacion !== undefined ? Number(params.limiteBajaRotacion) : 10,
  });

  const categories = queryAll(
    db,
    `SELECT id_categoria, nombre, descripcion, activo
     FROM categorias
     WHERE activo = 1
     ORDER BY nombre ASC`
  );

  const searchResult = searchInventoryProductsSync(db, {
    termino: params.q ?? '',
    idCategoria: params.id_categoria ?? null,
    unidadMedida: params.unidad_medida ?? null,
    soloActivos: params.activo !== undefined ? params.activo : 1,
    limite: params.limite !== undefined ? Number(params.limite) : 50,
    offset: params.offset !== undefined ? Number(params.offset) : 0,
  });

  return {
    database: { ...activeFileMeta },
    topSelling,
    urgentStock,
    slowMoving,
    categories,
    searchResult,
  };
}

export async function searchInventoryProducts(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();
  return searchInventoryProductsSync(db, {
    termino: params.q ?? '',
    idCategoria: params.id_categoria ?? null,
    unidadMedida: params.unidad_medida ?? null,
    soloActivos: params.activo !== undefined ? params.activo : 1,
    limite: params.limite !== undefined ? Number(params.limite) : 50,
    offset: params.offset !== undefined ? Number(params.offset) : 0,
  });
}
