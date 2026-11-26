// حارس الرام والمعالج وتنظيف المساحة التلقائي الصامت (Silent Auto RAM, CPU & Disk Guard)
// يعمل أوتوماتيكياً بالكامل بدون إزعاج أو إشعارات:
// 1) تقييد استهلاك المعالج في التبويبات الخلفية (setBackgroundThrottling)
// 2) تنويم ذكي وتلقائي للتبويبات الخاملة (5 دقائق عند فتح أكثر من 3 تبويبات، مع استثناء التبويب النشط والصوت والمواقع الحساسة)
// 3) تنظيف صامت للكاش المؤقت دورياً وعند الإغلاق دون المساس بتسجيل الدخول أو الكوكيز
const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');

const CHECK_MS = 30 * 1000;          // فحص خفيف كل 30 ثانية
const FAST_IDLE_MS = 4 * 60 * 1000;  // 4 دقائق عند وجود أكثر من 3 تبويبات لتوفير أكبر للرام
const NORM_IDLE_MS = 8 * 60 * 1000;  // 8 دقائق في الوضع العادي
const CACHE_CLEAN_MS = 6 * 60 * 60 * 1000; // تنظيف الكاش كل 6 ساعات

module.exports = (ctx) => {
  const { tabs, alive, sendTabs } = ctx;

  function applyThrottling(w) {
    if (!w) return;
    for (const id of w.order) {
      const tb = tabs.get(id);
      if (!tb || !alive(tb)) continue;
      try {
        tb.view.webContents.setBackgroundThrottling(id !== w.activeId);
      } catch {}
    }
  }

  function sleepQuietly(w, id) {
    const tb = tabs.get(id);
    if (!tb || tb.sleeping || !alive(tb) || id === w.activeId) return false;
    const wc = tb.view.webContents;
    let url = '';
    try { url = wc.getURL(); } catch { return false; }
    if (!/^https?:\/\//i.test(url) || /\.mybrowser\.invalid\b/i.test(url)) return false;
    try { if (wc.isCurrentlyAudible()) return false; } catch {}
    if (ctx.isSensitive && ctx.isSensitive(url)) return false;
    let title = url;
    try { title = wc.getTitle() || url; } catch {}
    tb.sleeping = { url, title, favicon: tb.favicon || '' };
    try {
      wc.loadURL('about:blank').catch(() => {});
      wc.setBackgroundThrottling(true);
    } catch {}
    return true;
  }

  // ضبط وقت النشاط + تفعيل التقييد الخلفي فور إنشاء/تبديل التبويبات
  ctx.hooks.tabCreated.push((w, id) => {
    const tb = tabs.get(id);
    if (tb) tb.lastActive = Date.now();
    applyThrottling(w);
  });
  ctx.hooks.tabActivated.push((w, id) => {
    const tb = tabs.get(id);
    if (tb) tb.lastActive = Date.now();
    applyThrottling(w);
  });

  // تنويم تلقائي ذكي في الخلفية بدون أي إشعارات مزعجة
  setInterval(() => {
    const now = Date.now();
    for (const w of ctx.windows) {
      if (!w || !w.order || w.order.length <= 1) continue;
      // عدد التبويبات الحية (غير النائمة)
      let awakeCount = 0;
      for (const id of w.order) {
        const tb = tabs.get(id);
        if (tb && !tb.sleeping && alive(tb)) awakeCount++;
      }
      if (awakeCount <= 1) continue;
      const limit = awakeCount > 3 ? FAST_IDLE_MS : NORM_IDLE_MS;
      let changed = false;
      for (const id of [...w.order]) {
        if (id === w.activeId) continue;
        const tb = tabs.get(id);
        if (!tb || tb.sleeping || !alive(tb)) continue;
        const idle = now - (tb.lastActive || now);
        if (idle >= limit && sleepQuietly(w, id)) changed = true;
      }
      if (changed) {
        try { sendTabs(w); } catch {}
      }
    }
  }, CHECK_MS);

  // تنظيف صامت للكاش فقط (يحافظ على الكوكيز وتسجيل الدخول 100%)
  async function trimCaches() {
    try {
      const seen = new Set();
      for (const p of (ctx.settings.profiles || [])) {
        const part = p.id === 'default' ? 'persist:main' : 'persist:p-' + p.id;
        if (seen.has(part)) continue;
        seen.add(part);
        const ses = session.fromPartition(part);
        await ses.clearCache().catch(() => {});
        await ses.clearCodeCaches({}).catch(() => {});
      }
      await session.defaultSession.clearCache().catch(() => {});
    } catch {}
    // تقليم ملف السجل القديم إن تجاوز 2 ميجابايت
    try {
      const oldLog = path.join(app.getPath('userData'), 'mybrowser.log.old');
      if (fs.existsSync(oldLog) && fs.statSync(oldLog).size > 2e6) fs.unlinkSync(oldLog);
    } catch {}
  }

  setInterval(trimCaches, CACHE_CLEAN_MS);
  app.on('will-quit', () => { trimCaches(); });

  // دالة اختيارية للوحة الأوامر لتنويم كل التبويبات الخلفية فوراً
  ctx.sleepIdleNow = (w) => {
    if (!w) return 0;
    let n = 0;
    for (const id of [...w.order]) if (sleepQuietly(w, id)) n++;
    if (n) { try { sendTabs(w); } catch {} }
    return n;
  };
};
