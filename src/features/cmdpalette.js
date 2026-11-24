// شريط الأوامر السريع (Command Palette — Ctrl+K)
// بحث فوري في مكان واحد: التبويبات المفتوحة + أوامر المتصفح + مساحات العمل + الذاكرة بدون إنترنت + السجل
// صفر استهلاك في الخلفية: يُنشأ فقط عند الضغط على Ctrl+K ويُزال عند الإغلاق
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const L = {
  ar: {
    ph: 'ابحث في التبويبات أو الأوامر أو السجل… (Esc للإغلاق)',
    tab: 'تبويب', cmd: 'أمر', ws: 'مساحة عمل', snap: 'بدون إنترنت',
    cSplit: 'شاشة مقسومة (Ctrl+Shift+S)', cBoss: 'وضع الخصوصية الفوري (F9)', cClean: 'نسخ رابط نظيف (Ctrl+Shift+C)',
    cSnap: 'حفظ الصفحة بدون إنترنت (Ctrl+Shift+M)', cRadar: 'مراقبة سعر هذا المنتج', cSwitch: 'تبديل الحساب',
    cSleep: 'تنويم التبويبات الخلفية الآن', cWs: 'فتح مساحات العمل', cSnaps: 'فتح الذاكرة بدون إنترنت',
    cPrices: 'فتح مراقب الأسعار', cFocus: 'فتح مؤقّت الانضباط وكابح التشتّت', cClip: 'فتح الحافظة السريعة (Ctrl+Shift+V)',
    cHist: 'فتح السجل (Ctrl+H)', empty: 'لا توجد نتائج مطابقة'
  },
  en: {
    ph: 'Search tabs, commands, workspaces… (Esc to close)',
    tab: 'Tab', cmd: 'Command', ws: 'Workspace', snap: 'Offline',
    cSplit: 'Toggle Split View (Ctrl+Shift+S)', cBoss: 'Quick Privacy Mode (F9)', cClean: 'Copy clean link (Ctrl+Shift+C)',
    cSnap: 'Save offline snapshot (Ctrl+Shift+M)', cRadar: 'Watch product price', cSwitch: 'Switch account',
    cSleep: 'Sleep background tabs now', cWs: 'Open Workspaces', cSnaps: 'Open Offline Memory',
    cPrices: 'Open Price Drop Radar', cFocus: 'Open Site Time Budget', cClip: 'Open Clipboard Vault (Ctrl+Shift+V)',
    cHist: 'Open History (Ctrl+H)', empty: 'No matching results'
  },
  de: {
    ph: 'Tabs, Befehle, Bereiche durchsuchen… (Esc)',
    tab: 'Tab', cmd: 'Befehl', ws: 'Bereich', snap: 'Offline',
    cSplit: 'Geteilte Ansicht (Ctrl+Shift+S)', cBoss: 'Privatsphäre-Modus (F9)', cClean: 'Sauberen Link kopieren',
    cSnap: 'Seite offline speichern', cRadar: 'Produktpreis überwachen', cSwitch: 'Konto wechseln',
    cSleep: 'Hintergrund-Tabs schlafen legen', cWs: 'Arbeitsbereiche öffnen', cSnaps: 'Offline-Speicher öffnen',
    cPrices: 'Preis-Radar öffnen', cFocus: 'Zeitlimit-Wächter öffnen', cClip: 'Zwischenablage öffnen (Ctrl+Shift+V)',
    cHist: 'Verlauf öffnen (Ctrl+H)', empty: 'Keine Treffer'
  }
};

