// مراقب الأسعار التلقائي في الخلفية (Price Drop Radar)
// يراقب أسعار المنتجات (أمازون، إيباي، وغيرها) دورياً في الخلفية وينبّهك فور انخفاض السعر مع رسم بياني
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const RADAR_URL = 'https://prices.mybrowser.invalid/';
const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // كل 4 ساعات

function parsePriceNum(raw) {
  if (typeof raw === 'number' && isFinite(raw) && raw > 0) return Math.round(raw * 100) / 100;
  const s = String(raw || '').replace(/[^\d.,]/g, '').trim();
  if (!s) return null;
  let norm = s;
  const lastDot = s.lastIndexOf('.'), lastCom = s.lastIndexOf(',');
  if (lastCom > lastDot && s.length - lastCom <= 3) {
    norm = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastCom && s.length - lastDot <= 3) {
    norm = s.replace(/,/g, '');
  } else {
    norm = s.replace(/[.,]/g, '');
  }
  const n = parseFloat(norm);
  return isFinite(n) && n > 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}

function detectCurrency(raw, fallback = '€') {
  const s = String(raw || '');
  if (/€|\bEUR\b/i.test(s)) return '€';
  if (/\$|\bUSD\b/i.test(s)) return '$';
  if (/£|\bGBP\b/i.test(s)) return '£';
  if (/\bSAR\b|ر\.س/i.test(s)) return 'SAR';
  if (/\bAED\b|د\.إ/i.test(s)) return 'AED';
  if (/\bMAD\b|د\.م/i.test(s)) return 'MAD';
  return fallback;
}

// استخراج السعر من صفحة الويب المفتوحة (DOM)
const DOM_EXTRACT = `(() => {
  const pickText = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      const t = el && (el.getAttribute('content') || el.innerText || el.textContent || '').trim();
      if (t) return t;
    }
    return '';
  };
  let price = '', currency = '', image = '', title = '';
  // 1) JSON-LD
  for (const sc of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (o['@graph']) walk(o['@graph']);
        const t = String(o['@type'] || '');
        if (/Product|Offer/i.test(t)) {
          if (!title && o.name) title = String(o.name);
          if (!image && o.image) image = Array.isArray(o.image) ? (typeof o.image[0] === 'string' ? o.image[0] : o.image[0]?.url || '') : (typeof o.image === 'string' ? o.image : o.image.url || '');
          const off = o.offers ? (Array.isArray(o.offers) ? o.offers[0] : o.offers) : o;
          if (!price && off && (off.price != null || off.lowPrice != null)) {
            price = String(off.price ?? off.lowPrice);
            currency = String(off.priceCurrency || currency);
          }
        }
      };
      walk(JSON.parse(sc.textContent));
    } catch {}
  }
  // 2) Meta & Common E-commerce selectors
  if (!price) price = pickText([
    'meta[property="product:price:amount"]', 'meta[property="og:price:amount"]', 'meta[itemprop="price"]',
    '#corePrice_feature_div .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen',
    '#priceblock_ourprice', '#priceblock_dealprice', '.a-price .a-offscreen',
    '.x-price-primary .ux-textspans', '[data-testid="x-price-primary"]',
    '[itemprop="price"]', '[class*="price-current"]', '[class*="product-price"]'
  ]);
  if (!currency) currency = pickText(['meta[property="product:price:currency"]', 'meta[property="og:price:currency"]', 'meta[itemprop="priceCurrency"]']) || price;
  if (!title) title = pickText(['#productTitle', 'h1.x-item-title__mainTitle', 'meta[property="og:title"]', 'h1']) || document.title;
  if (!image) image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || document.querySelector('#landingImage, .ux-image-carousel-item img')?.src || '';
  return { url: location.href, title: String(title || '').trim().slice(0, 160), priceRaw: String(price || ''), currencyRaw: String(currency || ''), image: String(image || '') };
})()`;

