const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('apps', {
  list: () => ipcRenderer.invoke('apps:list'),
  add: (id) => ipcRenderer.invoke('apps:add', id),
  custom: (name, url) => ipcRenderer.invoke('apps:custom', { name, url }),
  remove: (id) => ipcRenderer.invoke('apps:remove', id),
  open: (id) => ipcRenderer.invoke('apps:open', id)
});
