import { app, BrowserWindow, dialog, ipcMain, shell, protocol, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { 
  createDocumentArchive, 
  extractDocumentArchive, 
  isValidDocumentArchive,
  cleanupTempDirectory
} from './documentUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let openOnReadyFilePath = null;
const childWindows = new Set();
const tokenToWindow = new Map();
let lastFocusedWindow = null;
const documentTempDirs = new Set(); // Track temp directories for cleanup

const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allow custom protocols
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (openOnReadyFilePath) {
      mainWindow?.webContents.send('file:open-path', openOnReadyFilePath);
      openOnReadyFilePath = null;
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL(devUrl);
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexHtml);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Helpful diagnostics
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Electron] did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] did-finish-load');
  });
  mainWindow.on('focus', () => { lastFocusedWindow = mainWindow; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => (lastFocusedWindow || mainWindow)?.webContents.send('menu:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
              title: 'Открыть документ',
              properties: ['openFile'],
              filters: [{ name: 'Researcher Document (.rsrch)', extensions: ['rsrch'] }],
            });
            if (!canceled && filePaths[0]) {
              const filePath = filePaths[0];
              
              try {
                let data = {};
                
                // First, try to load as new archive format
                if (await isValidDocumentArchive(filePath)) {
                  data = await extractDocumentArchive(filePath);
                  // Track temp directory for cleanup
                  if (data._tempDir) {
                    documentTempDirs.add(data._tempDir);
                  }
                } else {
                  // Fallback to legacy format
                  const content = await fs.readFile(filePath, 'utf-8');
                  
                  if (content.trim().startsWith('<')) {
                    // Legacy XML format
                    const extract = (tag) => {
                      const m = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
                      return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
                    };
                    data = {
                      title: extract('title'),
                      description: extract('description'),
                      goals: extract('goals'),
                      hypotheses: extract('hypotheses'),
                      plan: extract('plan'),
                      contentHtml: extract('contentHtml'),
                      version: 1 // Mark as legacy
                    };
                  } else {
                    // Legacy JSON format
                    data = JSON.parse(content);
                    data.version = data.version || 1; // Mark as legacy if no version
                  }
                }
                
                (lastFocusedWindow || mainWindow)?.webContents.send('file:opened', { filePath, data });
              } catch (error) {
                console.error('Error opening document:', error);
                dialog.showErrorBox('Ошибка', 'Не удалось прочитать файл');
              }
            }
        }},
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => (lastFocusedWindow || mainWindow)?.webContents.send('menu:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => (lastFocusedWindow || mainWindow)?.webContents.send('menu:saveAs') },
        { type: 'separator' },
        { label: 'Export PDF', click: async () => {
            const targetWin = lastFocusedWindow || mainWindow;
            if (!targetWin) return;
            try {
              const pdf = await targetWin.webContents.printToPDF({
                landscape: false,
                marginsType: 0,
                pageSize: 'A4',
                printBackground: true,
                scaleFactor: 100,
              });
              const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Экспорт в PDF',
                defaultPath: 'document.pdf',
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
              });
              if (canceled || !filePath) return;
              await fs.writeFile(filePath, pdf);
            } catch (err) {
              dialog.showErrorBox('Ошибка', 'Не удалось экспортировать PDF');
            }
        }},
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
      ]
    },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'Learn More', click: () => shell.openExternal('https://www.electronjs.org') }] },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Single instance lock to handle opening files on Windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (process.platform === 'win32') {
      const fileArg = argv.find((a) => a.endsWith('.rsrch'));
      if (fileArg) {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.webContents.send('file:open-path', fileArg);
        } else {
          openOnReadyFilePath = fileArg;
        }
      }
    }
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('file:open-path', filePath);
  } else {
    openOnReadyFilePath = filePath;
  }
});

