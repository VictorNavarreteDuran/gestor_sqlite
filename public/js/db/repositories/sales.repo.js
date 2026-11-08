import {
  activeFileMeta,
  ensureLoadedInTab,
  persistChangesToLocalDisk,
  queryAll,
  queryGet,
  requireActiveDb,
  resolveValidUserId,
  runStmt,
} from '../engine.js';

// ==========================================
// SECCIÓN VENTAS (POS)
// ==========================================
export function queryPosProductsCatalogSync(db, params = {}) {
  const cleanTerm = String(params.q ?? params.termino ?? '').trim();
  const likePattern = `%${cleanTerm}%`;
  const rawCat = params.id_categoria ?? params.idCategoria ?? null;
  const categoriaParam =
    rawCat !== null && rawCat !== '' && !Number.isNaN(Number(rawCat))
      ? Number(rawCat)
      : null;
  const conStockParam =
    Number(params.solo_con_stock ?? params.soloConStock ?? 0) === 1 ? 1 : 0;
  const limProd = Math.max(
    1,
    Math.min(200, Number(params.limite_productos ?? params.limiteProductos) || 50)
  );

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
       p.activo
     FROM productos p
     LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
     WHERE p.activo = 1
       AND (? = '' OR p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ? OR p.descripcion LIKE ?)
       AND (? IS NULL OR p.id_categoria = ?)
       AND (? = 0 OR p.stock_actual > 0)
     ORDER BY
       CASE WHEN p.stock_actual > 0 THEN 0 ELSE 1 END ASC,
       p.nombre ASC
     LIMIT ?`,
    [
      cleanTerm,
      likePattern,
      likePattern,
      likePattern,
      likePattern,
      categoriaParam,
      categoriaParam,
      conStockParam,
      limProd,
    ]
  );
}

/**
 * Búsqueda rápida únicamente del catálogo de productos del POS (evita recalcular historial de ventas,
 * clientes y usuarios en cada pulsación de tecla del cajero).
 */
export async function searchPosProducts(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();
  return queryPosProductsCatalogSync(db, params);
}

export async function getSalesSectionData(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  if (params.soloCatalogo) {
    return {
      database: { ...activeFileMeta },
      productos: queryPosProductsCatalogSync(db, params),
    };
  }

  resolveValidUserId(db);

  const usuarios = queryAll(
    db,
    `SELECT id_usuario, nombre, email, rol, activo
     FROM usuarios
     WHERE activo = 1
     ORDER BY id_usuario ASC`
  );

  const clientes = queryAll(
    db,
    `SELECT id_cliente, rut_identificacion, nombre, giro, telefono, email
     FROM clientes
     ORDER BY nombre ASC
     LIMIT 200`
  );

  const categorias = queryAll(
    db,
    `SELECT id_categoria, nombre, descripcion, activo
     FROM categorias
     WHERE activo = 1
     ORDER BY nombre ASC`
  );

  const productos = queryPosProductsCatalogSync(db, params);

  const limVentas = Math.max(
    1,
    Math.min(100, Number(params.limite_ventas ?? params.limiteVentas) || 25)
  );

  // CTE ultimas_ventas: filtra y limita primero las N ventas más recientes antes de agrupar detalle_ventas y pagos_venta
  const ventasRecientes = queryAll(
    db,
    `WITH ultimas_ventas AS (
       SELECT
         v.id_venta,
         v.id_cliente,
         v.id_usuario,
         v.tipo_documento,
         v.folio_documento,
         v.fecha_venta,
         v.subtotal_neto,
         v.total_iva,
         v.descuento_global,
         v.total_venta,
         v.estado
       FROM ventas v
       ORDER BY v.fecha_venta DESC, v.id_venta DESC
       LIMIT ?
     )
     SELECT
       v.id_venta,
       v.id_cliente,
       COALESCE(cl.nombre, 'Cliente General') AS cliente_nombre,
       cl.rut_identificacion AS cliente_rut,
       v.id_usuario,
       COALESCE(u.nombre, 'Usuario #' || v.id_usuario) AS usuario_nombre,
       v.tipo_documento,
       v.folio_documento,
       v.fecha_venta,
       v.subtotal_neto,
       v.total_iva,
       v.descuento_global,
       v.total_venta,
       v.estado,
       COALESCE(dv_agg.total_items, 0) AS total_items,
       COALESCE(dv_agg.resumen_productos, '') AS resumen_productos,
       COALESCE(pv_agg.metodos_pago, 'SIN REGISTRO') AS metodos_pago
     FROM ultimas_ventas v
     LEFT JOIN clientes cl ON cl.id_cliente = v.id_cliente
     LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
     LEFT JOIN (
       SELECT
         dv.id_venta,
         SUM(dv.cantidad) AS total_items,
         GROUP_CONCAT(p.nombre || ' x' || dv.cantidad, ', ') AS resumen_productos
       FROM detalle_ventas dv
       INNER JOIN productos p ON p.id_producto = dv.id_producto
       WHERE dv.id_venta IN (SELECT id_venta FROM ultimas_ventas)
       GROUP BY dv.id_venta
     ) dv_agg ON dv_agg.id_venta = v.id_venta
     LEFT JOIN (
       SELECT
         pv.id_venta,
         GROUP_CONCAT(pv.metodo_pago, ' + ') AS metodos_pago
       FROM pagos_venta pv
       WHERE pv.id_venta IN (SELECT id_venta FROM ultimas_ventas)
       GROUP BY pv.id_venta
     ) pv_agg ON pv_agg.id_venta = v.id_venta
     ORDER BY v.fecha_venta DESC, v.id_venta DESC`,
    [limVentas]
  );

  return {
    database: { ...activeFileMeta },
    usuarios,
    clientes,
    categorias,
    productos,
    ventasRecientes,
  };
}

export async function registerSaleTransaction(payload = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const {
    id_cliente = null,
    id_usuario = null,
    tipo_documento = 'BOLETA',
    folio_documento = null,
    descuento_global = 0,
    estado = 'COMPLETADA',
    metodo_pago = 'EFECTIVO',
    referencia_transaccion = null,
    pagos = [],
    items = [],
  } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Debes agregar al menos un producto a la venta.');
  }

  const docsPermitidos = ['BOLETA', 'FACTURA', 'TICKET_INTERNO'];
  const tipoDocValido = String(tipo_documento || 'BOLETA').toUpperCase();
  if (!docsPermitidos.includes(tipoDocValido)) {
    throw new Error(`Tipo de documento inválido. Permitidos: ${docsPermitidos.join(', ')}`);
  }

  const estadosPermitidos = ['COMPLETADA', 'ANULADA', 'PENDIENTE'];
  const estadoValido = String(estado || 'COMPLETADA').toUpperCase();
  if (!estadosPermitidos.includes(estadoValido)) {
    throw new Error(`Estado de venta inválido. Permitidos: ${estadosPermitidos.join(', ')}`);
  }

  const metodosPermitidos = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'CREDITO_INTERNO'];
  const descuentoGlobalNum = Number(descuento_global ?? 0);
  if (Number.isNaN(descuentoGlobalNum) || descuentoGlobalNum < 0) {
    throw new Error('El descuento global en la venta total no puede ser negativo.');
  }

  const consolidatedItemsMap = new Map();
  for (const rawItem of items) {
    const prodId = Number(rawItem.id_producto);
    const cant = Number(rawItem.cantidad);
    const descLinea = Number(rawItem.descuento_linea ?? 0);

    if (!prodId || Number.isNaN(prodId)) {
      throw new Error('Uno de los productos seleccionados no tiene un ID válido.');
    }
    if (Number.isNaN(cant) || cant <= 0) {
      throw new Error('La cantidad de cada producto vendido debe ser mayor a 0.');
    }
    if (Number.isNaN(descLinea) || descLinea < 0) {
      throw new Error('El descuento por línea no puede ser negativo.');
    }

    if (consolidatedItemsMap.has(prodId)) {
      const existing = consolidatedItemsMap.get(prodId);
      existing.cantidad = Number((existing.cantidad + cant).toFixed(4));
      existing.descuento_linea = Number((existing.descuento_linea + descLinea).toFixed(2));
    } else {
      consolidatedItemsMap.set(prodId, {
        id_producto: prodId,
        cantidad: Number(cant.toFixed(4)),
        descuento_linea: Number(descLinea.toFixed(2)),
      });
    }
  }

  db.run('BEGIN TRANSACTION;');
  try {
    const usuarioValido = resolveValidUserId(db, id_usuario);

    let clienteIdValido = null;
    if (id_cliente !== null && id_cliente !== '' && !Number.isNaN(Number(id_cliente))) {
      const foundClient = queryGet(db, 'SELECT id_cliente FROM clientes WHERE id_cliente = ?', [
        Number(id_cliente),
      ]);
      if (foundClient) {
        clienteIdValido = Number(foundClient.id_cliente);
      }
    }

    const preparedLines = [];
    let sumaSubtotalesLineas = 0;
    let sumaNetoBruto = 0;

    for (const item of consolidatedItemsMap.values()) {
      const prod = queryGet(
        db,
        `SELECT
           id_producto,
           sku,
           nombre,
           unidad_medida,
           costo_promedio,
           precio_neto,
           exento_iva,
           precio_venta_final,
           stock_actual,
           activo
         FROM productos
         WHERE id_producto = ?`,
        [item.id_producto]
      );

      if (!prod) {
        throw new Error(`El producto ID #${item.id_producto} no existe en la base de datos.`);
      }
      if (Number(prod.activo) !== 1) {
        throw new Error(`El producto "${prod.nombre}" se encuentra inactivo.`);
      }

      const stockActual = Number(prod.stock_actual) || 0;
      if (estadoValido === 'COMPLETADA' && item.cantidad > stockActual) {
        throw new Error(
          `Stock insuficiente para "${prod.nombre}". Solicitado: ${item.cantidad} ${prod.unidad_medida}, Stock disponible: ${stockActual} ${prod.unidad_medida}.`
        );
      }

      const precioUnitarioVenta = Number(prod.precio_venta_final) || 0;
      const costoUnitarioHistorico = Number(prod.costo_promedio) || 0;
      const brutoLinea = Number((item.cantidad * precioUnitarioVenta).toFixed(2));

      if (item.descuento_linea > brutoLinea) {
        throw new Error(
          `El descuento de línea ($${item.descuento_linea}) supera el monto del producto "${prod.nombre}" ($${brutoLinea}).`
        );
      }

      const subtotalLinea = Number((brutoLinea - item.descuento_linea).toFixed(2));
      sumaSubtotalesLineas = Number((sumaSubtotalesLineas + subtotalLinea).toFixed(2));

      const esExento = Number(prod.exento_iva) === 1;
      const netoLinea = esExento ? subtotalLinea : Number((subtotalLinea / 1.19).toFixed(2));
      sumaNetoBruto = Number((sumaNetoBruto + netoLinea).toFixed(2));

      preparedLines.push({
        id_producto: Number(prod.id_producto),
        nombre: prod.nombre,
        unidad_medida: prod.unidad_medida,
        cantidad: item.cantidad,
        precio_unitario_venta: precioUnitarioVenta,
        costo_unitario_historico: costoUnitarioHistorico,
        descuento_linea: item.descuento_linea,
        subtotal: subtotalLinea,
      });
    }

    if (descuentoGlobalNum > sumaSubtotalesLineas) {
      throw new Error(
        `El descuento en la venta total ($${descuentoGlobalNum}) no puede superar el subtotal de la venta ($${sumaSubtotalesLineas}).`
      );
    }

    const totalVentaFinal = Number(Math.max(0, sumaSubtotalesLineas - descuentoGlobalNum).toFixed(2));
    const factorDescuentoGlobal =
      sumaSubtotalesLineas > 0 ? totalVentaFinal / sumaSubtotalesLineas : 0;
    const subtotalNetoFinal = Number((sumaNetoBruto * factorDescuentoGlobal).toFixed(2));
    const totalIvaFinal = Number(Math.max(0, totalVentaFinal - subtotalNetoFinal).toFixed(2));
    const cleanFolio = String(folio_documento ?? '').trim() || null;

    const insertVenta = runStmt(
      db,
      `INSERT INTO ventas (
         id_cliente,
         id_usuario,
         tipo_documento,
         folio_documento,
         subtotal_neto,
         total_iva,
         descuento_global,
         total_venta,
         estado
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clienteIdValido,
        usuarioValido,
        tipoDocValido,
        cleanFolio,
        subtotalNetoFinal,
        totalIvaFinal,
        Number(descuentoGlobalNum.toFixed(2)),
        totalVentaFinal,
        estadoValido,
      ]
    );

    const idVentaCreada = Number(insertVenta.lastInsertRowid);
    const refOrigenKardex = cleanFolio
      ? `VENTA #${idVentaCreada} (${tipoDocValido} ${cleanFolio})`
      : `VENTA #${idVentaCreada} (${tipoDocValido})`;

    for (const line of preparedLines) {
      runStmt(
        db,
        `INSERT INTO detalle_ventas (
           id_venta,
           id_producto,
           cantidad,
           precio_unitario_venta,
           costo_unitario_historico,
           descuento_linea,
           subtotal
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idVentaCreada,
          line.id_producto,
          line.cantidad,
          line.precio_unitario_venta,
          line.costo_unitario_historico,
          line.descuento_linea,
          line.subtotal,
        ]
      );

      if (estadoValido === 'COMPLETADA') {
        const currentProdRow = queryGet(
          db,
          'SELECT stock_actual FROM productos WHERE id_producto = ?',
          [line.id_producto]
        );
        const stockAnterior = Number(currentProdRow?.stock_actual) || 0;
        const stockResultante = Number((stockAnterior - line.cantidad).toFixed(4));

        runStmt(
          db,
          `INSERT INTO movimientos_inventario (
             id_producto,
             id_usuario,
             tipo_movimiento,
             cantidad,
             stock_anterior,
             stock_resultante,
             costo_unitario,
             referencia_origen,
             motivo
           ) VALUES (?, ?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?)`,
          [
            line.id_producto,
            usuarioValido,
            line.cantidad,
            stockAnterior,
            stockResultante,
            line.costo_unitario_historico,
            refOrigenKardex,
            `Salida por venta ${tipoDocValido}`,
          ]
        );
      }
    }

    const pagosList =
      Array.isArray(pagos) && pagos.length > 0
        ? pagos
        : [
            {
              metodo_pago: metodo_pago || 'EFECTIVO',
              monto: totalVentaFinal > 0 ? totalVentaFinal : 0.01,
              referencia_transaccion: referencia_transaccion || null,
            },
          ];

    for (const p of pagosList) {
      const metodoValido = String(p.metodo_pago || 'EFECTIVO').toUpperCase();
      if (!metodosPermitidos.includes(metodoValido)) {
        throw new Error(
          `Método de pago inválido (${p.metodo_pago}). Permitidos: ${metodosPermitidos.join(', ')}`
        );
      }
      const montoPago = Number(p.monto);
      if (!Number.isNaN(montoPago) && montoPago > 0) {
        runStmt(
          db,
          `INSERT INTO pagos_venta (
             id_venta,
             metodo_pago,
             monto,
             referencia_transaccion
           ) VALUES (?, ?, ?, ?)`,
          [
            idVentaCreada,
            metodoValido,
            Number(montoPago.toFixed(2)),
            String(p.referencia_transaccion ?? '').trim() || null,
          ]
        );
      }
    }

    db.run('COMMIT;');
    const syncStatus = await persistChangesToLocalDisk();
    const ventaGuardada = queryGet(db, 'SELECT * FROM ventas WHERE id_venta = ?', [
      idVentaCreada,
    ]);

    return {
      savedToFile: activeFileMeta.originalName,
      wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
      venta: ventaGuardada,
      lineas: preparedLines.length,
    };
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}
