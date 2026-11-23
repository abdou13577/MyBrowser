// شاشة اختيار الحساب عند بدء تشغيل المتصفح (ترجماتها بداخلها حتى تبقى مستقلة)
const $ = (s) => document.querySelector(s);
const COLORS = ['#7c9cff', '#3ecf8e', '#ff8a65', '#ba68c8', '#4dd0e1', '#ffd54f', '#f06292', '#90a4ae'];
const STR = {
  ar: { title: 'اختر حساباً', sub: 'اختر الحساب الذي تريد فتحه', guest: 'ضيف', add: '➕ إضافة حساب', signingIn: 'جارٍ فتح نافذة تسجيل الدخول…', acc: 'حساب' },
  en: { title: 'Choose an account', sub: 'Pick the account you want to open', guest: 'Guest', add: '➕ Add account', signingIn: 'Opening the sign-in window…', acc: 'Account' },
  de: { title: 'Konto auswählen', sub: 'Wähle das Konto, das du öffnen möchtest', guest: 'Gast', add: '➕ Konto hinzufügen', signingIn: 'Anmeldefenster wird geöffnet…', acc: 'Konto' },
  it: { title: 'Scegli un account', sub: "Scegli l'account da aprire", guest: 'Ospite', add: '➕ Aggiungi account', signingIn: 'Apertura della finestra di accesso…', acc: 'Account' },
  fr: { title: 'Choisir un compte', sub: 'Choisissez le compte à ouvrir', guest: 'Invité', add: '➕ Ajouter un compte', signingIn: 'Ouverture de la fenêtre de connexion…', acc: 'Compte' },
  es: { title: 'Elige una cuenta', sub: 'Elige la cuenta que quieres abrir', guest: 'Invitado', add: '➕ Añadir cuenta', signingIn: 'Abriendo la ventana de inicio de sesión…', acc: 'Cuenta' },
  tr: { title: 'Hesap seç', sub: 'Açmak istediğin hesabı seç', guest: 'Misafir', add: '➕ Hesap ekle', signingIn: 'Giriş penceresi açılıyor…', acc: 'Hesap' }
};
let L = STR.ar, busy = false;

function avatar(p, i) {
  const d = document.createElement('div');
  d.className = 'av';
  d.style.background = p.color || COLORS[i % COLORS.length];
  const label = (p.name || p.email || '؟').trim();
  if (p.photo) {
    const img = new Image();
    img.referrerPolicy = 'no-referrer'; img.alt = '';
    img.onerror = () => { img.remove(); d.textContent = label[0].toUpperCase(); };
    img.src = p.photo;
    d.append(img);
  } else d.textContent = label[0].toUpperCase();
  return d;
}

function render(data) {
  L = STR[data.lang] || STR.en;
  document.documentElement.lang = data.lang; document.documentElement.dir = data.rtl ? 'rtl' : 'ltr';
  $('#title').textContent = L.title;
  $('#sub').textContent = L.sub;
  $('#guestBtn').textContent = L.guest;
  $('#addBtn').textContent = L.add;
  const list = $('#list'); list.innerHTML = '';
  data.profiles.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'acc';
    const who = document.createElement('div'); who.className = 'who';
    const name = document.createElement('b'); name.textContent = p.name || p.email || (L.acc + ' ' + (i + 1));
    const email = document.createElement('span'); email.textContent = p.email || '';
    who.append(name, email);
    const chev = document.createElement('span'); chev.className = 'chev'; chev.textContent = '›';
    b.append(avatar(p, i), who, chev);
    b.onclick = () => pick(p.id);
    list.append(b);
  });
}

async function pick(id) { if (busy) return; busy = true; await window.chooser.open(id); }
$('#guestBtn').onclick = async () => { if (busy) return; busy = true; await window.chooser.guest(); };
$('#addBtn').onclick = async () => { if (busy) return; const r = await window.chooser.add(); if (r && r.ok) $('#msg').textContent = L.signingIn; };
$('#closeBtn').onclick = () => window.close();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });

async function load() { render(await window.chooser.get()); }
load();
// نحدّث الصور والأسماء (تصل من جوجل بعد لحظات)
setInterval(() => { if (!busy) load(); }, 2000);
