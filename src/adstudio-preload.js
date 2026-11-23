const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ad', {
  hasKey: () => ipcRenderer.invoke('ad:haskey'),
  ai: (req) => ipcRenderer.invoke('ad:ai', req),
  save: (buffer, ext, kind) => ipcRenderer.invoke('ad:save', { buffer, ext, kind }),
  reveal: (file) => ipcRenderer.invoke('ad:reveal', file)
});
