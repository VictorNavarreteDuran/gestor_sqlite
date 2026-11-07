/**
 * Motor SQLite 100% Client-Side (WebAssembly mediante sql.js)
 * Cumplimiento Ley 21.719 (Chile) — Privacidad desde el Diseño y por Defecto:
 * - El archivo .db jamás se sube ni se almacena en el servidor.
 * - Todas las consultas y transacciones ocurren en la memoria local del navegador del usuario.
 * - Los cambios se escriben directamente sobre el archivo .db local del computador del usuario
 *   (vía File System Access API) o se descargan directamente a su equipo.
 */
(function (global) {
  'use strict';

  const SQLITE_HEADER = 'SQLite format 3\0';
  const SESSION_FLAG_KEY = 'pime_local_db_active_session';
  const IDB_NAME = 'pime_ephemeral_local_db';
  const IDB_STORE = 'active_session_store';
  const IDB_KEY = 'current_db_session';

  const DEFAULT_SCHEMA_SQL = `
-- Configuración inicial obligatoria en cada conexión SQLite
PRAGMA foreign_keys = ON;

-- 1. USUARIOS (Auditoría y permisos)
CREATE TABLE usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('ADMIN', 'CAJERO', 'BODEGUERO')),
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. CATEGORÍAS
CREATE TABLE categorias (
    id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1
);

-- 3. PROVEEDORES
CREATE TABLE proveedores (
    id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT,
    rut_identificacion TEXT UNIQUE,
    razon_social TEXT NOT NULL,
    contacto_nombre TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. CLIENTES
CREATE TABLE clientes (
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
    rut_identificacion TEXT UNIQUE,
    nombre TEXT NOT NULL,
    giro TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. PRODUCTOS
-- Se usa REAL en stock para soportar venta a granel (ej: 1.5 kg o 2.25 metros)
CREATE TABLE productos (
    id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    codigo_barras TEXT UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    id_categoria INTEGER,
    unidad_medida TEXT NOT NULL DEFAULT 'UN' CHECK (unidad_medida IN ('UN', 'KG', 'LT', 'MT', 'CAJA')),
    costo_promedio REAL NOT NULL DEFAULT 0 CHECK (costo_promedio >= 0),
    precio_neto REAL NOT NULL CHECK (precio_neto >= 0),
    exento_iva INTEGER NOT NULL DEFAULT 0, -- 0: Afecto a IVA, 1: Exento
    precio_venta_final REAL NOT NULL CHECK (precio_venta_final >= 0),
    stock_actual REAL NOT NULL DEFAULT 0,
    stock_minimo REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE SET NULL
);

-- 6. COMPRAS / INGRESOS DE BODEGA (Cabecera)
CREATE TABLE compras (
    id_compra INTEGER PRIMARY KEY AUTOINCREMENT,
    id_proveedor INTEGER,
    id_usuario INTEGER NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('FACTURA', 'BOLETA', 'GUIA_DESPACHO', 'SIN_DOC')),
    folio_documento TEXT,
    fecha_emision DATE NOT NULL DEFAULT (DATE('now')),
    total_neto REAL NOT NULL DEFAULT 0,
    total_iva REAL NOT NULL DEFAULT 0,
    total_compra REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'RECIBIDA' CHECK (estado IN ('RECIBIDA', 'ANULADA')),
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- 7. DETALLE DE COMPRAS
CREATE TABLE detalle_compras (
    id_detalle_compra INTEGER PRIMARY KEY AUTOINCREMENT,
    id_compra INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    costo_unitario_neto REAL NOT NULL CHECK (costo_unitario_neto >= 0),
    subtotal_neto REAL NOT NULL,
    FOREIGN KEY (id_compra) REFERENCES compras(id_compra) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- 8. VENTAS (Cabecera)
CREATE TABLE ventas (
    id_venta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER,
    id_usuario INTEGER NOT NULL,
    tipo_documento TEXT NOT NULL DEFAULT 'BOLETA' CHECK (tipo_documento IN ('BOLETA', 'FACTURA', 'TICKET_INTERNO')),
    folio_documento TEXT,
    fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal_neto REAL NOT NULL DEFAULT 0,
    total_iva REAL NOT NULL DEFAULT 0,
    descuento_global REAL NOT NULL DEFAULT 0,
    total_venta REAL NOT NULL CHECK (total_venta >= 0),
    estado TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (estado IN ('COMPLETADA', 'ANULADA', 'PENDIENTE')),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- 9. DETALLE DE VENTAS
-- Congela precio y costo al momento de la venta para reportes reales de utilidad
CREATE TABLE detalle_ventas (
    id_detalle_venta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    precio_unitario_venta REAL NOT NULL CHECK (precio_unitario_venta >= 0),
    costo_unitario_historico REAL NOT NULL DEFAULT 0,
    descuento_linea REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- 10. PAGOS DE VENTA (Soporta pagos mixtos: mitad efectivo, mitad transferencia)
CREATE TABLE pagos_venta (
    id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta INTEGER NOT NULL,
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'CREDITO_INTERNO')),
    monto REAL NOT NULL CHECK (monto > 0),
    referencia_transaccion TEXT, -- Nro de voucher o comprobante
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE
);

-- 11. MOVIMIENTOS DE INVENTARIO (Kardex Inmutable)
CREATE TABLE movimientos_inventario (
    id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_producto INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN (
        'ENTRADA_COMPRA', 
        'SALIDA_VENTA', 
        'DEVOLUCION_CLIENTE', 
        'DEVOLUCION_PROVEEDOR', 
        'AJUSTE_POSITIVO', 
        'AJUSTE_NEGATIVO', 
        'MERMA'
    )),
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    stock_anterior REAL NOT NULL,
    stock_resultante REAL NOT NULL,
    costo_unitario REAL,
    referencia_origen TEXT, -- Ej: 'VENTA #105', 'COMPRA #22', 'CONTEO FISICO'
    motivo TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- ==========================================
-- TRIGGERS AUTOMÁTICOS DE INTEGRIDAD
-- ==========================================
CREATE TRIGGER trg_actualizar_stock_kardex
AFTER INSERT ON movimientos_inventario
BEGIN
    UPDATE productos
    SET stock_actual = NEW.stock_resultante,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE id_producto = NEW.id_producto;
END;

-- ==========================================
-- ÍNDICES DE RENDIMIENTO
-- ==========================================
CREATE INDEX idx_productos_busqueda ON productos(nombre, sku, codigo_barras);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_venta, estado);
CREATE INDEX idx_detalle_ventas_prod ON detalle_ventas(id_producto);
CREATE INDEX idx_kardex_producto_fecha ON movimientos_inventario(id_producto, fecha);
`;

  let sqlJsPromise = null;
  let activeDbInstance = null;
  let activeFileMeta = null; // { originalName, sizeBytes, tables, uploadedAt, hasDirectFileHandle }
  let activeFileHandle = null;

  function loadSqlJsEngine() {
    if (sqlJsPromise) return sqlJsPromise;
    if (typeof global.initSqlJs !== 'function') {
      return Promise.reject(
        new Error('No se pudo inicializar el motor WebAssembly de SQLite (sql.js no está cargado).')
      );
    }
    sqlJsPromise = global.initSqlJs({
      locateFile: (file) => `/vendor/sql.js/${file}`,
    });
    return sqlJsPromise;
  }

  function sanitizeParams(params = []) {
    return params.map((v) => (v === undefined ? null : v));
  }

  function queryAll(db, sql, params = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(sanitizeParams(params));
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  function queryGet(db, sql, params = []) {
    const rows = queryAll(db, sql, params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  function runStmt(db, sql, params = []) {
    db.run(sql, sanitizeParams(params));
    const lastRow = queryGet(db, 'SELECT last_insert_rowid() AS id');
    const changes = db.getRowsModified();
    return {
      lastInsertRowid: lastRow ? Number(lastRow.id) : 0,
      changes,
    };
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveEphemeralSessionState(bytes, meta, fileHandle = null) {
    const sessionId =
      sessionStorage.getItem(SESSION_FLAG_KEY) ||
      `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_FLAG_KEY, sessionId);

    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(
        {
          sessionId,
          bytes: new Uint8Array(bytes),
          meta,
          fileHandle: fileHandle || null,
          updatedAt: new Date().toISOString(),
        },
        IDB_KEY
      );
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        reject(tx.error);
      };
    });
  }

  async function clearSession() {
    if (activeDbInstance) {
      try {
        activeDbInstance.close();
      } catch (_) {}
    }
    activeDbInstance = null;
    activeFileMeta = null;
    activeFileHandle = null;
    sessionStorage.removeItem(SESSION_FLAG_KEY);

    try {
      const idb = await openIdb();
      await new Promise((resolve) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => {
          idb.close();
          resolve();
        };
      });
    } catch (_) {}
  }

  function validateSqliteBytesHeader(bytes) {
    if (!bytes || bytes.byteLength < 100) {
      return {
        valid: false,
        error: 'El archivo es demasiado pequeño para ser una base SQLite válida.',
      };
    }
    const headerBytes = bytes.subarray(0, 16);
    let headerStr = '';
    for (let i = 0; i < headerBytes.length; i++) {
      headerStr += String.fromCharCode(headerBytes[i]);
    }
    if (headerStr !== SQLITE_HEADER) {
      return {
        valid: false,
        error: 'El archivo seleccionado no tiene un encabezado SQLite 3 válido.',
      };
    }
    return { valid: true };
  }

  function listUserTables(db) {
    return queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map((r) => r.name);
  }

  /**
   * Restaura la base en memoria únicamente si existe una sesión activa en la pestaña actual (`sessionStorage`).
   * Si el usuario recién ingresa a la web en una pestaña nueva, purga cualquier residuo y exige cargar el .db.
   */
  async function ensureLoadedInTab() {
    const currentSessionId = sessionStorage.getItem(SESSION_FLAG_KEY);
    if (!currentSessionId) {
      await clearSession();
      return null;
    }

    if (activeDbInstance && activeFileMeta) {
      return activeFileMeta;
    }

    try {
      const idb = await openIdb();
      const record = await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => {
          idb.close();
          resolve(req.result);
        };
        req.onerror = () => {
          idb.close();
          reject(req.error);
        };
      });

      if (!record || record.sessionId !== currentSessionId || !record.bytes) {
        await clearSession();
        return null;
      }

      const SQL = await loadSqlJsEngine();
      const db = new SQL.Database(new Uint8Array(record.bytes));
      db.run('PRAGMA foreign_keys = ON;');

      const tables = listUserTables(db);
      activeDbInstance = db;
      activeFileHandle = record.fileHandle || null;
      activeFileMeta = {
        ...record.meta,
        sizeBytes: record.bytes.byteLength,
        tables,
        hasDirectFileHandle: Boolean(activeFileHandle),
      };
      return activeFileMeta;
    } catch (_) {
      await clearSession();
      return null;
    }
  }

  /**
   * Carga un archivo .db desde el computador del usuario hacia la memoria del navegador.
   */
  async function loadDatabaseFromFile(file, fileHandle = null) {
    if (!file) {
      throw new Error('No se seleccionó ningún archivo .db');
    }
    const allowedExt = ['.db', '.sqlite', '.sqlite3'];
    const lowerName = file.name.toLowerCase();
    if (!allowedExt.some((ext) => lowerName.endsWith(ext))) {
      throw new Error('Solo se permiten archivos .db, .sqlite o .sqlite3');
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const headerCheck = validateSqliteBytesHeader(bytes);
    if (!headerCheck.valid) {
      throw new Error(headerCheck.error);
    }

    const SQL = await loadSqlJsEngine();
    let db = null;
    try {
      db = new SQL.Database(bytes);
      db.run('PRAGMA foreign_keys = ON;');
      const tables = listUserTables(db);

      if (activeDbInstance) {
        try {
          activeDbInstance.close();
        } catch (_) {}
      }

      activeDbInstance = db;
      activeFileHandle = fileHandle || null;
      activeFileMeta = {
        originalName: file.name,
        sizeBytes: bytes.byteLength,
        tables,
        uploadedAt: new Date().toISOString(),
        hasDirectFileHandle: Boolean(activeFileHandle),
      };

      await saveEphemeralSessionState(bytes, activeFileMeta, activeFileHandle);
      return activeFileMeta;
    } catch (err) {
      if (db) {
        try {
          db.close();
        } catch (_) {}
      }
      throw new Error(err.message || 'El archivo seleccionado no es una base SQLite válida.');
    }
  }

  /**
   * Exporta los bytes actuales y, si el usuario abrió el archivo con File System Access API,
   * escribe los cambios directamente en el archivo .db de su computador.
   */
  async function persistChangesToLocalDisk() {
    if (!activeDbInstance || !activeFileMeta) {
      throw new Error('No hay ninguna base de datos cargada en la sesión.');
    }

    const exportedBytes = activeDbInstance.export();
    activeFileMeta.sizeBytes = exportedBytes.byteLength;
    activeFileMeta.tables = listUserTables(activeDbInstance);

    let wroteDirectlyToDisk = false;
    if (activeFileHandle && typeof activeFileHandle.createWritable === 'function') {
      try {
        if (typeof activeFileHandle.queryPermission === 'function') {
          let perm = await activeFileHandle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted' && typeof activeFileHandle.requestPermission === 'function') {
            perm = await activeFileHandle.requestPermission({ mode: 'readwrite' });
          }
          if (perm === 'granted') {
            const writable = await activeFileHandle.createWritable();
            await writable.write(exportedBytes);
            await writable.close();
            wroteDirectlyToDisk = true;
          }
        } else {
          const writable = await activeFileHandle.createWritable();
          await writable.write(exportedBytes);
          await writable.close();
          wroteDirectlyToDisk = true;
        }
      } catch (_) {
        wroteDirectlyToDisk = false;
      }
    }

    activeFileMeta.hasDirectFileHandle = Boolean(activeFileHandle && wroteDirectlyToDisk);
    await saveEphemeralSessionState(exportedBytes, activeFileMeta, activeFileHandle);

    return {
      wroteDirectlyToDisk,
      fileName: activeFileMeta.originalName,
      sizeBytes: exportedBytes.byteLength,
    };
  }

  /**
   * Permite vincular en cualquier momento el archivo .db del computador para escritura directa.
   */
  async function linkDirectLocalFileForSaving() {
    if (!activeDbInstance || !activeFileMeta) {
      throw new Error('Primero debes cargar una base de datos.');
    }
    if (typeof global.showSaveFilePicker === 'function') {
      const handle = await global.showSaveFilePicker({
        suggestedName: activeFileMeta.originalName || 'base_actualizada.db',
        types: [
          {
            description: 'Base de datos SQLite',
            accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'] },
          },
        ],
      });
      activeFileHandle = handle;
      activeFileMeta.originalName = handle.name || activeFileMeta.originalName;
      return persistChangesToLocalDisk();
    }
    return downloadActiveDatabaseFile();
  }

  function triggerBrowserDownload(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /**
   * Descarga el archivo .db activo consolidado directamente al computador del usuario.
   */
  async function downloadActiveDatabaseFile() {
    await ensureLoadedInTab();
    if (!activeDbInstance || !activeFileMeta) {
      throw new Error('No hay ninguna base de datos activa cargada.');
    }
    const exportedBytes = activeDbInstance.export();
    activeFileMeta.sizeBytes = exportedBytes.byteLength;
    triggerBrowserDownload(exportedBytes, activeFileMeta.originalName || 'base_actualizada.db');
    return {
      fileName: activeFileMeta.originalName || 'base_actualizada.db',
      sizeBytes: exportedBytes.byteLength,
    };
  }

  /**
   * Genera un archivo .db con el esquema predeterminado íntegramente en el navegador y lo descarga.
   */
  async function downloadEmptyDatabaseFile(rawName = 'nueva_base') {
    const clean = String(rawName || 'nueva_base')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = clean.endsWith('.db') ? clean : `${clean}.db`;

    const SQL = await loadSqlJsEngine();
    const db = new SQL.Database();
    try {
      db.run('PRAGMA encoding = "UTF-8";');
      db.run(DEFAULT_SCHEMA_SQL);
      const bytes = db.export();
      triggerBrowserDownload(bytes, fileName);
      return { fileName, sizeBytes: bytes.byteLength };
    } finally {
      db.close();
    }
  }

  function requireActiveDb() {
    if (!activeDbInstance || !activeFileMeta) {
      const err = new Error('No hay ninguna base de datos activa cargada en esta sesión.');
      err.status = 404;
      throw err;
    }
    activeDbInstance.run('PRAGMA foreign_keys = ON;');
    return activeDbInstance;
  }

  function resolveValidUserId(db, preferredUserId = null) {
    if (preferredUserId) {
      const found = queryGet(
        db,
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND activo = ?',
        [Number(preferredUserId), 1]
      );
      if (found) return Number(found.id_usuario);
    }

    const firstActive = queryGet(
      db,
      'SELECT id_usuario FROM usuarios WHERE activo = ? ORDER BY id_usuario ASC LIMIT ?',
      [1, 1]
    );
    if (firstActive) return Number(firstActive.id_usuario);

    const anyUser = queryGet(
      db,
      'SELECT id_usuario FROM usuarios ORDER BY id_usuario ASC LIMIT ?',
      [1]
    );
    if (anyUser) return Number(anyUser.id_usuario);

    const insertUser = runStmt(
      db,
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?)`,
      ['Operador Local', 'operador@local.db', 'local_operator_only', 'ADMIN', 1]
    );
    return Number(insertUser.lastInsertRowid);
  }

  // ==========================================
  // CONSULTAS DEL PANEL DE INICIO (DASHBOARD)
  // ==========================================
  async function getDashboardData() {
    await ensureLoadedInTab();
    const db = requireActiveDb();

    const existingTables = new Set(listUserTables(db));

    const salesSummary = {
      hoyMonto: 0,
      hoyCantidad: 0,
      mesMonto: 0,
      mesCantidad: 0,
      totalMonto: 0,
      totalCantidad: 0,
      utilidadEstimada: 0,
      ticketPromedio: 0,
      totalProductosActivos: 0,
      totalStockBajo: 0,
    };

    let lowStockProducts = [];
    let topSellingProducts = [];
    let recentSales = [];

    if (existingTables.has('ventas')) {
      const hoy = queryGet(
        db,
        `SELECT COALESCE(SUM(total_venta), 0) AS monto, COUNT(*) AS cantidad
         FROM ventas
         WHERE estado = 'COMPLETADA' AND date(fecha_venta) = date('now', 'localtime')`
      );

      const mes = queryGet(
        db,
        `SELECT COALESCE(SUM(total_venta), 0) AS monto, COUNT(*) AS cantidad
         FROM ventas
         WHERE estado = 'COMPLETADA' AND strftime('%Y-%m', fecha_venta) = strftime('%Y-%m', 'now', 'localtime')`
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
      salesSummary.totalMonto = Number(total?.monto) || 0;
      salesSummary.totalCantidad = Number(total?.cantidad) || 0;
      salesSummary.ticketPromedio =
        salesSummary.totalCantidad > 0 ? salesSummary.totalMonto / salesSummary.totalCantidad : 0;

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
         FROM detalle_ventas dv
         INNER JOIN ventas v ON v.id_venta = dv.id_venta
         WHERE v.estado = 'COMPLETADA'`
      );
      salesSummary.utilidadEstimada = Number(utilidad?.utilidad) || 0;
    }

    if (existingTables.has('productos')) {
      const prodStats = queryGet(
        db,
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo
         FROM productos
         WHERE activo = 1`
      );

      salesSummary.totalProductosActivos = Number(prodStats?.total) || 0;
      salesSummary.totalStockBajo = Number(prodStats?.bajo) || 0;

      const hasCategorias = existingTables.has('categorias');
      lowStockProducts = queryAll(
        db,
        hasCategorias
          ? `SELECT p.id_producto, p.sku, p.codigo_barras, p.nombre, p.unidad_medida,
                    p.stock_actual, p.stock_minimo, p.precio_venta_final,
                    COALESCE(c.nombre, 'Sin categoría') AS categoria
             FROM productos p
             LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
             WHERE p.activo = 1 AND p.stock_actual <= p.stock_minimo
             ORDER BY (p.stock_actual - p.stock_minimo) ASC, p.stock_actual ASC
             LIMIT 15`
          : `SELECT p.id_producto, p.sku, p.codigo_barras, p.nombre, p.unidad_medida,
                    p.stock_actual, p.stock_minimo, p.precio_venta_final,
                    'Sin categoría' AS categoria
             FROM productos p
             WHERE p.activo = 1 AND p.stock_actual <= p.stock_minimo
             ORDER BY (p.stock_actual - p.stock_minimo) ASC, p.stock_actual ASC
             LIMIT 15`
      );
    }

    if (
      existingTables.has('detalle_ventas') &&
      existingTables.has('ventas') &&
      existingTables.has('productos')
    ) {
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
         LIMIT 10`
      );
    }

    return {
      database: { ...activeFileMeta },
      salesSummary,
      lowStockProducts,
      topSellingProducts,
      recentSales,
    };
  }

  // ==========================================
  // CONSULTAS DE INVENTARIO
  // ==========================================
  function getInventoryTopSellingSync(
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

  function getInventoryUrgentStockSync(
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

  function getInventorySlowMovingSync(
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

  function searchInventoryProductsSync(
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

  async function getInventorySectionData(params = {}) {
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

  async function searchInventoryProducts(params = {}) {
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

  // ==========================================
  // GESTIÓN DE STOCK, PRODUCTOS NUEVOS Y MERMAS (KARDEX)
  // ==========================================
  async function getStockManagementData(params = {}) {
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

  async function createProductWithInitialStock(payload = {}) {
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
      costo_promedio = 0,
      precio_neto = 0,
      exento_iva = 0,
      precio_venta_final = 0,
      stock_minimo = 0,
      stock_inicial = 0,
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

    const costoPromNum = Number(costo_promedio);
    const precioNetoNum = Number(precio_neto);
    const precioFinalNum = Number(precio_venta_final);
    const stockMinNum = Number(stock_minimo ?? 0);
    const stockInicialNum = Number(stock_inicial ?? 0);
    const exentoInt = Number(exento_iva) === 1 ? 1 : 0;

    if (Number.isNaN(costoPromNum) || costoPromNum < 0) {
      throw new Error('El costo promedio debe ser un número mayor o igual a 0.');
    }
    if (Number.isNaN(precioNetoNum) || precioNetoNum < 0) {
      throw new Error('El precio neto debe ser un número mayor o igual a 0.');
    }
    if (Number.isNaN(precioFinalNum) || precioFinalNum < 0) {
      throw new Error('El precio de venta final debe ser un número mayor o igual a 0.');
    }
    if (Number.isNaN(stockMinNum) || stockMinNum < 0) {
      throw new Error('El stock mínimo debe ser un número mayor o igual a 0.');
    }
    if (Number.isNaN(stockInicialNum) || stockInicialNum < 0) {
      throw new Error('El stock inicial no puede ser negativo.');
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

  async function registerStockEntry(payload = {}) {
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

    const cantNum = Number(cantidad);
    if (Number.isNaN(cantNum) || cantNum <= 0) {
      throw new Error('La cantidad a ingresar debe ser mayor a 0.');
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

      const stockAnterior = Number(producto.stock_actual) || 0;
      const stockResultante = Number((stockAnterior + cantNum).toFixed(4));
      const costoActual = Number(producto.costo_promedio) || 0;
      const costoUnitarioFinal =
        costo_unitario !== null &&
        costo_unitario !== '' &&
        !Number.isNaN(Number(costo_unitario)) &&
        Number(costo_unitario) >= 0
          ? Number(costo_unitario)
          : costoActual;

      if (tipoMov === 'ENTRADA_COMPRA' && costoUnitarioFinal >= 0 && stockResultante > 0) {
        const stockBase = Math.max(0, stockAnterior);
        const nuevoCostoPromedio = Number(
          (((stockBase * costoActual) + (cantNum * costoUnitarioFinal)) / (stockBase + cantNum)).toFixed(2)
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

  async function registerStockLossOrMerma(payload = {}) {
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

      const stockAnterior = Number(producto.stock_actual) || 0;
      if (cantNum > stockAnterior) {
        throw new Error(
          `Stock insuficiente para registrar la merma. Stock actual de "${producto.nombre}": ${stockAnterior} ${producto.unidad_medida}.`
        );
      }

      const stockResultante = Number((stockAnterior - cantNum).toFixed(4));
      const costoActual = Number(producto.costo_promedio) || 0;
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

  // ==========================================
  // SECCIÓN VENTAS (POS)
  // ==========================================
  async function getSalesSectionData(params = {}) {
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

    const clientes = queryAll(
      db,
      `SELECT id_cliente, rut_identificacion, nombre, giro, telefono, email
       FROM clientes
       ORDER BY nombre ASC`
    );

    const categorias = queryAll(
      db,
      `SELECT id_categoria, nombre, descripcion, activo
       FROM categorias
       WHERE activo = 1
       ORDER BY nombre ASC`
    );

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

    const productos = queryAll(
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

    const limVentas = Math.max(
      1,
      Math.min(100, Number(params.limite_ventas ?? params.limiteVentas) || 25)
    );

    const ventasRecientes = queryAll(
      db,
      `SELECT
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
       FROM ventas v
       LEFT JOIN clientes cl ON cl.id_cliente = v.id_cliente
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
       LEFT JOIN (
         SELECT
           dv.id_venta,
           SUM(dv.cantidad) AS total_items,
           GROUP_CONCAT(p.nombre || ' x' || dv.cantidad, ', ') AS resumen_productos
         FROM detalle_ventas dv
         INNER JOIN productos p ON p.id_producto = dv.id_producto
         GROUP BY dv.id_venta
       ) dv_agg ON dv_agg.id_venta = v.id_venta
       LEFT JOIN (
         SELECT
           pv.id_venta,
           GROUP_CONCAT(pv.metodo_pago, ' + ') AS metodos_pago
         FROM pagos_venta pv
         GROUP BY pv.id_venta
       ) pv_agg ON pv_agg.id_venta = v.id_venta
       ORDER BY v.fecha_venta DESC, v.id_venta DESC
       LIMIT ?`,
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

  async function registerSaleTransaction(payload = {}) {
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

  // ==========================================
  // SECCIÓN CLIENTES Y PROVEEDORES (DERECHOS ARSOP+ LEY 21.719)
  // ==========================================
  async function getClientsAndSuppliersData(params = {}) {
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

  async function saveClientRecord(payload = {}) {
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
  async function deleteClientRecord(idCliente) {
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
  async function exportClientPersonalData(idCliente) {
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

  global.LocalSqliteEngine = {
    ensureLoadedInTab,
    clearSession,
    loadDatabaseFromFile,
    persistChangesToLocalDisk,
    linkDirectLocalFileForSaving,
    downloadActiveDatabaseFile,
    downloadEmptyDatabaseFile,
    getDashboardData,
    getInventorySectionData,
    searchInventoryProducts,
    getStockManagementData,
    createProductWithInitialStock,
    registerStockEntry,
    registerStockLossOrMerma,
    getSalesSectionData,
    registerSaleTransaction,
    getClientsAndSuppliersData,
    saveClientRecord,
    deleteClientRecord,
    exportClientPersonalData,
  };
})(window);
