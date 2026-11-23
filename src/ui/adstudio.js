// استوديو الإعلانات — محرك التركيب والحركة (كل شيء في المتصفح، مجاناً)
const $ = (s) => document.querySelector(s);
const code = (new URLSearchParams(location.search).get('lang') || navigator.language || 'en').slice(0, 2);
const RTL = code === 'ar';
const M = ({
  ar: { tag: 'إعلانات احترافية من صورك — مجاناً', video: 'فيديو', image: 'صورة', upload: 'الصور', drop: 'اسحب صورك هنا أو اضغط للاختيار', brief: 'عن ماذا الإعلان؟', briefPh: 'مثال: عرض خاص على عطر فاخر، خصم 30٪، توصيل مجاني', ai: '✨ اكتب النص بالذكاء الاصطناعي', aiHint: 'يكتب العنوان والسيناريو تلقائياً (يحتاج مفتاح الذكاء الاصطناعي في الإعدادات).', headline: 'العنوان', sub: 'سطر ثانوي', cta: 'زر الحث (CTA)', aspect: 'المقاس', template: 'القالب', color: 'اللون المميّز', colorHint: 'يُؤخذ من الذكاء الاصطناعي أيضاً', logo: 'الشعار (اختياري)', logoAdd: 'إضافة شعار', logoSet: 'تم ✓ (اضغط للتغيير)', music: 'موسيقى خلفية', play: '▶ معاينة', exportV: '⬇ تصدير الفيديو', exportI: '⬇ تصدير الصورة', reveal: '📂 فتح المجلد', needImg: 'أضف صورة واحدة على الأقل.', thinking: 'يكتب الذكاء الاصطناعي…', noKey: 'أضف مفتاح الذكاء الاصطناعي في إعدادات المتصفح لاستخدام الكتابة التلقائية.', rendering: 'جارٍ التصدير…', savedI: 'حُفظت الصورة في مجلد الصور ← MyBrowser Ads', savedV: 'حُفظ الفيديو في مجلد الفيديوهات ← MyBrowser Ads', fail: 'تعذّر الحفظ:' },
  en: { tag: 'Professional ads from your photos — free', video: 'Video', image: 'Image', upload: 'Photos', drop: 'Drag photos here or click to choose', brief: 'What is the ad about?', briefPh: 'e.g. Special offer on a luxury perfume, 30% off, free delivery', ai: '✨ Write copy with AI', aiHint: 'Writes the headline and storyboard automatically (needs an AI key in Settings).', headline: 'Headline', sub: 'Subheadline', cta: 'Call to action (CTA)', aspect: 'Size', template: 'Template', color: 'Accent color', colorHint: 'Also chosen by AI', logo: 'Logo (optional)', logoAdd: 'Add logo', logoSet: 'Set ✓ (click to change)', music: 'Background music', play: '▶ Preview', exportV: '⬇ Export video', exportI: '⬇ Export image', reveal: '📂 Open folder', needImg: 'Add at least one photo.', thinking: 'AI is writing…', noKey: 'Add an AI key in the browser settings to use auto-writing.', rendering: 'Exporting…', savedI: 'Image saved to Pictures → MyBrowser Ads', savedV: 'Video saved to Videos → MyBrowser Ads', fail: 'Could not save:' },
  de: { tag: 'Professionelle Werbung aus deinen Fotos — kostenlos', video: 'Video', image: 'Bild', upload: 'Fotos', drop: 'Fotos hierher ziehen oder klicken', brief: 'Worum geht die Werbung?', briefPh: 'z. B. Sonderangebot für ein Luxusparfüm, 30% Rabatt', ai: '✨ Text mit KI schreiben', aiHint: 'Schreibt Überschrift und Storyboard automatisch (KI-Schlüssel nötig).', headline: 'Überschrift', sub: 'Unterzeile', cta: 'Handlungsaufruf (CTA)', aspect: 'Format', template: 'Vorlage', color: 'Akzentfarbe', colorHint: 'Auch von KI gewählt', logo: 'Logo (optional)', logoAdd: 'Logo hinzufügen', logoSet: 'Gesetzt ✓', music: 'Hintergrundmusik', play: '▶ Vorschau', exportV: '⬇ Video exportieren', exportI: '⬇ Bild exportieren', reveal: '📂 Ordner öffnen', needImg: 'Füge mindestens ein Foto hinzu.', thinking: 'KI schreibt…', noKey: 'Füge einen KI-Schlüssel in den Einstellungen hinzu.', rendering: 'Exportiere…', savedI: 'Bild in Bilder → MyBrowser Ads gespeichert', savedV: 'Video in Videos → MyBrowser Ads gespeichert', fail: 'Speichern fehlgeschlagen:' },
  fr: { tag: 'Des pubs pro à partir de vos photos — gratuit', video: 'Vidéo', image: 'Image', upload: 'Photos', drop: 'Glissez vos photos ici ou cliquez', brief: 'De quoi parle la pub ?', briefPh: 'ex. Offre sur un parfum de luxe, -30%, livraison gratuite', ai: '✨ Rédiger avec l\'IA', aiHint: 'Écrit le titre et le storyboard (clé IA requise).', headline: 'Titre', sub: 'Sous-titre', cta: 'Appel à l\'action (CTA)', aspect: 'Format', template: 'Modèle', color: 'Couleur d\'accent', colorHint: 'Aussi choisie par l\'IA', logo: 'Logo (optionnel)', logoAdd: 'Ajouter un logo', logoSet: 'Défini ✓', music: 'Musique de fond', play: '▶ Aperçu', exportV: '⬇ Exporter la vidéo', exportI: '⬇ Exporter l\'image', reveal: '📂 Ouvrir le dossier', needImg: 'Ajoutez au moins une photo.', thinking: 'L\'IA rédige…', noKey: 'Ajoutez une clé IA dans les réglages.', rendering: 'Export…', savedI: 'Image enregistrée dans Images → MyBrowser Ads', savedV: 'Vidéo enregistrée dans Vidéos → MyBrowser Ads', fail: 'Échec :' },
  es: { tag: 'Anuncios profesionales desde tus fotos — gratis', video: 'Vídeo', image: 'Imagen', upload: 'Fotos', drop: 'Arrastra fotos aquí o haz clic', brief: '¿De qué trata el anuncio?', briefPh: 'ej. Oferta en un perfume de lujo, 30% de descuento', ai: '✨ Escribir con IA', aiHint: 'Escribe el titular y el guion (requiere clave de IA).', headline: 'Titular', sub: 'Subtítulo', cta: 'Llamada a la acción (CTA)', aspect: 'Tamaño', template: 'Plantilla', color: 'Color de acento', colorHint: 'También elegido por la IA', logo: 'Logo (opcional)', logoAdd: 'Añadir logo', logoSet: 'Listo ✓', music: 'Música de fondo', play: '▶ Vista previa', exportV: '⬇ Exportar vídeo', exportI: '⬇ Exportar imagen', reveal: '📂 Abrir carpeta', needImg: 'Añade al menos una foto.', thinking: 'La IA escribe…', noKey: 'Añade una clave de IA en los ajustes.', rendering: 'Exportando…', savedI: 'Imagen guardada en Imágenes → MyBrowser Ads', savedV: 'Vídeo guardado en Vídeos → MyBrowser Ads', fail: 'No se pudo guardar:' },
  it: { tag: 'Annunci professionali dalle tue foto — gratis', video: 'Video', image: 'Immagine', upload: 'Foto', drop: 'Trascina le foto qui o clicca', brief: 'Di cosa parla l\'annuncio?', briefPh: 'es. Offerta su un profumo di lusso, 30% di sconto', ai: '✨ Scrivi con l\'IA', aiHint: 'Scrive titolo e storyboard (serve una chiave IA).', headline: 'Titolo', sub: 'Sottotitolo', cta: 'Invito all\'azione (CTA)', aspect: 'Formato', template: 'Modello', color: 'Colore d\'accento', colorHint: 'Scelto anche dall\'IA', logo: 'Logo (opzionale)', logoAdd: 'Aggiungi logo', logoSet: 'Impostato ✓', music: 'Musica di sottofondo', play: '▶ Anteprima', exportV: '⬇ Esporta video', exportI: '⬇ Esporta immagine', reveal: '📂 Apri cartella', needImg: 'Aggiungi almeno una foto.', thinking: 'L\'IA sta scrivendo…', noKey: 'Aggiungi una chiave IA nelle impostazioni.', rendering: 'Esportazione…', savedI: 'Immagine salvata in Immagini → MyBrowser Ads', savedV: 'Video salvato in Video → MyBrowser Ads', fail: 'Salvataggio non riuscito:' },
  tr: { tag: 'Fotoğraflarından profesyonel reklamlar — ücretsiz', video: 'Video', image: 'Görsel', upload: 'Fotoğraflar', drop: 'Fotoğrafları buraya sürükle veya tıkla', brief: 'Reklam ne hakkında?', briefPh: 'örn. Lüks parfümde özel teklif, %30 indirim', ai: '✨ Yapay zeka ile yaz', aiHint: 'Başlığı ve storyboard\'u otomatik yazar (YZ anahtarı gerekir).', headline: 'Başlık', sub: 'Alt başlık', cta: 'Eylem çağrısı (CTA)', aspect: 'Boyut', template: 'Şablon', color: 'Vurgu rengi', colorHint: 'YZ da seçer', logo: 'Logo (isteğe bağlı)', logoAdd: 'Logo ekle', logoSet: 'Ayarlandı ✓', music: 'Arka plan müziği', play: '▶ Önizleme', exportV: '⬇ Videoyu dışa aktar', exportI: '⬇ Görseli dışa aktar', reveal: '📂 Klasörü aç', needImg: 'En az bir fotoğraf ekle.', thinking: 'YZ yazıyor…', noKey: 'Ayarlardan bir YZ anahtarı ekle.', rendering: 'Dışa aktarılıyor…', savedI: 'Görsel Resimler → MyBrowser Ads klasörüne kaydedildi', savedV: 'Video Videolar → MyBrowser Ads klasörüne kaydedildi', fail: 'Kaydedilemedi:' }
});
const L = M[code] || M.en;

