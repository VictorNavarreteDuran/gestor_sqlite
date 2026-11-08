/**
 * Orquestador Principal del Dashboard (Arquitectura Modular - Fases 1, 2 y 3)
 * Carga las plantillas HTML limpias mediante el template-loader,
 * enlaza los módulos de negocio e inicializa la navegación.
 */

import { loadAllTemplates } from './components/template-loader.js';

async function bootstrapDashboard() {
  try {
    // 1. Cargar y montar todas las plantillas HTML en el DOM antes de instanciar los módulos
    await loadAllTemplates();

    // 2. Importar módulos de manera diferida una vez que los elementos HTML ya existen en el DOM
    const [
      { initNavbar, updateNavDbLabel },
      { initInicioModule, loadDashboard },
      { initInventarioModule, loadInventorySection },
      { initKardexModule, loadStockManagementSection },
      { initPosModule, loadSalesSection },
      { initClientesModule, loadClientsSection },
      { initFinanzasModule, loadFinanceSection },
    ] = await Promise.all([
      import('./components/navbar.js'),
      import('./modules/inicio.js'),
      import('./modules/inventario.js'),
      import('./modules/kardex.js'),
      import('./modules/pos.js'),
      import('./modules/clientes.js'),
      import('./modules/finanzas.js'),
    ]);

    // 3. Inicializar el Navbar con los callbacks de cada sección
    initNavbar({
      onInicio: loadDashboard,
      onInventario: loadInventorySection,
      onVentas: loadSalesSection,
      onKardex: loadStockManagementSection,
      onClientes: loadClientsSection,
      onFinanzas: loadFinanceSection,
    });

    // 4. Inicializar eventos y escuchadores de cada módulo
    initInicioModule();
    initInventarioModule();
    initKardexModule();
    initPosModule();
    initClientesModule();
    initFinanzasModule();

    // 5. Cargar datos del panel de inicio
    await loadDashboard();
  } catch (error) {
    console.error('Error al iniciar el Dashboard modular:', error);
  }
}

// Iniciar aplicación al estar listo el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapDashboard);
} else {
  bootstrapDashboard();
}
