// إصلاح الوضع الداكن: منع انقلاب ألوان الصور والفيديوهات (خاصة داخل <picture> و[role="img"] وملء الشاشة)
// السبب القديم: تطبيق filter: invert(1) على picture وعلى img بداخلها معاً كان يعكس ألوان الصورة مرتين!
const FIXED_DARK_CSS = `
html {
  filter: invert(0.92) hue-rotate(180deg) !important;
  background: #fff !important;
}
picture {
  filter: none !important;
}
img, video, canvas, iframe, embed, object, svg image,
[style*="background-image"]:not(:has(img, video, canvas, picture)),
[role="img"]:not(:has(img, video, canvas, picture)) {
  filter: invert(1) hue-rotate(180deg) !important;
}
[style*="background-image"]:not(:has(img, video, canvas, picture)) *,
[role="img"]:not(:has(img, video, canvas, picture)) * {
  filter: none !important;
}
video:fullscreen,
video:-webkit-full-screen,
:fullscreen img,
:fullscreen video,
:-webkit-full-screen img,
:-webkit-full-screen video {
  filter: none !important;
}
`;

module.exports = (ctx) => {
  if (ctx && ctx.inj) {
    ctx.inj.DARK_CSS = FIXED_DARK_CSS;
  }
};
