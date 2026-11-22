// الفيديو العائم: زر «الرجوع إلى التبويب» يعيد المتصفح كاملاً إلى الشاشة مباشرة
// (بدل أن يبقى المتصفح مصغّراً في شريط المهام)
const WATCH = `(async () => {
  let v = null;
  for (let i = 0; i < 30 && !v; i++) { v = document.pictureInPictureElement; if (!v) await new Promise(r => setTimeout(r, 100)); }
  if (!v) return false;
  await new Promise(r => v.addEventListener('leavepictureinpicture', r, { once: true }));
  await new Promise(r => setTimeout(r, 350));
  return !v.paused; // زر الإغلاق يوقف الفيديو، أما زر الرجوع فيتركه يعمل
})()`;

module.exports = (ctx) => {
  const { tabs, alive } = ctx;
  ctx.hooks.windowReady.push((w) => {
    if (w.pipBackHooked) return;
    w.pipBackHooked = true;
    w.win.on('minimize', () => {
      setTimeout(() => {
        for (const id of w.order) {
          const tb = tabs.get(id);
          if (!alive(tb)) continue;
          tb.view.webContents.executeJavaScript(WATCH, true).then((back) => {
            if (back && !w.win.isDestroyed() && w.win.isMinimized()) { w.win.restore(); w.win.focus(); }
          }).catch(() => {});
        }
      }, 200);
    });
  });
};