document.documentElement.lang = code; document.documentElement.dir = RTL ? 'rtl' : 'ltr';

// ---------- الحالة ----------
const state = {
  mode: 'video', images: [], logo: null, aspect: '9:16', template: 0, accent: '#8B7CFF',
  headline: '', sub: '', cta: '', storyboard: null, music: true, lastFile: null, rendering: false
};
const ASPECTS = ['9:16', '1:1', '4:5', '16:9'];
const DIMS = { // أبعاد التصدير (مناسبة للتسجيل الحيّ)
  video: { '9:16': [720, 1280], '1:1': [1000, 1000], '4:5': [900, 1125], '16:9': [1280, 720] },
  image: { '9:16': [1080, 1920], '1:1': [1200, 1200], '4:5': [1080, 1350], '16:9': [1600, 900] }
};
const cv = $('#preview'), g = cv.getContext('2d');

// ---------- ترجمة الواجهة ----------
function applyText() {
  $('#tagline').textContent = L.tag;
  $('#mVideo').textContent = L.video; $('#mImage').textContent = L.image;
  $('#lUpload').textContent = L.upload; $('#dropText').textContent = L.drop;
  $('#lBrief').textContent = L.brief; $('#brief').placeholder = L.briefPh;
  $('#aiLabel').textContent = L.ai; $('#aiHint').textContent = L.aiHint;
  $('#lHeadline').textContent = L.headline; $('#lSub').textContent = L.sub; $('#lCta').textContent = L.cta;
  $('#lAspect').textContent = L.aspect; $('#lTemplate').textContent = L.template;
  $('#lColor').textContent = L.color; $('#colorHint').textContent = L.colorHint;
  $('#lLogo').textContent = L.logo; $('#logoBtn').textContent = L.logoAdd; $('#lMusic').textContent = L.music;
  $('#playBtn').textContent = L.play; $('#revealBtn').textContent = L.reveal;
  updateExportLabel();
}
function updateExportLabel() { $('#exportBtn').textContent = state.mode === 'video' ? L.exportV : L.exportI; }
function msg(t, color) { const m = $('#msg'); m.textContent = t || ''; m.style.color = color || 'var(--aqua)'; }

