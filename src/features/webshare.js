// دعم زر المشاركة القياسي للمواقع (Web Share API — navigator.share / navigator.canShare)
// Electron لا يفتح نافذة المشاركة الأصلية لويندوز، لذلك نوفّر نافذة مشاركة أنيقة وسريعة تدعم:
// WhatsApp، Telegram، Facebook، X، LinkedIn، البريد الإلكتروني، ونسخ الرابط بنقرة واحدة — بصفر عبء في الخلفية
const L = {
  ar: { title: 'مشاركة', copy: 'نسخ الرابط', copied: 'تم نسخ الرابط ✓', wa: 'واتساب', tg: 'تيليجرام', fb: 'فيسبوك', x: 'إكس (تويتر)', mail: 'البريد', li: 'لينكدإن', close: 'إغلاق' },
  en: { title: 'Share', copy: 'Copy link', copied: 'Link copied ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'Email', li: 'LinkedIn', close: 'Close' },
  de: { title: 'Teilen', copy: 'Link kopieren', copied: 'Link kopiert ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'E-Mail', li: 'LinkedIn', close: 'Schließen' },
  fr: { title: 'Partager', copy: 'Copier le lien', copied: 'Lien copié ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'E-mail', li: 'LinkedIn', close: 'Fermer' },
  es: { title: 'Compartir', copy: 'Copiar enlace', copied: 'Enlace copiado ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'Correo', li: 'LinkedIn', close: 'Cerrar' },
  it: { title: 'Condividi', copy: 'Copia link', copied: 'Link copiato ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'Email', li: 'LinkedIn', close: 'Chiudi' },
  tr: { title: 'Paylaş', copy: 'Bağlantıyı kopyala', copied: 'Kopyalandı ✓', wa: 'WhatsApp', tg: 'Telegram', fb: 'Facebook', x: 'X / Twitter', mail: 'E-posta', li: 'LinkedIn', close: 'Kapat' }
};

function shareScript(lbl, rtl) {
  return `(() => {
    if (window.__mbWebShare) return;
    window.__mbWebShare = true;
    const T = ${JSON.stringify(lbl)}, RTL = ${JSON.stringify(rtl)};

    const shareImpl = (data = {}) => new Promise((resolve, reject) => {
      const url = String(data.url || location.href || '').trim();
      const title = String(data.title || document.title || '').trim();
      const text = String(data.text || '').trim();
      const fullText = [title, text, url].filter(Boolean).join(' — ');
      const encUrl = encodeURIComponent(url);
      const encTxt = encodeURIComponent([title, text].filter(Boolean).join(' — ') || url);

      const prev = document.getElementById('__mbShareWrap');
      if (prev) prev.remove();

      const wrap = document.createElement('div');
      wrap.id = '__mbShareWrap';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(6,7,18,.62);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.45 "Segoe UI","Noto Sans Arabic",system-ui,sans-serif;direction:' + (RTL ? 'rtl' : 'ltr') + ';';

      const card = document.createElement('div');
      card.style.cssText = 'width:min(420px,94vw);background:#11132A;color:#EEF0FF;border:1px solid rgba(139,124,255,.45);border-radius:18px;padding:18px;box-shadow:0 24px 64px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:14px;box-sizing:border-box;';

      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';
      const h = document.createElement('b'); h.textContent = '🔗 ' + T.title; h.style.cssText = 'font-size:16px;';
      const xBtn = document.createElement('button'); xBtn.type = 'button'; xBtn.textContent = '✕'; xBtn.title = T.close;
      xBtn.style.cssText = 'width:30px;height:30px;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#A3A8C8;cursor:pointer;font-size:14px;';
      head.append(h, xBtn);

      const prevBox = document.createElement('div');
      prevBox.style.cssText = 'padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);';
      const pt = document.createElement('div'); pt.textContent = title || url; pt.style.cssText = 'font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      const pu = document.createElement('div'); pu.textContent = url; pu.style.cssText = 'font-size:11.5px;color:#8B93B8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:start;margin-top:2px;';
      prevBox.append(pt, pu);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';

      const done = (ok) => {
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        if (ok) resolve();
        else reject(new DOMException('Share canceled', 'AbortError'));
      };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      xBtn.onclick = () => done(false);
      wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) done(false); });

      const targets = [
        { icon: '💬', name: T.wa, color: '#25D366', href: 'https://wa.me/?text=' + encodeURIComponent(fullText) },
        { icon: '✈️', name: T.tg, color: '#2AABEE', href: 'https://t.me/share/url?url=' + encUrl + '&text=' + encTxt },
        { icon: '📘', name: T.fb, color: '#1877F2', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl },
        { icon: '𝕏', name: T.x, color: '#E2E8F0', href: 'https://twitter.com/intent/tweet?text=' + encTxt + '&url=' + encUrl },
        { icon: '🔗', name: T.li, color: '#0A66C2', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl },
        { icon: '✉️', name: T.mail, color: '#8B7CFF', href: 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(fullText) }
      ];

      for (const t of targets) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#EEF0FF;cursor:pointer;font:600 12px/1.2 inherit;transition:background .12s,border-color .12s;';
        b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,.1)'; b.style.borderColor = t.color; };
        b.onmouseleave = () => { b.style.background = 'rgba(255,255,255,.04)'; b.style.borderColor = 'rgba(255,255,255,.1)'; };
        const ic = document.createElement('span'); ic.textContent = t.icon; ic.style.cssText = 'font-size:20px;line-height:1;';
        const nm = document.createElement('span'); nm.textContent = t.name;
        b.append(ic, nm);
        b.onclick = () => { window.open(t.href, '_blank', 'noopener'); done(true); };
        grid.append(b);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = '📋 ' + T.copy;
      copyBtn.style.cssText = 'height:40px;border:0;border-radius:12px;background:linear-gradient(120deg,#8B7CFF,#4F8CFF 55%,#2EE6D6);color:#090A16;font:700 13.5px/1 inherit;cursor:pointer;';
      copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(url); } catch {
          const ta = document.createElement('textarea'); ta.value = url; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        copyBtn.textContent = T.copied;
        setTimeout(() => done(true), 600);
      };

      card.append(head, prevBox, grid, copyBtn);
      wrap.append(card);
      document.documentElement.append(wrap);
    });

    try {
      Object.defineProperty(navigator, 'share', { value: shareImpl, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true });
    } catch {
      try { navigator.share = shareImpl; navigator.canShare = () => true; } catch {}
    }
  })()`;
}

module.exports = (ctx) => {
  const inject = (wc, url) => {
    try {
      if (!wc || wc.isDestroyed() || !/^https?:\/\//i.test(url || '')) return;
      const code = (ctx.lang() || 'en').slice(0, 2);
      wc.executeJavaScript(shareScript(L[code] || L.en, ctx.isRTL())).catch(() => {});
    } catch {}
  };

  ctx.hooks.tabCreated.push((_w, _id, wc) => {
    wc.on('dom-ready', () => { try { inject(wc, wc.getURL()); } catch {} });
  });
};
