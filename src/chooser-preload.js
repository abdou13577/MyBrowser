const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chooser', {
  get: () => ipcRenderer.invoke('chooser:get'),
  open: (id) => ipcRenderer.invoke('chooser:open', id),
  guest: () => ipcRenderer.invoke('chooser:guest'),
  add: () => ipcRenderer.invoke('chooser:add')
});
