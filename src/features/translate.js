// ترجمة الصفحة الحالية إلى لغة الواجهة (مجاناً، بلا مفتاح) — Ctrl+Shift+Y للترجمة/الرجوع
// الجلب يتم في العملية الرئيسية (بلا قيود CORS)، والاستبدال في الصفحة مع حفظ النص الأصلي للرجوع.
const { app } = require('electron');

// يجمع العُقد النصية المرئية ويخزّن مراجعها على window لإعادة الاستبدال لاحقاً
const COLLECT = `(() => {
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','CODE','PRE','SVG','CANVAS']);
  window.__mbtr = { nodes: {}, orig: {} };
  const items = []; let id = 0;
  const root = document.body; if (!root) return items;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue; if (!v || !v.trim() || v.trim().length < 2) return NodeFilter.FILTER_REJECT;
      if (!/[\\p{L}]/u.test(v)) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement; if (!p || SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
      const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n; while ((n = walker.nextNode()) && items.length < 800) {
    const key = 't' + (id++); window.__mbtr.nodes[key] = n; window.__mbtr.orig[key] = n.nodeValue;
    items.push({ id: key, text: n.nodeValue.trim() });
  }
  return items;
})()`;

const applyScript = (mapJson) => `(() => {
  const m = ${mapJson}; const S = window.__mbtr; if (!S) return 0; let c = 0;
  for (const k in m) { const node = S.nodes[k]; if (!node) continue; const orig = S.orig[k] || node.nodeValue;
    const lead = (orig.match(/^\\s*/) || [''])[0], tail = (orig.match(/\\s*$/) || [''])[0];
    node.nodeValue = lead + m[k] + tail; c++; }
  return c;
})()`;

const REVERT = `(() => { const S = window.__mbtr; if (!S) return 0; let c = 0;
  for (const k in S.nodes) { const node = S.nodes[k]; if (node && S.orig[k] != null) { node.nodeValue = S.orig[k]; c++; } }
  window.__mbtr = null; return c; })()`;

// ترجمة قائمة نصوص عبر Google Translate المجاني (dedupe + تزامن محدود). fetchImpl قابل للحقن للاختبار.
async function translateBatch(strings, target, fetchImpl) {
  const uniq = [...new Set(strings)];
  const out = new Map();
  const one = async (text) => {
    try {
      const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
        encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(text);
      const r = await fetchImpl(url);
      const j = await r.json();
      const tr = Array.isArray(j && j[0]) ? j[0].map(s => (s && s[0]) || '').join('') : '';
      out.set(text, tr || text);
    } catch { out.set(text, text); }
  };
  const pool = 6;
  for (let i = 0; i < uniq.length; i += pool) await Promise.all(uniq.slice(i, i + pool).map(one));
  return out;
}

module.exports = (ctx) => {
  const translated = new WeakSet();

  function ownerOf(wc) {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id); if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  }

  async function translatePage(w) {
    const wc = ctx.activeWc(w); if (!wc) return;
    const target = ctx.lang();
    if (translated.has(wc)) {           // تبديل: ارجع للأصل
      await wc.executeJavaScript(REVERT).catch(() => {});
      translated.delete(wc); ctx.toast('↩ ' + (ctx.t('trRevert') || 'Original text'), w); return;
    }
    let items = [];
    try { items = await wc.executeJavaScript(COLLECT); } catch { items = []; }
    if (!items || !items.length) { ctx.toast(ctx.t('trNone') || 'Nothing to translate', w); return; }
    ctx.toast('🌐 ' + (ctx.t('trWorking') || 'Translating…'), w);
    const fetchImpl = (url) => ctx.sesOf(w).fetch(url);
    const map = await translateBatch(items.map(i => i.text), target, fetchImpl);
    const out = {}; for (const it of items) out[it.id] = map.get(it.text) || it.text;
    const n = await wc.executeJavaScript(applyScript(JSON.stringify(out))).catch(() => 0);
    if (n) { translated.add(wc); ctx.toast('✅ ' + (ctx.t('trDone') || 'Page translated'), w); }
    else ctx.toast(ctx.t('trNone') || 'Nothing to translate', w);
  }
  ctx.translatePage = translatePage;

  // عند مغادرة الصفحة ننسى حالتها
  ctx.hooks.navigated.push((w, id, wc) => translated.delete(wc));

  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (ev, input) => {
      if (input.type === 'keyDown' && (input.control || input.meta) && input.shift && !input.alt && input.key && input.key.toLowerCase() === 'y') {
        const w = ownerOf(wc); if (w) { ev.preventDefault(); translatePage(w); }
      }
    });
  });
};
module.exports.translateBatch = translateBatch;
module.exports._scripts = { COLLECT, applyScript, REVERT };
