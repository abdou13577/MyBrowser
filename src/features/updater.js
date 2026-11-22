// التحديث التلقائي الموقّع رقمياً (منذ 2.6.1)
// 1) نقرأ update/latest.json وتوقيعه من GitHub، ونتحقق من التوقيع بالمفتاح العام (المفتاح الخاص عند المالك فقط)
// 2) الملف الموقّع يذكر الملفات التي تغيّرت مع بصمة SHA-256 لكل ملف
// 3) نحمّل كل ملف من المستودع ونرفض أي ملف لا تطابق بصمته ما في الملف الموقّع
// 4) عند «تثبيت الآن» (أو عند إغلاق المتصفح) نكتب الملفات في مجلد البرنامج مع نسخة احتياطية، ثم نعيد التشغيل
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAEIvzAu2yzvXu+xak8Ybt7QeQxh+oaOkT2JizpgD1GhQ=
-----END PUBLIC KEY-----
`;
const ROOT = (process.env.MB_UPDATE_ROOT || 'https://raw.githubusercontent.com/abdou13577/MyBrowser/main/').replace(/\/?$/, '/');
const FEED = ROOT + 'update/';

const cmp = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// مسار آمن داخل مجلد البرنامج فقط
const SAFE = /^(package\.json|src\/[A-Za-z0-9_\-./]+)$/;

module.exports = (ctx) => {
  const { t, send, logLine } = ctx;
  const current = () => ctx.APP_VERSION;
  const appDir = () => process.env.MB_UPDATE_APPDIR || app.getAppPath();
  const st = { status: 'idle', version: '', notes: '', error: '', staged: null };
  const broadcast = () => { for (const w of ctx.windows) send(w, 'update', publicState()); };
  const publicState = () => ({ status: st.status, version: st.version, notes: st.notes, error: st.error, current: current() });
  const notesFor = (m) => (m.notes && (m.notes[ctx.lang()] || m.notes.en || m.notes.ar)) || '';
  const canWrite = () => !/\.asar$/i.test(appDir()); // نسخة قديمة مثبّتة كملف asar تحتاج المثبّت الكامل

  async function get(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return Buffer.from(await r.arrayBuffer());
  }
  let busy = false;
  async function check(manual) {
    if (busy || st.status === 'ready') { if (manual) broadcast(); return; }
    busy = true;
    st.status = 'checking'; st.error = ''; if (manual) broadcast();
    try {
      // محررات الويب قد تغيّر نهاية السطر أو الفراغ الأخير فقط؛ نقبل هذه الفروق وحدها (المحتوى نفسه يبقى موقّعاً)
      const text = (await get(FEED + 'latest.json')).toString('utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n';
      const sig = (await get(FEED + 'latest.json.sig')).toString('utf8').trim();
      if (!crypto.verify(null, Buffer.from(text, 'utf8'), PUBLIC_KEY, Buffer.from(sig, 'base64'))) {
        st.status = 'badsig'; logLine('UPDATE: bad signature, ignored'); return;
      }
      const m = JSON.parse(text);
      if (cmp(m.version, current()) <= 0) { st.status = 'latest'; return; }
      st.version = m.version; st.notes = notesFor(m);
      if ((m.minElectron && cmp(process.versions.electron, m.minElectron) < 0) ||
          (m.minBase && cmp(current(), m.minBase) < 0) || !canWrite() || !Array.isArray(m.files)) { st.status = 'needsFull'; return; }
      st.status = 'downloading'; broadcast();
      const staged = [];
      // الملفات من نسخة محددة في GitHub (إن وُجدت) حتى لا نأخذ نسخة قديمة من ذاكرة التخزين المؤقت
      const base = /^[0-9a-f]{40}$/.test(m.ref || '') ? ROOT.replace(/\/main\/$/, '/' + m.ref + '/') : ROOT;
      for (const f of m.files) {
        if (!SAFE.test(f.path) || f.path.includes('..')) throw new Error('unsafe path ' + f.path);
        const dest = path.join(appDir(), f.path);
        // الملف عندنا مطابق أصلاً؟ لا حاجة لتنزيله
        try { if (sha(fs.readFileSync(dest)) === f.sha256) continue; } catch (e) {}
        const buf = await get(base + f.path);
        if (sha(buf) !== f.sha256) { st.status = 'badsig'; logLine('UPDATE: hash mismatch', f.path); return; }
        staged.push({ path: f.path, buf });
      }
      st.staged = staged;
      st.status = 'ready';
      ctx.settings.pendingUpdate = { version: m.version, notes: m.notes || {} };
      ctx.saveSettings();
      logLine('UPDATE ready', m.version, staged.length + ' files');
    } catch (e) {
      st.status = 'error'; st.error = e.message; logLine('UPDATE check failed', e.message);
    } finally {
      busy = false;
      if (manual || st.status === 'ready' || st.status === 'needsFull') broadcast();
    }
  }

  // الكتابة: نسخة احتياطية أولاً، ثم استبدال كل ملف عبر ملف مؤقت + rename
  let applied = false;
  function apply() {
    if (applied || st.status !== 'ready' || !st.staged) return false;
    applied = true;
    const base = appDir();
    const bak = path.join(app.getPath('userData'), 'update-backup', current());
    const done = [];
    try {
      for (const f of st.staged) {
        const dest = path.join(base, f.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.existsSync(dest)) { fs.mkdirSync(path.dirname(path.join(bak, f.path)), { recursive: true }); fs.copyFileSync(dest, path.join(bak, f.path)); }
        fs.writeFileSync(dest + '.new', f.buf);
        fs.renameSync(dest + '.new', dest);
        done.push(f.path);
      }
      logLine('UPDATE applied', st.version, done.length + ' files');
      return true;
    } catch (e) {
      // فشل في المنتصف: نرجع الملفات التي غيّرناها
      for (const p of done) { try { fs.copyFileSync(path.join(bak, p), path.join(base, p)); } catch (x) {} }
      applied = false; st.status = 'error'; st.error = e.message;
      ctx.settings.pendingUpdate = null; ctx.saveSettings();
      logLine('UPDATE apply failed, rolled back', e);
      return false;
    }
  }
  ipcMain.handle('update:install', () => {
    if (!apply()) { broadcast(); return false; }
    setTimeout(() => { app.relaunch(); app.quit(); }, 200);
    return true;
  });
  ipcMain.handle('update:check', () => check(true).then(publicState));
  ipcMain.handle('update:state', () => publicState());
  // «لاحقاً»: يُثبَّت تلقائياً عند إغلاق المتصفح
  app.on('will-quit', () => { if (st.status === 'ready') apply(); });

  ctx.hooks.windowReady.push((w) => {
    const p = ctx.settings.pendingUpdate;
    if (p && cmp(current(), p.version) >= 0) {
      const notes = (p.notes && (p.notes[ctx.lang()] || p.notes.en)) || '';
      setTimeout(() => send(w, 'action-toast', { text: `✅ ${t('updDone')} ${p.version}${notes ? ' — ' + notes : ''}`, button: 'OK', action: 'none' }), 2500);
      ctx.settings.pendingUpdate = null;
      ctx.saveSettings();
    }
    if (st.status === 'ready' || st.status === 'needsFull') setTimeout(() => send(w, 'update', publicState()), 3000);
  });
  // نبحث عن تحديث: بعد التشغيل، كل 30 دقيقة، وعند الرجوع إلى المتصفح (إن مرّت 10 دقائق على آخر بحث)
  let lastCheck = 0;
  const auto = () => { lastCheck = Date.now(); check(false); };
  setTimeout(auto, 15e3);
  setInterval(auto, 30 * 60e3);
  app.on('browser-window-focus', () => { if (Date.now() - lastCheck > 10 * 60e3) auto(); });
  ctx.hooks.windowReady.push((w) => { if (w.updFocusHooked) return; w.updFocusHooked = true; try { w.win.on('focus', () => { if (Date.now() - lastCheck > 10 * 60e3) auto(); }); } catch (e) {} });
};
