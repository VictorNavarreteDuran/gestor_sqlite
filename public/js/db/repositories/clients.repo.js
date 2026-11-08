import {
  activeFileMeta,
  ensureLoadedInTab,
  persistChangesToLocalDisk,
  queryAll,
  queryGet,
  requireActiveDb,
  runStmt,
  triggerBrowserDownload,
} from '../engine.js';

// ==========================================
// SECCIÓN CLIENTES Y PROVEEDORES (DERECHOS ARSOP+ LEY 21.719)
// ==========================================
export async function getClientsAndSuppliersData(params = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const q = String(params.q ?? '').trim();
  const like = `%${q}%`;
  const limiteClientes = Math.max(1, Math.min(100, Number(params.limite) || 5));

  const totalClientesRow = queryGet(
    db,
    `SELECT COUNT(*) AS total
     FROM clientes c
     WHERE (? = '' OR c.nombre LIKE ? OR c.rut_identificacion LIKE ? OR c.giro LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.direccion LIKE ?)`,
    [q, like, like, like, like, like, like]
  );

  const clientes = queryAll(
    db,
    `SELECT
       c.id_cliente,
       c.rut_identificacion,
       c.nombre,
       c.giro,
       c.telefono,
       c.email,
       c.direccion,
       c.creado_en,
       COUNT(v.id_venta) AS total_compras,
       COALESCE(SUM(CASE WHEN v.estado = 'COMPLETADA' THEN v.total_venta ELSE 0 END), 0) AS monto_historico
     FROM clientes c
     LEFT JOIN ventas v ON v.id_cliente = c.id_cliente
     WHERE (? = '' OR c.nombre LIKE ? OR c.rut_identificacion LIKE ? OR c.giro LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.direccion LIKE ?)
     GROUP BY c.id_cliente
     ORDER BY c.id_cliente DESC
     LIMIT ?`,
    [q, like, like, like, like, like, like, limiteClientes]
  );

  const proveedores = queryAll(
    db,
    `SELECT
       id_proveedor,
       rut_identificacion,
       razon_social,
       contacto_nombre,
       telefono,
       email,
       direccion,
       activo,
       creado_en
     FROM proveedores
     WHERE (? = '' OR razon_social LIKE ? OR rut_identificacion LIKE ? OR contacto_nombre LIKE ? OR email LIKE ?)
     ORDER BY id_proveedor DESC
     LIMIT 100`,
    [q, like, like, like, like]
  );

  return {
    database: { ...activeFileMeta },
    totalClientes: Number(totalClientesRow?.total) || 0,
    clientes,
    proveedores,
  };
}

export async function saveClientRecord(payload = {}) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const idCliente = payload.id_cliente ? Number(payload.id_cliente) : null;
  const nombre = String(payload.nombre ?? '').trim();
  if (!nombre) {
    throw new Error('El nombre o razón social del cliente es obligatorio.');
  }

  const rut = String(payload.rut_identificacion ?? '').trim() || null;
  const giro = String(payload.giro ?? '').trim() || null;
  const telefono = String(payload.telefono ?? '').trim() || null;
  const email = String(payload.email ?? '').trim() || null;
  const direccion = String(payload.direccion ?? '').trim() || null;

  if (idCliente) {
    runStmt(
      db,
      `UPDATE clientes
       SET rut_identificacion = ?,
           nombre = ?,
           giro = ?,
           telefono = ?,
           email = ?,
           direccion = ?
       WHERE id_cliente = ?`,
      [rut, nombre, giro, telefono, email, direccion, idCliente]
    );
  } else {
    runStmt(
      db,
      `INSERT INTO clientes (rut_identificacion, nombre, giro, telefono, email, direccion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rut, nombre, giro, telefono, email, direccion]
    );
  }

  const syncStatus = await persistChangesToLocalDisk();
  return {
    savedToFile: activeFileMeta.originalName,
    wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
  };
}

/**
 * Derecho de Supresión / Anonimización (Art. 6 Ley 21.719):
 * Permite eliminar al titular de la tabla `clientes` (desvinculando sus ventas mediante ON DELETE SET NULL
 * para no alterar la contabilidad histórica).
 */
export async function deleteClientRecord(idCliente) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const id = Number(idCliente);
  if (!id || Number.isNaN(id)) {
    throw new Error('ID de cliente inválido.');
  }

  runStmt(db, 'DELETE FROM clientes WHERE id_cliente = ?', [id]);
  const syncStatus = await persistChangesToLocalDisk();
  return {
    savedToFile: activeFileMeta.originalName,
    wroteDirectlyToDisk: syncStatus.wroteDirectlyToDisk,
  };
}

/**
 * Derecho de Portabilidad y Acceso (Arts. 4 y 9 Ley 21.719):
 * Exporta todos los datos personales almacenados de un cliente y sus compras asociadas en un archivo JSON estructurado.
 */
export async function exportClientPersonalData(idCliente) {
  await ensureLoadedInTab();
  const db = requireActiveDb();

  const id = Number(idCliente);
  const cliente = queryGet(db, 'SELECT * FROM clientes WHERE id_cliente = ?', [id]);
  if (!cliente) {
    throw new Error('Cliente no encontrado.');
  }

  const ventas = queryAll(
    db,
    `SELECT id_venta, tipo_documento, folio_documento, fecha_venta, subtotal_neto, total_iva, descuento_global, total_venta, estado
     FROM ventas
     WHERE id_cliente = ?
     ORDER BY fecha_venta DESC`,
    [id]
  );

  const payload = {
    ley_aplicable: 'Ley N° 21.719 (Chile) - Portabilidad y Acceso de Datos Personales',
    fecha_exportacion: new Date().toISOString(),
    archivo_origen: activeFileMeta.originalName,
    titular: cliente,
    historial_transacciones: ventas,
  };

  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  const safeName = String(cliente.rut_identificacion || `cliente_${id}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  triggerBrowserDownload(bytes, `portabilidad_datos_${safeName}.json`);
  return payload;
}