function modalScript(items, lbl, rtl) {
  return `(() => {
    const existing = document.getElementById('mbxCmdWrap');
    if (existing) { existing.remove(); window.mbExtras && window.mbExtras.cmdClose(); return; }
    const ITEMS = ${JSON.stringify(items)}, T = ${JSON.stringify(lbl)}, RTL = ${JSON.stringify(rtl)};
    const wrap = document.createElement('div');
    wrap.id = 'mbxCmdWrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(5,6,16,.58);backdrop-filter:blur(6px);display:flex;align-items:flex-start;justify-content:center;padding-top:110px;font-family:"Segoe UI Variable Text","Segoe UI","Noto Sans Arabic",system-ui,sans-serif;direction:' + (RTL ? 'rtl' : 'ltr') + ';';
    const box = document.createElement('div');
    box.style.cssText = 'width:min(600px,92vw);max-height:70vh;background:#11132A;border:1px solid rgba(139,124,255,.4);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.65);display:flex;flex-direction:column;overflow:hidden;color:#EEF0FF;';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = T.ph;
    inp.style.cssText = 'width:100%;height:50px;border:0;border-bottom:1px solid rgba(255,255,255,.1);background:transparent;color:#EEF0FF;padding:0 18px;font:inherit;font-size:15px;outline:none;box-sizing:border-box;';
    const list = document.createElement('div');
    list.style.cssText = 'overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:4px;max-height:56vh;';

    let filtered = ITEMS, sel = 0;
    const close = () => { wrap.remove(); window.mbExtras && window.mbExtras.cmdClose(); };
    const run = (it) => { if (!it) return; close(); window.mbExtras && window.mbExtras.cmdRun(it); };

    function render() {
      const q = inp.value.trim().toLowerCase();
      filtered = q ? ITEMS.filter(x => (x.title + ' ' + (x.sub || '')).toLowerCase().includes(q)) : ITEMS;
      if (sel >= filtered.length) sel = 0;
      list.innerHTML = '';
      if (!filtered.length) {
        const em = document.createElement('div');
        em.textContent = T.empty;
        em.style.cssText = 'padding:24px;text-align:center;color:#A3A8C8;font-size:13px;';
        list.append(em); return;
      }
      filtered.slice(0, 30).forEach((it, idx) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:10px;cursor:pointer;text-align:start;font:inherit;color:#EEF0FF;background:' + (idx === sel ? 'rgba(139,124,255,.24)' : 'transparent') + ';';
        const left = document.createElement('div');
        left.style.cssText = 'min-width:0;flex:1;';
        const b = document.createElement('div'); b.textContent = it.title; b.style.cssText = 'font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        left.append(b);
        if (it.sub) {
          const s = document.createElement('div'); s.textContent = it.sub; s.style.cssText = 'font-size:11.5px;color:#A3A8C8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          left.append(s);
        }
        const badge = document.createElement('span');
        badge.textContent = it.badge || '';
        badge.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#A3A8C8;flex:none;';
        row.append(left, badge);
        row.onmouseenter = () => { sel = idx; render(); };
        row.onclick = () => run(it);
        list.append(row);
      });
    }

    inp.addEventListener('input', () => { sel = 0; render(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, Math.min(30, filtered.length)); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + Math.max(1, Math.min(30, filtered.length))) % Math.max(1, Math.min(30, filtered.length)); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
    });
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    box.append(inp, list);
    wrap.append(box);
    document.body.append(wrap);
    render();
    inp.focus();
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };

  function buildItems(w) {
    const T = lbl();
    const items = [];
    // 1) التبويبات المفتوحة
    for (const id of w.order) {
      const tb = ctx.tabs.get(id);
      if (!tb || !ctx.alive(tb)) continue;
      const url = tb.sleeping ? tb.sleeping.url : tb.view.webContents.getURL();
      const title = tb.sleeping ? tb.sleeping.title : (tb.view.webContents.getTitle() || url);
      items.push({ kind: 'tab', id, title: (tb.sleeping ? '💤 ' : '') + String(title || url).slice(0, 80), sub: url, badge: T.tab });
    }
    // 2) الأوامر السريعة
    const cmds = [
      ['split', '◧ ' + T.cSplit],
      ['boss', '👁 ' + T.cBoss],
      ['clean', '🔗 ' + T.cClean],
      ['snap', '📸 ' + T.cSnap],
      ['radar', '🏷️ ' + T.cRadar],
      ['switch', '⇄ ' + T.cSwitch],
      ['sleep', '💤 ' + T.cSleep],
      ['workspaces', '🗂 ' + T.cWs],
      ['snapshots', '📚 ' + T.cSnaps],
      ['prices', '📉 ' + T.cPrices],
      ['focus', '⏱ ' + T.cFocus],
      ['clip', '📋 ' + T.cClip],
      ['history', '🕒 ' + T.cHist]
    ];
    for (const [id, title] of cmds) items.push({ kind: 'cmd', id, title, badge: T.cmd });

    // 3) مساحات العمل المحفوظة
    try {
      const pid = ctx.profileOf(w).id;
      const wsFile = path.join(app.getPath('userData'), 'workspaces', pid + '.json');
      const wsList = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
      if (Array.isArray(wsList)) {
        for (const ws of wsList.slice(0, 8)) {
          items.push({ kind: 'ws', id: ws.id, tabs: ws.tabs || [], title: '🗂 ' + ws.name, sub: (ws.tabs || []).length + ' tabs', badge: T.ws });
        }
      }
    } catch {}
    return items;
  }

  function restoreViews(w) {
    if (!w || !w.win || w.win.isDestroyed()) return;
    if (ctx.isBossActive && ctx.isBossActive()) return;
    const cur = ctx.activeTab(w);
    if (cur && ctx.alive(cur)) { try { w.win.contentView.addChildView(cur.view); } catch {} }
    if (w._split && w._split.view && !w._split.view.webContents.isDestroyed()) {
      try { w.win.contentView.addChildView(w._split.view); } catch {}
    }
  }

  function openPalette(w) {
    if (!w || !w.win || w.win.isDestroyed() || !w.ui || w.ui.webContents.isDestroyed()) return;
    try { w.win.contentView.addChildView(w.ui); } catch {}
    w.ui.webContents.focus();
    w.ui.webContents.executeJavaScript(modalScript(buildItems(w), lbl(), ctx.isRTL())).catch(() => {});
  }

  ctx.openCommandPalette = openPalette;

  ipcMain.handle('cmd:close', (e) => { restoreViews(ctx.W(e)); return true; });
  ipcMain.handle('cmd:run', (e, it) => {
    const w = ctx.W(e);
    restoreViews(w);
    if (!w || !it) return false;
    if (it.kind === 'tab') { ctx.switchTab(w, it.id); return true; }
    if (it.kind === 'ws' && Array.isArray(it.tabs)) {
      it.tabs.forEach((t, i) => { try { ctx.createTab(w, t.url, i === 0); } catch {} });
      return true;
    }
    if (it.kind === 'cmd') {
      const map = {
        split: () => ctx.toggleSplit && ctx.toggleSplit(w),
        boss: () => ctx.toggleBossKey && ctx.toggleBossKey(),
        clean: () => ctx.copyCleanLink && ctx.copyCleanLink(w),
        snap: () => ctx.captureSnapshot && ctx.captureSnapshot(w),
        radar: () => ctx.watchPriceActive && ctx.watchPriceActive(w),
        switch: () => ctx.showAccountChooser && ctx.showAccountChooser(),
        sleep: () => { const n = ctx.sleepIdleNow ? ctx.sleepIdleNow(w) : 0; ctx.toast(`💤 ${n}`, w); },
        workspaces: () => ctx.openWorkspaces && ctx.openWorkspaces(w),
        snapshots: () => ctx.openSnapshots && ctx.openSnapshots(w),
        prices: () => ctx.openPriceRadar && ctx.openPriceRadar(w),
        focus: () => ctx.openFocusGuard && ctx.openFocusGuard(w),
        clip: () => ctx.openClipVault && ctx.openClipVault(w),
        history: () => ctx.openHistory && ctx.openHistory(w)
      };
      if (map[it.id]) map[it.id]();
    }
    return true;
  });

  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && !input.shift && !input.alt && input.key && input.key.toLowerCase() === 'k') {
        const w = ownerOf(wc);
        if (w) { ev.preventDefault(); openPalette(w); }
      }
    });
  });
};
