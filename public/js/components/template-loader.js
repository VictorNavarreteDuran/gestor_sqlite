/**
 * Cargador de Plantillas y Componentes HTML (Fase 3 - Arquitectura Modular)
 * Permite cargar e inyectar de manera atómica las secciones de la aplicación en el DOM,
 * manteniendo el DOM limpio y sin capas intermedias que interfieran con los estilos CSS.
 */

const templateCache = new Map();

export const DASHBOARD_TEMPLATES = [
  { key: 'navbar', url: '/templates/navbar.html', mountId: 'mount-navbar' },
  { key: 'inicio', url: '/templates/inicio.html', mountId: 'mount-inicio' },
  { key: 'inventario', url: '/templates/inventario.html', mountId: 'mount-inventario' },
  { key: 'kardex', url: '/templates/kardex.html', mountId: 'mount-kardex' },
  { key: 'ventas', url: '/templates/ventas.html', mountId: 'mount-ventas' },
  { key: 'clientes', url: '/templates/clientes.html', mountId: 'mount-clientes' },
  { key: 'finanzas', url: '/templates/finanzas.html', mountId: 'mount-finanzas' },
  { key: 'placeholder', url: '/templates/placeholder.html', mountId: 'mount-placeholder' },
];

/**
 * Obtiene el contenido HTML de una plantilla desde el servidor (con caché en memoria)
 * @param {string} url - Ruta relativa al archivo HTML
 * @returns {Promise<string>}
 */
export async function fetchTemplate(url) {
  if (templateCache.has(url)) {
    return templateCache.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al cargar plantilla [${url}]: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  templateCache.set(url, html);
  return html;
}

/**
 * Monta un fragmento HTML reemplazando el elemento de montaje
 * @param {string} html - Contenido HTML
 * @param {string} mountId - ID del elemento marcador en el DOM
 * @returns {Element|null} El elemento montado
 */
export function mountTemplate(html, mountId) {
  const mountPoint = document.getElementById(mountId);
  if (!mountPoint) {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = html.trim();

  const element = template.content.firstElementChild;
  if (!element) {
    return null;
  }

  mountPoint.replaceWith(element);
  return element;
}

/**
 * Descarga y monta en paralelo todas las plantillas del dashboard
 * @param {Array<{key: string, url: string, mountId: string}>} [manifest]
 * @returns {Promise<void>}
 */
export async function loadAllTemplates(manifest = DASHBOARD_TEMPLATES) {
  const fetchPromises = manifest.map(async (item) => {
    const html = await fetchTemplate(item.url);
    return { ...item, html };
  });

  const loadedTemplates = await Promise.all(fetchPromises);

  for (const { html, mountId } of loadedTemplates) {
    mountTemplate(html, mountId);
  }
}
