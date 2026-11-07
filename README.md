# Gestor SQLite PIME — Sistema POS, Inventario y Kardex (100% Local-First)

![SQLite 3](https://img.shields.io/badge/SQLite-3%20(WebAssembly)-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express%20Static-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Arquitectura](https://img.shields.io/badge/Arquitectura-100%25%20Client--Side-2563EB?style=flat-square)
![Privacidad](https://img.shields.io/badge/Ley%20N%C2%B0%2021.719%20(Chile)-Privacidad%20por%20Defecto-10B981?style=flat-square)

Plataforma web de **Punto de Venta (POS), Control de Inventario y Kardex Inmutable** diseñada para PYMEs que opera **100% en el navegador del usuario** mediante tecnología WebAssembly (`sql.js`) y `File System Access API`.

Tu archivo de base de datos (`.db`, `.sqlite` o `.sqlite3`) permanece exclusivamente en tu computador: **el servidor web solo entrega los archivos estáticos de la aplicación y jamás recibe, procesa ni almacena bases de datos ni datos personales**.

---

## Tabla de Contenidos

1. [Características Principales](#-características-principales)
2. [Cumplimiento Legal y Privacidad (Ley N° 21.719 - Chile)](#-cumplimiento-legal-y-privacidad-ley-n-21719---chile)
3. [Arquitectura y Reglas de Integridad SQLite](#-arquitectura-y-reglas-de-integridad-sqlite)
4. [Esquema de Base de Datos](#-esquema-de-base-de-datos)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Requisitos e Instalación](#-requisitos-e-instalación)
7. [Flujo de Trabajo Recomendado](#-flujo-de-trabajo-recomendado)

---

## Características Principales

### 1. Gestión Local de Archivos `.db`
- **Apertura directa desde tu PC:** Carga cualquier archivo `.db`, `.sqlite` o `.sqlite3` en la memoria local del navegador. En navegadores compatibles con *File System Access API*, los cambios se guardan directamente sobre el archivo físico de tu disco.
- **Generador de Base de Datos Vacía:** Crea y descarga al instante un archivo SQLite 3 con el esquema completo, restricciones `CHECK`, índices de rendimiento y triggers listos para producción.

### 2. Panel de Inicio (Dashboard Operativo)
- **KPIs en Tiempo Real:** Ventas del día, ventas acumuladas del mes, ingresos históricos, utilidad estimada (basada en costos históricos congelados) y conteo de productos críticos.
- **Alertas y Rankings:** Listado de productos con stock bajo o agotado, ranking Top 10 de productos más vendidos y registro de las últimas ventas emitidas.

### 3. Catálogo y Buscador Avanzado de Inventario
- **Stock de Urgencia:** Cálculo automático de déficit de unidades y costo estimado de reposición.
- **Artículos de Baja Rotación:** Identificación de stock inmovilizado cruzado con su última fecha y referencia de ingreso en Kardex.
- **Buscador Parametrizado:** Filtros combinados por nombre, SKU, código de barras, categoría, unidad de medida (`UN`, `KG`, `LT`, `MT`, `CAJA`) y estado (`Activo` / `Inactivo`).

### 4. Punto de Venta (POS) y Facturación
- **Búsqueda Rápida y Lector de Código de Barras:** Agrega productos al carrito mediante coincidencia exacta de SKU/código de barras o búsqueda interactiva.
- **Descuentos Flexibles:** Soporte para descuentos por línea (`descuento_linea`) y descuento sobre el total de la venta (`descuento_global`) tanto en monto fijo (`$ CLP`) como en porcentaje (`%`).
- **Congelamiento Contable:** Cada línea vendida congela automáticamente el `precio_unitario_venta` y el `costo_unitario_historico` vigentes al momento de la operación.
- **Documentos y Medios de Pago:** Emisión de `BOLETA`, `FACTURA` y `TICKET_INTERNO` con medios de pago `EFECTIVO`, `DEBITO`, `CREDITO`, `TRANSFERENCIA` y `CREDITO_INTERNO`.

### 5. Gestión de Productos, Entradas de Stock y Mermas (Kardex Inmutable)
- **Creación de Productos con Stock Inicial:** Alta de artículos y categorías con registro automático de movimiento inicial en Kardex.
- **Abastecimiento y Bajas:** Registro auditado de `ENTRADA_COMPRA`, `AJUSTE_POSITIVO`, `DEVOLUCION_CLIENTE`, `MERMA`, `AJUSTE_NEGATIVO` y `DEVOLUCION_PROVEEDOR`.

### 6. Directorio de Clientes y Derechos del Titular (ARSOP+)
- **Vista Ágil:** Muestra por defecto los **últimos 5 clientes** registrados junto con su resumen de compras históricas.
- **Buscador en Tiempo Real:** Filtra clientes instantáneamente por nombre, razón social, RUT, giro, teléfono, correo o dirección.
- **Edición y Derechos ARSOP+:**
  - **Editar / Rectificar (Art. 5):** Carga inmediata de los datos del cliente en el formulario para su actualización.
  - **Portabilidad JSON (Arts. 4 y 9):** Exportación descargable en formato `.json` con la ficha del titular y su historial de transacciones.
  - **Supresión (Art. 6):** Eliminación de los datos personales del cliente manteniendo intacta la cuadratura contable histórica (`ON DELETE SET NULL` en `ventas.id_cliente`).

---

## Cumplimiento Legal y Privacidad (Ley N° 21.719 - Chile)

Esta plataforma aplica el principio de **Privacidad desde el Diseño y por Defecto** (*Art. 14 quáter de la Ley N° 21.719* que modifica la Ley N° 19.628 sobre Protección de la Vida Privada en Chile):

1. **Cero Almacenamiento en Servidor:** El servidor Node.js/Express actúa exclusivamente como servidor de archivos estáticos con cabeceras de seguridad (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`).
2. **Procesamiento Local en RAM:** Todas las consultas SQL se ejecutan localmente en el navegador del cliente mediante WebAssembly (`sql-wasm.wasm`).
3. **Limpieza Efímera:** Al cerrar la sesión o la pestaña del navegador, la memoria temporal se purga por completo.

---

## Arquitectura y Reglas de Integridad SQLite

El motor de datos ([`public/local-sqlite.js`](file:///c:/Users/kuro_/OneDrive/Documents/proyectos/base_sqlite_PIME/public/local-sqlite.js)) hace cumplir reglas estrictas de integridad relacional:

1. **PRAGMAs Activos:** Ejecución obligatoria de `PRAGMA foreign_keys = ON;` en toda conexión.
2. **Prohibición de modificar `stock_actual` directamente:** Ninguna operación ejecuta `UPDATE productos SET stock_actual = ...` de forma manual. Toda variación de inventario se registra insertando una fila en `movimientos_inventario`, disparando el trigger `trg_actualizar_stock_kardex`.
3. **Transacciones Atómicas (`BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK`):** Las ventas, compras, altas con stock inicial y ajustes se ejecutan de manera atómica garantizando consistencia entre cabeceras, detalles, pagos y kardex.
4. **Soporte de Venta a Granel:** Las columnas de stock y cantidades utilizan tipo `REAL` con restricción `CHECK (cantidad > 0)`.

---

## Esquema de Base de Datos

| Tabla | Descripción Principal | Clave Primaria |
| :--- | :--- | :--- |
| `usuarios` | Operadores del sistema (`ADMIN`, `CAJERO`, `BODEGUERO`) | `id_usuario` |
| `categorias` | Clasificación del catálogo de productos | `id_categoria` |
| `proveedores` | Directorio de proveedores con RUT único y contacto | `id_proveedor` |
| `clientes` | Directorio de clientes con soporte ARSOP+ | `id_cliente` |
| `productos` | Catálogo maestro con costos, precios, IVA y stock | `id_producto` |
| `compras` | Cabecera de facturas, boletas y guías de proveedores | `id_compra` |
| `detalle_compras` | Líneas de productos ingresados por compra | `id_detalle_compra` |
| `ventas` | Cabecera de ventas (`BOLETA`, `FACTURA`, `TICKET_INTERNO`) | `id_venta` |
| `detalle_ventas` | Ítems vendidos con costo y precio histórico congelado | `id_detalle_venta` |
| `pagos_venta` | Registro de cobros y referencias de transacción | `id_pago` |
| `movimientos_inventario` | Kardex inmutable de entradas, salidas, ajustes y mermas | `id_movimiento` |

### Trigger e Índices Activos
- **Trigger `trg_actualizar_stock_kardex`**: `AFTER INSERT ON movimientos_inventario` → sincroniza `productos.stock_actual = NEW.stock_resultante` y `actualizado_en = CURRENT_TIMESTAMP`.
- **Índices**:
  - `idx_productos_busqueda (nombre, sku, codigo_barras)`
  - `idx_ventas_fecha (fecha_venta, estado)`
  - `idx_detalle_ventas_prod (id_producto)`
  - `idx_kardex_producto_fecha (id_producto, fecha)`

---

## Estructura del Proyecto

```text
base_sqlite_PIME/
├── public/
│   ├── index.html          # Pantalla de inicio: carga/creación de .db y aviso legal Ley 21.719
│   ├── dashboard.html      # Interfaz principal ERP (Dashboard, Inventario, POS, Kardex, Clientes)
│   ├── styles.css          # Hoja de estilos moderna (Dark UI responsiva)
│   ├── local-sqlite.js     # Motor SQLite WebAssembly client-side y transacciones de negocio
│   ├── app.js              # Lógica de la pantalla de inicio y carga de archivos
│   └── dashboard.js        # Controladores de interfaz para todos los módulos del ERP
├── src/
│   └── server.js           # Servidor Express estático con cabeceras de seguridad
├── .gitignore              # Reglas de exclusión para Git (.db, -wal, -shm, node_modules, etc.)
├── package.json            # Configuración de scripts y dependencias (express, sql.js)
└── README.md               # Documentación técnica del proyecto
```

---

## Requisitos e Instalación

### Requisitos Previos
- **Node.js** v18.0.0 o superior.
- **npm** v9.0.0 o superior.
- Navegador web moderno (Chrome, Edge, Brave, Firefox o Safari).

### Pasos de Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar en modo desarrollo (con recarga automática):**
   ```bash
   npm run dev
   ```

3. **Iniciar en modo producción:**
   ```bash
   npm start
   ```

4. **Abrir en el navegador:**
   Ingresa a `http://localhost:3000` (o el puerto definido en la variable de entorno `PORT`).

---

## Flujo de Trabajo Recomendado

1. **Al iniciar el turno:** Abre `http://localhost:3000` y selecciona tu archivo `.db` desde tu computador (o genera uno nuevo desde la tarjeta *"Generar DB vacía en tu PC"*).
2. **Operación diaria:** Registra ventas en **Registro de Ventas**, abastecimientos o mermas en **Gestión de Stock y Mermas**, y administra tu cartera en **Clientes y Proveedores**.
3. **Respaldo seguro:** Si tu navegador opera en modo memoria local o deseas conservar una copia adicional al finalizar el día, haz clic en el botón **"Descargar .db"** de la barra superior y guarda una copia de respaldo periódica en una carpeta segura.

