// إصلاح وضع التصفح الخفي / نافذة الضيف (True Incognito / Guest Mode) + اختصار Ctrl+Shift+N
// - يضمن جلسة معزولة 100% في الذاكرة (بدون أي كوكيز أو تسجيلات دخول من حساباتك الأخرى) مع بقاء حجب الإعلانات مفعّلاً
// - يمنع renderer.js نهائياً من استبدال أيقونة 🕶️ واسم «تصفح خفي» ببيانات حسابك العادي عند تحديث قائمة الحسابات
const { app, ipcMain, session } = require('electron');

const L = {
  ar: { badge: 'تصفح خفي', title: 'وضع التصفح الخفي — جلسة فارغة بدون حسابات أو سجل أو كوكيز' },
  en: { badge: 'Incognito', title: 'Incognito Mode — clean session, no accounts, history, or cookies' },
  de: { badge: 'Inkognito', title: 'Inkognito-Modus — leere Sitzung, kein Konto, kein Verlauf' },
  fr: { badge: 'Privé', title: 'Navigation privée — session vierge, aucun compte ni historique' },
  es: { badge: 'Incógnito', title: 'Modo incógnito — sesión limpia sin cuentas ni historial' },
  it: { badge: 'Incognito', title: 'Modalità incognito — sessione pulita senza account né cronologia' },
  tr: { badge: 'Gizli', title: 'Gizli Mod — temiz oturum, hesap ve geçmiş kaydedilmez' }
};

function guestUiScript(lbl) {
  return `(() => {
    const T = ${JSON.stringify(lbl)};
    document.documentElement.style.setProperty('--mbx', '#64748b');

    const paint = () => {
      const av = document.getElementById('avatar');
      if (av && av.textContent !== '🕶️') {
        av.innerHTML = '🕶️';
        av.style.background = '#334155';
        av.style.color = '#fff';
      }
      const pb = document.getElementById('profileBtn');
      if (pb) {
        pb.title = T.title;
        if (!document.getElementById('mbxGuestBadge')) {
          const b = document.createElement('span');
          b.id = 'mbxGuestBadge';
          b.textContent = '🕶️ ' + T.badge;
          b.title = T.title;
          b.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:999px;background:rgba(148,163,184,.2);border:1px solid rgba(148,163,184,.48);color:#F1F5F9;font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0;';
          pb.parentNode.insertBefore(b, pb);
        }
      }
      const pmName = document.getElementById('pmName');
      const pmEmail = document.getElementById('pmEmail');
      const pmAv = document.getElementById('pmAvatar');
      if (pmName && pmName.textContent !== T.badge) pmName.textContent = T.badge;
      if (pmEmail && pmEmail.textContent !== T.title) pmEmail.textContent = T.title;
      if (pmAv && pmAv.textContent !== '🕶️') { pmAv.innerHTML = '🕶️'; pmAv.style.background = '#334155'; }
      for (const id of ['pmSignin', 'pmAccountsWrap', 'pmSignout', 'pmRemove', 'pmLock']) {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      }
    };

    paint();
    if (!window.__mbGuestObs) {
      window.__mbGuestObs = true;
      const obs = new MutationObserver(() => paint());
      const av = document.getElementById('avatar');
      const pm = document.getElementById('profileMenu');
      if (av) obs.observe(av, { childList: true, subtree: true, characterData: true });
      if (pm) obs.observe(pm, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    }
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;

  async function openCleanGuest() {
    // نترك createWindow يضبط w.partition ('guest-' + Date.now()) ويفعّل عليه setupSession + مانع الإعلانات
    const w = ctx.createWindow('__guest__', { guest: true });
    if (!w) return;
    w.guest = true;
    w.profileId = '__guest__';
    // مسح فوري لأي بيانات في الجلسة المؤقتة لضمان بداية نظيفة 100% بدون أي حساب
    try {
      const ses = session.fromPartition(w.partition);
      await ses.clearStorageData().catch(() => {});
      await ses.clearCache().catch(() => {});
    } catch {}
    try { if (w.win && !w.win.isDestroyed()) { w.win.show(); w.win.focus(); } } catch {}
  }

  ctx.openGuestWindow = openCleanGuest;

  ipcMain.removeAllListeners('profiles:guest');
  ipcMain.on('profiles:guest', () => { openCleanGuest(); });

  ctx.hooks.windowReady.push((w) => {
    if (!w || !w.guest || !w.ui || w.ui.webContents.isDestroyed()) return;
    w.profileId = '__guest__';
    try {
      w.ui.webContents.executeJavaScript(guestUiScript(lbl())).catch(() => {});
    } catch {}
  });

  // اختصار Ctrl+Shift+N لفتح نافذة تصفح خفي جديدة في أي وقت
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'n') {
        ev.preventDefault();
        openCleanGuest();
      }
    });
  });
};
