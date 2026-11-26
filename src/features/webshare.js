// نافذة المشاركة الأصلية لويندوز 10/11 (Native Windows Share Sheet) + دعم كامل لـ navigator.share في كل المواقع
// - يسجّل src/webshare-preload.js على جميع الجلسات ليعمل navigator.share من لحظة تحميل الصفحة (document_start)
// - عند ضغط زر «مشاركة» في أي موقع (أو زر المشاركة في شريط المتصفح / Ctrl+Shift+U) يفتح نافذة المشاركة الأصلية لويندوز
//   والتي تعرض التطبيقات المثبتة لديك (WhatsApp، Telegram، ربط الهاتف Phone Link، البريد، إلخ)
const { app, ipcMain, session } = require('electron');
const path = require('path');
const cp = require('child_process');

const PRELOAD_PATH = path.join(__dirname, '..', 'webshare-preload.js');
const PS_SCRIPT = path.join(__dirname, 'winshare.ps1');

function hwndOf(w) {
  try {
    if (!w || !w.win || w.win.isDestroyed()) return '0';
    const buf = w.win.getNativeWindowHandle();
    if (!buf || buf.length < 4) return '0';
    if (buf.length >= 8 && typeof buf.readBigUInt64LE === 'function') return buf.readBigUInt64LE(0).toString();
    return String(buf.readUInt32LE(0));
  } catch { return '0'; }
}

function showWindowsShareSheet(w, { title, text, url }) {
  if (process.platform !== 'win32') return false;
  try {
    const hwnd = hwndOf(w);
    const args = [
      '-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT,
      '-Hwnd', hwnd,
      '-Title', String(title || 'MyBrowser').slice(0, 200),
      '-Text', String(text || '').slice(0, 600),
      '-Url', String(url || '').slice(0, 2000)
    ];
    const child = cp.spawn('powershell.exe', args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  } catch { return false; }
}

module.exports = (ctx) => {
  const registered = new WeakSet();
  const attachSession = (ses) => {
    try {
      if (!ses || registered.has(ses) || typeof ses.registerPreloadScript !== 'function') return;
      registered.add(ses);
      ses.registerPreloadScript({ type: 'frame', filePath: PRELOAD_PATH });
    } catch {}
  };

  // تسجيل على الجلسة الافتراضية وكل جلسات الحسابات والضيوف الجديدة
  app.on('session-created', (ses) => attachSession(ses));
  app.whenReady().then(() => {
    attachSession(session.defaultSession);
    for (const p of (ctx.settings.profiles || [])) {
      try {
        const part = p.id === 'default' ? 'persist:main' : 'persist:p-' + p.id;
        attachSession(session.fromPartition(part));
      } catch {}
    }
  });
  ctx.hooks.windowReady.push((w) => {
    try { attachSession(ctx.sesOf(w)); } catch {}
  });

  function shareCurrent(w) {
    if (!w) return { ok: false };
    const wc = ctx.activeWc(w);
    if (!wc || wc.isDestroyed()) return { ok: false };
    const url = wc.getURL() || '';
    if (!/^https?:\/\//i.test(url)) return { ok: false };
    const title = wc.getTitle() || url;
    const clean = ctx.cleanUrl ? ctx.cleanUrl(url).url : url;
    const ok = showWindowsShareSheet(w, { title, text: title, url: clean });
    return { ok };
  }

  ctx.shareCurrentPage = shareCurrent;

  ipcMain.handle('webshare:open', (e, data) => {
    const w = ctx.W(e);
    const ok = showWindowsShareSheet(w, data || {});
    return { ok };
  });

  ipcMain.handle('webshare:current', (e) => shareCurrent(ctx.W(e)));

  // اختصار Ctrl+Shift+U لمشاركة الصفحة الحالية عبر نافذة ويندوز في أي وقت
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'u') {
        const w = ownerOf(wc);
        if (w) { ev.preventDefault(); shareCurrent(w); }
      }
    });
  });
};
