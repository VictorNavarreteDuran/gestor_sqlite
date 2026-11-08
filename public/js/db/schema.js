/**
 * Esquema DDL por defecto (tablas, trigger del Kardex e índices) e índices de rendimiento.
 */

export const DEFAULT_SCHEMA_SQL = `
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
CREATE INDEX idx_productos_activo_stock ON productos(activo, stock_actual, stock_minimo);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_venta, estado);
CREATE INDEX idx_ventas_fecha_id ON ventas(fecha_venta DESC, id_venta DESC);
CREATE INDEX idx_ventas_estado_fecha ON ventas(estado, fecha_venta);
CREATE INDEX idx_ventas_id_cliente ON ventas(id_cliente);
CREATE INDEX idx_detalle_ventas_prod ON detalle_ventas(id_producto);
CREATE INDEX idx_detalle_ventas_id_venta ON detalle_ventas(id_venta);
CREATE INDEX idx_pagos_venta_id_venta ON pagos_venta(id_venta);
CREATE INDEX idx_kardex_producto_fecha ON movimientos_inventario(id_producto, fecha);
CREATE INDEX idx_kardex_prod_tipo_fecha ON movimientos_inventario(id_producto, tipo_movimiento, fecha DESC, id_movimiento DESC);
`;

export function ensurePerformanceIndexes(db, tableNames = []) {
  const tables = new Set(tableNames);
  const indexStatements = [
    [
      'productos',
      'CREATE INDEX IF NOT EXISTS idx_productos_activo_stock ON productos(activo, stock_actual, stock_minimo);',
    ],
    [
      'ventas',
      'CREATE INDEX IF NOT EXISTS idx_ventas_fecha_id ON ventas(fecha_venta DESC, id_venta DESC);',
    ],
    [
      'ventas',
      'CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha ON ventas(estado, fecha_venta);',
    ],
    ['ventas', 'CREATE INDEX IF NOT EXISTS idx_ventas_id_cliente ON ventas(id_cliente);'],
    [
      'detalle_ventas',
      'CREATE INDEX IF NOT EXISTS idx_detalle_ventas_id_venta ON detalle_ventas(id_venta);',
    ],
    [
      'pagos_venta',
      'CREATE INDEX IF NOT EXISTS idx_pagos_venta_id_venta ON pagos_venta(id_venta);',
    ],
    [
      'compras',
      'CREATE INDEX IF NOT EXISTS idx_compras_estado_fecha ON compras(estado, fecha_emision);',
    ],
    [
      'movimientos_inventario',
      'CREATE INDEX IF NOT EXISTS idx_kardex_prod_tipo_fecha ON movimientos_inventario(id_producto, tipo_movimiento, fecha DESC, id_movimiento DESC);',
    ],
    [
      'movimientos_inventario',
      'CREATE INDEX IF NOT EXISTS idx_kardex_tipo_fecha ON movimientos_inventario(tipo_movimiento, fecha DESC);',
    ],
  ];

  for (const [tableName, sql] of indexStatements) {
    if (tables.has(tableName)) {
      try {
        db.run(sql);
      } catch (_) {}
    }
  }
}
