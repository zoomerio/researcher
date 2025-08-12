// Use CommonJS for maximum compatibility in Electron preload
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveDocument: (payload) => ipcRenderer.invoke('dialog:save-document', payload),
  openDocument: () => ipcRenderer.invoke('dialog:open-document'),
  openDocumentPath: (filePath) => ipcRenderer.invoke('file:open-path', filePath),
  onOpenFilePath: (callback) => ipcRenderer.on('file:open-path', (_e, p) => callback(p)),
  exportPdf: () => ipcRenderer.invoke('export:pdf'),
});


