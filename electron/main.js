import { app, BrowserWindow, dialog, ipcMain, shell, protocol, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { 
  createDocumentArchive, 
  extractDocumentArchive, 
  isValidDocumentArchive,
  cleanupTempDirectory
} from './documentUtils.js';
import { childProcessManager } from './childProcessManager.js';
import { processPriorityManager } from './processPriorityManager.js';
import { memoryConfig } from './memoryConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let openOnReadyFilePath = null;
const childWindows = new Set();
const tokenToWindow = new Map();
let lastFocusedWindow = null;
const documentTempDirs = new Set(); // Track temp directories for cleanup
const imageHashToTempPath = new Map(); // Track image hash to temp file mapping

const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = !!process.env.VITE_DEV_SERVER_URL;

// Memory and performance optimizations
console.log('[Electron] Applying memory optimizations...');

// Disable hardware acceleration to reduce memory usage
app.disableHardwareAcceleration();
console.log('[Electron] Hardware acceleration disabled');

// Additional Chromium flags for memory optimization
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-gpu-compositing');
app.commandLine.appendSwitch('--disable-gpu-rasterization');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-features', 'TranslateUI,BlinkGenPropertyTrees');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--memory-pressure-off');
app.commandLine.appendSwitch('--max_old_space_size', '256');
app.commandLine.appendSwitch('--optimize-for-size');

// Enable garbage collection for main process
if (isDev && !global.gc) {
  console.warn('[Electron] Garbage collection not available. Restart with --expose-gc flag for full memory optimization.');
}

// Helper function to generate image hash
function generateImageHash(imageBuffer) {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
}

// Memory optimization for drawing mode
function setupDrawingModeMemoryOptimization() {
  console.log('[Electron] Setting up drawing mode memory optimization...');
  
  // Monitor memory usage more frequently when drawing mode is active
  let drawingModeActive = false;
  let memoryMonitorInterval = null;
  
  // Listen for drawing mode events from renderer
  ipcMain.on('drawing-mode:activated', () => {
    console.log('[Electron] Drawing mode activated - enabling aggressive memory management');
    drawingModeActive = true;
    
    // Start aggressive memory monitoring
    if (memoryMonitorInterval) clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      
      console.log(`[Electron] Drawing mode memory: ${heapUsedMB.toFixed(2)}MB heap, ${(usage.rss / 1024 / 1024).toFixed(2)}MB RSS`);
      
      // Force GC more aggressively in drawing mode
      if (heapUsedMB > 150 && typeof global.gc === 'function') {
        console.log('[Electron] Drawing mode: forcing garbage collection due to high memory usage');
        global.gc();
        
        // Also trigger renderer GC
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('memory:force-gc');
        }
      }
      
      // Clear image cache if memory is too high
      if (heapUsedMB > 200) {
        console.log('[Electron] Drawing mode: clearing image cache due to critical memory usage');
        clearImageCache();
      }
    }, 5000); // Check every 5 seconds in drawing mode
  });
  
  ipcMain.on('drawing-mode:deactivated', () => {
    console.log('[Electron] Drawing mode deactivated - reducing memory monitoring');
    drawingModeActive = false;
    
    // Reduce monitoring frequency
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
      memoryMonitorInterval = setInterval(() => {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > 100 && typeof global.gc === 'function') {
          global.gc();
        }
      }, 30000); // Check every 30 seconds when not drawing
    }
    
    // Force cleanup after drawing mode
    setTimeout(() => {
      if (typeof global.gc === 'function') {
        global.gc();
        console.log('[Electron] Post-drawing cleanup GC completed');
      }
    }, 1000);
  });
}

