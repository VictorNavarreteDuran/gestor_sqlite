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
// GESTIÓN DE STOCK, PRODUCTOS NUEVOS Y MERMAS (KARDEX)
// ==========================================
export async function getStockManagementData(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  resolveValidUserId(db);

  const usuarios = queryAll(
    db,
    `SELECT id_usuario, nombre, email, rol, activo
     FROM usuarios
     WHERE activo = 1
     ORDER BY id_usuario ASC`
  );

  const categorias = queryAll(
    db,
    `SELECT id_categoria, nombre, descripcion, activo
     FROM categorias
     WHERE activo = 1
     ORDER BY nombre ASC`
  );

  const productos = queryAll(
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
       p.activo
     FROM productos p
     LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
     WHERE p.activo = 1
     ORDER BY p.nombre ASC`
  );

  const tiposValidos = [
    'ENTRADA_COMPRA',
    'SALIDA_VENTA',
    'DEVOLUCION_CLIENTE',
    'DEVOLUCION_PROVEEDOR',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'MERMA',
  ];
  const rawTipo = params.tipo_movimiento ?? params.tipoMovimiento ?? null;
  const tipoParam =
    rawTipo && tiposValidos.includes(String(rawTipo).toUpperCase())
      ? String(rawTipo).toUpperCase()
      : null;
  const rawProd = params.id_producto ?? params.idProducto ?? null;
  const prodParam =
    rawProd !== null && rawProd !== '' && !Number.isNaN(Number(rawProd))
      ? Number(rawProd)
      : null;
  const limiteParam = Math.max(
    1,
    Math.min(100, Number(params.limite ?? params.limiteMovimientos) || 30)
  );

  const movimientos = queryAll(
    db,
    `SELECT
       mi.id_movimiento,
       mi.id_producto,
       p.nombre AS producto_nombre,
       p.sku AS producto_sku,
       p.unidad_medida,
       mi.id_usuario,
       COALESCE(u.nombre, 'Usuario #' || mi.id_usuario) AS usuario_nombre,
       mi.tipo_movimiento,
       mi.cantidad,
       mi.stock_anterior,
       mi.stock_resultante,
       mi.costo_unitario,
       mi.referencia_origen,
       mi.motivo,
       mi.fecha
     FROM movimientos_inventario mi
     INNER JOIN productos p ON p.id_producto = mi.id_producto
     LEFT JOIN usuarios u ON u.id_usuario = mi.id_usuario
     WHERE (? IS NULL OR mi.tipo_movimiento = ?)
       AND (? IS NULL OR mi.id_producto = ?)
     ORDER BY mi.fecha DESC, mi.id_movimiento DESC
     LIMIT ?`,
    [tipoParam, tipoParam, prodParam, prodParam, limiteParam]
  );

  return {
    database: { ...activeFileMeta },
    usuarios,
    categorias,
    productos,
    movimientos,
  };
}

export async function createProductWithInitialStock(payload = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const {
    sku = null,
    codigo_barras = null,
    nombre,
    descripcion = null,
    id_categoria = null,
    nueva_categoria = null,
    unidad_medida = 'UN',
    costo_promedio,
    precio_neto,
    exento_iva = 0,
    precio_venta_final,
    stock_minimo,
    stock_inicial,
    id_usuario = null,
    tipo_movimiento_inicial = 'AJUSTE_POSITIVO',
    referencia_origen = 'STOCK INICIAL',
    motivo = 'Carga inicial en creación de producto',
  } = payload;

  const cleanNombre = String(nombre ?? '').trim();
  if (!cleanNombre) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  const unidadesPermitidas = ['UN', 'KG', 'LT', 'MT', 'CAJA'];
  const unidadValida = String(unidad_medida || 'UN').toUpperCase();
  if (!unidadesPermitidas.includes(unidadValida)) {
    throw new Error(`Unidad de medida inválida. Valores permitidos: ${unidadesPermitidas.join(', ')}`);
  }

  if (
    costo_promedio === undefined ||
    costo_promedio === null ||
    String(costo_promedio).trim() === '' ||
    precio_neto === undefined ||
    precio_neto === null ||
    String(precio_neto).trim() === '' ||
    precio_venta_final === undefined ||
    precio_venta_final === null ||
    String(precio_venta_final).trim() === ''
  ) {
    throw new Error(
      'Los precios y costos (Costo Promedio, Precio Neto y Precio Venta Final) deben ingresarse manualmente.'
    );
  }

  if (
    stock_minimo === undefined ||
    stock_minimo === null ||
    String(stock_minimo).trim() === '' ||
    stock_inicial === undefined ||
    stock_inicial === null ||
    String(stock_inicial).trim() === ''
  ) {
    throw new Error('El stock mínimo y el stock inicial deben ingresarse manualmente.');
  }

  const costoPromNum = Number(costo_promedio);
  const precioNetoNum = Number(precio_neto);
  const precioFinalNum = Number(precio_venta_final);
  const stockMinNum = Number(stock_minimo);
  const stockInicialNum = Number(stock_inicial);
  const exentoInt = Number(exento_iva) === 1 ? 1 : 0;

  if (Number.isNaN(costoPromNum) || costoPromNum < 0 || !Number.isInteger(costoPromNum)) {
    throw new Error('El costo promedio debe ser un número entero (sin decimales ni punto flotante) mayor o igual a 0.');
  }
  if (Number.isNaN(precioNetoNum) || precioNetoNum < 0 || !Number.isInteger(precioNetoNum)) {
    throw new Error('El precio neto debe ser un número entero (sin decimales ni punto flotante) mayor o igual a 0.');
  }
  if (Number.isNaN(precioFinalNum) || precioFinalNum < 0 || !Number.isInteger(precioFinalNum)) {
    throw new Error('El precio de venta final debe ser un número entero (sin decimales ni punto flotante) mayor o igual a 0.');
  }
  if (Number.isNaN(stockMinNum) || stockMinNum < 0) {
    throw new Error('El stock mínimo debe ser un número mayor o igual a 0.');
  }
  if (Number.isNaN(stockInicialNum) || stockInicialNum < 0) {
    throw new Error('El stock inicial no puede ser negativo.');
  }

  const esUnidadEntera = unidadValida === 'UN' || unidadValida === 'CAJA';
  if (esUnidadEntera && (!Number.isInteger(stockMinNum) || !Number.isInteger(stockInicialNum))) {
    throw new Error(
      `Para artículos catalogados por ${unidadValida} (Unidad o Caja), las cantidades de stock no pueden tener decimales ni punto flotante.`
    );
  }

  const cleanSku = String(sku ?? '').trim() || null;
  const cleanBarcode = String(codigo_barras ?? '').trim() || null;
  const cleanDesc = String(descripcion ?? '').trim() || null;
  const cleanNuevaCat = String(nueva_categoria ?? '').trim();

  db.run('BEGIN TRANSACTION;');
  try {
    let categoriaIdFinal =
      id_categoria !== null && id_categoria !== '' && !Number.isNaN(Number(id_categoria))
        ? Number(id_categoria)
        : null;

    if (cleanNuevaCat) {
      const existingCat = queryGet(
        db,
        'SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER(?)',
        [cleanNuevaCat]
      );
      if (existingCat) {
        categoriaIdFinal = Number(existingCat.id_categoria);
      } else {
        const catRes = runStmt(
          db,
          'INSERT INTO categorias (nombre, descripcion, activo) VALUES (?, ?, ?)',
          [cleanNuevaCat, 'Categoría creada desde gestión de productos', 1]
        );
        categoriaIdFinal = Number(catRes.lastInsertRowid);
      }
    }

    // REGLA #2: Inserción del producto SIEMPRE con stock_actual = 0
    const insertProd = runStmt(
      db,
      `INSERT INTO productos (
         sku,
         codigo_barras,
         nombre,
         descripcion,
         id_categoria,
         unidad_medida,
         costo_promedio,
         precio_neto,
         exento_iva,
         precio_venta_final,
         stock_actual,
         stock_minimo,
         activo
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
      [
        cleanSku,
        cleanBarcode,
        cleanNombre,
        cleanDesc,
        categoriaIdFinal,
        unidadValida,
        costoPromNum,
        precioNetoNum,
        exentoInt,
        precioFinalNum,
        stockMinNum,
      ]
    );

    const idProductoCreado = Number(insertProd.lastInsertRowid);

    if (stockInicialNum > 0) {
      const usuarioValido = resolveValidUserId(db, id_usuario);
      const tipoMov = ['ENTRADA_COMPRA', 'AJUSTE_POSITIVO'].includes(tipo_movimiento_inicial)
        ? tipo_movimiento_inicial
        : 'AJUSTE_POSITIVO';

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
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idProductoCreado,
          usuarioValido,
          tipoMov,
          stockInicialNum,
          0,
          stockInicialNum,
          costoPromNum,
          String(referencia_origen || 'STOCK INICIAL').trim(),
          String(motivo || 'Inventario inicial al registrar producto nuevo').trim(),
        ]
      );
    }

    db.run('COMMIT;');
    const syncStatus = await persistChangesToLocalDisk();
    const producto = queryGet(db, 'SELECT * FROM productos WHERE id_producto = ?', [
      idProductoCreado,
    ]);

    return {
      savedToFile: activeFileMeta.originalName,
      wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
      producto,
    };
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}

