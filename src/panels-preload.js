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

contextBridge.exposeInMainWorld('mbWorkspaces', {
  list: () => ipcRenderer.invoke('ws:list'),
  saveCurrent: (d) => ipcRenderer.invoke('ws:saveCurrent', d),
  open: (id, replace) => ipcRenderer.invoke('ws:open', { id, replace }),
  del: (id) => ipcRenderer.invoke('ws:delete', id),
  removeTab: (id, url) => ipcRenderer.invoke('ws:removeTab', { id, url })
});

contextBridge.exposeInMainWorld('mbSnaps', {
  list: (q) => ipcRenderer.invoke('snaps:list', q),
  get: (id) => ipcRenderer.invoke('snaps:get', id),
  capture: () => ipcRenderer.invoke('snaps:capture'),
  del: (id) => ipcRenderer.invoke('snaps:delete', id),
  openUrl: (u) => ipcRenderer.send('snaps:openUrl', u),
  exportHtml: (id) => ipcRenderer.invoke('snaps:export', id),
  onChanged: (cb) => ipcRenderer.on('snaps:changed', () => cb())
});

contextBridge.exposeInMainWorld('mbRadar', {
  list: () => ipcRenderer.invoke('radar:list'),
  watch: () => ipcRenderer.invoke('radar:watch'),
  checkAll: () => ipcRenderer.invoke('radar:checkAll'),
  del: (id) => ipcRenderer.invoke('radar:delete', id),
  openUrl: (u) => ipcRenderer.send('radar:openUrl', u),
  onChanged: (cb) => ipcRenderer.on('radar:changed', () => cb())
});

contextBridge.exposeInMainWorld('mbFocus', {
  get: () => ipcRenderer.invoke('focus:get'),
  set: (domain, minutes) => ipcRenderer.invoke('focus:set', { domain, minutes }),
  remove: (domain) => ipcRenderer.invoke('focus:remove', domain)
});
