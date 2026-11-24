// إضافات الحسابات: لون نافذة لكل حساب، زر تبديل الحساب في أي وقت، صفحات بدء مخصصة لكل حساب.
// + إصلاح خطأ "Script failed to execute" المتكرر في السجل (وعود executeJavaScript غير المعالجة).
// مستقلة عن main.js: تضيف واجهتها إلى نافذة الواجهة بعد تحميلها.
const { app, ipcMain, webContents } = require('electron');

const COLORS = ['#7c9cff', '#8B7CFF', '#4dd0e1', '#3ecf8e', '#ffd166', '#ff9f5a', '#ff6b7e', '#e07cff'];
const HEX = /^#[0-9a-f]{6}$/i;

const L = {
  ar: { switch: 'تبديل الحساب', color: 'لون النافذة', pages: 'صفحات البدء المخصصة (رابط في كل سطر)', addCur: '+ الصفحة الحالية', save: 'حفظ', saved: 'تم الحفظ', ph: 'youtube.com\nmail.google.com', split: 'شاشة مقسومة (Ctrl+Shift+S)', clean: 'نسخ رابط نظيف بدون تتبع (Ctrl+Shift+C)', snap: 'حفظ الصفحة بدون إنترنت (Ctrl+Shift+M)', radar: 'مراقبة سعر هذا المنتج', boss: 'وضع الخصوصية الفوري (F9)' },
  en: { switch: 'Switch account', color: 'Window color', pages: 'Custom startup pages (one URL per line)', addCur: '+ Current page', save: 'Save', saved: 'Saved', ph: 'youtube.com\nmail.google.com', split: 'Split View (Ctrl+Shift+S)', clean: 'Copy clean link (Ctrl+Shift+C)', snap: 'Save offline snapshot (Ctrl+Shift+M)', radar: 'Watch product price', boss: 'Quick Privacy Mode (F9)' },
  de: { switch: 'Konto wechseln', color: 'Fensterfarbe', pages: 'Eigene Startseiten (eine URL pro Zeile)', addCur: '+ Aktuelle Seite', save: 'Speichern', saved: 'Gespeichert', ph: 'youtube.com\nmail.google.com', split: 'Geteilte Ansicht (Ctrl+Shift+S)', clean: 'Sauberen Link kopieren (Ctrl+Shift+C)', snap: 'Seite offline speichern (Ctrl+Shift+M)', radar: 'Produktpreis überwachen', boss: 'Privatsphäre-Modus (F9)' },
  fr: { switch: 'Changer de compte', color: 'Couleur de la fenêtre', pages: 'Pages de démarrage (une URL par ligne)', addCur: '+ Page actuelle', save: 'Enregistrer', saved: 'Enregistré', ph: 'youtube.com\nmail.google.com', split: 'Vue divisée (Ctrl+Shift+S)', clean: 'Copier lien propre (Ctrl+Shift+C)', snap: 'Enregistrer hors ligne (Ctrl+Shift+M)', radar: 'Suivre le prix', boss: 'Mode confidentialité (F9)' },
  es: { switch: 'Cambiar de cuenta', color: 'Color de la ventana', pages: 'Páginas de inicio (una URL por línea)', addCur: '+ Página actual', save: 'Guardar', saved: 'Guardado', ph: 'youtube.com\nmail.google.com', split: 'Vista dividida (Ctrl+Shift+S)', clean: 'Copiar enlace limpio (Ctrl+Shift+C)', snap: 'Guardar sin conexión (Ctrl+Shift+M)', radar: 'Vigilar precio', boss: 'Modo privacidad (F9)' },
  it: { switch: 'Cambia account', color: 'Colore finestra', pages: 'Pagine iniziali (un URL per riga)', addCur: '+ Pagina attuale', save: 'Salva', saved: 'Salvato', ph: 'youtube.com\nmail.google.com', split: 'Vista divisa (Ctrl+Shift+S)', clean: 'Copia link pulito (Ctrl+Shift+C)', snap: 'Salva offline (Ctrl+Shift+M)', radar: 'Monitora prezzo', boss: 'Modalità privacy (F9)' },
  tr: { switch: 'Hesap değiştir', color: 'Pencere rengi', pages: 'Özel açılış sayfaları (her satıra bir URL)', addCur: '+ Geçerli sayfa', save: 'Kaydet', saved: 'Kaydedildi', ph: 'youtube.com\nmail.google.com', split: 'Bölünmüş ekran (Ctrl+Shift+S)', clean: 'Temiz bağlantı kopyala (Ctrl+Shift+C)', snap: 'Çevrimdışı kaydet (Ctrl+Shift+M)', radar: 'Fiyatı izle', boss: 'Gizlilik Modu (F9)' }
};

