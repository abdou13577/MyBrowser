// صفحة البداية: الساعة + البحث + اختصارات المواقع (تُضاف وتُحذف وتُحفظ)
const code = I18N.pick(new URLSearchParams(location.search).get('lang') || navigator.language);
const L = I18N.dict(code);
document.documentElement.lang = code;
document.documentElement.dir = I18N.LANGS[code].dir;
document.title = L.newTab;
document.getElementById('q').placeholder = L.searchGoogle;
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L[el.dataset.i18n] || el.textContent; });

document.getElementById('appsLbl').textContent = ({ ar: 'التطبيقات', en: 'Apps', de: 'Apps', it: 'App', fr: 'Applications', es: 'Apps', tr: 'Uygulamalar' })[code] || 'Apps';
document.getElementById('adLbl').textContent = ({ ar: 'استوديو الإعلانات', en: 'Ad Studio', de: 'Werbe-Studio', it: 'Studio Ad', fr: 'Studio Pub', es: 'Estudio de anuncios', tr: 'Reklam Stüdyosu' })[code] || 'Ad Studio';
document.getElementById('historyLbl').textContent = ({ ar: 'السجل', en: 'History', de: 'Verlauf', it: 'Cronologia', fr: 'Historique', es: 'Historial', tr: 'Geçmiş' })[code] || 'History';
document.getElementById('downloadsLbl').textContent = ({ ar: 'التنزيلات', en: 'Downloads', de: 'Downloads', it: 'Download', fr: 'Téléchargements', es: 'Descargas', tr: 'İndirilenler' })[code] || 'Downloads';
document.getElementById('backupLbl').textContent = ({ ar: 'نسخة احتياطية', en: 'Backup', de: 'Sicherung', it: 'Backup', fr: 'Sauvegarde', es: 'Copia', tr: 'Yedek' })[code] || 'Backup';

const tick = () => {
  const d = new Date();
  document.getElementById('clock').textContent = d.toLocaleTimeString(code, { hour: '2-digit', minute: '2-digit', hour12: false });
  const h = d.getHours();
  document.getElementById('greet').textContent = h < 5 ? L.greetNight : h < 12 ? L.greetMorning : h < 18 ? L.greetDay : L.greetEvening;
};
tick(); setInterval(tick, 10000);

const KEY = 'zaki.tiles.v1';
const DEFAULTS = [
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: L.mySubs, url: 'https://www.youtube.com/feed/subscriptions', icon: 'youtube.com' },
  { name: 'Facebook', url: 'https://www.facebook.com' },
  { name: 'Instagram', url: 'https://www.instagram.com' },
  { name: 'WhatsApp', url: 'https://web.whatsapp.com' },
  { name: 'Gmail', url: 'https://mail.google.com' },
  { name: 'TikTok', url: 'https://www.tiktok.com' }
];
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return DEFAULTS.slice(); };
const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return ''; } };

function render() {
  const box = document.getElementById('tiles');
  box.innerHTML = '';
  const list = load();
  list.forEach((s, i) => {
    const a = document.createElement('a');
    a.className = 'tile'; a.href = s.url; a.title = s.url;
    const logo = document.createElement('div'); logo.className = 'logo';
    const img = new Image();
    img.alt = '';
    // نجرّب أكثر من مصدر للأيقونة، ونرفض الأيقونة الافتراضية الصغيرة (الكرة الرمادية)
    let host = s.icon || hostOf(s.url);
    if (/(^|\.)whatsapp\.com$/.test(host)) host = 'whatsapp.com';
    const sources = [
      'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=128',
      'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(host) + '.ico',
      'https://' + host + '/favicon.ico'
    ];
    let k = 0;
    const next = () => { if (k < sources.length) img.src = sources[k++]; else { img.remove(); logo.textContent = (s.name || '?').trim()[0].toUpperCase(); } };
    img.onerror = next;
    img.onload = () => { if (img.naturalWidth < 32 && k < sources.length) next(); };
    next();
    logo.append(img);
    const name = document.createElement('span'); name.className = 'name'; name.textContent = s.name;
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = L.removeSite;
    del.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const v = load(); v.splice(i, 1); store(v); render(); };
    a.append(logo, name, del);
    box.append(a);
  });
  // زر «+» لإضافة موقع خاص بك
  const add = document.createElement('button');
  add.className = 'tile add'; add.type = 'button'; add.title = L.addSite;
  add.innerHTML = '<div class="logo">+</div>';
  const n = document.createElement('span'); n.className = 'name'; n.textContent = L.addSite;
  add.append(n);
  add.onclick = () => { document.getElementById('siteName').value = ''; document.getElementById('siteUrl').value = ''; document.getElementById('dlg').showModal(); };
  box.append(add);
}
document.getElementById('cancelAdd').onclick = () => document.getElementById('dlg').close();
document.getElementById('addForm').addEventListener('submit', (e) => {
  let url = document.getElementById('siteUrl').value.trim();
  if (!url) { e.preventDefault(); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let name = document.getElementById('siteName').value.trim();
  if (!name) { const h = hostOf(url).replace(/^www\./, ''); name = h.split('.')[0]; name = name.charAt(0).toUpperCase() + name.slice(1); }
  const v = load(); v.push({ name, url }); store(v); render();
});
render();