// استخراج السعر من HTML في الخلفية بدون فتح متصفح
function extractFromHtml(html) {
  const s = String(html || '');
  // 1) JSON-LD
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(s)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const o = stack.pop();
        if (!o || typeof o !== 'object') continue;
        if (Array.isArray(o)) { stack.push(...o); continue; }
        if (o['@graph']) stack.push(o['@graph']);
        if (o.offers) stack.push(o.offers);
        const p = parsePriceNum(o.price ?? o.lowPrice);
        if (p) return { price: p, currency: detectCurrency(o.priceCurrency) };
      }
    } catch {}
  }
  // 2) Meta tags
  const metaRe = /<meta[^>]+(?:property|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([^"']+)["']/i;
  const mm = s.match(metaRe);
  if (mm) {
    const p = parsePriceNum(mm[1]);
    if (p) return { price: p, currency: detectCurrency(s.slice(Math.max(0, mm.index - 200), mm.index + 300)) };
  }
  // 3) Amazon / eBay offscreen price
  const amz = s.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</i);
  if (amz) {
    const p = parsePriceNum(amz[1]);
    if (p) return { price: p, currency: detectCurrency(amz[1]) };
  }
  return null;
}

const MSG = {
  ar: { watched: (t, p) => `تمت مراقبة السعر: ${t} (${p})`, noPrice: 'لم يُعثر على سعر في هذه الصفحة', drop: (t, p, pct) => `📉 انخفض السعر! ${t}: ${p} (-${pct}%)`, view: 'عرض' },
  en: { watched: (t, p) => `Watching price: ${t} (${p})`, noPrice: 'No product price detected on this page', drop: (t, p, pct) => `📉 Price drop! ${t}: ${p} (-${pct}%)`, view: 'View' },
  de: { watched: (t, p) => `Preis wird überwacht: ${t} (${p})`, noPrice: 'Kein Preis auf dieser Seite gefunden', drop: (t, p, pct) => `📉 Preis gesunken! ${t}: ${p} (-${pct}%)`, view: 'Ansehen' },
  fr: { watched: (t, p) => `Prix suivi : ${t} (${p})`, noPrice: 'Aucun prix détecté sur cette page', drop: (t, p, pct) => `📉 Baisse de prix ! ${t} : ${p} (-${pct}%)`, view: 'Voir' },
  es: { watched: (t, p) => `Siguiendo precio: ${t} (${p})`, noPrice: 'No se detectó precio en esta página', drop: (t, p, pct) => `📉 ¡Bajó el precio! ${t}: ${p} (-${pct}%)`, view: 'Ver' },
  it: { watched: (t, p) => `Prezzo monitorato: ${t} (${p})`, noPrice: 'Nessun prezzo trovato in questa pagina', drop: (t, p, pct) => `📉 Prezzo sceso! ${t}: ${p} (-${pct}%)`, view: 'Vedi' },
  tr: { watched: (t, p) => `Fiyat izleniyor: ${t} (${p})`, noPrice: 'Bu sayfada ürün fiyatı bulunamadı', drop: (t, p, pct) => `📉 Fiyat düştü! ${t}: ${p} (-%${pct})`, view: 'Gör' }
};

module.exports = (ctx) => {
  const tr = () => MSG[(ctx.lang() || 'en').slice(0, 2)] || MSG.en;
  const dir = () => path.join(app.getPath('userData'), 'priceradar');
  const fileOf = (pid) => path.join(dir(), (pid || 'default') + '.json');

  function load(pid) {
    try { const arr = JSON.parse(fs.readFileSync(fileOf(pid), 'utf8')); return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  }
  function save(pid, arr) {
    try { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(fileOf(pid), JSON.stringify(arr, null, 2)); }
    catch (e) { ctx.logLine('priceradar save', e); }
  }

  const wins = new Map();
  const appIcon = () => { try { const p = path.join(path.dirname(process.execPath), 'icon.ico'); return fs.existsSync(p) ? p : undefined; } catch { return undefined; } };
  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  const pidOf = (e) => { for (const [pid, win] of wins) if (!win.isDestroyed() && win.webContents === e.sender) return pid; return null; };
  const winForPid = (pid) => [...ctx.windows].find(x => !x.guest && ctx.profileOf(x).id === pid) || [...ctx.windows].find(x => !x.guest) || null;

  async function watchActive(w) {
    if (!w) return { ok: false };
    const wc = ctx.activeWc(w);
    const u = wc ? wc.getURL() : '';
    if (!wc || !/^https?:\/\//i.test(u) || /\.mybrowser\.invalid\b/i.test(u)) {
      ctx.toast(`🏷️ ${tr().noPrice}`, w);
      return { ok: false };
    }
    try {
      const d = await wc.executeJavaScript(DOM_EXTRACT, true);
      const price = parsePriceNum(d && d.priceRaw);
      if (!price) { ctx.toast(`🏷️ ${tr().noPrice}`, w); return { ok: false }; }
      const currency = detectCurrency((d.currencyRaw || '') + ' ' + (d.priceRaw || ''));
      const clean = ctx.cleanUrl ? ctx.cleanUrl(d.url || u).url : (d.url || u);
      const pid = ctx.profileOf(w).id;
      const arr = load(pid);
      const now = Date.now();
      let item = arr.find(x => x.url === clean);
      if (item) {
        item.price = price;
        item.lowestPrice = Math.min(item.lowestPrice || price, price);
        item.lastChecked = now;
        item.history = (item.history || []).concat([{ ts: now, price }]).slice(-40);
      } else {
        item = {
          id: 'pr_' + now + '_' + Math.random().toString(36).slice(2, 6),
          url: clean,
          title: d.title || clean,
          image: d.image || '',
          currency,
          price,
          originalPrice: price,
          lowestPrice: price,
          history: [{ ts: now, price }],
          lastChecked: now
        };
        arr.unshift(item);
      }
      save(pid, arr);
      const win = wins.get(pid);
      if (win && !win.isDestroyed()) win.webContents.send('radar:changed');
      ctx.toast(`🏷️ ${tr().watched(item.title.slice(0, 40), price + ' ' + currency)}`, w);
      return { ok: true, item };
    } catch {
      ctx.toast(`🏷️ ${tr().noPrice}`, w);
      return { ok: false };
    }
  }

  async function checkProfile(pid, force) {
    const arr = load(pid);
    if (!arr.length) return { checked: 0, drops: 0 };
    const now = Date.now();
    let checked = 0, drops = 0;
    for (const item of arr) {
      if (!force && item.lastChecked && now - item.lastChecked < CHECK_INTERVAL) continue;
      if (checked >= 10) break;
      try {
        const res = await fetch(item.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,ar;q=0.7' }
        });
        if (!res.ok) continue;
        const html = await res.text();
        const found = extractFromHtml(html);
        item.lastChecked = Date.now();
        checked++;
        if (found && found.price) {
          const prev = item.price;
          item.price = found.price;
          if (found.currency) item.currency = found.currency;
          item.lowestPrice = Math.min(item.lowestPrice || found.price, found.price);
          const lastH = item.history && item.history[item.history.length - 1];
          if (!lastH || lastH.price !== found.price || Date.now() - lastH.ts > 24 * 3600e3) {
            item.history = (item.history || []).concat([{ ts: Date.now(), price: found.price }]).slice(-40);
          }
          if (found.price < prev) {
            drops++;
            const pct = Math.max(1, Math.round(((prev - found.price) / prev) * 100));
            const w = winForPid(pid);
            if (w) ctx.send(w, 'action-toast', { text: tr().drop(item.title.slice(0, 38), found.price + ' ' + item.currency, pct), button: tr().view, action: 'none' });
          }
        }
        await new Promise(r => setTimeout(r, 1200));
      } catch {}
    }
    if (checked) {
      save(pid, arr);
      const win = wins.get(pid);
      if (win && !win.isDestroyed()) win.webContents.send('radar:changed');
    }
    return { checked, drops };
  }

  function openRadar(w) {
    if (!w) return;
    const pid = ctx.profileOf(w).id;
    const cur = wins.get(pid);
    if (cur && !cur.isDestroyed()) { if (cur.isMinimized()) cur.restore(); cur.show(); cur.focus(); return; }
    const win = new BrowserWindow({
      width: 980, height: 740, minWidth: 600, minHeight: 440, title: 'Price Drop Radar',
      autoHideMenuBar: true, backgroundColor: '#090A16', icon: appIcon(),
      webPreferences: { preload: path.join(__dirname, '..', 'panels-preload.js'), contextIsolation: true, sandbox: true }
    });
    win.__pid = pid;
    wins.set(pid, win);
    win.loadFile(path.join(__dirname, '..', 'ui', 'priceradar.html'), { query: { lang: ctx.lang() } });
    win.on('closed', () => { if (wins.get(pid) === win) wins.delete(pid); });
  }

  ctx.watchPriceActive = watchActive;
  ctx.openPriceRadar = openRadar;

  ipcMain.handle('radar:list', (e) => { const pid = pidOf(e); return pid == null ? [] : load(pid); });
  ipcMain.handle('radar:watch', (e) => {
    const pid = pidOf(e);
    const w = pid != null ? winForPid(pid) : ctx.W(e);
    return watchActive(w);
  });
  ipcMain.handle('radar:checkAll', (e) => { const pid = pidOf(e); return pid == null ? { checked: 0, drops: 0 } : checkProfile(pid, true); });
  ipcMain.handle('radar:delete', (e, id) => {
    const pid = pidOf(e); if (pid == null) return false;
    save(pid, load(pid).filter(x => x.id !== id));
    return true;
  });
  ipcMain.on('radar:openUrl', (e, url) => {
    const pid = pidOf(e); if (pid == null || !url) return;
    let w = winForPid(pid) || ctx.openProfileWindow(pid);
    if (w) { ctx.createTab(w, url); try { if (w.win.isMinimized()) w.win.restore(); w.win.focus(); } catch {} }
  });
  ipcMain.handle('radar:openPanel', (e) => { const w = ctx.W(e); if (w) openRadar(w); return true; });

  // فحص تلقائي خفيف في الخلفية كل 4 ساعات
  const bgRun = async () => {
    for (const p of (ctx.settings.profiles || [])) {
      try { await checkProfile(p.id, false); } catch {}
    }
  };
  setTimeout(bgRun, 120e3);
  setInterval(bgRun, CHECK_INTERVAL);

  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (String(url).startsWith(RADAR_URL)) { ev.preventDefault(); const w = ownerOf(wc); if (w) openRadar(w); } });
  });
};
