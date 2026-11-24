// إضافات الحسابات: لون نافذة لكل حساب، زر تبديل الحساب في أي وقت، صفحات بدء لكل حساب.
// + إخفاء خطأ "Script failed to execute" الذي يملأ السجل (رفض غير معالج لصفحات تتغير أثناء تنفيذ سكربت).
// مستقلة عن main.js: تضيف واجهتها إلى نافذة الواجهة بعد تحميلها.
const { app, ipcMain } = require('electron');

const COLORS = ['#7c9cff', '#8B7CFF', '#4dd0e1', '#3ecf8e', '#ffd166', '#ff9f5a', '#ff6b7e', '#e07cff'];
const HEX = /^#[0-9a-f]{6}$/i;

const L = {
  ar: { switch: 'تبديل الحساب', color: 'لون النافذة', pages: 'صفحات البدء (رابط في كل سطر)', save: 'حفظ', saved: 'تم الحفظ' },
  en: { switch: 'Switch account', color: 'Window color', pages: 'Startup pages (one URL per line)', save: 'Save', saved: 'Saved' },
  de: { switch: 'Konto wechseln', color: 'Fensterfarbe', pages: 'Startseiten (eine URL pro Zeile)', save: 'Speichern', saved: 'Gespeichert' },
  fr: { switch: 'Changer de compte', color: 'Couleur de la fenêtre', pages: 'Pages de démarrage (une URL par ligne)', save: 'Enregistrer', saved: 'Enregistré' },
  es: { switch: 'Cambiar de cuenta', color: 'Color de la ventana', pages: 'Páginas de inicio (una URL por línea)', save: 'Guardar', saved: 'Guardado' },
  it: { switch: 'Cambia account', color: 'Colore finestra', pages: 'Pagine iniziali (un URL per riga)', save: 'Salva', saved: 'Salvato' },
  tr: { switch: 'Hesap değiştir', color: 'Pencere rengi', pages: 'Açılış sayfaları (her satıra bir URL)', save: 'Kaydet', saved: 'Kaydedildi' }
};

const CSS = `
  #mbxSwitch { width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: inherit; cursor: pointer; font-size: 17px; display: grid; place-items: center; }
  #mbxSwitch:hover { background: rgba(255,255,255,.1); }
  #toolbar { position: relative; background-image: linear-gradient(180deg, color-mix(in srgb, var(--mbx, #7c9cff) 26%, transparent), transparent 70%); }
  #toolbar::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--mbx, #7c9cff); pointer-events: none; z-index: 5; }
  #profileMenu { max-height: 86vh; overflow: auto; }
  #mbxBox { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,.1); border-bottom: 1px solid rgba(255,255,255,.1); margin: 6px 0; }
  #mbxBox label { font-size: 12px; opacity: .75; }
  #mbxSw { display: flex; gap: 7px; flex-wrap: wrap; }
  #mbxSw i { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
  #mbxSw i.on { border-color: #fff; }
  #mbxPages { width: 100%; min-height: 64px; resize: vertical; border-radius: 8px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); color: inherit; padding: 6px 8px; font-size: 12.5px; direction: ltr; }
  #mbxSave { align-self: flex-start; height: 30px; padding: 0 14px; border-radius: 8px; border: 0; cursor: pointer; font-weight: 700; background: var(--mbx, #7c9cff); color: #0b0b16; }
`;

