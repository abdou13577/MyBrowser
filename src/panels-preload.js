// جسر مشترك لنوافذ اللوحات: البحث في الصفحة، السجل، التنزيلات، النسخ الاحتياطي
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mbFind', {
  search: (text, forward, findNext) => ipcRenderer.send('find:search', { text, forward, findNext }),
  close: () => ipcRenderer.send('find:close'),
  onResult: (cb) => ipcRenderer.on('find:result', (_e, d) => cb(d)),
  onFocus: (cb) => ipcRenderer.on('find:focus', () => cb())
});

contextBridge.exposeInMainWorld('mbHistory', {
  list: (opts) => ipcRenderer.invoke('history:list', opts),
  open: (url) => ipcRenderer.send('history:open', url),
  del: (ts) => ipcRenderer.invoke('history:delete', ts),
  clear: () => ipcRenderer.invoke('history:clear'),
  onChanged: (cb) => ipcRenderer.on('history:changed', () => cb())
});

contextBridge.exposeInMainWorld('mbDl', {
  list: () => ipcRenderer.invoke('dlm:list'),
  open: (p) => ipcRenderer.send('dlm:open', p),
  show: (p) => ipcRenderer.send('dlm:show', p),
  cancel: (id) => ipcRenderer.send('dlm:cancel', id),
  remove: (id) => ipcRenderer.invoke('dlm:remove', id),
  clear: () => ipcRenderer.invoke('dlm:clear'),
  onUpdate: (cb) => ipcRenderer.on('dl:update', (_e, d) => cb(d))
});

contextBridge.exposeInMainWorld('mbBackup', {
  export: () => ipcRenderer.invoke('backup:export'),
  import: () => ipcRenderer.invoke('backup:import')
});
