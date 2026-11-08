/**
 * Motor SQLite 100% Client-Side (WebAssembly mediante sql.js)
 * SesiÃ³n efÃ­mera, carga/persistencia del archivo .db local y helpers de consulta.
 * Cumplimiento Ley 21.719 (Chile): el archivo .db jamÃ¡s se sube ni se almacena en el servidor.
 */

import {
  DEFAULT_SCHEMA_SQL,
  ensurePerformanceIndexes,
} from './schema.js';

const SQLITE_HEADER = 'SQLite format 3\0';
const SESSION_FLAG_KEY = 'pime_local_db_active_session';
const IDB_NAME = 'pime_ephemeral_local_db';
const IDB_STORE = 'active_session_store';
const IDB_KEY = 'current_db_session';

let sqlJsPromise = null;
let activeDbInstance = null;
export let activeFileMeta = null; // { originalName, sizeBytes, tables, uploadedAt, hasDirectFileHandle }
let activeFileHandle = null;

function loadSqlJsEngine() {
  if (sqlJsPromise) return sqlJsPromise;
  if (typeof window.initSqlJs !== 'function') {
    return Promise.reject(
      new Error('No se pudo inicializar el motor WebAssembly de SQLite (sql.js no estÃ¡ cargado).')
    );
  }
  sqlJsPromise = window.initSqlJs({
    locateFile: (file) => `/vendor/sql.js/${file}`,
  });
  return sqlJsPromise;
}

function sanitizeParams(params = []) {
  return params.map((v) => (v === undefined ? null : v));
}

export function queryAll(db, sql, params = []) {
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

export function queryGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(sanitizeParams(params));
    return stmt.step() ? stmt.getAsObject() : undefined;
  } finally {
    stmt.free();
  }
}

export function runStmt(db, sql, params = []) {
  db.run(sql, sanitizeParams(params));
  const changes = db.getRowsModified();
  let lastInsertRowid = 0;
  if (/^\s*INSERT\b/i.test(sql)) {
    const lastRow = queryGet(db, 'SELECT last_insert_rowid() AS id');
    lastInsertRowid = lastRow ? Number(lastRow.id) : 0;
  }
  return {
    lastInsertRowid,
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

  // Evita clonar el buffer completo en RAM si ya es instancia de Uint8Array
  const uint8Bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(
      {
        sessionId,
        bytes: uint8Bytes,
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

export async function clearSession() {
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
      error: 'El archivo es demasiado pequeÃ±o para ser una base SQLite vÃ¡lida.',
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
      error: 'El archivo seleccionado no tiene un encabezado SQLite 3 vÃ¡lido.',
    };
  }
  return { valid: true };
}

export function listUserTables(db) {
  return queryAll(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).map((r) => r.name);
}

/**
 * Restaura la base en memoria Ãºnicamente si existe una sesiÃ³n activa en la pestaÃ±a actual (`sessionStorage`).
 * Si el usuario reciÃ©n ingresa a la web en una pestaÃ±a nueva, purga cualquier residuo y exige cargar el .db.
 */
export async function ensureLoadedInTab() {
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
    const dbBytes =
      record.bytes instanceof Uint8Array ? record.bytes : new Uint8Array(record.bytes);
    const db = new SQL.Database(dbBytes);
    db.run('PRAGMA foreign_keys = ON;');

    const tables = listUserTables(db);
    ensurePerformanceIndexes(db, tables);
    activeDbInstance = db;
    activeFileHandle = record.fileHandle || null;
    activeFileMeta = {
      ...record.meta,
      sizeBytes: dbBytes.byteLength,
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
export async function loadDatabaseFromFile(file, fileHandle = null) {
  if (!file) {
    throw new Error('No se seleccionÃ³ ningÃºn archivo .db');
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
    ensurePerformanceIndexes(db, tables);

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
    throw new Error(err.message || 'El archivo seleccionado no es una base SQLite vÃ¡lida.');
  }
}

/**
 * Exporta los bytes actuales y, si el usuario abriÃ³ el archivo con File System Access API,
 * escribe los cambios directamente en el archivo .db de su computador.
 */
export async function persistChangesToLocalDisk() {
  if (!activeDbInstance || !activeFileMeta) {
    throw new Error('No hay ninguna base de datos cargada en la sesiÃ³n.');
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
export async function linkDirectLocalFileForSaving() {
  if (!activeDbInstance || !activeFileMeta) {
    throw new Error('Primero debes cargar una base de datos.');
  }
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
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

export function triggerBrowserDownload(bytes, fileName) {
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
export async function downloadActiveDatabaseFile() {
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
 * Genera un archivo .db con el esquema predeterminado Ã­ntegramente en el navegador y lo descarga.
 */
export async function downloadEmptyDatabaseFile(rawName = 'nueva_base') {
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

export function requireActiveDb() {
  if (!activeDbInstance || !activeFileMeta) {
    const err = new Error('No hay ninguna base de datos activa cargada en esta sesiÃ³n.');
    err.status = 404;
    throw err;
  }
  activeDbInstance.run('PRAGMA foreign_keys = ON;');
  return activeDbInstance;
}

export function resolveValidUserId(db, preferredUserId = null) {
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
