// شاشة مقسومة حقيقية (Split View) داخل نفس النافذة — Ctrl+Shift+S أو زر الشريط
// يفتح موقعين جنباً إلى جنب بنفس جلسة الحساب وحجب الإعلانات، مع شريط عنوان صغير وتبديل النسبة والجانبين
const { app, WebContentsView, ipcMain } = require('electron');

const TOOLBAR_H = 92;
const SIDEBAR_W = 400;
const BAR_H = 36;
const GAP = 3;

const L = {
  ar: { ph: 'أدخل رابطاً أو ابحث للنافذة المقسومة…', swap: 'تبديل الجانبين', ratio: 'تغيير نسبة التقسيم', close: 'إغلاق الشاشة المقسومة', back: 'رجوع', reload: 'تحديث' },
  en: { ph: 'Enter URL or search for split pane…', swap: 'Swap sides', ratio: 'Cycle split ratio', close: 'Close split view', back: 'Back', reload: 'Reload' },
  de: { ph: 'URL oder Suche für geteilte Ansicht…', swap: 'Seiten tauschen', ratio: 'Teilung ändern', close: 'Geteilte Ansicht schließen', back: 'Zurück', reload: 'Neu laden' },
  fr: { ph: 'URL ou recherche pour le panneau divisé…', swap: 'Inverser les côtés', ratio: 'Changer le ratio', close: 'Fermer la vue divisée', back: 'Retour', reload: 'Actualiser' },
  es: { ph: 'URL o búsqueda para el panel dividido…', swap: 'Intercambiar lados', ratio: 'Cambiar proporción', close: 'Cerrar vista dividida', back: 'Atrás', reload: 'Recargar' },
  it: { ph: 'URL o ricerca per il pannello diviso…', swap: 'Scambia lati', ratio: 'Cambia proporzione', close: 'Chiudi vista divisa', back: 'Indietro', reload: 'Ricarica' },
  tr: { ph: 'Bölünmüş ekran için URL veya arama…', swap: 'Tarafları değiştir', ratio: 'Oranı değiştir', close: 'Bölünmüş görünümü kapat', back: 'Geri', reload: 'Yenile' }
};

