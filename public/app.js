const fileInput = document.getElementById('dbfile');
const fileLabel = document.getElementById('fileLabel');
const dropzone = document.getElementById('dropzone');
const uploadForm = document.getElementById('uploadForm');
const uploadBtn = document.getElementById('uploadBtn');
const uploadResult = document.getElementById('uploadResult');

const emptyDbNameInput = document.getElementById('emptyDbName');
const downloadEmptyBtn = document.getElementById('downloadEmptyBtn');

const statusDot = document.getElementById('statusDot');
const statusTitle = document.getElementById('statusTitle');
const statusDetails = document.getElementById('statusDetails');

// Pestañas de carga, funcionamiento y aviso legal en la pantalla de inicio.
const homeTabButtons = document.querySelectorAll('.home-tabs [data-home-tab]');
const homeTabPanels = {
  carga: document.getElementById('homeTabCarga'),
  funcionamiento: document.getElementById('homeTabFuncionamiento'),
  legal: document.getElementById('homeTabLegal'),
};
const backToLoadTabBtns = document.querySelectorAll('.backToLoadTabBtn');

let selectedFileHandle = null;
let selectedFileObject = null;

function switchHomeTab(tabName) {
  const activePanel = homeTabPanels[tabName];
  if (!activePanel) return;

  homeTabButtons.forEach((button) => {
    const isActive = button.dataset.homeTab === tabName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  Object.entries(homeTabPanels).forEach(([name, panel]) => {
    panel.classList.toggle('hidden', name !== tabName);
  });
}

homeTabButtons.forEach((button) => {
  button.addEventListener('click', () => switchHomeTab(button.dataset.homeTab));
});

document.addEventListener('click', (e) => {
  const control = e.target.closest('a[data-home-tab], .legal-footer-actions button[data-home-tab]');
  if (!control) return;
  if (control.tagName === 'A') e.preventDefault();
  switchHomeTab(control.dataset.homeTab);
});

backToLoadTabBtns.forEach((button) => {
  button.addEventListener('click', () => switchHomeTab('carga'));
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function updateActiveDbBanner(db) {
  if (!db) {
    statusDot.classList.remove('active');
    statusTitle.textContent = 'Sin archivo cargado — Debes cargar tu archivo .db en cada ingreso';
    statusDetails.innerHTML = `
      <span><strong>Procesamiento local:</strong> El contenido de la base se procesa en este navegador y no se envía al servidor de la aplicación.</span>
      <a href="#funcionamiento" class="banner-link" data-home-tab="funcionamiento">Ver cómo funciona →</a>
      <a href="#legal" class="banner-link" data-home-tab="legal">Aviso legal y privacidad →</a>
    `;
    return;
  }

  statusDot.classList.add('active');
  statusTitle.textContent = `Archivo local listo: ${db.originalName}`;

  const tablesText =
    db.tables && db.tables.length > 0
      ? db.tables.join(', ')
      : 'Sin tablas de usuario (vacía)';

  const syncModeText = db.hasDirectFileHandle
    ? 'Guardado directo en archivo del PC habilitado'
    : 'Modo memoria del navegador (descarga local al guardar)';

  statusDetails.innerHTML = `
    <span><strong>Tamaño:</strong> ${formatBytes(db.sizeBytes)}</span>
    <span><strong>Modo:</strong> ${syncModeText}</span>
    <span><strong>Tablas (${db.tables ? db.tables.length : 0}):</strong> ${tablesText}</span>
    <a href="/dashboard.html" class="banner-link">Ir al Panel de Inicio →</a>
  `;
}

// Cada ingreso a la pantalla inicial limpia la sesión previa y exige seleccionar una base de nuevo.
async function resetSessionOnEntry() {
  try {
    await window.LocalSqliteEngine.clearSession();
  } catch (_) {}
  updateActiveDbBanner(null);
}

// Si el navegador soporta File System Access API (Chrome/Edge), al hacer clic en el dropzone
// podemos abrir directamente el archivo .db del computador con permiso de lectura/escritura local.
dropzone.addEventListener('click', async (e) => {
  if (typeof window.showOpenFilePicker !== 'function') {
    return; // Usa el <input type="file"> estándar como respaldo
  }
  e.preventDefault();
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Bases de datos SQLite (.db, .sqlite, .sqlite3)',
          accept: {
            'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
          },
        },
      ],
    });
    if (handle) {
      selectedFileHandle = handle;
      selectedFileObject = await handle.getFile();
      fileLabel.textContent = `${selectedFileObject.name} (Vinculado para edición directa en tu PC)`;
    }
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      fileInput.click();
    }
  }
});

fileInput.addEventListener('change', () => {
  selectedFileHandle = null;
  if (fileInput.files.length > 0) {
    selectedFileObject = fileInput.files[0];
    fileLabel.textContent = selectedFileObject.name;
  } else {
    selectedFileObject = null;
    fileLabel.textContent = 'Haz clic o arrastra tu archivo .db aquí';
  }
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', async (e) => {
  selectedFileHandle = null;
  selectedFileObject = null;

  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    const item = e.dataTransfer.items[0];
    if (typeof item.getAsFileSystemHandle === 'function') {
      try {
        const handle = await item.getAsFileSystemHandle();
        if (handle && handle.kind === 'file') {
          selectedFileHandle = handle;
          selectedFileObject = await handle.getFile();
          fileLabel.textContent = `${selectedFileObject.name} (Vinculado para edición directa en tu PC)`;
          return;
        }
      } catch (_) {}
    }
  }

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    selectedFileObject = files[0];
    fileInput.files = files;
    fileLabel.textContent = files[0].name;
  }
});

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileToLoad = selectedFileObject || (fileInput.files && fileInput.files[0]);

  if (!fileToLoad) {
    uploadResult.classList.remove('hidden', 'success');
    uploadResult.classList.add('error');
    uploadResult.textContent = 'Selecciona primero un archivo .db desde tu computador.';
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Abriendo localmente...';
  uploadResult.classList.add('hidden');

  try {
    if (selectedFileHandle && typeof selectedFileHandle.requestPermission === 'function') {
      try {
        await selectedFileHandle.requestPermission({ mode: 'readwrite' });
      } catch (_) {}
    }

    const dbMeta = await window.LocalSqliteEngine.loadDatabaseFromFile(
      fileToLoad,
      selectedFileHandle
    );

    uploadResult.classList.remove('hidden', 'error');
    uploadResult.classList.add('success');
    uploadResult.textContent = `Base de datos "${dbMeta.originalName}" cargada en tu navegador (${dbMeta.tables.length} tabla(s) detectada(s), 0 bytes enviados al servidor). Abriendo panel...`;
    updateActiveDbBanner(dbMeta);

    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 900);
  } catch (err) {
    uploadResult.classList.remove('hidden', 'success');
    uploadResult.classList.add('error');
    uploadResult.textContent = err.message || 'Error al leer el archivo .db en el navegador.';
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Abrir Base de Datos Local';
  }
});

downloadEmptyBtn.addEventListener('click', async () => {
  const rawName = emptyDbNameInput.value.trim() || 'nueva_base';
  downloadEmptyBtn.disabled = true;
  try {
    await window.LocalSqliteEngine.downloadEmptyDatabaseFile(rawName);
  } catch (err) {
    uploadResult.classList.remove('hidden', 'success');
    uploadResult.classList.add('error');
    uploadResult.textContent = err.message || 'No se pudo generar el archivo .db vacío.';
  } finally {
    downloadEmptyBtn.disabled = false;
  }
});

resetSessionOnEntry();