// ---------- رفع الصور ----------
function loadImageFile(file) {
  return new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = URL.createObjectURL(file); });
}
async function addFiles(files) {
  for (const f of [...files]) { if (!f.type.startsWith('image/')) continue; const img = await loadImageFile(f); if (img) state.images.push(img); }
  renderThumbs(); draw();
}
function renderThumbs() {
  const box = $('#thumbs'); box.innerHTML = '';
  state.images.forEach((img, i) => {
    const d = document.createElement('div'); d.className = 'thumb';
    const im = document.createElement('img'); im.src = img.src; d.append(im);
    const x = document.createElement('button'); x.textContent = '✕'; x.onclick = () => { state.images.splice(i, 1); renderThumbs(); draw(); };
    d.append(x); box.append(d);
  });
}
const drop = $('#drop');
drop.onclick = () => $('#file').click();
$('#file').onchange = (e) => addFiles(e.target.files);
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
$('#logoBtn').onclick = () => $('#logoFile').click();
$('#logoFile').onchange = async (e) => { const img = await loadImageFile(e.target.files[0]); if (img) { state.logo = img; $('#logoBtn').textContent = L.logoSet; draw(); } };

// ---------- الحقول ----------
$('#brief').oninput = (e) => state.brief = e.target.value;
$('#headline').oninput = (e) => { state.headline = e.target.value; draw(); };
$('#sub').oninput = (e) => { state.sub = e.target.value; draw(); };
$('#cta').oninput = (e) => { state.cta = e.target.value; draw(); };
$('#accent').oninput = (e) => { state.accent = e.target.value; draw(); };
$('#music').onchange = (e) => state.music = e.target.checked;