function barScript(rect, url, lbl) {
  if (!rect) {
    return `(() => { const b = document.getElementById('mbxSplitBar'); if (b) b.remove(); const btn = document.getElementById('mbxSplit'); if (btn) btn.classList.remove('on'); })()`;
  }
  return `(() => {
    const R = ${JSON.stringify(rect)}, U = ${JSON.stringify(url || '')}, T = ${JSON.stringify(lbl)};
    const btn = document.getElementById('mbxSplit'); if (btn) btn.classList.add('on');
    let bar = document.getElementById('mbxSplitBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'mbxSplitBar';
      bar.style.cssText = 'position:fixed;z-index:40;display:flex;align-items:center;gap:5px;padding:0 8px;background:#10132A;border-bottom:1px solid rgba(255,255,255,.12);border-inline-start:2px solid var(--mbx,#7c9cff);box-sizing:border-box;font-family:inherit;';
      const mk = (txt, title, fn) => {
        const x = document.createElement('button'); x.type = 'button'; x.textContent = txt; x.title = title; x.setAttribute('aria-label', title);
        x.style.cssText = 'width:26px;height:26px;border:0;border-radius:7px;background:rgba(255,255,255,.06);color:#EEF0FF;cursor:pointer;font-size:13px;display:grid;place-items:center;flex:none;';
        x.onmouseenter = () => { x.style.background = 'rgba(255,255,255,.14)'; };
        x.onmouseleave = () => { x.style.background = 'rgba(255,255,255,.06)'; };
        x.onclick = fn; return x;
      };
      const inp = document.createElement('input');
      inp.id = 'mbxSplitUrl'; inp.type = 'text'; inp.dir = 'ltr'; inp.spellcheck = false; inp.placeholder = T.ph;
      inp.style.cssText = 'flex:1;min-width:60px;height:26px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#EEF0FF;padding:0 10px;font-size:12.5px;outline:none;';
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); window.mbExtras && window.mbExtras.splitGo(inp.value); inp.blur(); } });
      const bBack = mk('←', T.back, () => window.mbExtras && window.mbExtras.splitNav('back'));
      const bRel = mk('↻', T.reload, () => window.mbExtras && window.mbExtras.splitNav('reload'));
      const bRatio = mk('◧', T.ratio, () => window.mbExtras && window.mbExtras.splitRatio());
      const bSwap = mk('⇄', T.swap, () => window.mbExtras && window.mbExtras.splitSwap());
      const bClose = mk('✕', T.close, () => window.mbExtras && window.mbExtras.splitToggle());
      bar.append(bBack, bRel, inp, bRatio, bSwap, bClose);
      document.body.append(bar);
    }
    bar.style.left = R.x + 'px';
    bar.style.top = R.y + 'px';
    bar.style.width = R.width + 'px';
    bar.style.height = R.height + 'px';
    const inp = document.getElementById('mbxSplitUrl');
    if (inp && document.activeElement !== inp && U) inp.value = U;
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  const RATIOS = [0.5, 0.62, 0.38];

  function relayoutSplit(w) {
    if (!w || !w.win || w.win.isDestroyed() || !w._split) return;
    if (ctx.isBossActive && ctx.isBossActive()) return;
    const sp = w._split;
    if (!sp.view || sp.view.webContents.isDestroyed()) { w._split = null; return; }
    const { width, height } = w.win.getContentBounds();
    const sw = w.sidebarOpen ? SIDEBAR_W : 0;
    const baseX = ctx.isRTL() ? sw : 0;
    const availW = Math.max(0, width - sw);
    const availH = Math.max(0, height - TOOLBAR_H);
    const leftW = Math.max(240, Math.floor(availW * sp.ratio) - GAP);
    const rightX = baseX + leftW + GAP;
    const rightW = Math.max(240, availW - leftW - GAP);

    const leftBounds = { x: baseX, y: TOOLBAR_H, width: leftW, height: availH };
    const rightBounds = { x: rightX, y: TOOLBAR_H + BAR_H, width: rightW, height: Math.max(0, availH - BAR_H) };
    const barRect = { x: rightX, y: TOOLBAR_H, width: rightW, height: BAR_H };

    for (const id of w.order) {
      const tb = ctx.tabs.get(id);
      if (tb && ctx.alive(tb)) { try { tb.view.setBounds(leftBounds); } catch {} }
    }
    try { sp.view.setBounds(rightBounds); } catch {}
    try {
      const curUrl = sp.view.webContents.getURL() || sp.url || '';
      if (w.ui && !w.ui.webContents.isDestroyed()) {
        w.ui.webContents.executeJavaScript(barScript(barRect, curUrl, lbl())).catch(() => {});
      }
    } catch {}
  }

  function closeSplit(w) {
    if (!w || !w._split) return false;
    const sp = w._split;
    w._split = null;
    try { if (!w.win.isDestroyed()) w.win.contentView.removeChildView(sp.view); } catch {}
    try { if (!sp.view.webContents.isDestroyed()) sp.view.webContents.close(); } catch {}
    try { if (w.ui && !w.ui.webContents.isDestroyed()) w.ui.webContents.executeJavaScript(barScript(null, '', lbl())).catch(() => {}); } catch {}
    ctx.layout(w);
    return true;
  }

  function pickDefaultUrl(w) {
    // إن كان هناك تبويب آخر مفتوح، نعرض رابطه فوراً؛ وإلا نفتح جوجل
    for (const id of w.order) {
      if (id === w.activeId) continue;
      const tb = ctx.tabs.get(id);
      if (tb && ctx.alive(tb)) {
        const u = tb.sleeping ? tb.sleeping.url : tb.view.webContents.getURL();
        if (/^https?:\/\//i.test(u) && !/\.mybrowser\.invalid\b/i.test(u)) return u;
      }
    }
    return 'https://www.google.com/';
  }

  function openSplit(w, initialUrl) {
    if (!w || !w.win || w.win.isDestroyed()) return false;
    if (w._split) {
      if (initialUrl) {
        try { w._split.view.webContents.loadURL(ctx.toUrl(initialUrl)).catch(() => {}); } catch {}
      }
      relayoutSplit(w);
      return true;
    }
    const url = initialUrl ? ctx.toUrl(initialUrl) : pickDefaultUrl(w);
    const view = new WebContentsView({
      webPreferences: {
        session: ctx.sesOf(w),
        contextIsolation: true,
        sandbox: true,
        plugins: true
      }
    });
    const sp = { view, url, ratio: 0.5, ratioIdx: 0 };
    w._split = sp;
    w.win.contentView.addChildView(view);
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url: u }) => {
      if (u && /^https?:\/\//i.test(u)) wc.loadURL(u).catch(() => {});
      return { action: 'deny' };
    });
    const syncUrl = () => {
      try {
        if (!w._split || w._split !== sp || wc.isDestroyed()) return;
        sp.url = wc.getURL();
        relayoutSplit(w);
      } catch {}
    };
    wc.on('did-navigate', syncUrl);
    wc.on('did-navigate-in-page', syncUrl);
    wc.loadURL(url).catch(() => {});
    relayoutSplit(w);
    return true;
  }

  function toggleSplit(w, url) {
    if (!w) return { open: false };
    if (w._split) { closeSplit(w); return { open: false }; }
    openSplit(w, url);
    return { open: true };
  }

  ctx.relayoutSplit = relayoutSplit;
  ctx.toggleSplit = toggleSplit;
  ctx.openSplit = openSplit;

  ipcMain.handle('split:toggle', (e, url) => toggleSplit(ctx.W(e), url));
  ipcMain.handle('split:go', (e, input) => {
    const w = ctx.W(e);
    if (!w || !w._split || !input) return false;
    const u = ctx.toUrl(String(input).trim());
    w._split.view.webContents.loadURL(u).catch(() => {});
    return true;
  });
  ipcMain.handle('split:nav', (e, act) => {
    const w = ctx.W(e);
    if (!w || !w._split) return false;
    const wc = w._split.view.webContents;
    if (act === 'back' && wc.canGoBack()) wc.goBack();
    else if (act === 'reload') wc.reload();
    return true;
  });
  ipcMain.handle('split:ratio', (e) => {
    const w = ctx.W(e);
    if (!w || !w._split) return false;
    w._split.ratioIdx = (w._split.ratioIdx + 1) % RATIOS.length;
    w._split.ratio = RATIOS[w._split.ratioIdx];
    relayoutSplit(w);
    return true;
  });
  ipcMain.handle('split:swap', (e) => {
    const w = ctx.W(e);
    if (!w || !w._split) return false;
    const leftWc = ctx.activeWc(w);
    const rightWc = w._split.view.webContents;
    if (!leftWc || leftWc.isDestroyed() || rightWc.isDestroyed()) return false;
    const lu = leftWc.getURL(), ru = rightWc.getURL();
    if (/^https?:\/\//i.test(ru)) leftWc.loadURL(ru).catch(() => {});
    if (/^https?:\/\//i.test(lu)) rightWc.loadURL(lu).catch(() => {});
    return true;
  });

  // متابعة تغيير حجم النافذة وتبديل التبويبات واللوحة الجانبية والقوائم العائمة
  ctx.hooks.windowReady.push((w) => {
    if (w._splitHooked) return;
    w._splitHooked = true;
    w.win.on('resize', () => { if (w._split) setImmediate(() => relayoutSplit(w)); });
    w.win.on('closed', () => { if (w._split) { try { w._split.view.webContents.close(); } catch {} w._split = null; } });
  });
  ctx.hooks.tabActivated.push((w) => { if (w && w._split) setImmediate(() => relayoutSplit(w)); });
  ctx.hooks.tabCreated.push((w) => { if (w && w._split) setImmediate(() => relayoutSplit(w)); });
  ipcMain.on('sidebar', (e) => { const w = ctx.W(e); if (w && w._split) setTimeout(() => relayoutSplit(w), 40); });
  ipcMain.on('overlay', (e, open) => {
    const w = ctx.W(e);
    if (!w || !w._split || open) return;
    setTimeout(() => {
      try {
        if (w._split && w._split.view && !w.win.isDestroyed()) {
          w.win.contentView.addChildView(w._split.view);
          relayoutSplit(w);
        }
      } catch {}
    }, 30);
  });

  // اختصار Ctrl+Shift+S
  const ownerOf = (wc) => {
    for (const w of ctx.windows) {
      try {
        if (w.ui && w.ui.webContents === wc) return w;
        if (w._split && w._split.view && w._split.view.webContents === wc) return w;
      } catch {}
    }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 's') {
        const w = ownerOf(wc);
        if (w) { ev.preventDefault(); toggleSplit(w); }
      }
    });
  });
};
