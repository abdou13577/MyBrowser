// نسخ احتياطي للإعدادات واستعادتها: ملف واحد يحوي الإعدادات والمفضلة والملاحظات والسجل
// لا يشمل كلمات المرور (مشفّرة بمفتاح الجهاز ولا تُنقل بأمان). مستقل عن العملية الرئيسية.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const BACKUP_URL = 'https://backup.mybrowser.invalid/';
const FOLDERS = ['bookmarks', 'notes', 'history'];

module.exports = (ctx) => {
  const userData = () => app.getPath('userData');

  function readFolder(name) {
    const dir = path.join(userData(), name);
    const out = {};
    try { for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) out[f] = fs.readFileSync(path.join(dir, f), 'utf8'); } catch {}
    return out;
  }
  function writeFolder(name, obj) {
    if (!obj) return;
    const dir = path.join(userData(), name);
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    for (const [f, content] of Object.entries(obj)) {
      if (!/^[\w.-]+\.json$/.test(f)) continue;            // أمان: أسماء ملفات بسيطة فقط
      try { JSON.parse(content); fs.writeFileSync(path.join(dir, f), content); } catch {}
    }
  }

  function makeBundle() {
    const settings = JSON.parse(JSON.stringify(ctx.settings || {}));
    delete settings.apiKeyEnc;   // المفتاح لا يُنقل (خاص بالجهاز)
    const data = {}; for (const f of FOLDERS) data[f] = readFolder(f);
    return { app: 'MyBrowser', kind: 'backup', version: ctx.APP_VERSION || '', date: new Date().toISOString(), settings, data };
  }

  function applyBundle(bundle) {
    if (!bundle || bundle.app !== 'MyBrowser' || bundle.kind !== 'backup') return { ok: false, error: 'NOT_BACKUP' };
    if (bundle.settings && typeof bundle.settings === 'object') {
      const keepKey = ctx.settings.apiKeyEnc;               // لا نمسح مفتاح الجهاز الحالي
      for (const k of Object.keys(bundle.settings)) if (k !== 'apiKeyEnc') ctx.settings[k] = bundle.settings[k];
      ctx.settings.apiKeyEnc = keepKey;
      ctx.saveSettings();
    }
    for (const f of FOLDERS) writeFolder(f, bundle.data && bundle.data[f]);
    for (const w of ctx.windows) { try { w.ui.webContents.reload(); } catch {} }
    try { ctx.sendProfiles && ctx.sendProfiles(); } catch {}
    return { ok: true };
  }

  const wins = new Set();
  function ownerWin(e) { return [...wins].find(win => !win.isDestroyed() && win.webContents === e.sender); }

  ipcMain.handle('backup:export', async (e) => {
    const win = ownerWin(e); if (!win) return { ok: false };
    const def = `mybrowser-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const r = await dialog.showSaveDialog(win, { title: 'Backup', defaultPath: def, filters: [{ name: 'MyBrowser Backup', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try { fs.writeFileSync(r.filePath, JSON.stringify(makeBundle(), null, 2)); return { ok: true, file: r.filePath }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('backup:import', async (e) => {
    const win = ownerWin(e); if (!win) return { ok: false };
    const r = await dialog.showOpenDialog(win, { title: 'Restore', properties: ['openFile'], filters: [{ name: 'MyBrowser Backup', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    let bundle;
    try { bundle = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (err) { return { ok: false, error: 'BAD_FILE' }; }
    try { return applyBundle(bundle); } catch (err) { return { ok: false, error: err.message }; }
  });

  function openBackup() {
    const existing = [...wins].find(w => !w.isDestroyed());
    if (existing) { if (existing.isMinimized()) existing.restore(); existing.show(); existing.focus(); return; }
    const win = new BrowserWindow({
      width: 560, height: 520, minWidth: 440, minHeight: 420, title: 'Backup', autoHideMenuBar: true, backgroundColor: '#090A16', resizable: false,
      icon: (() => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } })(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    wins.add(win);
    win.loadFile(path.join(__dirname, '..', 'ui', 'backup.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => wins.delete(win));
  }
  ctx.openBackup = openBackup;
  ctx.makeBackupBundle = makeBundle;   // للاختبار
  ctx.applyBackupBundle = applyBundle;  // للاختبار

  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(BACKUP_URL)) { ev.preventDefault(); openBackup(); } });
  });
};