// Clear image cache to free memory
function clearImageCache() {
  console.log('[Electron] Clearing image cache...');
  
  // Clear the image hash to temp path mapping
  const clearedCount = imageHashToTempPath.size;
  imageHashToTempPath.clear();
  
  // Don't clean up temp directories immediately - they might still be in use
  // Only clean up directories that are older than 5 minutes
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  for (const tempDir of documentTempDirs) {
    fs.stat(tempDir).then(stats => {
      if (stats.mtime.getTime() < fiveMinutesAgo) {
        console.log('[Electron] Cleaning up old temp directory:', tempDir);
        cleanupTempDirectory(tempDir).catch(err => {
          console.warn('[Electron] Error cleaning temp directory:', err.message);
        });
        documentTempDirs.delete(tempDir);
      } else {
        console.log('[Electron] Keeping recent temp directory:', tempDir);
      }
    }).catch(err => {
      // Directory doesn't exist, remove from tracking
      console.log('[Electron] Temp directory no longer exists, removing from tracking:', tempDir);
      documentTempDirs.delete(tempDir);
    });
  }
  
  console.log(`[Electron] Cleared ${clearedCount} cached images`);
  
  // Force garbage collection after cache clear
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function createWindow() {
  const config = memoryConfig.getCompleteConfig();
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false, // Disable web security to allow custom protocols
      ...config.webPreferences.main,
      // Additional memory optimizations for drawing mode
      backgroundThrottling: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Disable hardware acceleration in renderer
      hardwareAcceleration: false,
      // Limit memory usage
      v8CacheOptions: 'none',
      // Disable unnecessary features
      plugins: false,
      webgl: false, // Disable WebGL to save memory (may affect Plotly)
      experimentalFeatures: false,
      // Memory-specific optimizations
      partition: 'persist:main', // Use persistent partition for better memory management
      // Allow custom protocols
      allowRunningInsecureContent: true,
    },
    show: false,
    // Additional memory optimizations
    useContentSize: true, // Use content size instead of window size
    enableLargerThanScreen: false, // Prevent oversized windows
    thickFrame: false, // Reduce window chrome memory usage
    ...config.window.main
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
    
    // Force garbage collection after page load
    if (typeof global.gc === 'function') {
      setTimeout(() => {
        global.gc();
        console.log('[Electron] Post-load garbage collection completed');
      }, 2000);
    }
    
    // Set up aggressive memory management for drawing mode
    setupDrawingModeMemoryOptimization();
  });
  mainWindow.on('focus', () => { 
    lastFocusedWindow = mainWindow; 
    try {
      processPriorityManager?.recordActivity();
    } catch (error) {
      console.warn('[Electron] Error recording activity:', error.message);
    }
  });
  
  // Track user activity for priority management
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      processPriorityManager?.recordActivity();
    } catch (error) {
      console.warn('[Electron] Error recording activity:', error.message);
    }
  });
  
  // Track various user interactions
  ['before-input-event', 'dom-ready'].forEach(event => {
    mainWindow.webContents.on(event, () => {
      try {
        processPriorityManager?.recordActivity();
      } catch (error) {
        console.warn('[Electron] Error recording activity:', error.message);
      }
    });
  });
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

// Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'rsrch-image',
    privileges: {
      secure: true,
      standard: true, // Changed to true to make it behave more like http
      bypassCSP: true, // Allow bypassing CSP
      allowServiceWorkers: false,
      supportFetchAPI: true, // Enable fetch API support
      corsEnabled: true, // Enable CORS
      stream: false
    }
  }
]);

console.log('[Electron] Custom protocol scheme registered');

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

