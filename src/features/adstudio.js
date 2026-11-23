// استوديو الإعلانات: صور وفيديوهات إعلانية احترافية من صور المستخدم
// مجاني بالكامل: التركيب والحركة في المتصفح، والذكاء الاصطناعي (كتابة النص والسيناريو) عبر مفتاح المستخدم.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const STUDIO_URL = 'https://adstudio.mybrowser.invalid/';

module.exports = (ctx) => {
  let win = null;
  function openStudio() {
    if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
    win = new BrowserWindow({
      width: 1180, height: 820, minWidth: 900, minHeight: 600, title: 'Ad Studio', autoHideMenuBar: true, backgroundColor: '#090A16',
      icon: (() => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } })(),
      webPreferences: { preload: path.join(__dirname, '..', 'adstudio-preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false }
    });
    win.loadFile(path.join(__dirname, '..', 'ui', 'adstudio.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => { win = null; });
  }
  ctx.openAdStudio = openStudio;

  // زر «استوديو الإعلانات» في صفحة البداية يفتحه، وكذلك Ctrl+Shift+D
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(STUDIO_URL)) { ev.preventDefault(); openStudio(); } });
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'd') { ev.preventDefault(); openStudio(); }
    });
  });

  const isStudio = (e) => win && !win.isDestroyed() && e.sender === win.webContents;

  ipcMain.handle('ad:haskey', () => !!ctx.getApiKey());

  // كتابة النص الإعلاني والسيناريو بالذكاء الاصطناعي (JSON صارم)
  ipcMain.handle('ad:ai', async (e, req) => {
    if (!isStudio(e)) return { error: 'DENIED' };
    const { kind, brief, nImages } = req || {};
    const langName = ctx.langName ? ctx.langName() : 'the user language';
    const sys = `You are an expert advertising creative director and copywriter. Write punchy, professional ad copy in ${langName} (match the brief's language if different). Output STRICTLY one JSON object, no markdown, no commentary.`;
    let prompt;
    if (kind === 'video') {
      prompt = `Create a short social-media VIDEO ad from ${nImages || 1} user photo(s). Brief: """${(brief || '').slice(0, 1500)}""".\n` +
        `Return JSON: {"headline": "<=6 words hook", "scenes": [{"image": <0-based photo index to show>, "caption": "<=7 words on-screen text", "seconds": 2.2}], "cta": "<=4 words call to action", "palette": {"bg":"#RRGGBB","accent":"#RRGGBB","text":"#FFFFFF"}}.\n` +
        `Make 3 to 5 scenes, cycling through the available photo indices (0..${(nImages || 1) - 1}). Keep captions benefit-driven and energetic. Colors should feel premium and match the product mood.`;
    } else {
      prompt = `Create a static social-media IMAGE ad (poster) from 1 user photo. Brief: """${(brief || '').slice(0, 1500)}""".\n` +
        `Return JSON: {"headline": "<=6 words bold hook", "subheadline": "<=12 words supporting line", "cta": "<=4 words", "palette": {"accent":"#RRGGBB","text":"#FFFFFF"}}. Make it feel premium and conversion-focused.`;
    }
    try {
      const raw = await ctx.askClaude(sys, [{ role: 'user', content: prompt }], 1200);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return { error: 'PARSE' };
      return { data: JSON.parse(m[0]) };
    } catch (err) {
      return { error: err.message === 'NO_KEY' ? 'NO_KEY' : (err.message || 'FAIL') };
    }
  });

  // حفظ الناتج (صورة PNG أو فيديو) في مجلد الصور/الفيديوهات
  ipcMain.handle('ad:save', async (e, { buffer, ext, kind }) => {
    if (!isStudio(e)) return { ok: false };
    try {
      const base = kind === 'video' ? app.getPath('videos') : app.getPath('pictures');
      const dir = path.join(base, 'MyBrowser Ads');
      fs.mkdirSync(dir, { recursive: true });
      const name = `ad-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
      const file = path.join(dir, name);
      fs.writeFileSync(file, Buffer.from(buffer));
      return { ok: true, file };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('ad:reveal', (e, file) => { if (isStudio(e) && file) shell.showItemInFolder(file); return true; });
};
