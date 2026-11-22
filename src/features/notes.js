// ملاحظات لكل موقع + تذكير بصفحة في وقت محدد
const { ipcMain, app, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = (ctx) => {
  const { t, W, send, activeWc, siteKey } = ctx;

  // ================= 12) ملاحظات لكل موقع =================
  const notesFile = (pid) => path.join(app.getPath('userData'), 'notes', pid + '.json');
  const loadNotes = (pid) => { try { return JSON.parse(fs.readFileSync(notesFile(pid), 'utf8')); } catch { return {}; } };
  const saveNotes = (pid, n) => { fs.mkdirSync(path.dirname(notesFile(pid)), { recursive: true }); fs.writeFileSync(notesFile(pid), JSON.stringify(n)); };
  const siteOfW = (w) => { const wc = activeWc(w); const u = wc ? wc.getURL() : ''; return /^https?:/.test(u) ? siteKey(u) : ''; };
  ipcMain.handle('notes:get', (e) => {
    const w = W(e), site = siteOfW(w);
    if (w.guest) return { site, text: '', guest: true };
    return { site, text: (loadNotes(w.profileId)[site] || {}).text || '' };
  });
  ipcMain.on('notes:set', (e, { site, text }) => {
    const w = W(e);
    if (!site || w.guest) return;
    const n = loadNotes(w.profileId);
    if (text && text.trim()) n[site] = { text, updated: Date.now() }; else delete n[site];
    saveNotes(w.profileId, n);
    send(w, 'note-indicator', !!(text && text.trim()));
  });
  ipcMain.handle('notes:all', (e) => {
    const w = W(e);
    return Object.entries(loadNotes(w.profileId)).sort((a, b) => b[1].updated - a[1].updated).map(([site, v]) => ({ site, text: v.text }));
  });
  // يظهر رمز 📝 عندما يكون للموقع الحالي ملاحظة
  const indicate = (w) => { if (!w || w.guest) return; const site = siteOfW(w); send(w, 'note-indicator', !!(site && loadNotes(w.profileId)[site])); };
  ctx.hooks.navigated.push((w, id) => { if (w.activeId === id) indicate(w); });
  ctx.hooks.tabActivated.push((w) => setImmediate(() => indicate(w)));

  // ================= 13) تذكير بصفحة =================
  try { app.setAppUserModelId('com.personal.mybrowser'); } catch {}
  const reminders = () => (ctx.settings.reminders = ctx.settings.reminders || []);
  ipcMain.handle('remind:add', (e, at) => {
    const w = W(e), wc = activeWc(w);
    if (!wc || !/^https?:/.test(wc.getURL())) return { ok: false };
    const r = { id: Date.now().toString(36), url: wc.getURL(), title: wc.getTitle() || wc.getURL(), at: Number(at), profileId: w.profileId };
    reminders().push(r);
    ctx.saveSettings();
    return { ok: true, reminder: r };
  });
  ipcMain.handle('remind:list', () => reminders().slice().sort((a, b) => a.at - b.at));
  ipcMain.handle('remind:delete', (_e, id) => { ctx.settings.reminders = reminders().filter(r => r.id !== id); ctx.saveSettings(); return true; });
  function fire(r) {
    const open = () => {
      const w = ctx.openProfileWindow(r.profileId) || ctx.wOfWc();
      if (w) { ctx.createTab(w, r.url); try { w.win.show(); w.win.focus(); } catch {} }
    };
    try {
      if (Notification.isSupported()) {
        const n = new Notification({ title: '⏰ ' + t('remindTitle'), body: r.title, silent: false });
        n.on('click', open);
        n.show();
      }
    } catch {}
    for (const w of ctx.windows) send(w, 'action-toast', { text: `⏰ ${t('remindTitle')}: ${r.title}`, button: t('remindOpen'), action: 'open-url', data: { url: r.url } });
  }
  setInterval(() => {
    const now = Date.now(), due = reminders().filter(r => r.at <= now);
    if (!due.length || !ctx.windows.size) return;
    ctx.settings.reminders = reminders().filter(r => r.at > now);
    ctx.saveSettings();
    due.forEach(fire);
  }, 15e3);
  ipcMain.on('open-url', (e, url) => { const w = W(e); if (w && /^https?:/.test(url)) ctx.createTab(w, url); });
  // أيقونة المتصفح (تُحمَّل من هنا حتى تصل بتحديث تلقائي صغير)
  try { require('./appicon')(ctx); } catch (e) { ctx.logLine('appicon failed', e); }
};