function uiScript(data, lbl) {
  return `(() => {
    const D = ${JSON.stringify(data)}, T = ${JSON.stringify(lbl)}, COLORS = ${JSON.stringify(COLORS)};
    const B = window.mbExtras; if (!B) return 'nobridge';
    document.documentElement.style.setProperty('--mbx', D.color);
    if (!document.getElementById('mbxStyle')) { const s = document.createElement('style'); s.id = 'mbxStyle'; s.textContent = ${JSON.stringify(CSS)}; document.head.append(s); }
    const pb = document.getElementById('profileBtn');
    if (pb && !document.getElementById('mbxSwitch')) {
      const b = document.createElement('button'); b.id = 'mbxSwitch'; b.type = 'button'; b.textContent = '\\u21C4'; b.title = T.switch;
      b.onclick = () => B.chooser(); pb.parentNode.insertBefore(b, pb);
    }
    const menu = document.getElementById('profileMenu'), anchor = document.getElementById('pmGuest');
    if (menu && anchor && !document.getElementById('mbxBox')) {
      const box = document.createElement('div'); box.id = 'mbxBox';
      const l1 = document.createElement('label'); l1.textContent = T.color;
      const sw = document.createElement('div'); sw.id = 'mbxSw';
      for (const c of COLORS) {
        const i = document.createElement('i'); i.style.background = c; if (c.toLowerCase() === D.color.toLowerCase()) i.className = 'on';
        i.onclick = async () => { const r = await B.setColor(c); if (r && r.ok) { document.documentElement.style.setProperty('--mbx', c); sw.querySelectorAll('i').forEach(x => x.className = ''); i.className = 'on'; } };
        sw.append(i);
      }
      const l2 = document.createElement('label'); l2.textContent = T.pages;
      const ta = document.createElement('textarea'); ta.id = 'mbxPages'; ta.spellcheck = false; ta.value = (D.pages || []).join('\\n');
      const sv = document.createElement('button'); sv.id = 'mbxSave'; sv.type = 'button'; sv.textContent = T.save;
      sv.onclick = async () => { const r = await B.setPages(ta.value); if (r && r.ok) { ta.value = r.pages.join('\\n'); sv.textContent = T.saved; setTimeout(() => { sv.textContent = T.save; }, 1200); } };
      box.append(l1, sw, l2, ta, sv); anchor.parentNode.insertBefore(box, anchor);
    }
    return 'ok';
  })()`;
}

module.exports = (ctx) => {
  // 1) السجل: رفض executeJavaScript الذي لا يعالجه أحد يُسجَّل كـ UNHANDLED. نضيف معالجاً صامتاً دون تغيير ما يراه المستدعي.
  app.on('web-contents-created', (_e, wc) => {
    try {
      const orig = wc.executeJavaScript.bind(wc);
      wc.executeJavaScript = (...a) => { const p = orig(...a); try { p.catch(() => {}); } catch {} return p; };
    } catch {}
  });

  const profile = (w) => { try { return ctx.profileOf(w); } catch { return null; } };
  const lblFor = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  const wOf = (e) => { try { return ctx.W(e); } catch { return null; } };

  ipcMain.handle('extras:setColor', (e, c) => {
    const w = wOf(e), p = profile(w);
    if (!p || typeof c !== 'string' || !HEX.test(c)) return { ok: false };
    p.color = c; ctx.saveSettings();
    try { ctx.sendProfiles && ctx.sendProfiles(); } catch {}
    return { ok: true };
  });

  ipcMain.handle('extras:setPages', (e, text) => {
    const w = wOf(e), p = profile(w);
    if (!p) return { ok: false };
    const pages = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .map(s => /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s)
      .filter(s => /^https?:\/\//i.test(s)).slice(0, 8);
    p.startupPages = pages; ctx.saveSettings();
    return { ok: true, pages };
  });

  ipcMain.handle('extras:chooser', () => { try { ctx.showAccountChooser && ctx.showAccountChooser(); } catch {} return true; });

  ctx.hooks.windowReady.push((w) => {
    try {
      const p = profile(w); if (!p || !w.ui || w.ui.webContents.isDestroyed()) return;
      const data = { color: HEX.test(p.color || '') ? p.color : COLORS[0], pages: p.startupPages || [] };
      w.ui.webContents.executeJavaScript(uiScript(data, lblFor())).catch(() => {});
      // صفحات البدء: تُفتح مرة واحدة عند أول تحميل للنافذة
      if (!w._mbxStarted) {
        w._mbxStarted = true;
        if (!w.guest && !w.locked && !(w.order && w.order.length) && data.pages.length) {
          for (const u of data.pages) { try { ctx.createTab(w, u); } catch {} }
        }
      }
    } catch (e) { ctx.logLine('extras failed', e); }
  });
};
