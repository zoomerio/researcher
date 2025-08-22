const { contextBridge, ipcRenderer } = require('electron');

const api = {
  saveDocumentAs: (payload) => ipcRenderer.invoke('dialog:save-document', payload),
  saveDocumentToPath: (payload) => ipcRenderer.invoke('dialog:save-document-to-path', payload),
  openDocument: () => ipcRenderer.invoke('dialog:open-document'),
  openDocumentPath: (filePath) => ipcRenderer.invoke('file:open-path', filePath),
  onOpenFilePath: (callback) => {
    ipcRenderer.removeAllListeners('file:open-path');
    ipcRenderer.on('file:open-path', (_e, p) => callback(p));
  },
  exportPdf: () => ipcRenderer.invoke('export:pdf'),
  newDocument: () => ipcRenderer.invoke('file:new'),
  onMenuNew: (cb) => {
    ipcRenderer.removeAllListeners('menu:new');
    ipcRenderer.on('menu:new', () => cb());
  },
  onMenuSave: (cb) => {
    ipcRenderer.removeAllListeners('menu:save');
    ipcRenderer.on('menu:save', () => cb());
  },
  onMenuSaveAs: (cb) => {
    ipcRenderer.removeAllListeners('menu:saveAs');
    ipcRenderer.on('menu:saveAs', () => cb());
  },
  onFileOpened: (cb) => {
    ipcRenderer.removeAllListeners('file:opened');
    ipcRenderer.on('file:opened', (_e, payload) => cb(payload));
  },
  detachTab: (payload) => ipcRenderer.invoke('window:detach-tab', payload),
  reattachTab: (payload) => ipcRenderer.invoke('window:reattach-tab', payload),
  onExternalOpenTab: (cb) => {
    ipcRenderer.removeAllListeners('external:open-tab');
    ipcRenderer.on('external:open-tab', (_e, p) => cb(p));
  },
  onExternalReattachTab: (cb) => {
    ipcRenderer.removeAllListeners('external:reattach-tab');
    ipcRenderer.on('external:reattach-tab', (_e, p) => cb(p));
  },
  broadcastCloseToken: (token) => ipcRenderer.invoke('window:broadcast-close-token', token),
  onCloseByToken: (cb) => {
    ipcRenderer.removeAllListeners('external:close-by-token');
    ipcRenderer.on('external:close-by-token', (_e, token) => cb(token));
  },
  closeSelf: () => ipcRenderer.invoke('window:close-self'),
  pickImage: () => ipcRenderer.invoke('dialog:open-image'),
  startExternalDrag: (payload) => ipcRenderer.send('drag:start', payload),
  endExternalDrag: () => ipcRenderer.send('drag:end'),
  onExternalDragStart: (cb) => {
    ipcRenderer.removeAllListeners('external:drag-start');
    ipcRenderer.on('external:drag-start', (_e, p) => cb(p));
  },
  onExternalDragEnd: (cb) => {
    ipcRenderer.removeAllListeners('external:drag-end');
    ipcRenderer.on('external:drag-end', () => cb());
  },
  cleanupDocumentTemp: (tempDir) => ipcRenderer.invoke('document:cleanup-temp', tempDir),
  createTempImage: (payload) => ipcRenderer.invoke('image:create-temp', payload),
  saveTempImageEdit: (payload) => ipcRenderer.invoke('image:save-temp-edit', payload),
  // Memory monitoring
  getMemoryUsage: () => ipcRenderer.invoke('memory:get-usage'),
  forceGarbageCollection: () => ipcRenderer.invoke('memory:force-gc'),
  saveMemoryReport: (payload) => ipcRenderer.invoke('memory:save-report', payload),
  // Child process operations
  executeDocumentOperation: (operation, data) => ipcRenderer.invoke('process:document-operation', { operation, data }),
  executeImageOperation: (operation, data) => ipcRenderer.invoke('process:image-operation', { operation, data }),
  getProcessStats: () => ipcRenderer.invoke('process:get-stats'),
};

contextBridge.exposeInMainWorld('api', api);


