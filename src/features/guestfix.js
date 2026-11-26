// إصلاح وضع التصفح الخفي / نافذة الضيف (True Incognito / Guest Mode) + اختصار Ctrl+Shift+N
// - يضمن جلسة معزولة 100% في الذاكرة (بدون أي كوكيز أو تسجيلات دخول من حساباتك الأخرى)
// - يمنع ظهور صورة أو اسم أو بريد حسابك العادي داخل نافذة التصفح الخفي
// - يضيف شارة واضحة «🕶️ تصفح خفي» وتلويناً خاصاً لتمييز النافذة فوراً
const { app, ipcMain, session } = require('electron');

const L = {
  ar: { badge: 'تصفح خفي', title: 'وضع التصفح الخفي — لا يُحفظ سجل أو كوكيز', tip: 'فتح نافذة تصفح خفي (Ctrl+Shift+N)' },
  en: { badge: 'Incognito', title: 'Incognito Mode — no history or cookies saved', tip: 'New Incognito window (Ctrl+Shift+N)' },
  de: { badge: 'Inkognito', title: 'Inkognito-Modus — kein Verlauf, keine Cookies', tip: 'Neues Inkognito-Fenster (Ctrl+Shift+N)' },
  fr: { badge: 'Privé', title: 'Navigation privée — aucun historique ni cookie', tip: 'Nouvelle fenêtre privée (Ctrl+Shift+N)' },
  es: { badge: 'Incógnito', title: 'Modo incógnito — sin historial ni cookies', tip: 'Nueva ventana incógnito (Ctrl+Shift+N)' },
  it: { badge: 'Incognito', title: 'Modalità incognito — nessuna cronologia o cookie', tip: 'Nuova finestra incognito (Ctrl+Shift+N)' },
  tr: { badge: 'Gizli', title: 'Gizli Mod — geçmiş ve çerez kaydedilmez', tip: 'Yeni gizli pencere (Ctrl+Shift+N)' }
};

function guestUiScript(lbl) {
  return `(() => {
    const T = ${JSON.stringify(lbl)};
    document.documentElement.style.setProperty('--mbx', '#64748b');
    const av = document.getElementById('avatar');
    if (av) { av.innerHTML = '🕶️'; av.style.background = '#334155'; av.style.color = '#fff'; }
    const pb = document.getElementById('profileBtn');
    if (pb) {
      pb.title = T.title;
      if (!document.getElementById('mbxGuestBadge')) {
        const b = document.createElement('span');
        b.id = 'mbxGuestBadge';
        b.textContent = '🕶️ ' + T.badge;
        b.title = T.title;
        b.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:999px;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.42);color:#E2E8F0;font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0;';
        pb.parentNode.insertBefore(b, pb);
      }
    }
    const pmName = document.getElementById('pmName');
    const pmEmail = document.getElementById('pmEmail');
    const pmAv = document.getElementById('pmAvatar');
    if (pmName) pmName.textContent = T.badge;
    if (pmEmail) pmEmail.textContent = T.title;
    if (pmAv) { pmAv.innerHTML = '🕶️'; pmAv.style.background = '#334155'; }
  })()`;
}

module.exports = (ctx) => {
  const lbl = () => L[(ctx.lang() || 'en').slice(0, 2)] || L.en;
  let seq = 0;

  async function openCleanGuest() {
    const w = ctx.createWindow('__guest__', { guest: true });
    if (!w) return;
    w.guest = true;
    w.profileId = '__guest__';
    w.partition = 'guest-' + Date.now() + '-' + (++seq);
    // مسح فوري لأي بيانات في الجلسة المؤقتة لضمان بداية نظيفة 100%
    try {
      const ses = session.fromPartition(w.partition);
      await ses.clearStorageData().catch(() => {});
      await ses.clearCache().catch(() => {});
    } catch {}
    try { if (w.win && !w.win.isDestroyed()) { w.win.show(); w.win.focus(); } } catch {}
  }

  ctx.openGuestWindow = openCleanGuest;

  // استبدال مستمع profiles:guest القديم حتى لا يورّث معرّف الحساب النشط
  ipcMain.removeAllListeners('profiles:guest');
  ipcMain.on('profiles:guest', () => { openCleanGuest(); });

  // عند جاهزية نافذة الضيف: نخفي هوية الحساب العادي ونضع شارة التصفح الخفي الواضحة
  ctx.hooks.windowReady.push((w) => {
    if (!w || !w.guest || !w.ui || w.ui.webContents.isDestroyed()) return;
    w.profileId = '__guest__';
    const apply = () => {
      try {
        if (w.ui && !w.ui.webContents.isDestroyed()) {
          w.ui.webContents.executeJavaScript(guestUiScript(lbl())).catch(() => {});
        }
      } catch {}
    };
    apply();
    // نعيد التطبيق بعد وصول رسالة profiles الأولية من main.js حتى لا تستبدل أيقونة 🕶️ بصورة الحساب
    setTimeout(apply, 250);
    setTimeout(apply, 900);
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