app.whenReady().then(() => {
  // Register custom protocol for serving local images
  protocol.registerFileProtocol('rsrch-image', (request, callback) => {
    const url = request.url.substr('rsrch-image://'.length);
    // Remove cache-busting parameters (everything after ?)
    const urlWithoutParams = url.split('?')[0];
    const decodedPath = decodeURIComponent(urlWithoutParams);
    callback({ path: decodedPath });
  });

  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function openChildWindow(initialPayload) {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allow custom protocols
    },
    parent: mainWindow || undefined,
  });
  childWindows.add(win);
  win.on('closed', () => childWindows.delete(win));
  // Track token for programmatic close
  const closeToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  tokenToWindow.set(closeToken, win);
  if (isDev) {
    win.loadURL(devUrl);
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    win.loadFile(indexHtml);
  }
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('external:open-tab', { ...initialPayload, closeToken });
  });
  win.on('focus', () => { lastFocusedWindow = win; });
}

// IPC handlers
ipcMain.handle('dialog:save-document', async (_event, { defaultPath, jsonData, asXml = false }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Сохранить документ',
    defaultPath: defaultPath || 'document.rsrch',
    filters: [
      { name: 'Researcher Document (.rsrch)', extensions: ['rsrch'] },
    ],
  });
  if (canceled || !filePath) return { canceled: true };

  try {
    if (asXml) {
      // Legacy XML format - keep old behavior for compatibility
      const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const xml = [
        '<research>',
        `<title>${escape(jsonData.title || '')}</title>`,
        `<description>${escape(jsonData.description || '')}</description>`,
        `<goals>${escape(jsonData.goals || '')}</goals>`,
        `<hypotheses>${escape(jsonData.hypotheses || '')}</hypotheses>`,
        `<plan>${escape(jsonData.plan || '')}</plan>`,
        `<contentHtml>${escape(jsonData.contentHtml || '')}</contentHtml>`,
        '</research>',
      ].join('');
      await fs.writeFile(filePath, xml, 'utf-8');
    } else {
      // New archive format
      await createDocumentArchive(jsonData, filePath);
    }
    
    return { canceled: false, filePath };
  } catch (error) {
    console.error('Error saving document:', error);
    dialog.showErrorBox('Ошибка', 'Не удалось сохранить файл');
    return { canceled: true };
  }
});

ipcMain.handle('dialog:save-document-to-path', async (_event, { filePath, jsonData, asXml = false }) => {
  if (!filePath) return { canceled: true };
  try {
    if (asXml) {
      // Legacy XML format - keep old behavior for compatibility
      const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const xml = [
        '<research>',
        `<title>${escape(jsonData.title || '')}</title>`,
        `<description>${escape(jsonData.description || '')}</description>`,
        `<goals>${escape(jsonData.goals || '')}</goals>`,
        `<hypotheses>${escape(jsonData.hypotheses || '')}</hypotheses>`,
        `<plan>${escape(jsonData.plan || '')}</plan>`,
        `<contentHtml>${escape(jsonData.contentHtml || '')}</contentHtml>`,
        '</research>',
      ].join('');
      await fs.writeFile(filePath, xml, 'utf-8');
    } else {
      // New archive format
      await createDocumentArchive(jsonData, filePath);
    }
    return { canceled: false, filePath };
  } catch (error) {
    console.error('Error saving document:', error);
    dialog.showErrorBox('Ошибка', 'Не удалось сохранить файл');
    return { canceled: true };
  }
});

ipcMain.handle('file:new', async () => {
  // Can be extended to create temp files, for now just signal new
  return { ok: true };
});