export async function registerStockEntry(payload = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const {
    id_producto,
    id_usuario = null,
    tipo_movimiento = 'ENTRADA_COMPRA',
    cantidad,
    costo_unitario = null,
    referencia_origen = 'INGRESO BODEGA',
    motivo = 'Reposición de stock',
  } = payload;

  const prodId = Number(id_producto);
  if (!prodId || Number.isNaN(prodId)) {
    throw new Error('Debes seleccionar un producto válido.');
  }

  const tiposEntradaPermitidos = ['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION_CLIENTE'];
  const tipoMov = String(tipo_movimiento || 'ENTRADA_COMPRA').toUpperCase();
  if (!tiposEntradaPermitidos.includes(tipoMov)) {
    throw new Error(
      `Tipo de movimiento de entrada inválido. Permitidos: ${tiposEntradaPermitidos.join(', ')}`
    );
  }

  if (cantidad === undefined || cantidad === null || String(cantidad).trim() === '') {
    throw new Error('Debes ingresar manualmente la cantidad a sumar.');
  }

  const cantNum = Number(cantidad);
  if (Number.isNaN(cantNum) || cantNum <= 0) {
    throw new Error('La cantidad a ingresar debe ser mayor a 0.');
  }

  if (
    costo_unitario === undefined ||
    costo_unitario === null ||
    String(costo_unitario).trim() === ''
  ) {
    throw new Error('Debes ingresar manualmente el costo unitario del movimiento.');
  }

  const costoUnitarioFinal = Number(costo_unitario);
  if (
    Number.isNaN(costoUnitarioFinal) ||
    costoUnitarioFinal < 0 ||
    !Number.isInteger(costoUnitarioFinal)
  ) {
    throw new Error(
      'El costo unitario debe ser un número entero (sin decimales ni punto flotante) mayor o igual a 0.'
    );
  }

  db.run('BEGIN TRANSACTION;');
  try {
    const producto = queryGet(
      db,
      'SELECT id_producto, nombre, stock_actual, costo_promedio, unidad_medida FROM productos WHERE id_producto = ?',
      [prodId]
    );
    if (!producto) {
      throw new Error('El producto seleccionado no existe.');
    }

    const unidadProd = String(producto.unidad_medida || 'UN').toUpperCase();
    if ((unidadProd === 'UN' || unidadProd === 'CAJA') && !Number.isInteger(cantNum)) {
      throw new Error(
        `El producto "${producto.nombre}" se vende por ${unidadProd}. La cantidad no puede tener decimales ni punto flotante.`
      );
    }

    const stockAnterior = Number(producto.stock_actual) || 0;
    const stockResultante = Number((stockAnterior + cantNum).toFixed(4));
    const costoActual = Number(producto.costo_promedio) || 0;

    if (tipoMov === 'ENTRADA_COMPRA' && costoUnitarioFinal >= 0 && stockResultante > 0) {
      const stockBase = Math.max(0, stockAnterior);
      const nuevoCostoPromedio = Math.round(
        ((stockBase * costoActual) + (cantNum * costoUnitarioFinal)) / (stockBase + cantNum)
      );
      runStmt(db, 'UPDATE productos SET costo_promedio = ? WHERE id_producto = ?', [
        nuevoCostoPromedio,
        prodId,
      ]);
    }

    const usuarioValido = resolveValidUserId(db, id_usuario);

    const insertMov = runStmt(
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prodId,
        usuarioValido,
        tipoMov,
        cantNum,
        stockAnterior,
        stockResultante,
        costoUnitarioFinal,
        String(referencia_origen || 'INGRESO BODEGA').trim(),
        String(motivo || 'Ingreso de stock').trim(),
      ]
    );

    db.run('COMMIT;');
    const syncStatus = await persistChangesToLocalDisk();
    const updatedProd = queryGet(
      db,
      'SELECT id_producto, nombre, stock_actual, costo_promedio, unidad_medida FROM productos WHERE id_producto = ?',
      [prodId]
    );

    return {
      savedToFile: activeFileMeta.originalName,
      wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
      id_movimiento: Number(insertMov.lastInsertRowid),
      producto: updatedProd,
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
    };
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}

