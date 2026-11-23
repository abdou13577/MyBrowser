// البحث داخل الصفحة (Ctrl+F): شريط بحث عائم يبرز النتائج ويتنقل بينها
// مستقل تماماً: لا يعدّل العملية الرئيسية ولا الواجهة — نافذة صغيرة فوق النافذة الحالية.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const BAR_W = 380, BAR_H = 54, TOP = 96, MARGIN = 22;

module.exports = (ctx) => {
  const bars = new Map();        // w (نافذة المتصفح) -> نافذة شريط البحث
  const byWc = new Map();        // webContents.id لشريط البحث -> { w, results }

  // النافذة (المتصفح) التي يملكها هذا المحتوى (شريطها العلوي أو أحد تبويباتها)
  function ownerOf(wc) {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  }

  // متابعة نتائج البحث على التبويب النشط (تتحرك مع تبديل التبويب)
  function makeResults(findWin, w) {
    let bound = null;
    const handler = (_e, r) => { if (!findWin.isDestroyed()) findWin.webContents.send('find:result', { active: r.activeMatchOrdinal, total: r.matches }); };
    const ensure = () => {
      const wc = ctx.activeWc(w);
      if (wc === bound) return wc;
      if (bound && !bound.isDestroyed()) { bound.removeListener('found-in-page', handler); try { bound.stopFindInPage('clearSelection'); } catch {} }
      bound = wc;
      if (wc) wc.on('found-in-page', handler);
      return wc;
    };
    const cleanup = () => { if (bound && !bound.isDestroyed()) { bound.removeListener('found-in-page', handler); try { bound.stopFindInPage('clearSelection'); } catch {} } bound = null; };
    return { ensure, cleanup };
  }

  function place(bar, w) {
    if (!bar || bar.isDestroyed() || !w || w.win.isDestroyed()) return;
    const b = w.win.getBounds();
    const x = ctx.isRTL() ? b.x + MARGIN : b.x + b.width - BAR_W - MARGIN;
    bar.setBounds({ x: Math.round(x), y: Math.round(b.y + TOP), width: BAR_W, height: BAR_H });
  }

  function openBar(w) {
    if (!w || w.win.isDestroyed()) return;
    const cur = bars.get(w);
    if (cur && !cur.isDestroyed()) { cur.showInactive(); cur.webContents.send('find:focus'); cur.focus(); return; }
    const bar = new BrowserWindow({
      parent: w.win, width: BAR_W, height: BAR_H, frame: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, show: false,
      backgroundColor: '#12142a', hasShadow: true,
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    bars.set(w, bar);
    const results = makeResults(bar, w);
    byWc.set(bar.webContents.id, { w, results });
    place(bar, w);
    bar.loadFile(path.join(__dirname, '..', 'ui', 'find.html'), { query: { lang: ctx.lang() } });
    bar.once('ready-to-show', () => { if (!bar.isDestroyed()) { bar.show(); bar.webContents.send('find:focus'); } });
    const reposition = () => place(bar, w);
    w.win.on('move', reposition); w.win.on('resize', reposition);
    bar.on('closed', () => {
      w.win.removeListener('move', reposition); w.win.removeListener('resize', reposition);
      results.cleanup(); byWc.delete(bar.webContents.id); if (bars.get(w) === bar) bars.delete(w);
    });
  }
  ctx.openFind = openBar;

  const senderInfo = (e) => byWc.get(e.sender.id);

  ipcMain.on('find:search', (e, { text, forward, findNext }) => {
    const info = senderInfo(e); if (!info) return;
    const wc = info.results.ensure();
    if (!wc) return;
    if (text) wc.findInPage(text, { forward: forward !== false, findNext: !!findNext, matchCase: false });
    else { try { wc.stopFindInPage('clearSelection'); } catch {} e.sender.send('find:result', { active: 0, total: 0 }); }
  });
  ipcMain.on('find:close', (e) => {
    const info = senderInfo(e); if (!info) return;
    const bar = bars.get(info.w);
    // أعِد التركيز إلى الصفحة قبل الإغلاق
    const wc = ctx.activeWc(info.w); if (wc) try { wc.focus(); } catch {}
    if (bar && !bar.isDestroyed()) bar.close();
  });

  // Ctrl+F على أي صفحة أو شريط عنوان يفتح الشريط لنافذتها
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type !== 'keyDown') return;
      const mod = input.control || input.meta;
      if (mod && !input.shift && !input.alt && input.key && input.key.toLowerCase() === 'f') {
        const owner = ownerOf(wc);
        if (owner) { ev.preventDefault(); openBar(owner); }
      }
    });
  });

  // عند تبديل التبويب: حدّث هدف البحث وامسح تحديد التبويب السابق
  ctx.hooks.tabActivated.push((w) => { const bar = bars.get(w); if (bar && !bar.isDestroyed()) byWc.get(bar.webContents.id) && byWc.get(bar.webContents.id).results.ensure(); });
};