ipcMain.handle('dialog:open-document', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Открыть документ',
    properties: ['openFile'],
    filters: [
      { name: 'Researcher Document (.rsrch)', extensions: ['rsrch'] },
    ],
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  const filePath = filePaths[0];
  
  try {
    // First, try to load as new archive format
    if (await isValidDocumentArchive(filePath)) {
      const data = await extractDocumentArchive(filePath);
      // Track temp directory for cleanup
      if (data._tempDir) {
        documentTempDirs.add(data._tempDir);
      }
      return { canceled: false, filePath, data };
    }
    
    // Fallback to legacy format
    const content = await fs.readFile(filePath, 'utf-8');
    let data = {};
    
    if (content.trim().startsWith('<')) {
      // Legacy XML format
      const extract = (tag) => {
        const m = content.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
        return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
      };
      data = {
        title: extract('title'),
        description: extract('description'),
        goals: extract('goals'),
        hypotheses: extract('hypotheses'),
        plan: extract('plan'),
        contentHtml: extract('contentHtml'),
        version: 1 // Mark as legacy
      };
    } else {
      // Legacy JSON format
      data = JSON.parse(content);
      data.version = data.version || 1; // Mark as legacy if no version
    }
    
    return { canceled: false, filePath, data };
  } catch (error) {
    console.error('Error opening document:', error);
    dialog.showErrorBox('Ошибка', 'Не удалось прочитать файл');
    return { canceled: true };
  }
});

ipcMain.handle('file:open-path', async (_event, filePath) => {
  try {
    // First, try to load as new archive format
    if (await isValidDocumentArchive(filePath)) {
      const data = await extractDocumentArchive(filePath);
      // Track temp directory for cleanup
      if (data._tempDir) {
        documentTempDirs.add(data._tempDir);
      }
      return { canceled: false, filePath, data };
    }
    
    // Fallback to legacy format
    const content = await fs.readFile(filePath, 'utf-8');
    let data = {};
    
    if (content.trim().startsWith('<')) {
      // Legacy XML format
      const extract = (tag) => {
        const m = content.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
        return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
      };
      data = {
        title: extract('title'),
        description: extract('description'),
        goals: extract('goals'),
        hypotheses: extract('hypotheses'),
        plan: extract('plan'),
        contentHtml: extract('contentHtml'),
        version: 1 // Mark as legacy
      };
    } else {
      // Legacy JSON format
      data = JSON.parse(content);
      data.version = data.version || 1; // Mark as legacy if no version
    }
    
    return { canceled: false, filePath, data };
  } catch (error) {
    console.error('Error opening document:', error);
    dialog.showErrorBox('Ошибка', 'Не удалось прочитать файл');
    return { canceled: true };
  }
});

ipcMain.handle('export:pdf', async () => {
  const targetWin = lastFocusedWindow || mainWindow;
  if (!targetWin) return { canceled: true };
  try {
    const pdf = await targetWin.webContents.printToPDF({
      landscape: false,
      marginsType: 0,
      pageSize: 'A4',
      printBackground: true,
      scaleFactor: 100,
    });
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Экспорт в PDF',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    await fs.writeFile(filePath, pdf);
    return { canceled: false, filePath };
  } catch (err) {
    dialog.showErrorBox('Ошибка', 'Не удалось экспортировать PDF');
    return { canceled: true };
  }
});

// Detach a tab into a new window
ipcMain.handle('window:detach-tab', async (_e, payload) => {
  openChildWindow(payload);
  return { ok: true };
});

// Reattach a tab back to main window from a child window
ipcMain.handle('window:reattach-tab', async (event, payload) => {
  if (mainWindow) {
    mainWindow.webContents.send('external:reattach-tab', payload);
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && win !== mainWindow) {
    try { win.close(); } catch {}
  }
  return { ok: true };
});

ipcMain.handle('window:broadcast-close-token', async (_e, token) => {
  const win = tokenToWindow.get(token);
  if (win) {
    try { win.close(); } catch {}
    tokenToWindow.delete(token);
  }
  return { ok: true };
});

ipcMain.handle('window:close-self', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && win !== mainWindow) {
    try { win.close(); } catch {}
  }
  return { ok: true };
});

// Ensure child windows close when main closes
app.on('before-quit', async () => {
  for (const w of Array.from(childWindows)) {
    try { w.destroy(); } catch {}
  }
  childWindows.clear();
  
  // Clean up all temporary directories
  for (const tempDir of documentTempDirs) {
    await cleanupTempDirectory(tempDir);
  }
  documentTempDirs.clear();
});

// External drag events (for future richer DnD between windows)
ipcMain.on('drag:start', (_e, _payload) => {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('external:drag-start', _payload);
  }
});

