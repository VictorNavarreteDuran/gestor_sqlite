# Gestor SQLite PIME

Aplicación local para administrar ventas, productos e inventario de una pequeña empresa usando archivos SQLite. El motor `sql.js` (SQLite compilado a WebAssembly) se ejecuta en el navegador; Express sirve los archivos de la aplicación y no recibe la base de datos.

## Contenido

- [Funciones disponibles](#funciones-disponibles)
- [Almacenamiento y privacidad](#almacenamiento-y-privacidad)
- [Arquitectura e integridad de datos](#arquitectura-e-integridad-de-datos)
- [Esquema de la base de datos](#esquema-de-la-base-de-datos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos y ejecución](#requisitos-y-ejecución)
- [Uso básico](#uso-básico)
- [Alcance actual](#alcance-actual)

## Funciones disponibles

- **Abrir y crear bases SQLite:** carga archivos `.db`, `.sqlite` y `.sqlite3`, o genera una base vacía con el esquema del sistema.
- **Panel de inicio:** muestra indicadores y gráficos de ventas, alertas de stock, productos más vendidos y ventas recientes.
- **Inventario:** consulta y busca productos; presenta alertas de stock bajo, artículos de baja rotación y rankings de venta.
- **Ventas (POS):** busca productos por nombre, SKU o código de barras, arma la venta, permite descuentos y registra documentos internos (`BOLETA`, `FACTURA` o `TICKET_INTERNO`) y pagos.
- **Productos y movimientos de stock:** permite crear productos con stock inicial, registrar entradas, devoluciones, ajustes, mermas y consultar movimientos recientes.
- **Clientes:** permite registrar, buscar y rectificar fichas; exportar los datos del cliente y su historial de ventas a JSON; y eliminar su ficha sin borrar las ventas históricas asociadas.
- **Proveedores:** muestra y permite buscar proveedores existentes en la base.
- **Finanzas:** resume ingresos, egresos, costos de ventas, IVA y pérdidas por mermas en períodos de 1, 3, 6 o 12 meses.

Las cantidades de inventario usan unidades de medida como `UN`, `KG`, `LT`, `MT` y `CAJA`. Los precios y reportes están orientados a pesos chilenos (CLP).

## Almacenamiento y privacidad

- Las consultas y operaciones SQLite se ejecutan en el navegador. El servidor Express entrega los recursos estáticos y los archivos de `sql.js`; no hay una API de carga de bases de datos.
- La aplicación mantiene una copia de trabajo local en el navegador durante la sesión. Al volver a la pantalla de inicio o cerrar la sesión desde el panel, elimina esa sesión local.
- En navegadores compatibles, y con el permiso correspondiente, los cambios pueden escribirse directamente en el archivo seleccionado. En caso contrario, se puede descargar una copia actualizada desde el panel.
- El archivo original no se modifica al abrirlo. Aun así, mantén respaldos antes de operar sobre bases importantes.

El diseño evita enviar la base de datos al servidor, pero esto por sí solo no constituye una certificación de cumplimiento legal ni reemplaza las obligaciones de quien trata los datos. Consulta el aviso disponible en la pantalla inicial.

## Arquitectura e integridad de datos

- **Interfaz:** HTML, CSS y módulos JavaScript nativos; las secciones del panel se cargan desde plantillas.
- **Persistencia local:** `sql.js` ejecuta SQLite en WebAssembly. El archivo se abre en el navegador y puede exportarse de nuevo a disco.
- **Servidor:** Express entrega archivos estáticos, comprime recursos con Brotli/Gzip y establece cabeceras de seguridad.
- **Relaciones:** el motor activa `PRAGMA foreign_keys = ON`.
- **Stock:** el trigger `trg_actualizar_stock_kardex`, al insertar un movimiento, actualiza el stock del producto usando el stock resultante del movimiento. Las operaciones de negocio registran los cambios mediante movimientos de inventario.
- **Ventas:** el detalle conserva el precio y costo unitarios históricos; las ventas incluyen pagos asociados y admiten registrar más de un medio de pago.
- **Rendimiento:** el esquema incluye índices para búsquedas de productos, ventas, pagos y movimientos de inventario.

## Esquema de la base de datos

El esquema inicial de `public/js/db/schema.js` define estas tablas:

| Tabla | Propósito |
| --- | --- |
| `usuarios` | Operadores y roles (`ADMIN`, `CAJERO`, `BODEGUERO`). |
| `categorias` | Clasificación de productos. |
| `proveedores` | Datos de contacto de proveedores. |
| `clientes` | Datos de clientes. |
| `productos` | Catálogo, precios, costos, unidad y stock actual. |
| `compras` | Cabecera de compras recibidas o anuladas. |
| `detalle_compras` | Productos y cantidades asociados a una compra. |
| `ventas` | Cabecera, totales y estado de cada venta. |
| `detalle_ventas` | Productos, cantidades y valores históricos de cada venta. |
| `pagos_venta` | Medios, montos y referencias de pago. |
| `movimientos_inventario` | Entradas, salidas, ajustes, devoluciones y mermas. |

Al abrir una base existente, la aplicación activa las claves foráneas e intenta agregar índices de rendimiento para las tablas que encuentra.

## Estructura del proyecto

```text
base_sqlite_PIME/
├── public/
│   ├── index.html                 # Inicio: abrir o crear una base y consultar el aviso
│   ├── app.js                     # Flujo de carga de archivos; usa el motor SQLite compartido
│   ├── dashboard.html             # Contenedor del panel modular
│   ├── styles.css                 # Estilos de la aplicación
│   ├── js/
│   │   ├── dashboard.js           # Orquestación e inicialización del panel
│   │   ├── components/
│   │   │   ├── navbar.js           # Navegación, descarga y cierre de sesión
│   │   │   └── template-loader.js  # Carga de plantillas HTML
│   │   ├── db/
│   │   │   ├── constants.js
│   │   │   ├── engine.js           # SQLite local, sesión y operaciones comunes del panel
│   │   │   ├── schema.js           # Esquema, trigger e índices
│   │   │   └── repositories/       # Consultas y escrituras por dominio
│   │   ├── modules/                # Inicio, inventario, ventas, Kardex, clientes y finanzas
│   │   └── utils/
│   │       └── formatters.js
│   └── templates/                 # Plantillas de navegación y secciones del panel
├── src/
│   └── server.js                  # Servidor estático Express
├── package.json
└── README.md
```

La pantalla inicial y el panel usan `js/db/engine.js` como motor SQLite compartido; las secciones del panel consumen los repositorios del dominio. No hay un motor global duplicado ni una implementación monolítica alternativa del dashboard.

## Requisitos y ejecución

- Node.js 18.11 o superior (el modo de desarrollo usa `node --watch`).
- npm.
- Un navegador moderno. El acceso a archivos y la escritura directa dependen del soporte del navegador; cuando no están disponibles, se puede usar el selector estándar y descargar la base actualizada.

Desde la raíz del proyecto:

```bash
npm install
npm run dev
```

Para iniciar sin el modo de recarga:

```bash
npm start
```

Abre `http://localhost:3000`. El puerto se puede cambiar con la variable de entorno `PORT`.

## Uso básico

1. En la pantalla inicial, selecciona una base `.db`, `.sqlite` o `.sqlite3`, o descarga una base nueva.
2. Abre el panel y trabaja en las secciones disponibles.
3. Usa **Descargar .db** para guardar una copia actualizada. Si el navegador permitió vincular el archivo con acceso de escritura, los cambios de las operaciones compatibles se guardan directamente; comprueba el estado mostrado por la aplicación.
4. Cierra la sesión o vuelve al inicio antes de cambiar de base.

## Alcance actual

- La opción **Compras** del menú todavía muestra una pantalla de marcador de posición. Aunque existen tablas de compras y Finanzas puede leer esos registros, actualmente no hay una pantalla para registrar compras.
- Los tipos de documento de venta son etiquetas de registro interno; el sistema no emite documentos tributarios electrónicos ni se integra con el SII.
- Los roles están definidos en el esquema, pero el proyecto no implementa inicio de sesión ni control de acceso por rol.
- La base generada contiene el esquema y los índices; no incluye datos de ejemplo.
