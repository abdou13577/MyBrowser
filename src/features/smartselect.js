// المحوّل والمترجم الفوري عند التحديد (Smart Selection Bubble)
// يعمل فقط عند تحديد النص (mouseup) — صفر استهلاك في الخلفية!
// يحوّل العملات ($ / £ / € / SAR / AED / MAD) والوحدات (inches, miles, lbs, °F, oz, ft) فورياً داخل فقاعة أنيقة
const { app } = require('electron');

// أسعار صرف افتراضية (تُحدَّث مرة يومياً في الخلفية من واجهة عامة مجانية بدون مفتاح)
let RATES = { USD: 1, EUR: 0.92, GBP: 0.79, SAR: 3.75, AED: 3.67, MAD: 9.95, TRY: 34.5, EGP: 49.0 };

async function refreshRates() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    if (d && d.rates && d.rates.EUR) {
      for (const k of Object.keys(RATES)) if (d.rates[k]) RATES[k] = d.rates[k];
    }
  } catch {}
}

function buildScript(rates, lang) {
  return `(() => {
    if (window.__mbSmartSel) return;
    window.__mbSmartSel = true;
    const R = ${JSON.stringify(rates)};
    const LANG = ${JSON.stringify(lang)};
    const isAr = LANG === 'ar';
    let tip = null;

    function hide() { if (tip) { tip.remove(); tip = null; } }

    function parseNum(s) {
      let c = s.replace(/[^\\d.,]/g, '');
      const ld = c.lastIndexOf('.'), lc = c.lastIndexOf(',');
      if (lc > ld && c.length - lc <= 3) c = c.replace(/\\./g, '').replace(',', '.');
      else if (ld > lc && c.length - ld <= 3) c = c.replace(/,/g, '');
      else c = c.replace(/[.,]/g, '');
      const n = parseFloat(c);
      return isFinite(n) && n > 0 ? n : null;
    }

    function detect(raw) {
      const s = raw.trim();
      if (!s || s.length > 60) return null;
      // 1) عملات
      const cm = s.match(/^(?:([$€£])\\s*([\\d.,]+)|([\\d.,]+)\\s*(USD|EUR|GBP|SAR|AED|MAD|TRY|EGP|\\$|€|£))$/i);
      if (cm) {
        const sym = (cm[1] || cm[4] || '').toUpperCase();
        const map = { '$': 'USD', '€': 'EUR', '£': 'GBP' };
        const code = map[sym] || sym;
        const val = parseNum(cm[2] || cm[3]);
        if (val && R[code]) {
          const usd = val / R[code];
          const targets = code === 'EUR' ? ['USD', 'MAD', 'SAR'] : ['EUR', 'USD', 'SAR'];
          const parts = targets.filter(t => t !== code && R[t]).slice(0, 2).map(t => (usd * R[t]).toFixed(2) + ' ' + t);
          if (parts.length) return '💱 ' + parts.join('  ·  ');
        }
      }
      // 2) وحدات قياس وحرارة
      const um = s.match(/^(-?[\\d.,]+)\\s*(in|inch|inches|ft|feet|mi|miles|mile|lb|lbs|pound|pounds|oz|°?f|°?c|km|cm|kg|mph|km\\/h)$/i);
      if (um) {
        const v = parseFloat(um[1].replace(',', '.'));
        if (!isFinite(v)) return null;
        const u = um[2].toLowerCase().replace('°', '');
        if (/^(in|inch|inches)$/.test(u)) return '📏 ' + (v * 2.54).toFixed(1) + ' cm';
        if (/^(ft|feet)$/.test(u)) return '📏 ' + (v * 0.3048).toFixed(2) + ' m';
        if (/^(mi|mile|miles)$/.test(u)) return '📏 ' + (v * 1.60934).toFixed(2) + ' km';
        if (/^(lb|lbs|pound|pounds)$/.test(u)) return '⚖️ ' + (v * 0.453592).toFixed(2) + ' kg';
        if (u === 'oz') return '⚖️ ' + (v * 28.3495).toFixed(1) + ' g';
        if (u === 'f') return '🌡️ ' + (((v - 32) * 5) / 9).toFixed(1) + ' °C';
        if (u === 'c') return '🌡️ ' + ((v * 9) / 5 + 32).toFixed(1) + ' °F';
        if (u === 'km') return '📏 ' + (v * 0.621371).toFixed(2) + ' mi';
        if (u === 'cm') return '📏 ' + (v / 2.54).toFixed(2) + ' in';
        if (u === 'kg') return '⚖️ ' + (v * 2.20462).toFixed(2) + ' lbs';
        if (u === 'mph') return '🚗 ' + (v * 1.60934).toFixed(1) + ' km/h';
        if (u === 'km/h') return '🚗 ' + (v * 0.621371).toFixed(1) + ' mph';
      }
      return null;
    }

    function show(text, rect) {
      hide();
      tip = document.createElement('div');
      tip.id = '__mbSmartTip';
      tip.textContent = text;
      tip.style.cssText = 'position:fixed;z-index:2147483647;padding:6px 12px;border-radius:10px;background:#12152E;color:#EEF0FF;border:1px solid rgba(139,124,255,.55);box-shadow:0 10px 28px rgba(0,0,0,.5);font:600 13px/1.3 "Segoe UI",system-ui,sans-serif;pointer-events:auto;cursor:pointer;white-space:nowrap;direction:' + (isAr ? 'rtl' : 'ltr') + ';';
      const top = Math.max(8, rect.top - 40);
      const left = Math.min(window.innerWidth - 240, Math.max(8, rect.left));
      tip.style.top = top + 'px';
      tip.style.left = left + 'px';
      tip.title = isAr ? 'انقر للنسخ' : 'Click to copy';
      tip.onclick = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(text.replace(/^[^\\d-]+/, '')); } catch {} hide(); };
      document.documentElement.append(tip);
    }

    document.addEventListener('mouseup', () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) { hide(); return; }
        const txt = sel.toString().trim();
        const res = detect(txt);
        if (!res) { hide(); return; }
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0) show(res, rect);
        } catch { hide(); }
      }, 20);
    }, { passive: true });
    document.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('mousedown', (e) => { if (tip && !tip.contains(e.target)) hide(); }, { passive: true });
  })()`;
}

module.exports = (ctx) => {
  setTimeout(refreshRates, 15000);
  setInterval(refreshRates, 24 * 60 * 60 * 1000);

  ctx.hooks.navigated.push((_w, _id, wc, url) => {
    try {
      if (!wc || wc.isDestroyed() || !/^https?:\/\//i.test(url || '')) return;
      if (/\.mybrowser\.invalid\b/i.test(url)) return;
      const lang = (ctx.lang() || 'en').slice(0, 2);
      wc.executeJavaScript(buildScript(RATES, lang)).catch(() => {});
    } catch {}
  });
};