// Open image file dialog and immediately create temp copy for editing
ipcMain.handle('dialog:open-image', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Выбрать изображение',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
    ],
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  const originalPath = filePaths[0];
  
  try {
    const ext = (originalPath.split('.').pop() || '').toLowerCase();
    const mime = ext === 'png' ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : ext === 'svg' ? 'image/svg+xml'
      : ext === 'webp' ? 'image/webp'
      : 'application/octet-stream';
    
    // Get file stats for size
    const stats = await fs.stat(originalPath);
    
    // Create temp directory for this new image
    const tempDir = path.join(os.tmpdir(), `rsrch_new_image_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Copy image to temp directory to avoid modifying original
    const fileName = path.basename(originalPath);
    const tempPath = path.join(tempDir, fileName);
    const imageBuffer = await fs.readFile(originalPath);
    await fs.writeFile(tempPath, imageBuffer);
    
    // Track temp directory for cleanup
    documentTempDirs.add(tempDir);
    
    // Return custom protocol URL pointing to temp copy
    const normalizedPath = tempPath.replace(/\\/g, '/');
    const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
    
    return { 
      canceled: false, 
      dataUrl: customUrl, // Use custom protocol URL to temp copy
      originalPath: originalPath, // Keep reference to original
      tempPath: tempPath, // Path to temp copy for editing
      tempDir: tempDir, // Temp directory for cleanup
      mimeType: mime,
      size: stats.size
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return { canceled: true };
  }
});
ipcMain.on('drag:end', () => {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('external:drag-end');
  }
});

// Clean up temporary directory for a specific document
ipcMain.handle('document:cleanup-temp', async (_event, tempDir) => {
  if (tempDir && documentTempDirs.has(tempDir)) {
    await cleanupTempDirectory(tempDir);
    documentTempDirs.delete(tempDir);
  }
  return { ok: true };
});

// Create temporary file from image data for editing
ipcMain.handle('image:create-temp', async (_event, { imageData, originalPath, mimeType }) => {
  try {
    const tempDir = path.join(os.tmpdir(), `rsrch_image_edit_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    let imageBuffer;
    let fileName;
    
    if (imageData.startsWith('data:')) {
      // Handle base64 data
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType ? mimeType.split('/')[1] : 'png';
      fileName = `temp_image.${ext}`;
    } else if (imageData.startsWith('rsrch-image://')) {
      // Handle custom protocol URL
      const decodedPath = decodeURIComponent(imageData.replace('rsrch-image://', ''));
      imageBuffer = await fs.readFile(decodedPath);
      fileName = path.basename(decodedPath);
    } else if (originalPath) {
      // Handle file path
      imageBuffer = await fs.readFile(originalPath);
      fileName = path.basename(originalPath);
    } else {
      throw new Error('Invalid image data provided');
    }
    
    const tempFilePath = path.join(tempDir, fileName);
    await fs.writeFile(tempFilePath, imageBuffer);
    
    // Track temp directory for cleanup
    documentTempDirs.add(tempDir);
    
    // Return custom protocol URL for the temp file
    const normalizedPath = tempFilePath.replace(/\\/g, '/');
    const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
    
    return {
      success: true,
      tempPath: tempFilePath,
      customUrl,
      tempDir
    };
  } catch (error) {
    console.error('Error creating temp image:', error);
    return { success: false, error: error.message };
  }
});

// Save edited image data to temporary file
ipcMain.handle('image:save-temp-edit', async (_event, { tempPath, imageData }) => {
  try {
    if (!imageData.startsWith('data:')) {
      throw new Error('Expected base64 data URL for saving');
    }
    
    const base64Data = imageData.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    await fs.writeFile(tempPath, imageBuffer);
    
    // Return custom protocol URL for the updated file
    const normalizedPath = tempPath.replace(/\\/g, '/');
    const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
    
    return {
      success: true,
      customUrl
    };
  } catch (error) {
    console.error('Error saving temp image edit:', error);
    return { success: false, error: error.message };
  }
});


