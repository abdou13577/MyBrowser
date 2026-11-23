// إعادة فتح آخر تبويب مُغلق (Ctrl+Shift+T) — مثل كروم
// مستقل: لا يعدّل العملية الرئيسية. يتتبّع عناوين التبويبات ويعيد فتح آخرها المغلق.
const { app } = require('electron');

module.exports = (ctx) => {
  const lastOf = new Map();      // tab id -> { url, title }  (آخر عنوان شاهده التبويب)
  const MAX = 25;

  const skip = (u) => !u || ctx.isStartPage(u) || u === 'about:blank' || /^zaki:\/\//i.test(u) || /mybrowser\.invalid/i.test(u);

  function ownerOf(wc) {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  }

  // تحديث آخر عنوان لكل تبويب عند التنقل
  ctx.hooks.navigated.push((w, id, wc, url) => {
    if (skip(url)) { lastOf.delete(id); return; }
    let title = ''; try { title = wc.getTitle(); } catch {}
    lastOf.set(id, { url, title: title || url });
    setTimeout(() => { try { if (!wc.isDestroyed()) { const t = wc.getTitle(); if (t) lastOf.set(id, { url: wc.getURL() || url, title: t }); } } catch {} }, 600);
  });

  // عند إنشاء التبويب: راقب إغلاقه لندفعه إلى مكدّس «المغلقة»
  ctx.hooks.tabCreated.push((w, id, wc) => {
    // استهلاك طلب إعادة الفتح المعلّق (نتركه بعد أن تنشئ العملية الرئيسية التبويب الجديد)
    if (w._reopen && w._reopen.length) {
      const url = w._reopen.pop();
      setImmediate(() => { try { if (!wc.isDestroyed()) wc.loadURL(url).catch(() => {}); } catch {} });
    }
    wc.once('destroyed', () => {
      const info = lastOf.get(id); lastOf.delete(id);
      if (!w || !ctx.windows.has(w) || !info || skip(info.url)) return;
      w._closed = w._closed || [];
      // لا نكرّر نفس العنوان في الأعلى
      if (w._closed[w._closed.length - 1] !== info.url) { w._closed.push(info.url); if (w._closed.length > MAX) w._closed.shift(); }
    });
  });

  // Ctrl+Shift+T: حضّر العنوان المُعاد، ودع العملية الرئيسية تنشئ التبويب (معالِجنا يسبقها)
  app.on('web-contents-created', (_e, wc) => {
    wc.on('before-input-event', (_ev, input) => {
      if (input.type !== 'keyDown') return;
      const mod = input.control || input.meta;
      if (mod && input.shift && !input.alt && input.key && input.key.toLowerCase() === 't') {
        const w = ownerOf(wc);
        if (!w || !w._closed || !w._closed.length) return;    // لا شيء لإعادته: تبويب جديد عادي
        const url = w._closed.pop();
        w._reopen = w._reopen || []; w._reopen.push(url);     // سيُستهلك في hook tabCreated
      }
    });
  });

  // واجهة برمجية بسيطة (للاستخدام المستقبلي)
  ctx.reopenClosed = (w) => {
    if (!w || !w._closed || !w._closed.length) return false;
    ctx.createTab(w, w._closed.pop());
    return true;
  };
};
