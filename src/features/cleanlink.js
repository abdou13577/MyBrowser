// منظّف الروابط والتتبع الذكي عند النسخ (Clean Copy Link)
// يحذف معاملات التتبع (utm_*, fbclid, gclid, si, igsh, ref...) عند النسخ أو بالاختصار Ctrl+Shift+C
const { app, clipboard, ipcMain, BrowserWindow } = require('electron');

const TRACK_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'ttclid', 'twclid', 'li_fat_id',
  'mc_cid', 'mc_eid', 'si', 'igsh', 'igshid', 'ref', 'ref_src', 'ref_url', 'spm', 'scm', 'feature',
  'pp', 'tt_medium', 'tt_content', '_trksid', 'qid', 'sr', 'dib', 'dib_tag', 'smid', 'psc', 'tag',
  'mibextid', 'rdid', 'share_url', 'share_id', 'fb_action_ids', 'fb_action_types', 'fb_source',
  'ved', 'ei', 'oq', 'gs_lcrp', 'sourceid', 'sxsrf', 'uact', 'sca_esv', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_reader', 'utm_name', 'utm_pubreferrer'
]);
const TRACK_PREFIX = ['utm_', 'pd_rd_', 'pf_rd_', 'mc_', 'ga_', 'hsa_', 'oly_', 'vero_', 'wicked', '_hs'];

function cleanUrl(raw) {
  const s = String(raw || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s) || /\s/.test(s)) return { url: s, removed: 0 };
  let u;
  try { u = new URL(s); } catch { return { url: s, removed: 0 }; }
  let removed = 0;
  for (const k of [...u.searchParams.keys()]) {
    const kl = k.toLowerCase();
    if (TRACK_EXACT.has(kl) || TRACK_PREFIX.some(p => kl.startsWith(p))) {
      u.searchParams.delete(k);
      removed++;
    }
  }
  // تنظيف مسار أمازون /ref=...
  if (/(^|\.)amazon\./i.test(u.hostname) && /\/ref=[^/?#]*/i.test(u.pathname)) {
    u.pathname = u.pathname.replace(/\/ref=[^/?#]*/i, '');
    removed++;
  }
  return { url: u.toString(), removed };
}

const MSG = {
  ar: { copied: 'تم نسخ رابط نظيف', removed: (n) => `تم نسخ رابط نظيف (أُزيل ${n} متعقّب)`, auto: (n) => `نُظّف الرابط المنسوخ (أُزيل ${n} متعقّب)`, none: 'لا يوجد رابط لنسخه' },
  en: { copied: 'Clean link copied', removed: (n) => `Clean link copied (${n} trackers removed)`, auto: (n) => `Copied link cleaned (${n} trackers removed)`, none: 'No URL to copy' },
  de: { copied: 'Sauberer Link kopiert', removed: (n) => `Sauberer Link kopiert (${n} Tracker entfernt)`, auto: (n) => `Link bereinigt (${n} Tracker entfernt)`, none: 'Keine URL zum Kopieren' },
  fr: { copied: 'Lien propre copié', removed: (n) => `Lien propre copié (${n} traceurs supprimés)`, auto: (n) => `Lien nettoyé (${n} traceurs supprimés)`, none: 'Aucune URL à copier' },
  es: { copied: 'Enlace limpio copiado', removed: (n) => `Enlace limpio copiado (${n} rastreadores eliminados)`, auto: (n) => `Enlace limpiado (${n} rastreadores eliminados)`, none: 'No hay URL para copiar' },
  it: { copied: 'Link pulito copiato', removed: (n) => `Link pulito copiato (${n} tracker rimossi)`, auto: (n) => `Link pulito (${n} tracker rimossi)`, none: 'Nessun URL da copiare' },
  tr: { copied: 'Temiz bağlantı kopyalandı', removed: (n) => `Temiz bağlantı kopyalandı (${n} izleyici kaldırıldı)`, auto: (n) => `Bağlantı temizlendi (${n} izleyici kaldırıldı)`, none: 'Kopyalanacak URL yok' }
};

module.exports = (ctx) => {
  const tr = () => MSG[(ctx.lang() || 'en').slice(0, 2)] || MSG.en;
  let lastClip = '';

  function copyCleanFor(w) {
    const wc = ctx.activeWc(w);
    const raw = wc ? wc.getURL() : '';
    if (!raw || !/^https?:\/\//i.test(raw) || /\.mybrowser\.invalid\b/i.test(raw)) {
      ctx.toast(`🔗 ${tr().none}`, w);
      return { ok: false };
    }
    const { url, removed } = cleanUrl(raw);
    lastClip = url;
    try { clipboard.writeText(url); } catch {}
    ctx.toast(`🔗 ${removed > 0 ? tr().removed(removed) : tr().copied}`, w);
    return { ok: true, url, removed };
  }

  ctx.cleanUrl = cleanUrl;
  ctx.copyCleanLink = copyCleanFor;

  ipcMain.handle('cleanlink:copy', (e) => copyCleanFor(ctx.W(e)));
  ipcMain.handle('cleanlink:toggleAuto', () => {
    ctx.settings.autoCleanLinks = ctx.settings.autoCleanLinks === false ? true : false;
    ctx.saveSettings();
    return { enabled: ctx.settings.autoCleanLinks !== false };
  });

  // تنظيف تلقائي هادئ للحافظة عند نسخ رابط يحتوي متعقبات أثناء التركيز على المتصفح
  setInterval(() => {
    try {
      if (ctx.settings.autoCleanLinks === false) return;
      const focused = [...ctx.windows].find(w => w.win && !w.win.isDestroyed() && w.win.isFocused());
      if (!focused) return;
      const cur = String(clipboard.readText() || '').trim();
      if (!cur || cur === lastClip) return;
      lastClip = cur;
      if (!/^https?:\/\/\S+$/i.test(cur)) return;
      const { url, removed } = cleanUrl(cur);
      if (removed > 0 && url !== cur) {
        lastClip = url;
        clipboard.writeText(url);
        ctx.toast(`🧹 ${tr().auto(removed)}`, focused);
      }
    } catch {}
  }, 900);

  // اختصار Ctrl+Shift+C لنسخ رابط نظيف
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'c') {
        const w = ownerOf(wc);
        if (w) { ev.preventDefault(); copyCleanFor(w); }
      }
    });
  });
};
