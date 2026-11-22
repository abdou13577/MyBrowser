// متجر التطبيقات في MyBrowser
const S = {
  ar: ['التطبيقات', 'أضف تطبيقاً بضغطة: يظهر على سطح المكتب وفي قائمة ابدأ، ويفتح في نافذته الخاصة مثل تطبيق الهاتف — بحساباتك وبدون إعلانات. لا حاجة لتنزيل أي ملف.', 'تطبيقاتي', 'كل التطبيقات', 'إضافة', 'فتح', 'إزالة', 'أضف تطبيقاً من أي موقع', 'الاسم', 'العنوان', 'إلغاء', 'تمت الإضافة إلى سطح المكتب وقائمة ابدأ', 'لم تُضف أي تطبيق بعد. اختر من القائمة.', 'ابحث عن تطبيق', 'نصيحة: اضغط بالزر الأيمن على التطبيق في شريط المهام واختر «تثبيت» ليبقى هناك. افتح هذه الصفحة في أي وقت بـ Ctrl+Shift+A.', 'جارٍ الإضافة…', 'تعذّرت الإضافة:'],
  en: ['Apps', 'Add an app in one click: it appears on your desktop and Start menu and opens in its own window like a phone app — signed in, with no ads. Nothing to download.', 'My apps', 'All apps', 'Add', 'Open', 'Remove', 'Add an app from any website', 'Name', 'Address', 'Cancel', 'Added to your desktop and Start menu', 'You haven\'t added any apps yet. Pick one below.', 'Search apps', 'Tip: right-click an app in the taskbar and choose "Pin to taskbar" to keep it there. Open this page any time with Ctrl+Shift+A.', 'Adding…', 'Couldn\'t add the app:'],
  de: ['Apps', 'Füge eine App mit einem Klick hinzu: Sie erscheint auf dem Desktop und im Startmenü und öffnet sich wie eine Handy-App in einem eigenen Fenster — angemeldet und ohne Werbung. Kein Download nötig.', 'Meine Apps', 'Alle Apps', 'Hinzufügen', 'Öffnen', 'Entfernen', 'App aus einer beliebigen Website erstellen', 'Name', 'Adresse', 'Abbrechen', 'Zum Desktop und Startmenü hinzugefügt', 'Du hast noch keine Apps hinzugefügt. Wähle unten eine aus.', 'Apps suchen', 'Tipp: Rechtsklick auf die App in der Taskleiste und „An Taskleiste anheften“. Diese Seite öffnest du jederzeit mit Strg+Umschalt+A.', 'Wird hinzugefügt…', 'Hinzufügen fehlgeschlagen:'],
  it: ['App', 'Aggiungi un\'app con un clic: compare sul desktop e nel menu Start e si apre nella sua finestra come un\'app del telefono — con il tuo account e senza pubblicità. Niente da scaricare.', 'Le mie app', 'Tutte le app', 'Aggiungi', 'Apri', 'Rimuovi', 'Aggiungi un\'app da qualsiasi sito', 'Nome', 'Indirizzo', 'Annulla', 'Aggiunta al desktop e al menu Start', 'Non hai ancora aggiunto app. Scegline una qui sotto.', 'Cerca app', 'Suggerimento: clic destro sull\'app nella barra delle applicazioni e scegli «Aggiungi alla barra». Apri questa pagina con Ctrl+Maiusc+A.', 'Aggiunta in corso…', 'Impossibile aggiungere:'],
  fr: ['Applications', 'Ajoutez une app en un clic : elle apparaît sur le bureau et dans le menu Démarrer et s\'ouvre dans sa propre fenêtre comme une app de téléphone — connectée et sans pub. Rien à télécharger.', 'Mes applications', 'Toutes les applications', 'Ajouter', 'Ouvrir', 'Retirer', 'Ajouter une app depuis n\'importe quel site', 'Nom', 'Adresse', 'Annuler', 'Ajoutée au bureau et au menu Démarrer', 'Aucune app ajoutée pour l\'instant. Choisissez-en une ci-dessous.', 'Rechercher une app', 'Astuce : clic droit sur l\'app dans la barre des tâches puis « Épingler ». Ouvrez cette page avec Ctrl+Maj+A.', 'Ajout…', 'Impossible d\'ajouter :'],
  es: ['Apps', 'Añade una app con un clic: aparece en el escritorio y en el menú Inicio y se abre en su propia ventana como una app del móvil — con tu cuenta y sin anuncios. No hay nada que descargar.', 'Mis apps', 'Todas las apps', 'Añadir', 'Abrir', 'Quitar', 'Añadir una app desde cualquier web', 'Nombre', 'Dirección', 'Cancelar', 'Añadida al escritorio y al menú Inicio', 'Aún no has añadido apps. Elige una abajo.', 'Buscar apps', 'Consejo: clic derecho en la app de la barra de tareas y «Anclar». Abre esta página con Ctrl+Mayús+A.', 'Añadiendo…', 'No se pudo añadir:'],
  tr: ['Uygulamalar', 'Tek tıkla uygulama ekle: masaüstünde ve Başlat menüsünde görünür, telefon uygulaması gibi kendi penceresinde açılır — hesabınla ve reklamsız. İndirilecek bir şey yok.', 'Uygulamalarım', 'Tüm uygulamalar', 'Ekle', 'Aç', 'Kaldır', 'Herhangi bir siteden uygulama ekle', 'Ad', 'Adres', 'İptal', 'Masaüstüne ve Başlat menüsüne eklendi', 'Henüz uygulama eklemedin. Aşağıdan birini seç.', 'Uygulama ara', 'İpucu: Görev çubuğundaki uygulamaya sağ tıklayıp «Sabitle»yi seç. Bu sayfayı Ctrl+Shift+A ile açabilirsin.', 'Ekleniyor…', 'Eklenemedi:']
};
const lang = (new URLSearchParams(location.search).get('lang') || navigator.language || 'en').slice(0, 2);
const T = S[lang] || S.en;
const [tTitle, tSub, tMine, tAll, tAdd, tOpen, tRemove, tOwn, tName, tUrl, tCancel, tAdded, tEmpty, tSearch, tNote, tAdding, tFail] = T;
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
const $ = (s) => document.querySelector(s);
$('#t').textContent = tTitle; $('#sub').textContent = tSub; $('#hMine').textContent = tMine; $('#hAll').textContent = tAll;
$('#q').placeholder = tSearch; $('#note').textContent = tNote;
$('#dT').textContent = tOwn; $('#dN').textContent = tName; $('#dU').textContent = tUrl; $('#cancel').textContent = tCancel; $('#save').textContent = tAdd;

