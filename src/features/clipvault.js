// الحافظة السريعة المؤقتة داخل المتصفح (Quick Clipboard Vault — Ctrl+Shift+V)
// تحفظ آخر 15 نصاً/رابطاً في الرام فقط وتُمسح تلقائياً عند إغلاق المتصفح (صفر مساحة قرص، وتجاهل كلمات السر والمواقع الحساسة)
const { app, clipboard, ipcMain } = require('electron');

const MAX = 15;
const L = {
  ar: { title: 'الحافظة السريعة (آخر النصوص المنسوخة)', empty: 'الحافظة فارغة حالياً — انسخ أي نص أو رابط داخل المتصفح', copied: 'تم النسخ للحافظة (اضغط Ctrl+V للصق)', clear: 'مسح الكل' },
  en: { title: 'Quick Clipboard Vault (Recent copies)', empty: 'Clipboard vault is empty — copy any text or link in the browser', copied: 'Copied to clipboard (press Ctrl+V to paste)', clear: 'Clear all' },
  de: { title: 'Zwischenablage-Verlauf', empty: 'Noch keine Einträge kopiert', copied: 'Kopiert (Strg+V zum Einfügen)', clear: 'Leeren' }
};

function looksSecret(s) {
  if (!s || s.length > 2000) return true;
  if (/^(sk-|ghp_|gho_|AIza|AKIA|-----BEGIN )/i.test(s)) return true;
  // كلمة مرور عشوائية بدون مسافات بطول 10-40 تحتوي رموزاً وأرقاماً بدون http
  if (!/^https?:\/\//i.test(s) && !/\s/.test(s) && s.length >= 10 && s.length <= 40 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s)) return true;
  return false;
}

function vaultScript(items, lbl, rtl) {
  return `(() => {
    const ex = document.getElementById('mbxClipWrap');
    if (ex) { ex.remove(); window.mbExtras && window.mbExtras.clipClose(); return; }
    const ITEMS = ${JSON.stringify(items)}, T = ${JSON.stringify(lbl)}, RTL = ${JSON.stringify(rtl)};
    const wrap = document.createElement('div');
    wrap.id = 'mbxClipWrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(5,6,16,.55);backdrop-filter:blur(5px);display:flex;align-items:flex-start;justify-content:center;padding-top:110px;font-family:"Segoe UI Variable Text","Segoe UI","Noto Sans Arabic",system-ui,sans-serif;direction:' + (RTL ? 'rtl' : 'ltr') + ';';
    const box = document.createElement('div');
    box.style.cssText = 'width:min(540px,92vw);max-height:68vh;background:#11132A;border:1px solid rgba(46,230,214,.38);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.65);display:flex;flex-direction:column;overflow:hidden;color:#EEF0FF;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:600;font-size:14px;';
    const title = document.createElement('span'); title.textContent = '📋 ' + T.title;
    const clr = document.createElement('button'); clr.type = 'button'; clr.textContent = T.clear;
    clr.style.cssText = 'border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#A3A8C8;border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-size:12px;';
    const close = () => { wrap.remove(); window.mbExtras && window.mbExtras.clipClose(); };
    clr.onclick = () => { window.mbExtras && window.mbExtras.clipClear(); close(); };
    head.append(title, clr);
    const list = document.createElement('div');
    list.style.cssText = 'overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;';
    if (!ITEMS.length) {
      const em = document.createElement('div'); em.textContent = T.empty; em.style.cssText = 'padding:28px;text-align:center;color:#A3A8C8;font-size:13px;';
      list.append(em);
    } else {
      ITEMS.forEach((txt, idx) => {
        const b = document.createElement('button'); b.type = 'button';
        b.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.03);color:#EEF0FF;cursor:pointer;text-align:start;font:inherit;font-size:13px;';
        b.onmouseenter = () => { b.style.background = 'rgba(139,124,255,.2)'; };
        b.onmouseleave = () => { b.style.background = 'rgba(255,255,255,.03)'; };
        const num = document.createElement('span'); num.textContent = idx < 9 ? (idx + 1) : '•';
        num.style.cssText = 'width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,.08);color:#2EE6D6;display:grid;place-items:center;font-size:11.5px;flex:none;font-weight:700;';
        const s = document.createElement('span'); s.textContent = txt.replace(/\\s+/g, ' ').slice(0, 140);
        s.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
        b.append(num, s);
        b.onclick = () => { close(); window.mbExtras && window.mbExtras.clipPick(idx); };
        list.append(b);
      });
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); document.removeEventListener('keydown', onKey); close(); }
      else if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1;
        if (ITEMS[i] != null) { e.preventDefault(); document.removeEventListener('keydown', onKey); close(); window.mbExtras && window.mbExtras.clipPick(i); }
      }
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) { document.removeEventListener('keydown', onKey); close(); } });
    box.append(head, list);
    wrap.append(box);
    document.body.append(wrap);
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  let history = [];
  let lastSeen = '';

  // التقاط هادئ للنصوص المنسوخة فقط أثناء التركيز على المتصفح (في الرام فقط)
  setInterval(() => {
    try {
      const focused = [...ctx.windows].find(w => w.win && !w.win.isDestroyed() && w.win.isFocused());
      if (!focused) return;
      const wc = ctx.activeWc(focused);
      const url = wc ? wc.getURL() : '';
      if (ctx.isSensitive && ctx.isSensitive(url)) return;
      const cur = String(clipboard.readText() || '').trim();
      if (!cur || cur === lastSeen || looksSecret(cur)) return;
      lastSeen = cur;
      history = [cur, ...history.filter(x => x !== cur)].slice(0, MAX);
    } catch {}
  }, 1400);

  function restoreViews(w) {
    if (!w || !w.win || w.win.isDestroyed()) return;
    if (ctx.isBossActive && ctx.isBossActive()) return;
    const cur = ctx.activeTab(w);
    if (cur && ctx.alive(cur)) { try { w.win.contentView.addChildView(cur.view); } catch {} }
    if (w._split && w._split.view && !w._split.view.webContents.isDestroyed()) {
      try { w.win.contentView.addChildView(w._split.view); } catch {}
    }
  }

  function openVault(w) {
    if (!w || !w.win || w.win.isDestroyed() || !w.ui || w.ui.webContents.isDestroyed()) return;
    try { w.win.contentView.addChildView(w.ui); } catch {}
    w.ui.webContents.focus();
    w.ui.webContents.executeJavaScript(vaultScript(history, lbl(), ctx.isRTL())).catch(() => {});
  }
  ctx.openClipVault = openVault;

  ipcMain.handle('clip:close', (e) => { restoreViews(ctx.W(e)); return true; });
  ipcMain.handle('clip:clear', () => { history = []; return true; });
  ipcMain.handle('clip:pick', (e, idx) => {
    const w = ctx.W(e);
    restoreViews(w);
    const val = history[idx];
    if (!val) return false;
    lastSeen = val;
    try { clipboard.writeText(val); } catch {}
    ctx.toast(`📋 ${lbl().copied}`, w);
    return true;
  });

  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'v') {
        const w = ownerOf(wc);
        if (w) { ev.preventDefault(); openVault(w); }
      }
    });
  });
};