// المقاسات
const aspectBox = $('#aspect');
ASPECTS.forEach(a => { const b = document.createElement('button'); b.className = 'chip' + (a === state.aspect ? ' on' : ''); b.textContent = a; b.onclick = () => { state.aspect = a; [...aspectBox.children].forEach(c => c.classList.toggle('on', c.textContent === a)); sizeCanvas(); draw(); }; aspectBox.append(b); });

// القوالب (للصورة)
const TPL_NAMES = 4;
const tplBox = $('#tpl');
for (let i = 0; i < TPL_NAMES; i++) { const b = document.createElement('button'); b.className = i === 0 ? 'on' : ''; const c = document.createElement('canvas'); c.width = 90; c.height = 120; b.append(c); b.onclick = () => { state.template = i; [...tplBox.children].forEach((x, j) => x.classList.toggle('on', j === i)); draw(); }; tplBox.append(b); }

// الوضع
function setMode(m) {
  state.mode = m;
  $('#mVideo').classList.toggle('on', m === 'video'); $('#mImage').classList.toggle('on', m === 'image');
  $('#tplField').classList.toggle('hide', m !== 'image');
  $('#subField').classList.toggle('hide', m !== 'image');
  $('#musicField').classList.toggle('hide', m !== 'video');
  $('#playBtn').classList.toggle('hide', m !== 'video');
  updateExportLabel(); sizeCanvas(); draw();
}
$('#mVideo').onclick = () => setMode('video');
$('#mImage').onclick = () => setMode('image');

