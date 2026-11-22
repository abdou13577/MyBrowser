// «التطبيقات»: مواقع تعمل كتطبيقات مستقلة (نافذة خاصة + أيقونة على سطح المكتب وقائمة ابدأ وشريط المهام)
// لا تُنزَّل ملفات APK: التطبيق هو نسخة الويب الرسمية، يفتح في نافذته الخاصة بحساباتك ومانع الإعلانات
const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const CATALOG = [
  ['whatsapp', 'WhatsApp', 'https://web.whatsapp.com', 'whatsapp.com'],
  ['instagram', 'Instagram', 'https://www.instagram.com'],
  ['facebook', 'Facebook', 'https://www.facebook.com'],
  ['messenger', 'Messenger', 'https://www.facebook.com/messages', 'messenger.com'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com'],
  ['youtube', 'YouTube', 'https://www.youtube.com'],
  ['ytmusic', 'YouTube Music', 'https://music.youtube.com'],
  ['telegram', 'Telegram', 'https://web.telegram.org/a/', 'telegram.org'],
  ['snapchat', 'Snapchat', 'https://web.snapchat.com', 'snapchat.com'],
  ['x', 'X', 'https://x.com'],
  ['pinterest', 'Pinterest', 'https://www.pinterest.com'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com'],
  ['reddit', 'Reddit', 'https://www.reddit.com'],
  ['discord', 'Discord', 'https://discord.com/app', 'discord.com'],
  ['gmail', 'Gmail', 'https://mail.google.com'],
  ['maps', 'Google Maps', 'https://www.google.com/maps', 'maps.google.com'],
  ['translate', 'Google Translate', 'https://translate.google.com'],
  ['drive', 'Google Drive', 'https://drive.google.com'],
  ['photos', 'Google Photos', 'https://photos.google.com'],
  ['outlook', 'Outlook', 'https://outlook.live.com/mail/', 'outlook.com'],
  ['claude', 'Claude', 'https://claude.ai'],
  ['chatgpt', 'ChatGPT', 'https://chatgpt.com'],
  ['twitch', 'Twitch', 'https://www.twitch.tv'],
  ['soundcloud', 'SoundCloud', 'https://soundcloud.com'],
  ['canva', 'Canva', 'https://www.canva.com'],
  ['capcut', 'CapCut', 'https://www.capcut.com']
].map(([id, name, url, icon]) => ({ id, name, url, icon: icon || new URL(url).hostname.replace(/^www\./, '') }));

const STORE_URL = 'https://apps.mybrowser.invalid/';
const argApp = (argv) => { const a = (argv || []).find(x => /^--mb-app=/.test(x)); return a ? a.slice(9) : ''; };

module.exports = (ctx) => {
  // نسخة واحدة فقط من المتصفح: فتح أيقونة تطبيق أو المتصفح مرة ثانية يذهب للنسخة المفتوحة
  if (!app.requestSingleInstanceLock()) { app.exit(0); return; }
  const startApp = argApp(process.argv);

  const dir = () => path.join(app.getPath('userData'), 'apps');
  const installed = () => (ctx.settings.apps = ctx.settings.apps || []);
  const find = (id) => installed().find(a => a.id === id) || CATALOG.find(a => a.id === id);
  const appUserId = (id) => 'com.personal.mybrowser.app.' + id;
  const icoFile = (id) => path.join(dir(), id + '.ico');
  const startMenuDir = () => path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MyBrowser Apps');
  const shortcutPaths = (a) => [path.join(app.getPath('desktop'), a.name + '.lnk'), path.join(startMenuDir(), a.name + '.lnk')];
  const faviconUrl = (a) => 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(a.icon) + '&sz=128';

  // أيقونة التطبيق: شعار الموقع على مربع زجاجي أبيض بزوايا دائرية (256 بكسل) ثم ملف ICO
  async function makeIcon(a) {
    const { toIco } = require('./appicon');
    const w = new BrowserWindow({ width: 256, height: 256, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
    try {
      const letter = (a.name || '?').trim()[0].toUpperCase();
      const html = `<html><body style="margin:0;background:transparent;overflow:hidden">
        <div style="position:absolute;inset:8px;border-radius:58px;background:linear-gradient(160deg,#ffffff,#eef0ff);display:grid;place-items:center;box-shadow:inset 0 0 0 2px rgba(139,124,255,.25)">
        <img id="i" src="${faviconUrl(a)}" style="width:150px;height:150px;image-rendering:auto" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${letter.replace(/'/g, '')}',style:'font:700 130px Segoe UI,sans-serif;color:#5B5FEF'}))">
        </div></body></html>`;
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await w.webContents.executeJavaScript(`new Promise(r => { const i = document.getElementById('i'); if (!i || i.complete) return r(); i.onload = i.onerror = () => r(); setTimeout(r, 4000); })`);
      await new Promise(r => setTimeout(r, 150));
      const big = (await w.capturePage()).resize({ width: 256, height: 256, quality: 'best' });
      fs.mkdirSync(dir(), { recursive: true });
      const pngs = [256, 64, 48, 32, 24, 16].map(s => ({ size: s, png: (s === 256 ? big : big.resize({ width: s, height: s, quality: 'best' })).toPNG() }));
      fs.writeFileSync(icoFile(a.id), toIco(pngs));
      return icoFile(a.id);
    } finally { w.destroy(); }
  }

  function writeShortcuts(a) {
    if (process.platform !== 'win32') return;
    fs.mkdirSync(startMenuDir(), { recursive: true });
    for (const p of shortcutPaths(a)) {
      shell.writeShortcutLink(p, 'replace', {
        target: process.execPath, args: `--mb-app=${a.id}`, icon: icoFile(a.id), iconIndex: 0,
        appUserModelId: appUserId(a.id), description: a.name
      });
    }
  }

  // ---------- نافذة التطبيق ----------
  const open = new Map();
  function profileWindow() { return [...ctx.windows].find(w => !w.guest) || null; }
  function openApp(id) {
    const a = find(id);
    if (!a) return false;
    const cur = open.get(id);
    if (cur && !cur.isDestroyed()) { if (cur.isMinimized()) cur.restore(); cur.show(); cur.focus(); return true; }
    const pw = profileWindow();
    const ico = fs.existsSync(icoFile(id)) ? icoFile(id) : null;
    const big = /whatsapp|telegram|messenger|discord|gmail|outlook|drive|photos|maps|canva|capcut|claude|chatgpt|linkedin|x$/.test(id);
    const win = new BrowserWindow({
      width: big ? 1200 : 1100, height: 820, minWidth: 360, minHeight: 480, title: a.name, autoHideMenuBar: true,
      backgroundColor: '#ffffff', icon: ico ? nativeImage.createFromPath(ico) : undefined,
      webPreferences: { partition: ctx.partOf(pw), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false }
    });
    open.set(id, win);
    try {
      if (process.platform === 'win32' && ico) win.setAppDetails({ appId: appUserId(id), appIconPath: ico, appIconIndex: 0,
        relaunchCommand: `"${process.execPath}" --mb-app=${id}`, relaunchDisplayName: a.name });
    } catch (e) {}
    win.on('page-title-updated', (e, title) => { e.preventDefault(); const m = String(title).match(/\((\d+)\)/); win.setTitle(m ? `${a.name} (${m[1]})` : a.name); });
    const wc = win.webContents;
    // الروابط التي تفتح نافذة جديدة تذهب إلى المتصفح، ونوافذ تسجيل الدخول تبقى كنوافذ صغيرة
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (disposition === 'new-window') return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true } };
      const w = profileWindow() || ctx.openProfileWindow(ctx.settings.activeProfile);
      if (w) { ctx.createTab(w, url); try { if (w.win.isMinimized()) w.win.restore(); w.win.focus(); } catch (e) {} }
      return { action: 'deny' };
    });
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      const k = input.key.toLowerCase(), mod = input.control || input.meta;
      if (k === 'f5' || (mod && k === 'r')) { wc.reload(); e.preventDefault(); }
      else if (input.alt && k === 'arrowleft') { wc.navigationHistory.goBack(); e.preventDefault(); }
      else if (input.alt && k === 'arrowright') { wc.navigationHistory.goForward(); e.preventDefault(); }
      else if (mod && (k === '=' || k === '+')) { wc.setZoomLevel(wc.getZoomLevel() + 0.5); e.preventDefault(); }
      else if (mod && k === '-') { wc.setZoomLevel(wc.getZoomLevel() - 0.5); e.preventDefault(); }
      else if (mod && k === '0') { wc.setZoomLevel(0); e.preventDefault(); }
    });
    win.on('closed', () => { open.delete(id); quitIfNothingVisible(); });
    wc.loadURL(a.url).catch(() => {});
    ctx.logLine('APP open', id);
    return true;
  }

  // ---------- المتجر ----------
  let store = null;
  function openStore() {
    if (store && !store.isDestroyed()) { store.show(); store.focus(); return; }
    store = new BrowserWindow({
      width: 1040, height: 740, minWidth: 560, minHeight: 480, title: 'MyBrowser Apps', autoHideMenuBar: true, backgroundColor: '#090A16',
      webPreferences: { preload: path.join(__dirname, '..', 'apps', 'store-preload.js'), contextIsolation: true, sandbox: true }
    });
    store.loadFile(path.join(__dirname, '..', 'apps', 'store.html'), { query: { lang: ctx.lang() } });
    store.on('closed', () => { store = null; quitIfNothingVisible(); });
  }
  const isStore = (e) => store && !store.isDestroyed() && e.sender === store.webContents;
  ipcMain.handle('apps:list', () => ({ catalog: CATALOG, installed: installed().map(a => a.id), custom: installed().filter(a => a.custom) }));
  ipcMain.handle('apps:add', async (e, id) => {
    if (!isStore(e)) return { ok: false };
    const a = CATALOG.find(x => x.id === id);
    if (!a) return { ok: false };
    try {
      await makeIcon(a);
      writeShortcuts(a);
      if (!installed().find(x => x.id === id)) installed().push({ id: a.id, name: a.name, url: a.url, icon: a.icon });
      ctx.saveSettings();
      return { ok: true };
    } catch (err) { ctx.logLine('APP add failed', id, err); return { ok: false, error: err.message }; }
  });
  ipcMain.handle('apps:custom', async (e, { name, url }) => {
    if (!isStore(e)) return { ok: false };
    try {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const u = new URL(url);
      name = String(name || '').trim().slice(0, 30) || u.hostname.replace(/^www\./, '').split('.')[0];
      const id = 'c' + Date.now().toString(36);
      const a = { id, name, url: u.href, icon: u.hostname, custom: true };
      await makeIcon(a);
      writeShortcuts(a);
      installed().push(a);
      ctx.saveSettings();
      return { ok: true, id };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('apps:remove', (e, id) => {
    if (!isStore(e)) return false;
    const a = find(id);
    if (a) for (const p of shortcutPaths(a)) { try { fs.unlinkSync(p); } catch (x) {} }
    try { fs.unlinkSync(icoFile(id)); } catch (x) {}
    ctx.settings.apps = installed().filter(x => x.id !== id);
    ctx.saveSettings();
    return true;
  });
  ipcMain.handle('apps:open', (e, id) => openApp(id));

  // فتح المتجر: زر «التطبيقات» في صفحة البداية، أو Ctrl+Shift+A
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(STORE_URL)) { ev.preventDefault(); openStore(); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'a') { ev.preventDefault(); openStore(); }
    });
  });

  app.on('second-instance', (_e, argv) => {
    const id = argApp(argv);
    if (id) { openApp(id); return; }
    const w = profileWindow();
    if (w) { if (w.win.isMinimized()) w.win.restore(); w.win.show(); w.win.focus(); }
    else ctx.openProfileWindow(ctx.settings.activeProfile);
  });

  // نافذة المتصفح والتطبيقات مستقلة: إغلاق آخر نافذة متصفح يخفيها فقط ما دام هناك تطبيق مفتوح
  let quitting = false;
  app.on('before-quit', () => { quitting = true; });
  const appsOpen = () => [...open.values()].some(x => !x.isDestroyed()) || (store && !store.isDestroyed());
  function quitIfNothingVisible() {
    setTimeout(() => {
      if (quitting || appsOpen()) return;
      if (![...ctx.windows].some(w => !w.win.isDestroyed() && w.win.isVisible())) app.quit();
    }, 100);
  }
  ctx.hooks.windowReady.push((w) => {
    if (w.appsCloseHooked) return;
    w.appsCloseHooked = true;
    w.win.on('close', (e) => {
      if (quitting || !appsOpen()) return;
      const others = [...ctx.windows].filter(x => x !== w && !x.win.isDestroyed() && x.win.isVisible());
      if (!others.length) { e.preventDefault(); w.win.hide(); }
    });
  });

  // تشغيل مباشر من أيقونة التطبيق: نفتح التطبيق وحده، ونافذة المتصفح تبقى مخفية حتى تفتحها
  if (startApp) app.whenReady().then(() => {
    if (!openApp(startApp)) return;
    for (const w of [...ctx.windows]) { try { w.win.hide(); } catch (e) {} }
  });
  ctx.openStore = openStore;
  ctx.openApp = openApp;
  ctx.appsCatalog = CATALOG;
};
