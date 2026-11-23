// مدير التنزيلات (الملفات العامة): يلتقط أي تنزيل من أي موقع ويعرض التقدّم مع فتح/إظهار/إلغاء
// مستقل: لا يعدّل العملية الرئيسية. يلتقط session.will-download لكل جلسة حساب.
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const DL_URL = 'https://downloads.mybrowser.invalid/';
const MAX = 500;

module.exports = (ctx) => {
  const file = () => path.join(app.getPath('userData'), 'downloads.json');
  let list = null;                // [{ id, name, url, path, total, got, state, ts, mime }]  newest first
  const items = new Map();        // id -> DownloadItem حيّ (للإلغاء)
  let seq = 0, saveT = null;

  function load() { if (list) return list; try { list = JSON.parse(fs.readFileSync(file(), 'utf8')); if (!Array.isArray(list)) list = []; } catch { list = []; } return list; }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(file(), JSON.stringify(load().slice(0, MAX))); } catch (e) { ctx.logLine('dl save', e); } }, 800); }
  function push(ch, data) { for (const win of wins) if (!win.isDestroyed()) win.webContents.send(ch, data); }
  function emit(rec) { push('dl:update', rec); saveSoon(); }

  // اسم فريد داخل مجلد التنزيلات (report.bin, report (1).bin …) — حفظ تلقائي بلا نافذة حوار
  function uniquePath(name) {
    const dir = app.getPath('downloads');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const ext = path.extname(name), base = path.basename(name, ext) || 'download';
    let p = path.join(dir, base + ext), i = 1;
    while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
    return p;
  }

  function attach(ses) {
    if (!ses || ses.__mbDl) return; ses.__mbDl = true;
    ses.on('will-download', (_e, item, wc) => {
      const id = 'd' + (++seq) + '-' + Date.now().toString(36);
      // احفظ تلقائياً في مجلد التنزيلات (مثل كروم) بدل إظهار نافذة حفظ
      let save = ''; try { save = uniquePath(item.getFilename()); item.setSavePath(save); } catch (err) { ctx.logLine('dl path', err); }
      const rec = { id, name: item.getFilename(), url: item.getURL(), path: save, total: item.getTotalBytes() || 0, got: 0, state: 'running', ts: Date.now(), mime: item.getMimeType() || '' };
      load().unshift(rec); if (load().length > MAX) load().length = MAX;
      items.set(id, item);
      try { const w = ctx.wOfWc(wc); ctx.toast('⬇ ' + rec.name, w); } catch {}
      emit(rec);
      item.on('updated', (_ev, state) => {
        rec.got = item.getReceivedBytes(); if (!rec.total) rec.total = item.getTotalBytes() || 0;
        rec.path = item.getSavePath() || rec.path;
        rec.state = state === 'interrupted' ? 'interrupted' : 'running';
        emit(rec);
      });
      item.on('done', (_ev, state) => {
        items.delete(id);
        rec.got = item.getReceivedBytes(); rec.path = item.getSavePath() || rec.path;
        rec.state = state === 'completed' ? 'done' : (state === 'cancelled' ? 'canceled' : 'error');
        if (rec.state === 'done') { try { ctx.toast('✅ ' + rec.name, ctx.wOfWc(wc)); } catch {} }
        emit(rec);
      });
    });
  }

  // اربط جلسة كل نافذة حساب + الجلسة الافتراضية
  ctx.hooks.windowReady.push((w) => { try { attach(ctx.sesOf(w)); } catch {} });
  app.whenReady().then(() => { try { attach(session.defaultSession); } catch {} for (const w of ctx.windows) { try { attach(ctx.sesOf(w)); } catch {} } });

  // ---------- النافذة ----------
  const wins = new Set();
  function ownerOf(wc) {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id); if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  }
  let theWin = null;
  function openDownloads() {
    if (theWin && !theWin.isDestroyed()) { if (theWin.isMinimized()) theWin.restore(); theWin.show(); theWin.focus(); return; }
    theWin = new BrowserWindow({
      width: 860, height: 700, minWidth: 520, minHeight: 420, title: 'Downloads', autoHideMenuBar: true, backgroundColor: '#090A16',
      icon: (() => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } })(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    wins.add(theWin);
    theWin.loadFile(path.join(__dirname, '..', 'ui', 'downloads.html'), { query: { lang: ctx.lang() } });
    theWin.on('closed', () => { wins.delete(theWin); theWin = null; });
  }
  ctx.openDownloads = openDownloads;
  const fromWin = (e) => [...wins].some(win => !win.isDestroyed() && win.webContents === e.sender);

  ipcMain.handle('dlm:list', (e) => fromWin(e) ? load() : []);
  ipcMain.on('dlm:open', (e, p) => { if (fromWin(e) && p) shell.openPath(p).catch(() => {}); });
  ipcMain.on('dlm:show', (e, p) => { if (fromWin(e) && p) shell.showItemInFolder(p); });
  ipcMain.on('dlm:cancel', (e, id) => { if (!fromWin(e)) return; const it = items.get(id); if (it) try { it.cancel(); } catch {} });
  ipcMain.handle('dlm:remove', (e, id) => { if (!fromWin(e)) return false; const a = load(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a.splice(i, 1); saveSoon(); } return true; });
  ipcMain.handle('dlm:clear', (e) => { if (!fromWin(e)) return false; list = load().filter(x => x.state === 'running'); saveSoon(); return true; });

  // فتح: Ctrl+Shift+J أو زر التنزيلات في صفحة البداية
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(DL_URL)) { ev.preventDefault(); openDownloads(); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'j') { ev.preventDefault(); openDownloads(); }
    });
  });
};