// Register custom protocol before app is ready
app.whenReady().then(() => {
  // Register custom protocol for serving local images using buffer protocol
  const protocolRegistered = protocol.registerBufferProtocol('rsrch-image', (request, callback) => {
    try {
      const url = request.url.replace('rsrch-image://', '');
      // Remove cache-busting parameters (everything after ?)
      const urlWithoutParams = url.split('?')[0];
      const decodedPath = decodeURIComponent(urlWithoutParams);
      
      console.log('[Electron] Protocol request:', request.url, '-> decoded:', decodedPath);
      
      // Validate the path exists and is safe
      if (!decodedPath || decodedPath.includes('..')) {
        console.error('[Electron] Invalid path in protocol request:', decodedPath);
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }
      
      // Handle the async operations properly
      (async () => {
        try {
          // Check if file exists
          await fs.access(decodedPath);
          console.log('[Electron] File exists, serving:', decodedPath);
          
          // Get file stats for additional info
          const stats = await fs.stat(decodedPath);
          console.log('[Electron] File stats:', {
            size: stats.size,
            modified: stats.mtime,
            isFile: stats.isFile()
          });
          
          // Determine MIME type based on file extension
          const ext = path.extname(decodedPath).toLowerCase();
          let mimeType = 'application/octet-stream';
          
          switch (ext) {
            case '.png':
              mimeType = 'image/png';
              break;
            case '.jpg':
            case '.jpeg':
              mimeType = 'image/jpeg';
              break;
            case '.gif':
              mimeType = 'image/gif';
              break;
            case '.svg':
              mimeType = 'image/svg+xml';
              break;
            case '.webp':
              mimeType = 'image/webp';
              break;
            case '.bmp':
              mimeType = 'image/bmp';
              break;
          }
          
          console.log('[Electron] Serving file with MIME type:', mimeType);
          
          // Read the file and serve it as a buffer
          const fileBuffer = await fs.readFile(decodedPath);
          console.log('[Electron] Read file buffer, size:', fileBuffer.length);
          
          callback({
            mimeType: mimeType,
            data: fileBuffer
          });
        } catch (error) {
          console.error('[Electron] File not found:', decodedPath);
          console.error('[Electron] Error details:', error.message);
          
          // Try to check if the directory exists
          const dir = path.dirname(decodedPath);
          try {
            const dirExists = await fs.access(dir).then(() => true).catch(() => false);
            console.log('[Electron] Parent directory exists:', dirExists, dir);
            
            if (dirExists) {
              // List files in the directory to see what's there
              const files = await fs.readdir(dir);
              console.log('[Electron] Files in directory:', files);
            }
          } catch (dirError) {
            console.error('[Electron] Error checking directory:', dirError.message);
          }
          
          callback({ error: -6 }); // FILE_NOT_FOUND
        }
      })();
    } catch (error) {
      console.error('[Electron] Error in protocol handler:', error);
      callback({ error: -2 }); // GENERIC_FAILURE
    }
  });
  
  if (protocolRegistered) {
    console.log('[Electron] rsrch-image buffer protocol registered successfully');
  } else {
    console.error('[Electron] Failed to register rsrch-image buffer protocol');
  }

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
  const config = memoryConfig.getCompleteConfig();
  
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false, // Allow custom protocols
      allowRunningInsecureContent: true,
      ...config.webPreferences.child
    },
    parent: mainWindow || undefined,
    ...config.window.child
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
  console.log('[Electron] App shutting down, cleaning up...');
  
  // Shutdown child process manager
  try {
    await childProcessManager.shutdown();
  } catch (error) {
    console.error('[Electron] Error shutting down child processes:', error);
  }
  
  // Shutdown process priority manager
  try {
    processPriorityManager?.shutdown();
  } catch (error) {
    console.error('[Electron] Error shutting down process priority manager:', error);
  }
  
  // Close child windows
  for (const w of Array.from(childWindows)) {
    try { w.destroy(); } catch {}
  }
  childWindows.clear();
  
  // Clean up all temporary directories
  for (const tempDir of documentTempDirs) {
    await cleanupTempDirectory(tempDir);
  }
  documentTempDirs.clear();
  imageHashToTempPath.clear();
  
  console.log('[Electron] Cleanup completed');
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
    
    console.log('[Electron] Created temp image:', {
      originalPath,
      tempPath,
      normalizedPath,
      customUrl,
      fileExists: await fs.access(tempPath).then(() => true).catch(() => false)
    });
    
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

// Memory monitoring IPC handlers
ipcMain.handle('memory:get-usage', async () => {
  const memoryUsage = process.memoryUsage();
  return {
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed,
    external: memoryUsage.external,
    arrayBuffers: memoryUsage.arrayBuffers,
    timestamp: Date.now()
  };
});

ipcMain.handle('memory:force-gc', async () => {
  try {
    if (typeof global.gc === 'function') {
      const memBefore = process.memoryUsage();
      console.log('[Electron] Forcing garbage collection...');
      global.gc();
      const memAfter = process.memoryUsage();
      const heapReduced = Math.round((memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024);
      console.log(`[Electron] Manual GC completed - freed ${heapReduced}MB heap memory`);
      return { 
        success: true, 
        message: `Garbage collection completed - freed ${heapReduced}MB`,
        memoryBefore: memBefore,
        memoryAfter: memAfter
      };
    } else {
      console.warn('[Electron] Garbage collection not available. Restart with --expose-gc flag for full memory optimization.');
      return { success: false, message: 'GC not available - restart with --expose-gc flag' };
    }
  } catch (error) {
    console.error('[Electron] Error forcing garbage collection:', error);
    return { success: false, message: error.message };
  }
});

// Log memory usage periodically in main process
let memoryLogInterval = null;
function startMemoryLogging() {
  if (memoryLogInterval) return;
  
  console.log('[Electron] Starting memory monitoring...');

// Test V8 flags
console.log('[Electron] Testing V8 flags...');
console.log(`[Electron] Node.js version: ${process.version}`);
console.log(`[Electron] Process execArgv:`, process.execArgv);

// Test --expose-gc flag
if (typeof global.gc === 'function') {
  console.log('[Electron] ✅ global.gc is available - --expose-gc flag working');
  try {
    const memBefore = process.memoryUsage();
    global.gc();
    const memAfter = process.memoryUsage();
    console.log(`[Electron] Manual GC test: ${Math.round(memBefore.heapUsed/1024/1024)}MB → ${Math.round(memAfter.heapUsed/1024/1024)}MB`);
  } catch (error) {
    console.log('[Electron] ❌ Error testing manual GC:', error.message);
  }
} else {
  console.log('[Electron] ❌ global.gc NOT available - --expose-gc flag not working');
}

// Test heap size limit
(async () => {
  try {
    const v8 = await import('v8');
    const heapStats = v8.getHeapStatistics();
    const heapLimitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    console.log(`[Electron] Heap size limit: ${heapLimitMB}MB`);
    if (heapLimitMB < 600) {
      console.log('[Electron] ✅ --max-old-space-size flag appears to be working');
    } else {
      console.log('[Electron] ❌ --max-old-space-size flag may not be working');
    }
  } catch (error) {
    console.log('[Electron] Error checking heap statistics:', error.message);
  }
})();
  memoryLogInterval = setInterval(() => {
    const usage = process.memoryUsage();
    console.log(`[Electron Memory] RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    
    // Aggressive memory management - force GC if heap usage is high
    const heapUsageMB = usage.heapUsed / 1024 / 1024;
    if (heapUsageMB > 100 && typeof global.gc === 'function') { // If heap > 100MB
      console.log('[Electron] High memory usage detected, forcing garbage collection...');
      global.gc();
      
      // Log memory after GC
      setTimeout(() => {
        const afterGC = process.memoryUsage();
        const freed = Math.round((usage.heapUsed - afterGC.heapUsed) / 1024 / 1024);
        console.log(`[Electron] GC freed ${freed}MB, new heap: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }, 100);
    }
  }, 15000); // Every 15 seconds (more frequent)
}

