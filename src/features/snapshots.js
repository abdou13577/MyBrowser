// ذاكرة مرئية ذكية للصفحات بدون إنترنت (Smart Page Snapshots / Offline Reader)
// حفظ أي مقال أو صفحة مهمة بنقرة زر (Ctrl+Shift+M) مع البحث الفوري داخل النصوص المحفوظة والقراءة بدون إنترنت
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SNAP_URL = 'https://snapshots.mybrowser.invalid/';
const MAX_SNAPS = 300;

const EXTRACT = `(() => {
  const title = (document.querySelector('h1')?.innerText || document.title || location.hostname || '').trim().slice(0, 180);
  const root = document.querySelector('article, main, [role="main"]') || document.body;
  const blocks = [];
  const seen = new Set();
  const nodes = root.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, pre');
  let chars = 0;
  for (const el of nodes) {
    if (chars > 60000) break;
    if (el.closest('nav, header, footer, aside, script, style, noscript, [aria-hidden="true"]')) continue;
    const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (text.length < 12 && !/^H[1-4]$/.test(el.tagName)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    const tag = el.tagName.toLowerCase();
    blocks.push({ tag, text: text.slice(0, 2000) });
    chars += text.length;
  }
  const plain = blocks.map(b => b.text).join('\\n').slice(0, 60000) || (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 20000);
  const excerpt = plain.slice(0, 220);
  return { title, url: location.href, domain: location.hostname, blocks: blocks.slice(0, 250), plain, excerpt };
})()`;

const MSG = {
  ar: { saved: 'تم حفظ الصفحة للقراءة بدون إنترنت', fail: 'تعذّر حفظ هذه الصفحة', none: 'افتح صفحة ويب أولاً لحفظها' },
  en: { saved: 'Page saved for offline reading', fail: 'Could not save this page', none: 'Open a web page first' },
  de: { saved: 'Seite offline gespeichert', fail: 'Seite konnte nicht gespeichert werden', none: 'Zuerst eine Webseite öffnen' },
  fr: { saved: 'Page enregistrée hors ligne', fail: 'Impossible d’enregistrer cette page', none: 'Ouvrez d’abord une page web' },
  es: { saved: 'Página guardada sin conexión', fail: 'No se pudo guardar esta página', none: 'Abre primero una página web' },
  it: { saved: 'Pagina salvata offline', fail: 'Impossibile salvare questa pagina', none: 'Apri prima una pagina web' },
  tr: { saved: 'Sayfa çevrimdışı okuma için kaydedildi', fail: 'Sayfa kaydedilemedi', none: 'Önce bir web sayfası açın' }
};