// ---------- الذكاء الاصطناعي ----------
$('#aiBtn').onclick = async () => {
  if (!state.brief.trim() && !state.images.length) { msg(L.brief, 'var(--bloom)'); return; }
  const btn = $('#aiBtn'); btn.disabled = true; msg(L.thinking);
  try {
    const r = await window.ad.ai({ kind: state.mode, brief: state.brief, nImages: Math.max(1, state.images.length) });
    if (r.error === 'NO_KEY') { msg(L.noKey, 'var(--bloom)'); return; }
    if (r.error || !r.data) { msg('AI: ' + (r.error || 'error'), 'var(--bloom)'); return; }
    const d = r.data;
    if (d.headline) { state.headline = d.headline; $('#headline').value = d.headline; }
    if (d.subheadline) { state.sub = d.subheadline; $('#sub').value = d.subheadline; }
    if (d.cta) { state.cta = d.cta; $('#cta').value = d.cta; }
    const acc = d.palette && (d.palette.accent || d.palette.bg);
    if (acc && /^#[0-9a-f]{6}$/i.test(acc)) { state.accent = acc; $('#accent').value = acc; }
    if (state.mode === 'video' && Array.isArray(d.scenes)) state.storyboard = d;
    msg('✓');
    draw();
  } catch (e) { msg('AI: ' + e.message, 'var(--bloom)'); } finally { btn.disabled = false; }
};

// ---------- أدوات الرسم ----------
function sizeCanvas() { const [w, h] = DIMS[state.mode][state.aspect]; cv.width = w; cv.height = h; }
function drawCover(ctx, img, dx, dy, dw, dh, scale, cx, cy) {
  if (!img) { ctx.fillStyle = '#15173a'; ctx.fillRect(dx, dy, dw, dh); return; }
  scale = scale || 1; cx = cx == null ? 0.5 : cx; cy = cy == null ? 0.5 : cy;
  const ir = img.width / img.height, dr = dw / dh;
  let sw, sh; if (ir > dr) { sh = img.height / scale; sw = sh * dr; } else { sw = img.width / scale; sh = sw / dr; }
  const sx = (img.width - sw) * cx, sy = (img.height - sh) * cy;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(ctx, text, maxW) { const words = (text || '').split(/\s+/).filter(Boolean); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function fitWrap(ctx, text, maxW, maxLines, startPx, weight, family) { let px = startPx; for (; px > 14; px -= 2) { ctx.font = `${weight} ${px}px ${family}`; const l = wrap(ctx, text, maxW); if (l.length <= maxLines) return { px, lines: l }; } ctx.font = `${weight} ${px}px ${family}`; return { px, lines: wrap(ctx, text, maxW).slice(0, maxLines) }; }
const FONT = '"Segoe UI Variable Display","Segoe UI","Noto Sans Arabic",system-ui,sans-serif';
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function darken(h, f) { const [r, gg, b] = hexToRgb(h); return `rgb(${r * f | 0},${gg * f | 0},${b * f | 0})`; }
function textColorOn(h) { const [r, gg, b] = hexToRgb(h); return (r * 299 + gg * 587 + b * 114) / 1000 > 150 ? '#0A0B16' : '#FFFFFF'; }

// ---------- رسم الصورة الإعلانية ----------
function drawImageAd(ctx, W, H, opt) {
  const img = state.images[0]; const acc = state.accent; const ink = '#FFFFFF';
  const headline = state.headline || (opt && opt.ph ? 'Your headline' : '');
  const sub = state.sub; const cta = state.cta;
  const tpl = state.template;
  ctx.clearRect(0, 0, W, H); ctx.textBaseline = 'alphabetic'; ctx.textAlign = RTL ? 'right' : 'left';
  const pad = Math.round(W * 0.07);
  const ax = RTL ? W - pad : pad; // anchor x
  const alignLeft = (x) => RTL ? x : x;
  if (tpl === 0) { // Bottom bar
    drawCover(ctx, img, 0, 0, W, H, 1.02);
    const ggr = ctx.createLinearGradient(0, H * 0.4, 0, H); ggr.addColorStop(0, 'rgba(5,6,16,0)'); ggr.addColorStop(1, 'rgba(5,6,16,.92)'); ctx.fillStyle = ggr; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = acc; roundRect(ctx, RTL ? W - pad - W * 0.14 : pad, H * 0.62, W * 0.14, Math.max(5, W * 0.012), 4); ctx.fill();
    let y = H * 0.68;
    const hf = fitWrap(ctx, headline, W - pad * 2, 3, W * 0.11, 800, FONT); ctx.fillStyle = ink;
    hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, ax, y += hf.px * 1.04); });
    if (sub) { ctx.font = `500 ${W * 0.042}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; wrap(ctx, sub, W - pad * 2).slice(0, 2).forEach(l => ctx.fillText(l, ax, y += W * 0.058)); }
    if (cta) drawCTA(ctx, cta, y + W * 0.05, W, acc, { anchor: ax });
  } else if (tpl === 1) { // Spotlight center
    drawCover(ctx, img, 0, 0, W, H, 1.05);
    ctx.fillStyle = 'rgba(5,6,16,.5)'; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(5,6,16,.75)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; let y = H * 0.4;
    const hf = fitWrap(ctx, headline, W - pad * 2, 3, W * 0.12, 800, FONT); ctx.fillStyle = ink;
    hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, W / 2, y += hf.px * 1.05); });
    if (sub) { ctx.font = `500 ${W * 0.044}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.88)'; wrap(ctx, sub, W - pad * 2).slice(0, 2).forEach(l => ctx.fillText(l, W / 2, y += W * 0.06)); }
    if (cta) drawCTA(ctx, cta, y + W * 0.06, W, acc, { center: true });
    ctx.textAlign = RTL ? 'right' : 'left';
  } else if (tpl === 2) { // Banner (image top, panel bottom)
    const ih = H * 0.6; drawCover(ctx, img, 0, 0, W, ih, 1.02);
    ctx.fillStyle = darken(acc, 0.22); ctx.fillRect(0, ih, W, H - ih);
    ctx.fillStyle = acc; ctx.fillRect(0, ih, W, Math.max(6, H * 0.01));
    let y = ih + W * 0.04;
    const hf = fitWrap(ctx, headline, W - pad * 2, 2, W * 0.095, 800, FONT); ctx.fillStyle = '#fff';
    hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, ax, y += hf.px * 1.05); });
    if (sub) { ctx.font = `500 ${W * 0.04}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; wrap(ctx, sub, W - pad * 2).slice(0, 2).forEach(l => ctx.fillText(l, ax, y += W * 0.055)); }
    if (cta) drawCTA(ctx, cta, y + W * 0.04, W, '#fff', { anchor: ax, textColor: acc });
  } else { // Split (accent panel side)
    const pw = W * 0.44; const px0 = RTL ? 0 : W - pw;
    drawCover(ctx, img, RTL ? pw : 0, 0, W - pw, H, 1.02);
    ctx.fillStyle = darken(acc, 0.3); ctx.fillRect(px0, 0, pw, H);
    const grd = ctx.createLinearGradient(px0, 0, px0 + pw, 0); grd.addColorStop(0, acc); grd.addColorStop(1, darken(acc, 0.5)); ctx.globalAlpha = .9; ctx.fillStyle = grd; ctx.fillRect(px0, 0, pw, H); ctx.globalAlpha = 1;
    const ipad = pw * 0.14; const tax = RTL ? pw - ipad : px0 + ipad; let y = H * 0.3;
    const col = textColorOn(acc);
    const hf = fitWrap(ctx, headline, pw - ipad * 2, 4, pw * 0.2, 800, FONT); ctx.fillStyle = col;
    hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, tax, y += hf.px * 1.06); });
    if (sub) { ctx.font = `500 ${pw * 0.085}px ${FONT}`; ctx.globalAlpha = .85; wrap(ctx, sub, pw - ipad * 2).slice(0, 3).forEach(l => ctx.fillText(l, tax, y += pw * 0.11)); ctx.globalAlpha = 1; }
    if (cta) drawCTA(ctx, cta, y + pw * 0.1, W, col === '#FFFFFF' ? '#fff' : acc, { anchor: tax, textColor: col === '#FFFFFF' ? acc : '#fff' });
  }
  drawLogo(ctx, W, H);
}
// opt.anchor = حافة النص (يمين في RTL، يسار في LTR) لمحاذاة الحبّة معها، أو opt.center لتوسيطها.
function drawCTA(ctx, text, y, W, fill, opt) {
  opt = opt || {};
  const fs = W * 0.04; ctx.font = `700 ${fs}px ${FONT}`;
  const padx = W * 0.05, h = fs * 2.1; const w = ctx.measureText(text).width + padx * 2;
  let bx; if (opt.center) bx = (W - w) / 2; else bx = RTL ? (opt.anchor - w) : opt.anchor;
  bx = Math.max(W * 0.03, Math.min(bx, W - w - W * 0.03));
  ctx.fillStyle = fill; roundRect(ctx, bx, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = opt.textColor || textColorOn(typeof fill === 'string' && fill[0] === '#' ? fill : '#ffffff');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = RTL ? 'right' : 'left';
}
function drawLogo(ctx, W, H) { if (!state.logo) return; const s = W * 0.14; const m = W * 0.05; drawCoverContain(ctx, state.logo, RTL ? W - m - s : m, m, s, s); }
function drawCoverContain(ctx, img, x, y, w, h) { const ir = img.width / img.height; let dw = w, dh = h; if (ir > 1) dh = w / ir; else dw = h * ir; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }


// الجزء الثاني
(function(){ const s = document.createElement("script"); s.src = "adstudio2.js"; s.async = false; document.body.appendChild(s); })();