function stopMemoryLogging() {
  if (memoryLogInterval) {
    clearInterval(memoryLogInterval);
    memoryLogInterval = null;
    console.log('[Electron] Stopped memory monitoring');
  }
}

// Start memory logging in development
if (isDev) {
  startMemoryLogging();
}

// Save memory report to file
ipcMain.handle('memory:save-report', async (_event, { filename, reportText, reportData }) => {
  try {
    const reportsDir = path.join(os.homedir(), 'Documents', 'Researcher', 'Memory Reports');
    
    // Create directory if it doesn't exist
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Save text report
    const textPath = path.join(reportsDir, `${filename}.txt`);
    await fs.writeFile(textPath, reportText, 'utf-8');
    
    // Save JSON report
    const jsonPath = path.join(reportsDir, `${filename}.json`);
    await fs.writeFile(jsonPath, reportData, 'utf-8');
    
    console.log(`[Electron] Memory reports saved to: ${reportsDir}`);
    
    return {
      success: true,
      textPath,
      jsonPath,
      directory: reportsDir
    };
  } catch (error) {
    console.error('[Electron] Failed to save memory report:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Child process operations for heavy tasks
ipcMain.handle('process:document-operation', async (_event, { operation, data }) => {
  try {
    console.log(`[Electron] Starting document operation: ${operation}`);
    const result = await childProcessManager.executeTask('document', { operation, data });
    console.log(`[Electron] Document operation completed: ${operation}`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`[Electron] Document operation failed: ${operation}`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process:image-operation', async (_event, { operation, data }) => {
  try {
    console.log(`[Electron] Starting image operation: ${operation}`);
    const result = await childProcessManager.executeTask('image', { operation, data });
    console.log(`[Electron] Image operation completed: ${operation}`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`[Electron] Image operation failed: ${operation}`, error);
    return { success: false, error: error.message };
  }
});

// Get child process statistics
ipcMain.handle('process:get-stats', async () => {
  try {
    const stats = childProcessManager.getProcessStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('[Electron] Failed to get process stats:', error);
    return { success: false, error: error.message };
  }
});

// Additional memory management IPC handlers
ipcMain.handle('memory:clear-cache', async () => {
  try {
    clearImageCache();
    return { success: true, message: 'Cache cleared successfully' };
  } catch (error) {
    console.error('[Electron] Failed to clear cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:get-detailed-usage', async () => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      success: true,
      data: {
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers,
        },
        cpu: cpuUsage,
        cacheInfo: {
          imagesCached: imageHashToTempPath.size,
          tempDirs: documentTempDirs.size,
        },
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('[Electron] Failed to get detailed memory usage:', error);
    return { success: false, error: error.message };
  }
});

// Create temporary file from image data for editing
ipcMain.handle('image:create-temp', async (_event, { imageData, originalPath, mimeType }) => {
  try {
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
    
    // Generate content-based hash
    const imageHash = generateImageHash(imageBuffer);
    
    // Check if we already have a temp file for this image content
    if (imageHashToTempPath.has(imageHash)) {
      const existingTempPath = imageHashToTempPath.get(imageHash);
      try {
        // Verify the existing file still exists
        await fs.access(existingTempPath);
        const normalizedPath = existingTempPath.replace(/\\/g, '/');
        const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
        
        return {
          success: true,
          tempPath: existingTempPath,
          customUrl,
          tempDir: path.dirname(existingTempPath),
          reused: true
        };
      } catch (error) {
        // File no longer exists, remove from tracking
        imageHashToTempPath.delete(imageHash);
      }
    }
    
    // Create new temp file
    const tempDir = path.join(os.tmpdir(), `rsrch_image_edit_${Date.now()}_${imageHash}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Use hash-based filename for consistency
    const ext = fileName.split('.').pop() || 'png';
    const hashBasedFileName = `img_${imageHash}.${ext}`;
    const tempFilePath = path.join(tempDir, hashBasedFileName);
    
    await fs.writeFile(tempFilePath, imageBuffer);
    
    // Track temp directory and hash mapping
    documentTempDirs.add(tempDir);
    imageHashToTempPath.set(imageHash, tempFilePath);
    
    // Return custom protocol URL for the temp file
    const normalizedPath = tempFilePath.replace(/\\/g, '/');
    const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
    
    return {
      success: true,
      tempPath: tempFilePath,
      customUrl,
      tempDir,
      hash: imageHash
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
    
    // Generate new hash for the edited image
    const newImageHash = generateImageHash(imageBuffer);
    
    // Remove old hash mapping if it exists
    for (const [hash, path] of imageHashToTempPath.entries()) {
      if (path === tempPath) {
        imageHashToTempPath.delete(hash);
        break;
      }
    }
    
    await fs.writeFile(tempPath, imageBuffer);
    
    // Update hash mapping with new content hash
    imageHashToTempPath.set(newImageHash, tempPath);
    
    // Return custom protocol URL for the updated file
    const normalizedPath = tempPath.replace(/\\/g, '/');
    const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
    
    return {
      success: true,
      customUrl,
      hash: newImageHash
    };
  } catch (error) {
    console.error('Error saving temp image edit:', error);
    return { success: false, error: error.message };
  }
});