const CSS = `
  #mbxSwitch {
    width: 34px; height: 34px; border: 1px solid color-mix(in srgb, var(--mbx, #7c9cff) 38%, rgba(255,255,255,.12));
    border-radius: 50%; background: color-mix(in srgb, var(--mbx, #7c9cff) 14%, transparent);
    color: #EEF0FF; cursor: pointer; display: grid; place-items: center; flex-shrink: 0;
    transition: background .15s, border-color .15s, transform .12s;
  }
  #mbxSwitch:hover { background: color-mix(in srgb, var(--mbx, #7c9cff) 28%, rgba(255,255,255,.08)); border-color: var(--mbx, #7c9cff); color: #fff; }
  #mbxSwitch:active { transform: scale(.95); }
  #mbxSwitch svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.85; stroke-linecap: round; stroke-linejoin: round; }
  #toolbar {
    position: relative;
    background:
      radial-gradient(560px 120px at 10% -40%, color-mix(in srgb, var(--mbx, #7c9cff) 32%, transparent), transparent 72%),
      linear-gradient(180deg, color-mix(in srgb, var(--mbx, #7c9cff) 26%, #0C0E20), color-mix(in srgb, var(--mbx, #7c9cff) 9%, #090A16)) !important;
  }
  #toolbar::before {
    content: ''; position: absolute; inset: 0 0 auto 0; height: 3px;
    background: var(--mbx, #7c9cff); pointer-events: none; z-index: 5;
  }
  #toolbar::after {
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--mbx, #7c9cff) 65%, transparent), transparent) !important;
  }
  .tab.active {
    border-color: color-mix(in srgb, var(--mbx, #7c9cff) 45%, rgba(255,255,255,.12)) !important;
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--mbx, #7c9cff) 35%, rgba(255,255,255,.12)), 0 4px 14px rgba(0,0,0,.25) !important;
  }
  #profileMenu { max-height: 86vh; overflow: auto; }
  #mbxBox { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,.1); border-bottom: 1px solid rgba(255,255,255,.1); margin: 6px 0; }
  #mbxBox label { font-size: 12px; opacity: .78; }
  #mbxSw { display: flex; gap: 8px; flex-wrap: wrap; }
  #mbxSw i { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform .12s, border-color .12s; }
  #mbxSw i:hover { transform: scale(1.12); }
  #mbxSw i.on { border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,.22); }
  #mbxPages { width: 100%; min-height: 66px; resize: vertical; border-radius: 8px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); color: inherit; padding: 6px 8px; font-size: 12.5px; direction: ltr; font-family: inherit; }
  #mbxPages:focus { outline: 2px solid var(--mbx, #7c9cff); outline-offset: 1px; }
  #mbxActs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  #mbxSave { height: 30px; padding: 0 14px; border-radius: 8px; border: 0; cursor: pointer; font-weight: 700; background: var(--mbx, #7c9cff); color: #0b0b16; }
  #mbxAddCur { height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); color: inherit; cursor: pointer; font-size: 12px; }
  #mbxAddCur:hover { background: rgba(255,255,255,.12); }
`;

