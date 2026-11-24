// أيقونة المتصفح: تُرسم من ملف SVG (نص) داخل البرنامج، فيمكن تغييرها بتحديث تلقائي عادي
// - أيقونة النوافذ وشريط المهام: تُضبط عند كل تشغيل
// - أيقونة الاختصارات (سطح المكتب وقائمة ابدأ): نكتب icon.ico بجانب البرنامج ونحدّث ذاكرة الأيقونات في ويندوز
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const SVG_FILE = path.join(__dirname, '..', 'assets', 'icon.svg');

async function render(svg, size) {
  const w = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`));
    await new Promise(r => setTimeout(r, 300));
    return (await w.capturePage()).resize({ width: size, height: size, quality: 'best' });
  } finally { w.destroy(); }
}
// ملف ICO يحتوي صور PNG بعدة مقاسات
function toIco(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = [], data = [];
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    offset += png.length; dir.push(e); data.push(png);
  }
  return Buffer.concat([head, ...dir, ...data]);
}

module.exports = (ctx) => {
  try { require('./pipfix')(ctx); } catch (e) { ctx.logLine('pipfix failed', e); }
  try { require('./apps')(ctx); } catch (e) { ctx.logLine('apps failed', e); }
  try { require('./chooser')(ctx); } catch (e) { ctx.logLine('chooser failed', e); }
  try { require('./adstudio')(ctx); } catch (e) { ctx.logLine('adstudio failed', e); }
  try { require('./find')(ctx); } catch (e) { ctx.logLine('find failed', e); }
  try { require('./recent')(ctx); } catch (e) { ctx.logLine('recent failed', e); }
  try { require('./history')(ctx); } catch (e) { ctx.logLine('history failed', e); }
  try { require('./downloads')(ctx); } catch (e) { ctx.logLine('downloads failed', e); }
  try { require('./backup')(ctx); } catch (e) { ctx.logLine('backup failed', e); }
  try { require('./translate')(ctx); } catch (e) { ctx.logLine('translate failed', e); }
  try { require('./fblogin')(ctx); } catch (e) { ctx.logLine('fblogin failed', e); }
  let icon = null, icoReady = '';
  const icoPath = path.join(path.dirname(process.execPath), 'icon.ico');
  const apply = (w) => {
    try {
      if (!w.win || w.win.isDestroyed()) return;
      if (icon) w.win.setIcon(icon);
      // التثبيت على شريط المهام يأخذ الأيقونة من هنا (وإلا يأخذ أيقونة ملف البرنامج القديمة)
      if (icoReady && typeof w.win.setAppDetails === 'function') {
        w.win.setAppDetails({ appId: 'com.personal.mybrowser', appIconPath: icoReady, appIconIndex: 0,
          relaunchCommand: `"${process.execPath}"`, relaunchDisplayName: 'MyBrowser' });
      }
    } catch (e) {}
  };
  ctx.hooks.windowReady.push(apply);
  app.whenReady().then(async () => {
    try {
      const svg = fs.readFileSync(SVG_FILE, 'utf8');
      const big = await render(svg, 256);
      icon = big;
      if (process.platform === 'win32' && app.isPackaged) {
        const stamp = require('crypto').createHash('sha256').update(svg).digest('hex').slice(0, 16);
        if (ctx.settings.iconStamp !== stamp || !fs.existsSync(icoPath)) {
          const pngs = [256, 64, 48, 32, 24, 16].map(s => ({ size: s, png: (s === 256 ? big : big.resize({ width: s, height: s, quality: 'best' })).toPNG() }));
          fs.writeFileSync(icoPath, toIco(pngs));
          // تحديث ذاكرة الأيقونات حتى يظهر الشكل الجديد على سطح المكتب بدون إعادة تشغيل الجهاز
          try { cp.spawn('ie4uinit.exe', ['-show'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch (e) {}
          ctx.settings.iconStamp = stamp; ctx.saveSettings();
          ctx.logLine('ICON updated', stamp);
        }
        icoReady = icoPath;
      }
      for (const w of ctx.windows) apply(w);
    } catch (e) { ctx.logLine('ICON failed', e); }
  });
};
module.exports.render = render;
module.exports.toIco = toIco;