let data = { catalog: [], installed: [], custom: [] };
let toastT;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 3500); };
function logo(a, cls) {
  const d = document.createElement('div'); d.className = 'logo' + (cls ? ' ' + cls : '');
  const img = new Image(); img.alt = '';
  img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(a.icon) + '&sz=128';
  img.onerror = () => { img.remove(); d.textContent = (a.name || '?').trim()[0].toUpperCase(); };
  d.append(img); return d;
}
function render() {
  const q = $('#q').value.trim().toLowerCase();
  const all = [...data.catalog, ...data.custom];
  const mine = $('#mine'); mine.innerHTML = '';
  const mineList = data.installed.map(id => all.find(a => a.id === id)).filter(Boolean);
  if (!mineList.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = tEmpty; mine.append(p); }
  for (const a of mineList) {
    const b = document.createElement('button'); b.className = 'app'; b.title = tOpen + ' ' + a.name;
    b.append(logo(a));
    const n = document.createElement('span'); n.className = 'nm'; n.textContent = a.name; b.append(n);
    const x = document.createElement('span'); x.className = 'x'; x.textContent = '✕'; x.title = tRemove; x.setAttribute('role', 'button');
    x.onclick = async (e) => { e.stopPropagation(); await window.apps.remove(a.id); await load(); };
    b.append(x);
    b.onclick = () => window.apps.open(a.id);
    mine.append(b);
  }
  const grid = $('#grid'); grid.innerHTML = '';
  for (const a of data.catalog) {
    if (q && !(a.name.toLowerCase().includes(q) || a.icon.includes(q))) continue;
    const c = document.createElement('div'); c.className = 'card';
    c.append(logo(a));
    const m = document.createElement('div'); m.className = 'meta';
    const b = document.createElement('b'); b.textContent = a.name;
    const s = document.createElement('span'); s.textContent = a.icon;
    m.append(b, s); c.append(m);
    const has = data.installed.includes(a.id);
    const btn = document.createElement('button');
    btn.className = has ? 'openb' : 'add'; btn.textContent = has ? tOpen : tAdd;
    btn.onclick = async () => {
      if (has) return window.apps.open(a.id);
      btn.disabled = true; btn.textContent = tAdding;
      const r = await window.apps.add(a.id);
      if (r && r.ok) { toast(`${a.name} — ${tAdded}`); window.apps.open(a.id); } else toast(`${tFail} ${(r && r.error) || ''}`);
      await load();
    };
    c.append(btn); grid.append(c);
  }
  const own = document.createElement('button'); own.className = 'card own';
  const ol = document.createElement('div'); ol.className = 'logo'; ol.textContent = '+';
  const om = document.createElement('div'); om.className = 'meta'; const ob = document.createElement('b'); ob.textContent = tOwn; om.append(ob);
  own.append(ol, om);
  own.onclick = () => { $('#nm').value = ''; $('#url').value = ''; $('#dlg').showModal(); };
  grid.append(own);
}
async function load() { data = await window.apps.list(); render(); }
$('#q').addEventListener('input', render);
$('#cancel').onclick = () => $('#dlg').close();
$('#f').addEventListener('submit', async (e) => {
  const url = $('#url').value.trim();
  if (!url) { e.preventDefault(); return; }
  const r = await window.apps.custom($('#nm').value.trim(), url);
  if (r && r.ok) { toast(tAdded); window.apps.open(r.id); } else toast(`${tFail} ${(r && r.error) || ''}`);
  await load();
});
load();