function blendHex(fg, bg, alpha) {
  const parse = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = parse(fg), b = parse(bg);
  const mix = (i) => Math.round(a[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0');
  return '#' + mix(0) + mix(1) + mix(2);
}

function uiScript(data, lbl) {
  return `(() => {
    const D = ${JSON.stringify(data)}, T = ${JSON.stringify(lbl)}, COLORS = ${JSON.stringify(COLORS)};
    const B = window.mbExtras; if (!B) return 'nobridge';
    document.documentElement.style.setProperty('--mbx', D.color);
    if (!document.getElementById('mbxStyle')) {
      const s = document.createElement('style'); s.id = 'mbxStyle'; s.textContent = ${JSON.stringify(CSS)}; document.head.append(s);
    }
    const pb = document.getElementById('profileBtn');
    if (pb && !document.getElementById('mbxSwitch')) {
      const b = document.createElement('button');
      b.id = 'mbxSwitch'; b.type = 'button'; b.title = T.switch; b.setAttribute('aria-label', T.switch);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3l4 4-4 4"/><path d="M20 7H8"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h12"/></svg>';
      b.onclick = () => B.chooser();
      pb.parentNode.insertBefore(b, pb);
    }
    const tools = document.querySelector('#navbar .tools');
    if (tools && !document.getElementById('mbxSplit')) {
      const addTool = (id, title, svg, fn) => {
        const b = document.createElement('button');
        b.id = id; b.type = 'button'; b.className = 'ibtn'; b.title = title; b.setAttribute('aria-label', title);
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svg + '</svg>';
        b.onclick = fn;
        tools.append(b);
      };
      addTool('mbxSplit', T.split, '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 4v16"/>', () => B.splitToggle && B.splitToggle());
      addTool('mbxClean', T.clean, '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>', () => B.copyClean && B.copyClean());
      addTool('mbxSnap', T.snap, '<path d="M6 4h12v16l-6-4-6 4z"/>', () => B.snapCapture && B.snapCapture());
      addTool('mbxRadar', T.radar, '<path d="M20 12l-8 8-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/>', () => B.radarWatch && B.radarWatch());
      addTool('mbxBoss', T.boss, '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/>', () => B.bossToggle && B.bossToggle());
    }
    if (D.guest) return 'ok';
    const menu = document.getElementById('profileMenu'), anchor = document.getElementById('pmGuest');
    if (menu && anchor && !document.getElementById('mbxBox')) {
      const box = document.createElement('div'); box.id = 'mbxBox';
      const l1 = document.createElement('label'); l1.textContent = T.color;
      const sw = document.createElement('div'); sw.id = 'mbxSw';
      for (const c of COLORS) {
        const i = document.createElement('i'); i.style.background = c; i.setAttribute('role', 'button'); i.title = c;
        if (c.toLowerCase() === D.color.toLowerCase()) i.className = 'on';
        i.onclick = async () => {
          const r = await B.setColor(c);
          if (r && r.ok) {
            document.documentElement.style.setProperty('--mbx', c);
            sw.querySelectorAll('i').forEach(x => x.className = '');
            i.className = 'on';
          }
        };
        sw.append(i);
      }
      const l2 = document.createElement('label'); l2.textContent = T.pages;
      const ta = document.createElement('textarea'); ta.id = 'mbxPages'; ta.spellcheck = false; ta.placeholder = T.ph;
      ta.value = (D.pages || []).join('\\n');
      const acts = document.createElement('div'); acts.id = 'mbxActs';
      const sv = document.createElement('button'); sv.id = 'mbxSave'; sv.type = 'button'; sv.textContent = T.save;
      sv.onclick = async () => {
        const r = await B.setPages(ta.value);
        if (r && r.ok) {
          ta.value = r.pages.join('\\n');
          sv.textContent = T.saved;
          setTimeout(() => { sv.textContent = T.save; }, 1200);
        }
      };
      const addCur = document.createElement('button'); addCur.id = 'mbxAddCur'; addCur.type = 'button'; addCur.textContent = T.addCur;
      addCur.onclick = async () => {
        const u = await B.currentUrl();
        if (!u) return;
        const lines = ta.value.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
        if (!lines.includes(u)) { lines.push(u); ta.value = lines.join('\\n'); }
      };
      acts.append(sv, addCur);
      box.append(l1, sw, l2, ta, acts);
      anchor.parentNode.insertBefore(box, anchor);
    }
    return 'ok';
  })()`;
}

module.exports = (ctx) => {
  // 1) إصلاح خطأ "Script failed to execute" في السجل:
  // نغلف executeJavaScript لكل WebContents (الحالية والمستقبلية) بمعالج صامت للرفض غير المعالج
  // دون تغيير القيمة أو الخطأ الذي يراه المستدعي عند استخدام await أو .catch()
  const guardWc = (wc) => {
    try {
      if (!wc || wc._mbxGuarded || typeof wc.executeJavaScript !== 'function') return;
      wc._mbxGuarded = true;
      const orig = wc.executeJavaScript.bind(wc);
      wc.executeJavaScript = (...a) => {
        const p = orig(...a);
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return p;
      };
    } catch {}
  };
  try { webContents.getAllWebContents().forEach(guardWc); } catch {}
  app.on('web-contents-created', (_e, wc) => guardWc(wc));

  const profile = (w) => { try { return ctx.profileOf(w); } catch { return null; } };
  const lblFor = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  const wOf = (e) => { try { return ctx.W(e); } catch { return null; } };
  const colorOf = (p) => {
    if (p && HEX.test(p.color || '')) return p.color;
    const list = ctx.settings.profiles || [];
    const idx = Math.max(0, list.indexOf(p));
    return COLORS[idx % COLORS.length];
  };
  const applyWinColor = (w, color) => {
    try {
      if (process.platform !== 'darwin' && w && w.win && !w.win.isDestroyed() && typeof w.win.setTitleBarOverlay === 'function') {
        w.win.setTitleBarOverlay({ color: blendHex(color, '#0C0E20', 0.26), symbolColor: '#EEF0FF', height: 40 });
      }
    } catch {}
  };

  ipcMain.handle('extras:setColor', (e, c) => {
    const w = wOf(e), p = profile(w);
    if (!p || (w && w.guest) || typeof c !== 'string' || !HEX.test(c)) return { ok: false };
    p.color = c; ctx.saveSettings();
    for (const win of ctx.windows) {
      if (!win.guest && win.profileId === p.id) {
        applyWinColor(win, c);
        try {
          if (win.ui && !win.ui.webContents.isDestroyed()) {
            win.ui.webContents.executeJavaScript(`document.documentElement.style.setProperty('--mbx', ${JSON.stringify(c)})`).catch(() => {});
          }
        } catch {}
      }
    }
    try { ctx.sendProfiles && ctx.sendProfiles(); } catch {}
    return { ok: true };
  });

  ipcMain.handle('extras:setPages', (e, text) => {
    const w = wOf(e), p = profile(w);
    if (!p || (w && w.guest)) return { ok: false };
    const pages = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .map(s => /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s)
      .filter(s => /^https?:\/\//i.test(s)).slice(0, 10);
    p.startupPages = pages; ctx.saveSettings();
    return { ok: true, pages };
  });

  ipcMain.handle('extras:currentUrl', (e) => {
    try {
      const w = wOf(e), wc = ctx.activeWc(w);
      const u = wc ? wc.getURL() : '';
      return /^https?:\/\//i.test(u) && !/\.mybrowser\.invalid\b/i.test(u) ? u : '';
    } catch { return ''; }
  });

  ipcMain.handle('extras:chooser', () => { try { ctx.showAccountChooser && ctx.showAccountChooser(); } catch {} return true; });

  ctx.hooks.windowReady.push((w) => {
    try {
      const p = profile(w); if (!w || !w.ui || w.ui.webContents.isDestroyed()) return;
      const color = w.guest ? '#90a4ae' : colorOf(p);
      const pages = (!w.guest && p && Array.isArray(p.startupPages)) ? p.startupPages : [];
      applyWinColor(w, color);
      w.ui.webContents.executeJavaScript(uiScript({ color, pages, guest: !!w.guest }, lblFor())).catch(() => {});
      // صفحات البدء المخصصة: تُفتح مرة واحدة عند أول تحميل للنافذة
      if (!w._mbxStarted) {
        w._mbxStarted = true;
        if (!w.guest && !w.locked && !(w.order && w.order.length) && pages.length) {
          pages.forEach((u, i) => { try { ctx.createTab(w, u, i === 0); } catch {} });
        }
      }
    } catch (e) { ctx.logLine('extras failed', e); }
  });
};
