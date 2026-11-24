// مساحات العمل بنقرة واحدة (Workspaces) — حفظ مجموعة التبويبات باسم مشروع وإغلاقها لتوفير الذاكرة ثم استعادتها بنقرة
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const WS_URL = 'https://workspaces.mybrowser.invalid/';

module.exports = (ctx) => {
  const dir = () => path.join(app.getPath('userData'), 'workspaces');
  const fileOf = (pid) => path.join(dir(), (pid || 'default') + '.json');

  function load(pid) {
    try {
      const arr = JSON.parse(fs.readFileSync(fileOf(pid), 'utf8'));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function save(pid, arr) {
    try {
      fs.mkdirSync(dir(), { recursive: true });
      fs.writeFileSync(fileOf(pid), JSON.stringify(arr, null, 2));
    } catch (e) { ctx.logLine('workspaces save', e); }
  }

  const wins = new Map();
  const appIcon = () => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } };
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  const pidOf = (e) => { for (const [pid, win] of wins) if (!win.isDestroyed() && win.webContents === e.sender) return pid; return null; };
  const winForPid = (pid) => [...ctx.windows].find(x => !x.guest && ctx.profileOf(x).id === pid) || [...ctx.windows].find(x => !x.guest) || null;

  function openWorkspaces(w) {
    if (!w) return;
    const pid = ctx.profileOf(w).id;
    const cur = wins.get(pid);
    if (cur && !cur.isDestroyed()) { if (cur.isMinimized()) cur.restore(); cur.show(); cur.focus(); return; }
    const win = new BrowserWindow({
      width: 920, height: 720, minWidth: 560, minHeight: 440, title: 'Workspaces',
      autoHideMenuBar: true, backgroundColor: '#090A16', icon: appIcon(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    win.__pid = pid;
    wins.set(pid, win);
    win.loadFile(path.join(__dirname, '..', 'ui', 'workspaces.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => { if (wins.get(pid) === win) wins.delete(pid); });
  }
  ctx.openWorkspaces = openWorkspaces;

  function collectTabs(w) {
    if (!w) return [];
    const list = [];
    for (const id of w.order) {
      const tb = ctx.tabs.get(id);
      if (!tb || !ctx.alive(tb)) continue;
      const url = tb.sleeping ? tb.sleeping.url : tb.view.webContents.getURL();
      const title = tb.sleeping ? tb.sleeping.title : (tb.view.webContents.getTitle() || url);
      if (url && /^https?:\/\//i.test(url) && !/\.mybrowser\.invalid\b/i.test(url)) {
        list.push({ url, title: String(title).slice(0, 120) });
      }
    }
    return list;
  }

  ipcMain.handle('ws:list', (e) => {
    const pid = pidOf(e); if (pid == null) return { workspaces: [], openCount: 0 };
    const w = winForPid(pid);
    return { workspaces: load(pid), openCount: collectTabs(w).length };
  });

  ipcMain.handle('ws:saveCurrent', (e, { name, color, closeAfter } = {}) => {
    const pid = pidOf(e); if (pid == null) return { ok: false };
    const w = winForPid(pid);
    const tabs = collectTabs(w);
    if (!tabs.length) return { ok: false, error: 'empty' };
    const ws = {
      id: 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: String(name || '').trim().slice(0, 48) || 'Workspace',
      color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#7c9cff',
      tabs,
      createdAt: Date.now()
    };
    const arr = load(pid);
    arr.unshift(ws);
    save(pid, arr);
    if (closeAfter && w) {
      const ids = [...w.order];
      for (const id of ids) { try { ctx.closeTab(w, id); } catch {} }
    }
    return { ok: true, ws };
  });

  ipcMain.handle('ws:open', (e, { id, replace } = {}) => {
    const pid = pidOf(e); if (pid == null) return { ok: false };
    const arr = load(pid);
    const ws = arr.find(x => x.id === id);
    if (!ws || !Array.isArray(ws.tabs) || !ws.tabs.length) return { ok: false };
    let w = winForPid(pid);
    if (!w) w = ctx.openProfileWindow(pid);
    if (!w) return { ok: false };
    const oldIds = replace ? [...w.order] : [];
    ws.tabs.forEach((t, i) => { try { ctx.createTab(w, t.url, i === 0); } catch {} });
    if (replace) {
      for (const oid of oldIds) { try { ctx.closeTab(w, oid); } catch {} }
    }
    try { if (w.win.isMinimized()) w.win.restore(); w.win.focus(); } catch {}
    return { ok: true };
  });

  ipcMain.handle('ws:delete', (e, id) => {
    const pid = pidOf(e); if (pid == null) return false;
    const arr = load(pid).filter(x => x.id !== id);
    save(pid, arr);
    return true;
  });

  ipcMain.handle('ws:removeTab', (e, { id, url } = {}) => {
    const pid = pidOf(e); if (pid == null) return false;
    const arr = load(pid);
    const ws = arr.find(x => x.id === id);
    if (!ws) return false;
    ws.tabs = (ws.tabs || []).filter(t => t.url !== url);
    save(pid, ws.tabs.length ? arr : arr.filter(x => x.id !== id));
    return true;
  });

  ipcMain.handle('ws:openPanel', (e) => { const w = ctx.W(e); if (w) openWorkspaces(w); return true; });

  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(WS_URL)) { ev.preventDefault(); const w = ownerOf(wc); if (w) openWorkspaces(w); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'w') {
        const w = ownerOf(wc); if (w) { ev.preventDefault(); openWorkspaces(w); }
      }
    });
  });
};
