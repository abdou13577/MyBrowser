// سجلّ التصفّح + البحث فيه (لكل حساب على حدة) — مثل كروم
// يُسجّل الصفحات المزارة في ملف لكل ملف شخصي، ونافذة لعرضه والبحث والحذف.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const HISTORY_URL = 'https://history.mybrowser.invalid/';
const MAX = 3000;

module.exports = (ctx) => {
  const dir = () => path.join(app.getPath('userData'), 'history');
  const fileOf = (pid) => path.join(dir(), (pid || 'default') + '.json');
  const mem = new Map();    // pid -> array (newest first)
  const saveT = new Map();  // pid -> timer
  let lastStamp = 0;
  const stamp = () => { let n = Date.now(); if (n <= lastStamp) n = lastStamp + 1; lastStamp = n; return n; }; // زمن فريد تصاعدي (لا تضارب)

  function load(pid) {
    if (mem.has(pid)) return mem.get(pid);
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(fileOf(pid), 'utf8')); if (!Array.isArray(arr)) arr = []; } catch {}
    mem.set(pid, arr); return arr;
  }
  function saveSoon(pid) {
    clearTimeout(saveT.get(pid));
    saveT.set(pid, setTimeout(() => {
      try { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(fileOf(pid), JSON.stringify(mem.get(pid) || [])); } catch (e) { ctx.logLine('history save', e); }
    }, 1500));
  }
  const skip = (u) => !u || ctx.isStartPage(u) || u === 'about:blank' || /^(zaki|data|blob|chrome):/i.test(u) || /mybrowser\.invalid/i.test(u) || ctx.isSensitive(u);

  function record(pid, url, title) {
    if (skip(url)) return;
    const arr = load(pid);
    if (arr[0] && arr[0].u === url) { if (title) arr[0].t = title; arr[0].ts = stamp(); saveSoon(pid); return arr[0]; }
    const e = { u: url, t: title || url, ts: stamp() };
    arr.unshift(e);
    if (arr.length > MAX) arr.length = MAX;
    saveSoon(pid);
    for (const win of hwins.values()) if (!win.isDestroyed() && win.__pid === pid) win.webContents.send('history:changed');
    return e;
  }

  ctx.hooks.navigated.push((w, id, wc, url) => {
    if (w.guest) return;
    const pid = ctx.profileOf(w).id;
    const e = record(pid, url, (() => { try { return wc.getTitle(); } catch { return ''; } })());
    if (e) setTimeout(() => { try { if (!wc.isDestroyed() && wc.getURL() === url) { const t = wc.getTitle(); if (t && t !== e.t) { e.t = t; saveSoon(pid); } } } catch {} }, 800);
  });

  // ---------- النافذة ----------
  const hwins = new Map(); // pid -> BrowserWindow
  function ownerOf(wc) {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  }
  function openHistory(w) {
    if (!w) return;
    const pid = ctx.profileOf(w).id;
    const cur = hwins.get(pid);
    if (cur && !cur.isDestroyed()) { if (cur.isMinimized()) cur.restore(); cur.show(); cur.focus(); return; }
    const win = new BrowserWindow({
      width: 940, height: 760, minWidth: 560, minHeight: 440, title: ctx.t('historyTitle') || 'History',
      autoHideMenuBar: true, backgroundColor: '#090A16',
      icon: (() => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } })(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    win.__pid = pid;
    hwins.set(pid, win);
    win.loadFile(path.join(__dirname, '..', 'ui', 'history.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => { if (hwins.get(pid) === win) hwins.delete(pid); });
  }
  ctx.openHistory = openHistory;
  const pidOf = (e) => { for (const [pid, win] of hwins) if (!win.isDestroyed() && win.webContents === e.sender) return pid; return null; };

  ipcMain.handle('history:list', (e, { query, limit } = {}) => {
    const pid = pidOf(e); if (pid == null) return [];
    let arr = load(pid);
    const q = (query || '').trim().toLowerCase();
    if (q) arr = arr.filter(x => (x.t || '').toLowerCase().includes(q) || (x.u || '').toLowerCase().includes(q));
    return arr.slice(0, limit || 500);
  });
  ipcMain.handle('history:delete', (e, ts) => {
    const pid = pidOf(e); if (pid == null) return false;
    const arr = load(pid); const i = arr.findIndex(x => x.ts === ts);
    if (i >= 0) { arr.splice(i, 1); saveSoon(pid); } return true;
  });
  ipcMain.handle('history:clear', (e) => {
    const pid = pidOf(e); if (pid == null) return false;
    mem.set(pid, []); saveSoon(pid); return true;
  });
  ipcMain.on('history:open', (e, url) => {
    const pid = pidOf(e); if (pid == null || !url) return;
    let w = [...ctx.windows].find(x => !x.guest && ctx.profileOf(x).id === pid) || [...ctx.windows].find(x => !x.guest);
    if (!w) w = ctx.openProfileWindow(pid);
    if (w) { ctx.createTab(w, url); try { if (w.win.isMinimized()) w.win.restore(); w.win.focus(); } catch {} }
  });

  // فتح: Ctrl+H أو زر السجل في صفحة البداية (history.mybrowser.invalid)
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(HISTORY_URL)) { ev.preventDefault(); const w = ownerOf(wc); if (w) openHistory(w); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && !input.shift && !input.alt && input.key && input.key.toLowerCase() === 'h') {
        const w = ownerOf(wc); if (w) { ev.preventDefault(); openHistory(w); }
      }
    });
  });
};
