// حاجب لافتات الكوكيز والنوافذ المزعجة (Cookie & Overlay Killer)
// يعمل مرة واحدة عند انتهاء تحميل الصفحة (بدون MutationObserver) حتى لا يستهلك أي معالج
const CSS = `
  #onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter,
  #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay,
  #didomi-host, .didomi-popup-container, .didomi-popup-backdrop,
  .qc-cmp2-container, #qc-cmp2-container,
  .fc-consent-root, .fc-dialog-overlay,
  #usercentrics-root, [data-testid="uc-overlay"],
  .cky-consent-container, .cky-overlay,
  #cookie-law-info-bar, .cli-modal-backdrop,
  #truste-consent-track, .truste_box_overlay,
  .cc-window, .cc-banner, #cookieConsent, #cookie-banner, .cookie-banner, .cookie-notice,
  [id*="sp_message_container"], .sp_message_container {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

// فك قفل التمرير إذا كانت لافتة كوكيز قد أوقفت التمرير في الصفحة
const UNLOCK_SCROLL = `(() => {
  try {
    const hs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body);
    if (hs.overflow === 'hidden' || hs.overflowY === 'hidden') document.documentElement.style.setProperty('overflow', 'auto', 'important');
    if (bs.overflow === 'hidden' || bs.overflowY === 'hidden') document.body.style.setProperty('overflow', 'auto', 'important');
    document.body.classList.remove('modal-open', 'no-scroll', 'cookie-modal-open', 'didomi-popup-open');
  } catch {}
})()`;

// مواقع لا نتدخل في لافتاتها (تسجيل دخول/بنوك/تطبيقات ويب ثقيلة مثل فيسبوك ويوتيوب)
const SKIP = /(^|\.)(accounts\.google\.com|google\.com|youtube\.com|facebook\.com|instagram\.com|tiktok\.com|whatsapp\.com|paypal\.com|stripe\.com|bank|sparkasse|ing\.de|dkb\.de|n26\.com)$/i;

module.exports = (ctx) => {
  ctx.hooks.navigated.push((_w, _id, wc, url) => {
    try {
      if (!ctx.settings.adblock) return;
      if (!wc || wc.isDestroyed() || !/^https?:\/\//i.test(url || '')) return;
      const host = new URL(url).hostname;
      if (SKIP.test(host)) return;
      if (ctx.isSensitive && ctx.isSensitive(url)) return;
      const site = ctx.siteKey ? ctx.siteKey(url) : '';
      if (site && ctx.settings.siteModes && ctx.settings.siteModes[site] === 'off') return;
      wc.insertCSS(CSS, { cssOrigin: 'user' }).catch(() => {});
      setTimeout(() => {
        try { if (!wc.isDestroyed() && wc.getURL() === url) wc.executeJavaScript(UNLOCK_SCROLL).catch(() => {}); } catch {}
      }, 900);
    } catch {}
  });
};
