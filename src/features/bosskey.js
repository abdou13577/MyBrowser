// وضع الخصوصية الفورية / زر الذعر (Quick Blur / Boss Key)
// اختصار واحد (F9 أو Ctrl+Shift+B) أو زر الشريط: يكتم كل التبويبات ويخفي الشاشة فوراً بستار هادئ، ويعيد كل شيء بنفس الاختصار
const { app, ipcMain } = require('electron');

const L = {
  ar: { title: 'وضع الخصوصية مُفعّل', sub: 'تم كتم الصوت وإخفاء جميع الصفحات مؤقتاً', hint: 'اضغط F9 أو Ctrl+Shift+B للعودة', unlock: 'العودة للتصفح' },
  en: { title: 'Privacy Mode Active', sub: 'All tabs are muted and hidden', hint: 'Press F9 or Ctrl+Shift+B to resume', unlock: 'Resume browsing' },
  de: { title: 'Privatsphäre-Modus aktiv', sub: 'Alle Tabs sind stummgeschaltet und ausgeblendet', hint: 'F9 oder Strg+Umschalt+B zum Fortfahren', unlock: 'Weiter surfen' },
  fr: { title: 'Mode confidentialité actif', sub: 'Tous les onglets sont muets et masqués', hint: 'Appuyez sur F9 ou Ctrl+Maj+B pour reprendre', unlock: 'Reprendre' },
  es: { title: 'Modo privacidad activo', sub: 'Todas las pestañas están silenciadas y ocultas', hint: 'Pulsa F9 o Ctrl+Mayús+B para volver', unlock: 'Reanudar' },
  it: { title: 'Modalità privacy attiva', sub: 'Tutte le schede sono silenziate e nascoste', hint: 'Premi F9 o Ctrl+Maiusc+B per riprendere', unlock: 'Riprendi' },
  tr: { title: 'Gizlilik Modu Aktif', sub: 'Tüm sekmeler sessize alındı ve gizlendi', hint: 'Devam etmek için F9 veya Ctrl+Shift+B', unlock: 'Devam et' }
};

function veilScript(show, lbl) {
  if (!show) {
    return `(() => { const el = document.getElementById('mbxBossVeil'); if (el) el.remove(); })()`;
  }
  return `(() => {
    const T = ${JSON.stringify(lbl)};
    let el = document.getElementById('mbxBossVeil');
    if (el) return;
    el = document.createElement('div');
    el.id = 'mbxBossVeil';
    el.style.cssText = 'position:fixed;inset:92px 0 0 0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(60% 50% at 30% 15%,rgba(139,124,255,.18),transparent 70%),radial-gradient(55% 45% at 80% 85%,rgba(46,230,214,.12),transparent 70%),#090A16;color:#EEF0FF;font-family:"Segoe UI Variable Text","Segoe UI","Noto Sans Arabic",system-ui,sans-serif;user-select:none;';
    const clk = document.createElement('div');
    clk.style.cssText = 'font-size:68px;font-weight:200;letter-spacing:-2px;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#fff,#B9B8FF 65%,#7FE9F0);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;';
    const upd = () => { const d = new Date(); clk.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); };
    upd(); const iv = setInterval(() => { if (!document.getElementById('mbxBossVeil')) { clearInterval(iv); return; } upd(); }, 10000);
    const h = document.createElement('div'); h.textContent = T.title; h.style.cssText = 'font-size:20px;font-weight:600;margin-top:8px;';
    const p = document.createElement('div'); p.textContent = T.sub; p.style.cssText = 'font-size:14px;color:#A3A8C8;';
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = T.unlock;
    btn.style.cssText = 'margin-top:10px;height:40px;padding:0 22px;border-radius:12px;border:0;cursor:pointer;font:inherit;font-weight:700;background:linear-gradient(120deg,#8B7CFF,#4F8CFF 55%,#2EE6D6);color:#090A16;';
    btn.onclick = () => window.mbExtras && window.mbExtras.bossToggle && window.mbExtras.bossToggle();
    const hint = document.createElement('div'); hint.textContent = T.hint; hint.style.cssText = 'font-size:12px;color:#6E7396;margin-top:4px;';
    el.append(clk, h, p, btn, hint);
    document.body.append(el);
  })()`;
}

module.exports = (ctx) => {
  let active = false;
  const savedMute = new WeakMap(); // webContents -> boolean
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;

  function setBoss(on) {
    active = !!on;
    for (const w of ctx.windows) {
      if (!w || !w.win || w.win.isDestroyed()) continue;
      // 1) كتم / استعادة الصوت لجميع التبويبات + الشاشة المقسومة
      for (const id of w.order) {
        const tb = ctx.tabs.get(id);
        if (!tb || !ctx.alive(tb)) continue;
        const wc = tb.view.webContents;
        try {
          if (active) {
            savedMute.set(wc, wc.isAudioMuted());
            wc.setAudioMuted(true);
            tb.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
          } else {
            const was = savedMute.has(wc) ? savedMute.get(wc) : false;
            wc.setAudioMuted(!!was);
          }
        } catch {}
      }
      if (w._split && w._split.view && !w._split.view.webContents.isDestroyed()) {
        const swc = w._split.view.webContents;
        try {
          if (active) {
            savedMute.set(swc, swc.isAudioMuted());
            swc.setAudioMuted(true);
            w._split.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
          } else {
            const was = savedMute.has(swc) ? savedMute.get(swc) : false;
            swc.setAudioMuted(!!was);
          }
        } catch {}
      }
      // 2) إظهار / إخفاء الستار
      try {
        if (active) {
          w.win.contentView.addChildView(w.ui);
          w.ui.webContents.executeJavaScript(veilScript(true, lbl())).catch(() => {});
        } else {
          w.ui.webContents.executeJavaScript(veilScript(false, lbl())).catch(() => {});
          ctx.layout(w);
          if (ctx.relayoutSplit) ctx.relayoutSplit(w);
          const cur = ctx.activeTab(w);
          if (cur && ctx.alive(cur)) w.win.contentView.addChildView(cur.view);
          if (w._split && w._split.view && !w._split.view.webContents.isDestroyed()) {
            w.win.contentView.addChildView(w._split.view);
          }
        }
      } catch {}
    }
    return { active };
  }

  ctx.toggleBossKey = () => setBoss(!active);
  ctx.isBossActive = () => active;

  ipcMain.handle('boss:toggle', () => setBoss(!active));
  ipcMain.handle('boss:state', () => ({ active }));

  // اختصار F9 أو Ctrl+Shift+B في أي مكان داخل المتصفح
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type !== 'keyDown') return;
      const isF9 = input.key === 'F9' && !input.control && !input.meta && !input.alt && !input.shift;
      const isCtrlShiftB = (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'b';
      if (isF9 || isCtrlShiftB) {
        ev.preventDefault();
        setBoss(!active);
      }
    });
  });
};
