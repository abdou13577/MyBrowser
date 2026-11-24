// مؤقّت الانضباط وكابح التشتّت (Site Time Budget / Focus Guard)
// يتابع وقتك اليومي على المواقع التي تحددها فقط (فحص خفيف كل 15 ثانية أثناء التركيز)، ويُظهر تذكيراً لطيفاً عند انتهاء الوقت
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const FOCUS_URL = 'https://focus.mybrowser.invalid/';
const TICK_SEC = 15;

const L = {
  ar: { title: 'انتهى وقتك اليومي لهذا الموقع', sub: (d, m) => `قضيت ${m} دقيقة اليوم على ${d}`, snooze: '+5 دقائق إضافية', leave: 'العودة لصفحة البداية' },
  en: { title: 'Daily time budget reached', sub: (d, m) => `You spent ${m} min today on ${d}`, snooze: '+5 extra minutes', leave: 'Go back' },
  de: { title: 'Tageslimit erreicht', sub: (d, m) => `Du hast heute ${m} Min. auf ${d} verbracht`, snooze: '+5 Minuten', leave: 'Zurück' }
};

function pauseScript(domain, mins, lbl, rtl) {
  return `(() => {
    if (window.__mbFocusSnooze && Date.now() < window.__mbFocusSnooze) return;
    if (document.getElementById('__mbFocusGate')) return;
    const gate = document.createElement('div');
    gate.id = '__mbFocusGate';
    gate.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(9,10,22,.96);backdrop-filter:blur(12px);color:#EEF0FF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:15px/1.5 "Segoe UI","Noto Sans Arabic",system-ui,sans-serif;text-align:center;padding:24px;direction:' + (${JSON.stringify(rtl)} ? 'rtl' : 'ltr') + ';';
    const ic = document.createElement('div'); ic.textContent = '⏱'; ic.style.cssText = 'font-size:48px;';
    const h = document.createElement('h2'); h.textContent = ${JSON.stringify(lbl.title)}; h.style.cssText = 'margin:0;font-size:24px;';
    const p = document.createElement('p'); p.textContent = ${JSON.stringify(lbl.sub(domain, mins))}; p.style.cssText = 'margin:0;color:#A3A8C8;font-size:15px;';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center;';
    const b1 = document.createElement('button'); b1.type = 'button'; b1.textContent = ${JSON.stringify(lbl.snooze)};
    b1.style.cssText = 'height:40px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#EEF0FF;cursor:pointer;font:inherit;font-weight:600;';
    b1.onclick = () => { window.__mbFocusSnooze = Date.now() + 5 * 60 * 1000; gate.remove(); };
    const b2 = document.createElement('button'); b2.type = 'button'; b2.textContent = ${JSON.stringify(lbl.leave)};
    b2.style.cssText = 'height:40px;padding:0 20px;border-radius:12px;border:0;background:linear-gradient(120deg,#8B7CFF,#4F8CFF 55%,#2EE6D6);color:#090A16;cursor:pointer;font:inherit;font-weight:700;';
    b2.onclick = () => { history.length > 1 ? history.back() : (location.href = 'about:blank'); };
    row.append(b2, b1);
    gate.append(ic, h, p, row);
    document.documentElement.append(gate);
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  const today = () => new Date().toISOString().slice(0, 10);
  const file = () => path.join(app.getPath('userData'), 'focusguard.json');

  let state = { limits: {}, day: today(), used: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (raw && typeof raw === 'object') {
      state.limits = raw.limits || {};
      if (raw.day === today()) state.used = raw.used || {};
    }
  } catch {}
  const save = () => { try { fs.writeFileSync(file(), JSON.stringify(state, null, 2)); } catch {} };

  const normDomain = (raw) => {
    let s = String(raw || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : '';
  };
  const matchLimit = (host) => {
    const h = String(host || '').toLowerCase().replace(/^www\./, '');
    for (const dom of Object.keys(state.limits)) {
      if (h === dom || h.endsWith('.' + dom)) return dom;
    }
    return '';
  };

  // فحص خفيف كل 15 ثانية فقط عندما تكون نافذة المتصفح نشطة
  setInterval(() => {
    if (!Object.keys(state.limits).length) return;
    if (state.day !== today()) { state.day = today(); state.used = {}; save(); }
    const focused = [...ctx.windows].find(w => w.win && !w.win.isDestroyed() && w.win.isFocused());
    if (!focused) return;
    const wc = ctx.activeWc(focused);
    if (!wc || wc.isDestroyed()) return;
    let host = '';
    try { const u = wc.getURL(); if (/^https?:\/\//i.test(u)) host = new URL(u).hostname; } catch { return; }
    const dom = matchLimit(host);
    if (!dom) return;
    state.used[dom] = (state.used[dom] || 0) + TICK_SEC;
    if (state.used[dom] % 60 === 0) save();
    const limitMin = Number(state.limits[dom]) || 0;
    if (limitMin > 0 && state.used[dom] >= limitMin * 60) {
      const mins = Math.round(state.used[dom] / 60);
      wc.executeJavaScript(pauseScript(dom, mins, lbl(), ctx.isRTL())).catch(() => {});
    }
  }, TICK_SEC * 1000);

  let fwin = null;
  const appIcon = () => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } };
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };

  function openFocusGuard() {
    if (fwin && !fwin.isDestroyed()) { if (fwin.isMinimized()) fwin.restore(); fwin.show(); fwin.focus(); return; }
    fwin = new BrowserWindow({
      width: 720, height: 600, minWidth: 480, minHeight: 400, title: 'Focus Guard',
      autoHideMenuBar: true, backgroundColor: '#090A16', icon: appIcon(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    fwin.loadFile(path.join(__dirname, '..', 'ui', 'focusguard.html'), { query: { lang: ctx.lang() } });
    fwin.on('closed', () => { fwin = null; });
  }
  ctx.openFocusGuard = openFocusGuard;

  ipcMain.handle('focus:get', () => {
    if (state.day !== today()) { state.day = today(); state.used = {}; save(); }
    return { limits: state.limits, used: state.used };
  });
  ipcMain.handle('focus:set', (_e, { domain, minutes } = {}) => {
    const dom = normDomain(domain);
    const m = Math.max(1, Math.min(480, Math.round(Number(minutes) || 0)));
    if (!dom || !m) return { ok: false };
    state.limits[dom] = m; save();
    return { ok: true };
  });
  ipcMain.handle('focus:remove', (_e, domain) => {
    delete state.limits[domain]; save();
    return true;
  });

  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(FOCUS_URL)) { ev.preventDefault(); if (ownerOf(wc)) openFocusGuard(); } });
  });
};