module.exports = (ctx) => {
  const tr = () => MSG[(ctx.lang() || 'en').slice(0, 2)] || MSG.en;
  const dir = () => path.join(app.getPath('userData'), 'snapshots');
  const fileOf = (pid) => path.join(dir(), (pid || 'default') + '.json');

  function load(pid) {
    try { const arr = JSON.parse(fs.readFileSync(fileOf(pid), 'utf8')); return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  }
  function save(pid, arr) {
    try { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(fileOf(pid), JSON.stringify(arr)); }
    catch (e) { ctx.logLine('snapshots save', e); }
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

  async function captureActive(w) {
    if (!w) return { ok: false };
    const wc = ctx.activeWc(w);
    const u = wc ? wc.getURL() : '';
    if (!wc || !/^https?:\/\//i.test(u) || /\.mybrowser\.invalid\b/i.test(u)) {
      ctx.toast(`📸 ${tr().none}`, w);
      return { ok: false };
    }
    try {
      const data = await wc.executeJavaScript(EXTRACT, true);
      if (!data || !data.plain) { ctx.toast(`⚠️ ${tr().fail}`, w); return { ok: false }; }
      const pid = ctx.profileOf(w).id;
      const item = {
        id: 'sn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: data.title || u,
        url: data.url || u,
        domain: data.domain || '',
        excerpt: data.excerpt || '',
        blocks: data.blocks || [],
        plain: data.plain || '',
        savedAt: Date.now()
      };
      const arr = load(pid).filter(x => x.url !== item.url);
      arr.unshift(item);
      if (arr.length > MAX_SNAPS) arr.length = MAX_SNAPS;
      save(pid, arr);
      const win = wins.get(pid);
      if (win && !win.isDestroyed()) win.webContents.send('snaps:changed');
      ctx.toast(`📸 ${tr().saved}`, w);
      return { ok: true, id: item.id };
    } catch {
      ctx.toast(`⚠️ ${tr().fail}`, w);
      return { ok: false };
    }
  }

  function openSnapshots(w) {
    if (!w) return;
    const pid = ctx.profileOf(w).id;
    const cur = wins.get(pid);
    if (cur && !cur.isDestroyed()) { if (cur.isMinimized()) cur.restore(); cur.show(); cur.focus(); return; }
    const win = new BrowserWindow({
      width: 1020, height: 760, minWidth: 640, minHeight: 460, title: 'Offline Snapshots',
      autoHideMenuBar: true, backgroundColor: '#090A16', icon: appIcon(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    win.__pid = pid;
    wins.set(pid, win);
    win.loadFile(path.join(__dirname, '..', 'ui', 'snapshots.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => { if (wins.get(pid) === win) wins.delete(pid); });
  }

  ctx.captureSnapshot = captureActive;
  ctx.openSnapshots = openSnapshots;

  ipcMain.handle('snaps:capture', (e) => {
    const pid = pidOf(e);
    const w = pid != null ? winForPid(pid) : ctx.W(e);
    return captureActive(w);
  });
  ipcMain.handle('snaps:list', (e, query) => {
    const pid = pidOf(e); if (pid == null) return [];
    const q = String(query || '').trim().toLowerCase();
    let arr = load(pid);
    if (q) {
      arr = arr.filter(x =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.url || '').toLowerCase().includes(q) ||
        (x.plain || '').toLowerCase().includes(q)
      );
    }
    return arr.map(({ id, title, url, domain, excerpt, savedAt, plain }) => {
      let matchSnippet = excerpt;
      if (q && plain) {
        const idx = plain.toLowerCase().indexOf(q);
        if (idx >= 0) {
          const start = Math.max(0, idx - 60);
          matchSnippet = (start > 0 ? '…' : '') + plain.slice(start, idx + q.length + 120) + '…';
        }
      }
      return { id, title, url, domain, excerpt: matchSnippet, savedAt };
    });
  });
  ipcMain.handle('snaps:get', (e, id) => {
    const pid = pidOf(e); if (pid == null) return null;
    return load(pid).find(x => x.id === id) || null;
  });
  ipcMain.handle('snaps:delete', (e, id) => {
    const pid = pidOf(e); if (pid == null) return false;
    save(pid, load(pid).filter(x => x.id !== id));
    return true;
  });
  ipcMain.on('snaps:openUrl', (e, url) => {
    const pid = pidOf(e); if (pid == null || !url) return;
    let w = winForPid(pid) || ctx.openProfileWindow(pid);
    if (w) { ctx.createTab(w, url); try { if (w.win.isMinimized()) w.win.restore(); w.win.focus(); } catch {} }
  });
  ipcMain.handle('snaps:export', async (e, id) => {
    const pid = pidOf(e); if (pid == null) return { ok: false };
    const item = load(pid).find(x => x.id === id);
    if (!item) return { ok: false };
    const win = wins.get(pid);
    const safeName = (item.title || 'snapshot').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) + '.html';
    const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: safeName, filters: [{ name: 'HTML', extensions: ['html'] }] });
    if (canceled || !filePath) return { ok: false };
    const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const body = (item.blocks || []).map(b => `<${/^(h[1-4]|p|li|blockquote|pre)$/.test(b.tag) ? b.tag : 'p'}>${esc(b.text)}</${/^(h[1-4]|p|li|blockquote|pre)$/.test(b.tag) ? b.tag : 'p'}>`).join('\n');
    const html = `<!DOCTYPE html><html dir="auto"><head><meta charset="utf-8"><title>${esc(item.title)}</title><style>body{max-width:760px;margin:40px auto;padding:0 20px;font:17px/1.75 system-ui,sans-serif;background:#0b0c18;color:#eef0ff}a{color:#4f8cff}blockquote{border-inline-start:3px solid #8b7cff;padding-inline-start:14px;color:#b8bde0}pre{background:#151830;padding:12px;border-radius:10px;overflow:auto}</style></head><body><h1>${esc(item.title)}</h1><p><a href="${esc(item.url)}">${esc(item.url)}</a></p><hr>${body}</body></html>`;
    fs.writeFileSync(filePath, html, 'utf8');
    return { ok: true };
  });
  ipcMain.handle('snaps:openPanel', (e) => { const w = ctx.W(e); if (w) openSnapshots(w); return true; });

  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(SNAP_URL)) { ev.preventDefault(); const w = ownerOf(wc); if (w) openSnapshots(w); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'm') {
        const w = ownerOf(wc); if (w) { ev.preventDefault(); captureActive(w); }
      }
    });
  });
};
