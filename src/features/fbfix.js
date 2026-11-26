// إصلاح فيسبوك وإنستغرام للأداء الخفيف وحل مشكلة الصور بعد العودة من الريلز إلى الصفحة الرئيسية
// 1) استبدال سكربت حجب إعلانات فيسبوك الثقيل (الذي كان يخفي div.x1lliihq ويجري reflow كل 800ms) بنسخة خفيفة ودقيقة جداً
// 2) إصلاح تلقائي للصور العالقة بعد الخروج من Reels والعودة لصفحة فيسبوك الرئيسية بدون الحاجة لتحديث الصفحة
const FAST_FACEBOOK_ADS = `(() => {
  if (window.__mbFBFast) return;
  window.__mbFBFast = true;
  window.__mbFB = true; // منع السكربت القديم من التشغيل المزدوج
  const WORDS = new Set(['Sponsored', 'ممول', 'مُموَّل', 'Gesponsert', 'Sponsorisé', 'Patrocinado', 'Sponsorlu']);
  const hide = (el) => { if (el && el.style.display !== 'none') el.style.display = 'none'; };

  const scan = () => {
    if (document.hidden) return;
    // لا نخفي أبداً div.x1lliihq العام؛ نكتفي بوحدات المنشورات الفعلية فقط
    const links = document.querySelectorAll('a[href*="/ads/about"], a[href*="ads/preferences"]');
    for (let i = 0; i < links.length; i++) {
      const unit = links[i].closest('[data-pagelet^="FeedUnit"], div[role="article"]');
      if (unit) hide(unit);
    }
    const articles = document.querySelectorAll('[data-pagelet^="FeedUnit"], div[role="article"]');
    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      if (art.style.display === 'none' || art.__mbChecked) continue;
      // فحص سريع عبر textContent فقط (صفر Layout Reflow!)
      const spans = art.querySelectorAll('a[aria-label="Sponsored"], a[aria-label="ممول"], a[aria-label="Gesponsert"], span');
      let isAd = false;
      for (let j = 0; j < spans.length && j < 45; j++) {
        const s = spans[j];
        if (s.children.length > 0) continue;
        const t = (s.textContent || '').trim();
        if (t.length >= 4 && t.length <= 16 && WORDS.has(t)) { isAd = true; break; }
      }
      if (isAd) hide(art);
      else art.__mbChecked = true;
    }
    const rail = document.querySelector('[data-pagelet="RightRail"]');
    if (rail) {
      rail.querySelectorAll('h3, [aria-label="Sponsored"], [aria-label="ممول"], [aria-label="Gesponsert"]').forEach(h => {
        const t = (h.textContent || h.getAttribute('aria-label') || '').trim();
        if (WORDS.has(t)) hide(h.parentElement && h.parentElement.parentElement);
      });
    }
  };

  const schedule = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(scan, { timeout: 1200 });
    else scan();
  };
  setInterval(schedule, 1800);
  setTimeout(schedule, 600);
})();`;

const FAST_INSTAGRAM_ADS = `(() => {
  if (window.__mbIGFast) return;
  window.__mbIGFast = true;
  window.__mbIG = true;
  const WORDS = new Set(['Sponsored', 'ممول', 'مُموَّل', 'Gesponsert', 'Sponsorisé', 'Publicidad', 'Sponsorlu']);
  const scan = () => {
    if (document.hidden) return;
    const arts = document.querySelectorAll('article');
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i];
      if (a.style.display === 'none' || a.__mbChecked) continue;
      const nodes = a.querySelectorAll('span, a');
      let isAd = false;
      for (let j = 0; j < nodes.length && j < 30; j++) {
        if (nodes[j].children.length > 0) continue;
        const t = (nodes[j].textContent || '').trim();
        if (t.length >= 4 && t.length <= 16 && WORDS.has(t)) { isAd = true; break; }
      }
      if (isAd) a.style.display = 'none';
      else a.__mbChecked = true;
    }
  };
  setInterval(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(scan, { timeout: 1200 });
    else scan();
  }, 1800);
})();`;

// استعادة الصور العالقة عند العودة من Reels إلى الصفحة الرئيسية في فيسبوك
const RECOVER_FB_IMAGES = `(() => {
  try {
    // 1) إيقاظ محمّل الصور الكسول (IntersectionObserver) في React
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
    // 2) إعادة تحميل أي صورة لم تُحمّل أو تعطلت أثناء الانتقال من Reels
    const imgs = document.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img.src || img.src.startsWith('data:')) continue;
      if (img.loading === 'lazy') img.loading = 'eager';
      if (img.complete && img.naturalWidth === 0 && !img.__mbRetried) {
        img.__mbRetried = true;
        const orig = img.src;
        img.src = '';
        img.src = orig;
      }
    }
  } catch {}
})()`;

module.exports = (ctx) => {
  // استبدال سكربتات فيسبوك وإنستغرام الثقيلة بالنسخة السريعة والآمنة قبل تحميل الصفحات
  if (ctx && ctx.inj && ctx.inj.ADS_SCRIPT) {
    ctx.inj.ADS_SCRIPT.facebook = FAST_FACEBOOK_ADS;
    ctx.inj.ADS_SCRIPT.instagram = FAST_INSTAGRAM_ADS;
  }

  // متابعة التنقل داخل فيسبوك (خاصة عند الخروج من /reel أو /reels إلى الصفحة الرئيسية)
  const lastUrl = new WeakMap();
  ctx.hooks.tabCreated.push((_w, _id, wc) => {
    const checkReturn = (url) => {
      try {
        const prev = lastUrl.get(wc) || '';
        lastUrl.set(wc, url || '');
        if (!/facebook\.com/i.test(url || '')) return;
        const leftReels = /\/(reel|reels|watch)\b/i.test(prev) && !/\/(reel|reels)\b/i.test(url);
        if (leftReels) {
          setTimeout(() => { try { if (!wc.isDestroyed()) wc.executeJavaScript(RECOVER_FB_IMAGES).catch(() => {}); } catch {} }, 350);
          setTimeout(() => { try { if (!wc.isDestroyed()) wc.executeJavaScript(RECOVER_FB_IMAGES).catch(() => {}); } catch {} }, 1200);
        }
      } catch {}
    };
    wc.on('did-navigate-in-page', (_e, u) => checkReturn(u));
    wc.on('did-navigate', (_e, u) => checkReturn(u));
  });
};
