const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SQL_DIST_DIR = path.join(ROOT_DIR, 'node_modules', 'sql.js', 'dist');
const VENDOR_SQL_DIR = path.join(DIST_DIR, 'vendor', 'sql.js');

const SQL_VENDOR_FILES = [
  'sql-wasm.js',
  'sql-wasm.wasm',
  'worker.sql-wasm.js',
];

function build() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  fs.cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true });

  fs.mkdirSync(VENDOR_SQL_DIR, { recursive: true });
  for (const fileName of SQL_VENDOR_FILES) {
    const srcPath = path.join(SQL_DIST_DIR, fileName);
    const destPath = path.join(VENDOR_SQL_DIR, fileName);
    fs.copyFileSync(srcPath, destPath);
  }

  console.log('Build completado en dist/ (public/ + vendor/sql.js/)');
}

build();
