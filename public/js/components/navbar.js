import { clearSession, downloadActiveDatabaseFile } from '../db/engine.js';

const navDbName = document.getElementById('navDbName');
const navLinks = document.querySelectorAll('.nav-link');
const downloadActiveDbBtn = document.getElementById('downloadActiveDbBtn');
const closeDbSessionBtn = document.getElementById('closeDbSessionBtn');

const sectionInicio = document.getElementById('section-inicio');
const sectionInventario = document.getElementById('section-inventario');
const sectionVentas = document.getElementById('section-ventas');
const sectionKardex = document.getElementById('section-kardex');
const sectionClientes = document.getElementById('section-clientes');
const sectionFinanzas = document.getElementById('section-finanzas');
const sectionPlaceholder = document.getElementById('section-placeholder');
const moduleTitle = document.getElementById('moduleTitle');
const moduleDesc = document.getElementById('moduleDesc');
const backToHomeBtn = document.getElementById('backToHomeBtn');

const moduleDescriptions = {
  ventas: {
    title: 'Registro de Ventas y Pagos',
    desc: 'Emisión de boletas, facturas y tickets internos con soporte para medios de pago mixtos.',
  },
  compras: {
    title: 'Compras e Ingresos de Bodega',
    desc: 'Registro de facturas de proveedores, guías de despacho y actualización de costos unitarios.',
  },
  kardex: {
    title: 'Kardex de Movimientos de Inventario',
    desc: 'Historial inmutable de entradas, salidas, devoluciones, ajustes de inventario y mermas.',
  },
  clientes: {
    title: 'Directorio de Clientes y Proveedores',
    desc: 'Administración de RUT, razón social, giro comercial y datos de contacto.',
  },
};

export function updateNavDbLabel(dbMeta) {
  if (!dbMeta || !navDbName) return;
  const suffix = dbMeta.hasDirectFileHandle ? ' (Edición directa en PC)' : ' (Local en navegador)';
  navDbName.textContent = `${dbMeta.originalName}${suffix}`;
}

export function setNavDbStatusText(text) {
  if (navDbName) {
    navDbName.textContent = text;
  }
}

function hideAllSections() {
  if (sectionInicio) sectionInicio.classList.add('hidden');
  if (sectionInventario) sectionInventario.classList.add('hidden');
  if (sectionVentas) sectionVentas.classList.add('hidden');
  if (sectionKardex) sectionKardex.classList.add('hidden');
  if (sectionClientes) sectionClientes.classList.add('hidden');
  if (sectionFinanzas) sectionFinanzas.classList.add('hidden');
  if (sectionPlaceholder) sectionPlaceholder.classList.add('hidden');
}

export function initNavbar(sectionHandlers = {}) {
  if (downloadActiveDbBtn) {
    downloadActiveDbBtn.addEventListener('click', async () => {
      try {
        await downloadActiveDatabaseFile();
      } catch (err) {
        window.alert(err.message || 'No se pudo descargar el archivo .db');
      }
    });
  }

  if (closeDbSessionBtn) {
    closeDbSessionBtn.addEventListener('click', async () => {
      await clearSession();
      window.location.href = '/';
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;

      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      hideAllSections();

      if (section === 'inicio' && sectionInicio) {
        sectionInicio.classList.remove('hidden');
        sectionHandlers.onInicio?.();
      } else if (section === 'inventario' && sectionInventario) {
        sectionInventario.classList.remove('hidden');
        sectionHandlers.onInventario?.();
      } else if (section === 'ventas' && sectionVentas) {
        sectionVentas.classList.remove('hidden');
        sectionHandlers.onVentas?.();
      } else if (section === 'kardex' && sectionKardex) {
        sectionKardex.classList.remove('hidden');
        sectionHandlers.onKardex?.();
      } else if (section === 'clientes' && sectionClientes) {
        sectionClientes.classList.remove('hidden');
        sectionHandlers.onClientes?.();
      } else if (section === 'finanzas' && sectionFinanzas) {
        sectionFinanzas.classList.remove('hidden');
        sectionHandlers.onFinanzas?.();
      } else if (sectionPlaceholder) {
        const info = moduleDescriptions[section] || { title: section, desc: '' };
        if (moduleTitle) moduleTitle.textContent = info.title;
        if (moduleDesc) moduleDesc.textContent = info.desc;
        sectionPlaceholder.classList.remove('hidden');
      }
    });
  });

  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => {
      navLinks.forEach((l) => l.classList.toggle('active', l.dataset.section === 'inicio'));
      hideAllSections();
      if (sectionInicio) sectionInicio.classList.remove('hidden');
      sectionHandlers.onInicio?.();
    });
  }
}
