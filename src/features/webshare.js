// نافذة المشاركة الأصلية لويندوز 10/11 (Native Windows Share Sheet) + دعم كامل لـ navigator.share في كل المواقع
// - يبني برنامج winshare.exe صغير (8 KB) مرة واحدة عبر csc.exe المدمج في ويندوز لسرعة فورية (40ms) بدون وميض طرفية
// - يسجّل src/webshare-preload.js على جميع الجلسات ليعمل navigator.share من لحظة تحميل الصفحة (document_start)
// - عند ضغط زر «مشاركة» في أي موقع (أو زر المشاركة في الشريط / Ctrl+Shift+U) تفتح نافذة ويندوز الأصلية بجميع التطبيقات المثبتة
const { app, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const PRELOAD_PATH = path.join(__dirname, '..', 'webshare-preload.js');
const CS_SRC = path.join(__dirname, 'winshare.cs');
const CSC = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

function exePath() {
  return path.join(app.getPath('userData'), 'winshare.exe');
}

function ensureExe(logLine) {
  if (process.platform !== 'win32') return '';
  const out = exePath();
  try {
    if (fs.existsSync(out) && fs.existsSync(CS_SRC)) {
      if (fs.statSync(out).mtimeMs >= fs.statSync(CS_SRC).mtimeMs) return out;
    }
  } catch {}
  if (!fs.existsSync(CSC) || !fs.existsSync(CS_SRC)) return '';
  try {
    const fw = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319';
    const wm = 'C:\\Windows\\System32\\WinMetadata';
    const r = cp.spawnSync(CSC, [
      '/nologo', '/target:winexe', `/out:${out}`,
      '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll',
      `/r:${fw}\\System.Runtime.dll`,
      `/r:${fw}\\System.Runtime.WindowsRuntime.dll`,
      `/r:${fw}\\System.Runtime.InteropServices.WindowsRuntime.dll`,
      `/r:${wm}\\Windows.ApplicationModel.winmd`,
      `/r:${wm}\\Windows.Foundation.winmd`,
      CS_SRC
    ], { windowsHide: true, encoding: 'utf8' });
    if (r.status === 0 && fs.existsSync(out)) return out;
    if (logLine) logLine('WEBSHARE compile failed', r.status, (r.stdout || r.stderr || '').slice(0, 200));
  } catch (e) {
    if (logLine) logLine('WEBSHARE compile err', e.message);
  }
  return '';
}

function showWindowsShareSheet(logLine, { title, text, url }) {
  if (process.platform !== 'win32') return false;
  const exe = ensureExe(logLine);
  if (!exe) return false;
  try {
    // بدون windowsHide حتى يمنح ويندوز التركيز الأمامي تلقائياً لنافذة winshare.exe GUI فتظهر نافذة المشاركة فوراً
    const child = cp.spawn(exe, [
      String(title || 'MyBrowser').slice(0, 200),
      String(text || '').slice(0, 600),
      String(url || '').slice(0, 2000)
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch (e) {
    if (logLine) logLine('WEBSHARE spawn err', e.message);
    return false;
  }
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

  app.on('session-created', (ses) => attachSession(ses));
  app.whenReady().then(() => {
    // بناء winshare.exe مرة واحدة بهدوء عند بدء المتصفح ليكون جاهزاً فورياً عند أول ضغطة
    setTimeout(() => { try { ensureExe(ctx.logLine); } catch {} }, 2500);
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
    return { ok: showWindowsShareSheet(ctx.logLine, { title, text: title, url: clean }) };
  }

  ctx.shareCurrentPage = shareCurrent;

  ipcMain.handle('webshare:open', (_e, data) => ({ ok: showWindowsShareSheet(ctx.logLine, data || {}) }));
  ipcMain.handle('webshare:current', (e) => shareCurrent(ctx.W(e)));

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
