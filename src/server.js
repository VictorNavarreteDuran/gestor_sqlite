const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

const SQL_DIST_DIR = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Solo se exponen los binarios de producción necesarios de sql.js (evita exponer ~5 MB de builds debug y .zip)
const ALLOWED_SQL_VENDOR_FILES = new Set([
  'sql-wasm.js',
  'sql-wasm.wasm',
  'worker.sql-wasm.js',
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Caché en RAM de archivos estáticos pre-comprimidos (Brotli / Gzip) indexada por ruta e instante de modificación (mtimeMs)
const assetMemoryCache = new Map();

function getCachedStaticAsset(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
  } catch (_) {
    return null;
  }

  const cached = assetMemoryCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }

  const raw = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const compressible =
    ext === '.html' ||
    ext === '.css' ||
    ext === '.js' ||
    ext === '.wasm' ||
    ext === '.json' ||
    ext === '.svg';

  const gzip = compressible
    ? zlib.gzipSync(raw, { level: zlib.constants.Z_DEFAULT_COMPRESSION })
    : null;
  const br = compressible
    ? zlib.brotliCompressSync(raw, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
        },
      })
    : null;

  const entry = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    etag: `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`,
    contentType: MIME_TYPES[ext] || 'application/octet-stream',
    raw,
    gzip,
    br,
  };

  assetMemoryCache.set(filePath, entry);
  return entry;
}

function sendCompressedAsset(req, res, entry, cacheControlValue) {
  res.setHeader('Content-Type', entry.contentType);
  res.setHeader('Cache-Control', cacheControlValue);
  res.setHeader('ETag', entry.etag);
  res.setHeader('Vary', 'Accept-Encoding');

  if (req.headers['if-none-match'] === entry.etag) {
    return res.status(304).end();
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (entry.br && /\bbr\b/.test(acceptEncoding)) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Content-Length', String(entry.br.byteLength));
    return res.status(200).end(entry.br);
  }

  if (entry.gzip && /\bgzip\b/.test(acceptEncoding)) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(entry.gzip.byteLength));
    return res.status(200).end(entry.gzip);
  }

  res.setHeader('Content-Length', String(entry.raw.byteLength));
  return res.status(200).end(entry.raw);
}

// Cabeceras de seguridad y privacidad (Ley N° 21.719 - Sin almacenamiento en servidor)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Motor WebAssembly de SQLite (sql.js) servido desde caché en memoria con compresión Brotli/Gzip
// y cabecera de caché inmutable (el motor .wasm no contiene datos de usuario y ahorra ~685 KB por navegación)
app.get('/vendor/sql.js/:file', (req, res) => {
  const fileName = path.basename(req.params.file || '');
  if (!ALLOWED_SQL_VENDOR_FILES.has(fileName)) {
    return res.status(404).end();
  }

  const fullPath = path.join(SQL_DIST_DIR, fileName);
  const entry = getCachedStaticAsset(fullPath);
  if (!entry) {
    return res.status(404).end();
  }

  return sendCompressedAsset(req, res, entry, 'public, max-age=86400, immutable');
});

// Middleware de alto rendimiento para activos de /public con compresión Brotli/Gzip y Cache-Control: no-store
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const cleanPath = req.path === '/' ? '/index.html' : req.path;
  const resolvedPath = path.resolve(PUBLIC_DIR, `.${cleanPath}`);
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return res.status(403).end();
  }

  const entry = getCachedStaticAsset(resolvedPath);
  if (!entry) {
    return next();
  }

  return sendCompressedAsset(req, res, entry, 'no-store');
});

// Respaldo estático estándar para cualquier otro archivo en /public
app.use(express.static(PUBLIC_DIR, { etag: true, maxAge: 0 }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Servidor web estático optimizado iniciado en http://localhost:${PORT} (100% Local en Navegador · Compresión Brotli/Gzip activa)`
    );
  });
}

module.exports = app;
