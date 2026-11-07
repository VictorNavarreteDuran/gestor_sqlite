const express = require('express');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad y privacidad (Ley N° 21.719 - Sin almacenamiento en servidor)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Motor WebAssembly de SQLite (sql.js) servido estáticamente para ejecución 100% en el navegador
app.use(
  '/vendor/sql.js',
  express.static(path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist'))
);

// Archivos estáticos de la interfaz web (el servidor no recibe ni almacena archivos .db)
app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Servidor web estático iniciado en http://localhost:${PORT} (100% Local en Navegador · Cero archivos en servidor)`
    );
  });
}

module.exports = app;
