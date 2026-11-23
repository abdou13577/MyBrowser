// إصلاح «تسجيل الدخول عبر فيسبوك» في إنستغرام/تيك توك
// السبب المعروف: نافذة فيسبوك المنبثقة تفقد window.opener بسبب سياسة COOP بعد إعادة التوجيه،
// فلا يصل الرمز إلى إنستغرام/تيك توك وتُغلق النافذة وتعود لتسجيل الدخول.
// الحل: تخفيف عزل COOP حتى يبقى opener حياً، مع تسجيل تشخيصي لنافذة الدخول.
const { app } = require('electron');

// يجب ضبط مفاتيح كروميوم قبل جاهزية التطبيق (ملفات الميزات تُحمَّل في هذه اللحظة)
try {
  const prev = app.commandLine.getSwitchValue('disable-features');
  const add = ['CrossOriginOpenerPolicy', 'CrossOriginOpenerPolicyByDefault', 'CrossOriginEmbedderPolicy'];
  const all = [...new Set((prev ? prev.split(',') : []).concat(add).filter(Boolean))];
  app.commandLine.appendSwitch('disable-features', all.join(','));
} catch {}

const FB_AUTH = /facebook\.com\/(v\d|dialog\/oauth|connect|login|x\/oauth|privacy|checkpoint|oauth)/i;
const isFbAuth = (u) => { try { return FB_AUTH.test(u) || /\/\/(www\.|m\.|web\.)?facebook\.com\/(login|dialog)/i.test(u); } catch { return false; } };

module.exports = (ctx) => {
  // تشخيص دورة حياة نافذة دخول فيسبوك المنبثقة (يساعد على تحديد أي خلل متبقٍّ بدقّة)
  app.on('browser-window-created', (_e, win) => {
    const wc = win.webContents;
    let fb = false, opened = Date.now();
    const mark = (u) => { if (!fb && isFbAuth(u)) { fb = true; opened = Date.now(); ctx.logLine('FB-POPUP open', u); try { win.show(); win.focus(); } catch {} } };
    try { mark(wc.getURL()); } catch {}
    wc.on('did-start-navigation', (_ev, u, inPage, isMain) => { if (isMain) mark(u); });
    wc.on('did-navigate', (_ev, u) => { if (fb) ctx.logLine('FB-POPUP nav', u); else mark(u); });
    wc.on('did-fail-load', (_ev, ec, desc, u, isMain) => { if (fb && isMain && ec !== -3) ctx.logLine('FB-POPUP fail', ec, desc, u); });
    win.on('close', () => { if (fb) ctx.logLine('FB-POPUP closed after', (Date.now() - opened) + 'ms', 'url=', (() => { try { return wc.getURL(); } catch { return '?'; } })()); });
  });
  ctx.logLine('fblogin: COOP relaxed for Facebook OAuth popups');
};
module.exports.isFbAuth = isFbAuth;