export async function registerStockLossOrMerma(payload = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const {
    id_producto,
    id_usuario = null,
    tipo_movimiento = 'MERMA',
    cantidad,
    referencia_origen = 'ACTA DE MERMA',
    motivo = 'Pérdida o merma de inventario',
  } = payload;

  const prodId = Number(id_producto);
  if (!prodId || Number.isNaN(prodId)) {
    throw new Error('Debes seleccionar un producto válido.');
  }

  const tiposSalidaPermitidos = ['MERMA', 'AJUSTE_NEGATIVO', 'DEVOLUCION_PROVEEDOR'];
  const tipoMov = String(tipo_movimiento || 'MERMA').toUpperCase();
  if (!tiposSalidaPermitidos.includes(tipoMov)) {
    throw new Error(
      `Tipo de movimiento de baja inválido. Permitidos: ${tiposSalidaPermitidos.join(', ')}`
    );
  }

  if (cantidad === undefined || cantidad === null || String(cantidad).trim() === '') {
    throw new Error('Debes ingresar manualmente la cantidad de merma o pérdida.');
  }

  const cantNum = Number(cantidad);
  if (Number.isNaN(cantNum) || cantNum <= 0) {
    throw new Error('La cantidad de merma/pérdida debe ser mayor a 0.');
  }

  const cleanMotivo = String(motivo ?? '').trim();
  if (!cleanMotivo) {
    throw new Error('Debes indicar el motivo de la merma o pérdida.');
  }

  db.run('BEGIN TRANSACTION;');
  try {
    const producto = queryGet(
      db,
      'SELECT id_producto, nombre, stock_actual, costo_promedio, unidad_medida FROM productos WHERE id_producto = ?',
      [prodId]
    );
    if (!producto) {
      throw new Error('El producto seleccionado no existe.');
    }

    const unidadProd = String(producto.unidad_medida || 'UN').toUpperCase();
    if ((unidadProd === 'UN' || unidadProd === 'CAJA') && !Number.isInteger(cantNum)) {
      throw new Error(
        `El producto "${producto.nombre}" está catalogado por ${unidadProd} (Unidad o Caja). Al registrar mermas o pérdidas no se permite usar decimales ni punto flotante.`
      );
    }

    const stockAnterior = Number(producto.stock_actual) || 0;
    if (cantNum > stockAnterior) {
      throw new Error(
        `Stock insuficiente para registrar la merma. Stock actual de "${producto.nombre}": ${stockAnterior} ${producto.unidad_medida}.`
      );
    }

    const stockResultante = Number((stockAnterior - cantNum).toFixed(4));
    const costoActual = Math.round(Number(producto.costo_promedio) || 0);
    const usuarioValido = resolveValidUserId(db, id_usuario);

    const insertMov = runStmt(
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prodId,
        usuarioValido,
        tipoMov,
        cantNum,
        stockAnterior,
        stockResultante,
        costoActual,
        String(referencia_origen || 'REGISTRO MERMA').trim(),
        cleanMotivo,
      ]
    );

    db.run('COMMIT;');
    const syncStatus = await persistChangesToLocalDisk();
    const updatedProd = queryGet(
      db,
      'SELECT id_producto, nombre, stock_actual, costo_promedio, unidad_medida FROM productos WHERE id_producto = ?',
      [prodId]
    );

    return {
      savedToFile: activeFileMeta.originalName,
      wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
      id_movimiento: Number(insertMov.lastInsertRowid),
      producto: updatedProd,
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
    };
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }
}
