// شاشة اختيار الحساب عند بدء التشغيل
// عند وجود أكثر من حساب: نخفي النافذة التي فتحها البرنامج تلقائياً ونعرض شاشة الاختيار،
// فلا يُفتح أي حساب حتى يختاره المستخدم (مثل صفحة اختيار الحساب في جوجل).
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = (ctx) => {
  const viaApp = process.argv.some(a => a.startsWith('--mb-app='));
  const profiles = () => ctx.settings.profiles || [];
  const pub = ctx.publicProfile || ((p) => ({ id: p.id, name: p.name, email: p.email, photo: p.photo, color: p.color }));
  const appIcon = () => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } };

  let chooserWin = null, picked = false;
  const hidden = new Set();

  function showChooser() {
    if (chooserWin && !chooserWin.isDestroyed()) { chooserWin.show(); chooserWin.focus(); return; }
    picked = false;
    chooserWin = new BrowserWindow({
      width: 760, height: 560, resizable: false, frame: false, show: false, backgroundColor: '#090A16', icon: appIcon(),
      webPreferences: { preload: path.join(__dirname, '..', 'chooser-preload.js'), contextIsolation: true, sandbox: true }
    });
    chooserWin.loadURL('zaki://ui/chooser.html');
    chooserWin.once('ready-to-show', () => { try { chooserWin.show(); chooserWin.center(); } catch {} });
    chooserWin.on('closed', () => { chooserWin = null; if (!picked) revealHidden(); });
    profiles().forEach(p => { try { ctx.refreshIdentity(p); } catch {} });
  }
  ctx.showAccountChooser = showChooser;
  function closeChooser() { if (chooserWin && !chooserWin.isDestroyed()) { try { chooserWin.destroy(); } catch {} } chooserWin = null; }

  // النوافذ التي فُتحت تلقائياً عند البدء وأخفيناها بانتظار اختيار المستخدم
  function revealHidden() { for (const w of [...hidden]) { hidden.delete(w); try { if (w.win && !w.win.isDestroyed()) w.win.show(); } catch {} } }
  function resolve(keepId) {
    for (const w of [...hidden]) {
      hidden.delete(w);
      try {
        if (!w.win || w.win.isDestroyed()) continue;
        if (w.profileId === keepId) { w.win.show(); continue; } // الحساب المختار: أظهره
        w.win.close(); // نافذة حساب آخر فُتحت تلقائياً: أغلقها (نافذة المختار مفتوحة الآن)
      } catch {}
    }
  }

  ipcMain.handle('chooser:get', () => ({ profiles: profiles().map(pub), appName: ctx.t('appName'), lang: ctx.lang(), rtl: ctx.isRTL() }));
  ipcMain.handle('chooser:open', (_e, id) => {
    if (!profiles().find(p => p.id === id)) return false;
    picked = true;
    const w = ctx.openProfileWindow(id);
    try { if (w && w.win && !w.win.isDestroyed()) { if (w.win.isMinimized()) w.win.restore(); w.win.show(); w.win.focus(); } } catch {}
    resolve(id); closeChooser(); return true;
  });
  ipcMain.handle('chooser:guest', () => { picked = true; if (ctx.openGuestWindow) ctx.openGuestWindow(); else ctx.createWindow('__guest__', { guest: true }); resolve(null); closeChooser(); return true; });
  ipcMain.handle('chooser:add', () => {
    picked = true;
    const w = ctx.openProfileWindow(ctx.settings.activeProfile);
    try { if (w && w.win && !w.win.isDestroyed()) { w.win.show(); w.win.focus(); } } catch {}
    resolve(ctx.settings.activeProfile); closeChooser(); return { ok: true };
  });

  app.whenReady().then(() => {
    if (viaApp) return;
    // يعمل بعد أن تفتح main.js نوافذ البدء (whenReady الخاص بنا مُسجَّل بعده)
    setImmediate(() => {
      if (ctx.settings.askAccountOnStart === false) return;
      if (profiles().length <= 1) return;
      if (chooserWin || hidden.size) return;
      for (const w of ctx.windows) { try { if (w.win && !w.win.isDestroyed() && !w.guest) { w.win.hide(); hidden.add(w); } } catch {} }
      if (hidden.size) showChooser();
    });
  });
};
