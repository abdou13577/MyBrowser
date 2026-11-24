// ربط المساعد الذكي في MyBrowser بأسرع سحابة مجانية + FreeLLMAPI + Ollama + البحث المباشر في الويب مع روابط قابلة للنقر
// الأولوية الذكية:
// 1) مفتاح Claude مدفوع (sk-ant-...) -> Anthropic
// 2) مفتاح FreeLLMAPI -> FreeLLMAPI المحلي (127.0.0.1:31415)
// 3) السحابة المجانية السريعة (text.pollinations.ai) -> استجابة فورية خلال ثانية بدون مفتاح وبصفر عبء على جهازك
// 4) احتياطي محلي تلقائي -> Ollama (127.0.0.1:11434) عند انقطاع الإنترنت أو انشغال السحابة
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const FREELOCAL_URL = 'https://freellm.mybrowser.invalid/';
const CLOUD_URL = 'https://text.pollinations.ai/openai';
const OLLAMA_URL = 'http://127.0.0.1:11434';
const EXE_CANDIDATES = [
  'C:\\AI_Tools\\FreeLLMAPI\\app\\FreeLLMAPI.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'FreeLLMAPI', 'FreeLLMAPI.exe')
];

function readFreePort() {
  try {
    const cfgPath = path.join(process.env.APPDATA || app.getPath('appData'), 'FreeLLMAPI', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg && Number(cfg.port) > 0) return Number(cfg.port);
  } catch {}
  return 31415;
}
const baseUrl = () => `http://127.0.0.1:${readFreePort()}`;

function toOpenAiMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: 'system', content: String(system) });
  for (const m of (messages || [])) {
    if (Array.isArray(m.content)) {
      const parts = m.content.map(b => {
        if (b && b.type === 'text') return { type: 'text', text: b.text || '' };
        if (b && b.type === 'image' && b.source && b.source.data) {
          return { type: 'image_url', image_url: { url: `data:${b.source.media_type || 'image/png'};base64,${b.source.data}` } };
        }
        return null;
      }).filter(Boolean);
      out.push({ role: m.role || 'user', content: parts.length ? parts : '' });
    } else {
      out.push({ role: m.role || 'user', content: String(m.content || '') });
    }
  }
  return out;
}

function toTextOnlyMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: 'system', content: String(system) });
  for (const m of (messages || [])) {
    if (Array.isArray(m.content)) {
      const txt = m.content.filter(b => b && b.type === 'text').map(b => b.text || '').join('\n');
      out.push({ role: m.role || 'user', content: txt || 'Describe this.' });
    } else {
      out.push({ role: m.role || 'user', content: String(m.content || '') });
    }
  }
  return out;
}

// ---------- البحث الحي في الويب + توليد روابط مباشرة حقيقية ومختبرة ----------
const SEARCH_INTENT = /(ابحث|بحث|دور|أعطني رابط|أعطني روابط|روابط|رابط|سيار[ةه]|حادث|سعر|أسعار|شراء|للبيع|أين أجد|kleinanzeigen|kleine anzeigen|mobile\.de|autoscout|amazon|ebay|youtube|search|find|buy|price|suche|auto kaufen|gebrauchtwagen|unfallwagen)/i;

function sanitizeLinks(text) {
  return String(text || '')
    // تحويل الدومين القديم المغلق ebay-kleinanzeigen.de إلى kleinanzeigen.de
    .replace(/https?:\/\/(?:www\.)?ebay-kleinanzeigen\.de/gi, 'https://www.kleinanzeigen.de')
    // استبدال روابط suchen.mobile.de التي ترفض الدخول بـ 403 بروابط AutoScout24/Kleinanzeigen تعمل فعلياً
    .replace(/https?:\/\/suchen\.mobile\.de\/[^\s)]+/gi, 'https://www.autoscout24.de/lst?atype=C&cy=D&sort=price&desc=0');
}

function extractCarTerms(text) {
  const s = String(text || '');
  const terms = [];
  const latin = s.match(/\b(vw|volkswagen|golf|polo|passat|tiguan|touran|touareg|caddy|bmw|mercedes|benz|audi|opel|corsa|astra|insignia|ford|focus|fiesta|mondeo|toyota|yaris|corolla|auris|rav4|skoda|octavia|fabia|superb|seat|ibiza|leon|renault|clio|megane|peugeot|citroen|hyundai|kia|nissan|dacia|fiat|volvo|mazda|honda|civic|porsche|mini|jeep|suzuki|c200|c220|e200|e220|e350|a180|a200|cla|glc|gle|a3|a4|a5|a6|q3|q5|q7|318d|320d|330d|520d|530d|x1|x3|x5|116i|118i|118d|gti|gtd|tdi|tsi|amg|s-line|20\d\d)\b/gi);
  if (latin) {
    for (const m of latin) {
      const lw = m.toLowerCase();
      if (!terms.includes(lw)) terms.push(lw);
    }
  }
  if (/غولف|جولف/i.test(s) && !terms.includes('golf')) terms.push('golf');
  if (/مرسيدس/i.test(s) && !terms.includes('mercedes')) terms.push('mercedes');
  if (/بي ام|بي إم/i.test(s) && !terms.includes('bmw')) terms.push('bmw');
  if (/أودي|اودي/i.test(s) && !terms.includes('audi')) terms.push('audi');
  if (/تويوتا/i.test(s) && !terms.includes('toyota')) terms.push('toyota');
  if (/فولكس|فولكسفاغن/i.test(s) && !terms.includes('vw')) terms.push('vw');
  if (/أوبل|اوبل/i.test(s) && !terms.includes('opel')) terms.push('opel');
  if (/فورد/i.test(s) && !terms.includes('ford')) terms.push('ford');
  if (/سكودا/i.test(s) && !terms.includes('skoda')) terms.push('skoda');
  if (/حادث|مصدوم|أضرار|تلف|unfall|beschädigt|damaged/i.test(s) && !terms.includes('unfallwagen')) terms.push('unfallwagen');
  if (/أوتوماتيك|اتوماتيك|automatik/i.test(s) && !terms.includes('automatik')) terms.push('automatik');
  if (/ديزل|diesel/i.test(s) && !terms.includes('diesel')) terms.push('diesel');
  return terms.slice(0, 6);
}

function buildDirectLinks(q, history = []) {
  const links = [];
  const recentHist = (Array.isArray(history) ? history : []).slice(-6).map(m => String(m && m.content || '')).join('\n');
  const combinedText = q + '\n' + recentHist;
  const low = combinedText.toLowerCase();
  const isCar = /(سيار|حادث|مصدوم|auto|car|golf|bmw|mercedes|audi|vw|polo|passat|opel|ford|toyota|skoda|seat|unfall|gebrauchtwagen)/i.test(low);
  const isDamaged = /(حادث|مصدوم|أضرار|تلف|unfall|beschädigt|damaged)/i.test(low);
  const isCheap = /(مميز|رخيص|أرخص|اقتصادي|günstig|billig|cheap)/i.test(low);

  // نستخرج الماركة/الموديل من السؤال الحالي أولاً، وإذا كان سؤالاً تابعاً ("نفس هذه السيارة") نستخرجه من سجل المحادثة!
  let carTerms = extractCarTerms(q);
  if (carTerms.filter(t => t !== 'unfallwagen' && t !== 'diesel' && t !== 'automatik').length === 0 && recentHist) {
    const fromHist = extractCarTerms(recentHist);
    for (const t of fromHist) if (!carTerms.includes(t)) carTerms.push(t);
    carTerms = carTerms.slice(0, 6);
  }

  const cleaned = q
    .replace(/(أريدك أن تقوم بالبحث عن|قم بالبحث لي عن|قم بالبحث عن|ابحث لي عن|ابحث لي|ابحث عن|ابحث|عن نفس هذه السيارة|نفس هذه السيارة|هذه السيارة|عنها|في الإنترنت|في الانترنت|في موقع|في|على موقع|على|عن سيارة|تكون لديها|تكون لديه|لديها|لديه|وتكون|بسيط|بسعر مميز|أحضر لي روابط|أعطني روابط|أعطني رابط|روابط|kleinanzeigen\.de|kleinanzeigen|kleine anzeigen|mobile\.de|autoscout24|autoscout|amazon\.de|amazon|ebay\.de|ebay|youtube)/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const effectiveQuery = carTerms.length ? carTerms.join(' ') : (cleaned || (recentHist.slice(-140).trim()) || q.trim());
  const enc = encodeURIComponent(effectiveQuery);

  if (isCar) {
    const kaSlug = (carTerms.length ? carTerms.join('-') : 'gebrauchtwagen').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
    const kaSort = isCheap ? 'sortierung:preis/' : '';
    const labelTerms = carTerms.filter(t => t !== 'unfallwagen').join(' ').toUpperCase() || (isDamaged ? 'سيارات بحادث' : 'سيارات مستعملة');
    links.push({
      title: isDamaged ? `Kleinanzeigen — ${labelTerms} (بحادث / الأرخص)` : `Kleinanzeigen — ${labelTerms}`,
      url: `https://www.kleinanzeigen.de/s-autos/${kaSort}${kaSlug}/k0c216`,
      desc: 'Verified Kleinanzeigen live car listings'
    });
    const asParams = new URLSearchParams({ atype: 'C', cy: 'D', sort: 'price', desc: '0' });
    if (isDamaged) asParams.set('damaged_listing', 'only');
    const asQuery = carTerms.filter(t => t !== 'unfallwagen').join(' ');
    if (asQuery) asParams.set('q', asQuery);
    links.push({
      title: isDamaged ? `AutoScout24 — ${labelTerms} (بحادث / الأرخص)` : `AutoScout24 — ${labelTerms}`,
      url: `https://www.autoscout24.de/lst?${asParams.toString()}`,
      desc: 'Verified AutoScout24 live car listings'
    });
    links.push({
      title: `Google — إعلانات ${labelTerms} على Kleinanzeigen`,
      url: `https://www.google.com/search?q=${encodeURIComponent('site:kleinanzeigen.de/s-anzeige ' + (carTerms.join(' ') || 'gebrauchtwagen'))}`,
      desc: 'Direct individual Kleinanzeigen car ads via Google'
    });
    return { cleaned: effectiveQuery, links };
  }

  if (/klein\s*anzeigen|kleine\s*anzeigen/i.test(low)) {
    const slug = effectiveQuery.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '');
    links.push({ title: `Kleinanzeigen: ${effectiveQuery}`, url: `https://www.kleinanzeigen.de/s-${encodeURIComponent(slug || effectiveQuery)}/k0`, desc: 'Direct Kleinanzeigen search' });
  }
  if (/amazon/i.test(low)) {
    links.push({ title: `Amazon: ${effectiveQuery}`, url: `https://www.amazon.de/s?k=${enc}`, desc: 'Direct Amazon search' });
  }
  if (/ebay/i.test(low)) {
    links.push({ title: `eBay: ${effectiveQuery}`, url: `https://www.ebay.de/sch/i.html?_nkw=${enc}`, desc: 'Direct eBay search' });
  }
  if (/youtube|يوتيوب/i.test(low)) {
    links.push({ title: `YouTube: ${effectiveQuery}`, url: `https://www.youtube.com/results?search_query=${enc}`, desc: 'Direct YouTube search' });
  }
  if (!links.length) {
    links.push({ title: `Google: ${effectiveQuery}`, url: `https://www.google.com/search?q=${enc}`, desc: 'Direct Google search' });
  }
  return { cleaned: effectiveQuery, links };
}

async function liveWebSearch(question, history = []) {
  if (!SEARCH_INTENT.test(question || '')) return '';
  const { cleaned, links } = buildDirectLinks(question, history);
  const low = question.toLowerCase();
  let query = cleaned;
  if (/klein\s*anzeigen|kleine\s*anzeigen/i.test(low)) query = `kleinanzeigen.de ${cleaned}`;
  else if (/mobile\.de/i.test(low)) query = `mobile.de ${cleaned}`;
  else if (/autoscout/i.test(low)) query = `autoscout24.de ${cleaned}`;
  else if (/amazon/i.test(low)) query = `amazon.de ${cleaned}`;
  else if (/ebay/i.test(low)) query = `ebay.de ${cleaned}`;

  const found = [...links];
  try {
    const r = await fetch('https://www.bing.com/search?format=rss&q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(4500)
    });
    if (r.ok) {
      const xml = await r.text();
      const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi;
      const unesc = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
      let m;
      while ((m = re.exec(xml)) && found.length < 7) {
        const u = unesc(m[2]);
        if (/^https?:\/\//i.test(u) && !found.some(x => x.url === u)) {
          found.push({ title: unesc(m[1]).slice(0, 110), url: u, desc: unesc(m[3]).slice(0, 160) });
        }
      }
    }
  } catch {}

  const lines = found.map((x, i) => `${i + 1}. [${x.title}](${x.url}) — ${x.desc}`).join('\n');
  return `\n\n[LIVE WEB SEARCH RESULTS — include the most relevant clickable Markdown links [Title](URL) in your answer so the user can click them directly]:\n${lines}`;
}

module.exports = (ctx) => {
  const origAskClaude = ctx.askClaude;
  const origGetApiKey = ctx.getApiKey;
  let cachedFreeModel = '';
  let cachedOllamaModel = '';
  let launchedOnce = false;

  async function isFreeUp() {
    try {
      const r = await fetch(baseUrl() + '/v1/models', { signal: AbortSignal.timeout(1000) });
      return r.status === 200 || r.status === 401;
    } catch { return false; }
  }

  async function ensureFreeRunning() {
    if (await isFreeUp()) return true;
    if (launchedOnce) return false;
    launchedOnce = true;
    const exe = EXE_CANDIDATES.find(p => p && fs.existsSync(p));
    if (!exe) return false;
    try {
      cp.spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: true }).unref();
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 800));
        if (await isFreeUp()) return true;
      }
    } catch {}
    return false;
  }

  async function pickFreeModel(key) {
    if (cachedFreeModel) return cachedFreeModel;
    try {
      const headers = key ? { Authorization: 'Bearer ' + key } : {};
      const r = await fetch(baseUrl() + '/v1/models', { headers, signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const ids = (d.data || []).map(x => x.id).filter(Boolean);
        if (ids.length) {
          cachedFreeModel = ids.find(id => /^auto$/i.test(id)) ||
            ids.find(id => /qwen|gemini|llama|deepseek|mistral|claude/i.test(id)) ||
            ids[0];
          return cachedFreeModel;
        }
      }
    } catch {}
    return 'auto';
  }

  async function askFreeLLM(system, messages, maxTokens = 2048, key = '') {
    const up = await ensureFreeRunning();
    if (!up) return null;
    const model = await pickFreeModel(key);
    const headers = { 'content-type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    const res = await fetch(baseUrl() + '/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: toOpenAiMessages(system, messages) }),
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const msg = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof msg === 'string' && msg ? msg : (Array.isArray(msg) ? msg.map(p => p.text || '').join('') : null);
  }

  async function askFastCloud(system, messages, maxTokens = 2048) {
    try {
      const res = await fetch(CLOUD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'openai', max_tokens: maxTokens, messages: toOpenAiMessages(system, messages) }),
        signal: AbortSignal.timeout(22000)
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const msg = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return typeof msg === 'string' && msg ? msg : null;
    } catch { return null; }
  }

  async function pickOllamaModel() {
    if (cachedOllamaModel) return cachedOllamaModel;
    try {
      const r = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(1200) });
      if (!r.ok) return '';
      const d = await r.json().catch(() => ({}));
      const names = (d.models || []).map(m => m.name).filter(Boolean);
      if (names.length) { cachedOllamaModel = names[0]; return cachedOllamaModel; }
    } catch {}
    return '';
  }

  async function askOllama(system, messages, maxTokens = 2048) {
    try {
      const model = await pickOllamaModel();
      if (!model) return null;
      const res = await fetch(OLLAMA_URL + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: toTextOnlyMessages(system, messages) }),
        signal: AbortSignal.timeout(45000)
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const msg = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return typeof msg === 'string' && msg ? msg : null;
    } catch { return null; }
  }

  async function unifiedAsk(system, messages, maxTokens = 2048, extra = {}) {
    const key = (origGetApiKey && origGetApiKey()) || '';
    // 1) مفتاح Claude مدفوع
    if (key.startsWith('sk-ant-')) return origAskClaude(system, messages, maxTokens, extra);
    // 2) مفتاح FreeLLMAPI مضاف -> FreeLLMAPI السحابي المجمّع أولاً
    if (key) {
      const fl = await askFreeLLM(system, messages, maxTokens, key);
      if (fl) return fl;
    }
    // 3) السحابة المجانية السريعة (استجابة خلال ~1-2 ثانية بدون مفتاح وبصفر عبء على جهازك)
    const cloud = await askFastCloud(system, messages, maxTokens);
    if (cloud) return cloud;
    // 4) FreeLLMAPI بدون مفتاح إن كان متاحاً
    const fl2 = await askFreeLLM(system, messages, maxTokens, '');
    if (fl2) return fl2;
    // 5) احتياط محلي تلقائي: Ollama
    const ol = await askOllama(system, messages, maxTokens);
    if (ol) return ol;
    throw new Error('تعذّر الاتصال بخدمة الذكاء الاصطناعي مؤقتاً — تحقق من الاتصال بالإنترنت.');
  }

  ctx.askClaude = unifiedAsk;
  ctx.getApiKey = () => (origGetApiKey && origGetApiKey()) || 'cloud-free-ai';

  async function imageBlock(src, w) {
    const r = await ctx.sesOf(w).fetch(src);
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|gif|webp)$/.test(type)) throw new Error('Unsupported image type: ' + type);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) throw new Error('Image too large');
    return { type: 'image', source: { type: 'base64', media_type: type, data: buf.toString('base64') } };
  }

  try { ipcMain.removeHandler('ai'); } catch {}
  ipcMain.handle('ai', async (e, { action, text, question, history }) => {
    const w = ctx.W(e);
    try {
      const sys = ctx.system() + ' CRITICAL RULES: (1) Always remember and follow the full conversation history — when the user refers to "this car", "the same one", "find links for it", etc., use the exact car/product/topic from previous messages in this chat! (2) NEVER invent or guess URLs from memory, and NEVER use ebay-kleinanzeigen.de or suchen.mobile.de. ONLY output the exact verified URLs provided in [LIVE WEB SEARCH RESULTS] formatted as clickable Markdown links [Title](https://...).';
      const one = async (content) => sanitizeLinks(await unifiedAsk(sys, [{ role: 'user', content }]));
      if (action === 'translate') return { ok: true, text: await one(`Translate the following text into ${ctx.langName()}. Output only the translation:\n\n${text}`) };
      if (action === 'explain') return { ok: true, text: await one(`Explain this text simply:\n\n${text}`) };
      if (action === 'reply') return { ok: true, text: await one(`Suggest 3 short, polite replies with different tones to this post/comment, in the same language as the post:\n\n${text}`) };
      if (action === 'image') return { ok: true, text: await one([await imageBlock(text, w), { type: 'text', text: 'Describe this image in detail. If it contains text, transcribe and translate it.' }]) };
      if (action === 'general') {
        const webCtx = await liveWebSearch(question, history);
        const msgs = (history || []).slice(-16).map(m => ({ role: m.role, content: m.content }));
        msgs.push({ role: 'user', content: question + webCtx });
        return { ok: true, text: sanitizeLinks(await unifiedAsk(sys, msgs)) };
      }
      const pctx = await ctx.pageContext(w);
      const block = ctx.contextBlock(pctx);
      if (action === 'summarize') {
        const what = pctx && pctx.kind === 'video' ? 'this video' : 'this page';
        return { ok: true, text: await one(`${block}\n\n---\nSummarize ${what}: start with one sentence on the main idea, then the key points, then the takeaway.`) };
      }
      if (action === 'highlights') {
        return { ok: true, text: await one(`${block}\n\n---\nList the most important moments of this video as a bullet list. Start every bullet with its timestamp in square brackets, e.g. [3:15], followed by a short description.`) };
      }
      if (action === 'ask') {
        const webCtx = await liveWebSearch(question, history);
        const msgs = (history || []).slice(-16).map(m => ({ role: m.role, content: m.content }));
        const hasHistory = msgs.length > 0;
        const prompt = webCtx
          ? `My question: ${question}${webCtx}`
          : (hasHistory ? `${question}\n\n(Current browser tab context if relevant: ${(pctx && pctx.title) || ''} — ${(pctx && pctx.url) || ''})` : `${block}\n\n---\nMy question: ${question}`);
        msgs.push({ role: 'user', content: prompt });
        return { ok: true, text: sanitizeLinks(await unifiedAsk(sys, msgs)) };
      }
      return { ok: false, error: 'Unknown action' };
    } catch (err) {
      return { ok: false, error: err.message === 'NO_KEY' ? 'NO_KEY' : err.message };
    }
  });

  setTimeout(() => { ensureFreeRunning().catch(() => {}); }, 3500);

  const ownerOf = (wc) => {
    for (const w of ctx.windows) { try { if (w.ui && w.ui.webContents === wc) return w; } catch {} }
    const id = ctx.idByWc(wc.id);
    if (id != null) { const tb = ctx.tabs.get(id); if (tb) return tb.w; }
    return null;
  };
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => {
      if (String(url).startsWith(FREELOCAL_URL)) {
        ev.preventDefault();
        const w = ownerOf(wc);
        ensureRunningSafe(w);
      }
    });
  });
  function ensureRunningSafe(w) { ensureFreeRunning().then(() => { if (w) ctx.createTab(w, baseUrl()); }); }

  // ---------- ترقية مقارنة الأسعار (shop:compare) بالبحث الفوري الحقيقي لجميع المنتجات والسيارات والملابس ----------
  const SHOP_DETECT = `(() => {
    const out = { name: '', price: '', currency: '', brand: '' };
    try {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        let j; try { j = JSON.parse(s.textContent); } catch { continue; }
        const items = [].concat(j['@graph'] || j);
        for (const it of items) {
          const type = [].concat((it && it['@type']) || []).join(',');
          if (/Product|Car|Vehicle/i.test(type)) {
            const off = [].concat(it.offers || [])[0] || {};
            out.name = it.name || out.name;
            out.price = String(off.price || off.lowPrice || out.price || '');
            out.currency = off.priceCurrency || out.currency;
            out.brand = (it.brand && (it.brand.name || it.brand)) || out.brand;
            if (out.name) return out;
          }
        }
      }
    } catch {}
    const pEl = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"], #corePrice_feature_div .a-offscreen, .a-price .a-offscreen, .price, [class*="price"]');
    out.name = (document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText || document.title || '').trim();
    out.price = pEl ? (pEl.getAttribute('content') || pEl.innerText || '').trim().slice(0, 32) : '';
    return out;
  })()`;

  async function bingRss(query, max = 5) {
    try {
      const r = await fetch('https://www.bing.com/search?format=rss&q=' + encodeURIComponent(query), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(4500)
      });
      if (!r.ok) return [];
      const xml = await r.text();
      const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi;
      const unesc = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
      const out = [];
      let m;
      while ((m = re.exec(xml)) && out.length < max) {
        const u = unesc(m[2]);
        if (/^https?:\/\//i.test(u)) out.push({ title: unesc(m[1]).slice(0, 110), url: u, desc: unesc(m[3]).slice(0, 170) });
      }
      return out;
    } catch { return []; }
  }

  try { ipcMain.removeHandler('shop:compare'); } catch {}
  ipcMain.handle('shop:compare', async (e) => {
    const w = ctx.W(e), wc = ctx.activeWc(w);
    if (!wc) return { ok: false, error: ctx.t('shopNoProduct') };
    if (wc.isLoading()) await new Promise(r => { const tm = setTimeout(r, 5000); wc.once('did-stop-loading', () => { clearTimeout(tm); setTimeout(r, 250); }); });
    try {
      const d = await wc.executeJavaScript(SHOP_DETECT).catch(() => ({}));
      const rawName = (d && d.name ? d.name : wc.getTitle() || '').replace(/\s*[|–—-]\s*[^|–—-]+$/, '').trim();
      const name = rawName.slice(0, 90) || 'Product';
      const curUrl = wc.getURL();
      let curHost = '';
      try { curHost = new URL(curUrl).hostname.replace(/^www\./, ''); } catch {}

      const queryCore = [d && d.brand, name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const isCar = /(auto|car|bmw|mercedes|audi|volkswagen|vw|golf|polo|passat|opel|ford|toyota|skoda|seat|unfall|km|ps|tüv|baujahr|kleinanzeigen\.de\/s-anzeige|autoscout24|mobile\.de)/i.test(queryCore + ' ' + curUrl);
      const isFashion = /(kleid|hose|jacke|schuh|slipper|sneaker|pullover|mantel|hemd|shirt|dress|shoe|jacket|jeans|coat|boot|mode|fashion|abito|scarpe|giacca|veste|chaussure|فستان|حذاء|معطف|جاكيت|بنطلون|ملابس)/i.test(queryCore + ' ' + curUrl);
      const enc = encodeURIComponent(queryCore);

      // 1) روابط مقارنة مباشرة حقيقية حسب نوع المنتج (سيارة / ملابس / أي منتج)
      const directStores = isCar ? [
        { title: `Kleinanzeigen: ${queryCore}`, url: `https://www.kleinanzeigen.de/s-autos/sortierung:preis/${encodeURIComponent(queryCore.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}/k0c216`, desc: 'Direct Kleinanzeigen car listings sorted by lowest price' },
        { title: `AutoScout24: ${queryCore}`, url: `https://www.autoscout24.de/lst?atype=C&cy=D&sort=price&desc=0&q=${enc}`, desc: 'Direct AutoScout24 listings sorted by lowest price' }
      ] : [
        { title: `idealo (مقارنة الأسعار): ${queryCore}`, url: `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${enc}`, desc: 'Price comparison across hundreds of European stores' },
        { title: `Google Shopping: ${queryCore}`, url: `https://www.google.com/search?tbm=shop&q=${enc}`, desc: 'Live Google Shopping prices & similar items' },
        { title: `Amazon: ${queryCore}`, url: `https://www.amazon.de/s?k=${enc}`, desc: 'Amazon listings & prices' },
        { title: `eBay: ${queryCore}`, url: `https://www.ebay.de/sch/i.html?_nkw=${enc}&_sop=15`, desc: 'eBay listings sorted by lowest price' },
        ...(isFashion ? [{ title: `Zalando: ${queryCore}`, url: `https://www.zalando.de/katalog/?q=${enc}`, desc: 'Similar fashion items on Zalando' }] : [])
      ];

      // 2) بحث حي متوازي على الويب لإيجاد متاجر وأسعار فعلية لمنتجات مماثلة أو مطابقة
      const [r1, r2] = await Promise.all([
        bingRss(`${queryCore} price OR preis OR €`, 5),
        bingRss(isCar ? `kleinanzeigen.de OR autoscout24.de ${queryCore}` : `${queryCore} idealo OR amazon OR ebay OR zalando OR otto`, 5)
      ]);
      const seen = new Set([curUrl]);
      const liveResults = [];
      for (const item of [...r1, ...r2]) {
        if (seen.has(item.url)) continue;
        if (curHost && item.url.includes(curHost)) continue;
        seen.add(item.url);
        liveResults.push(item);
        if (liveResults.length >= 6) break;
      }

      const combined = [...liveResults, ...directStores];
      const block = combined.map((x, i) => `${i + 1}. [${x.title}](${x.url}) — ${x.desc}`).join('\n');
      const sys = ctx.system() +
        ' You HAVE live real-time web search results attached below. NEVER say you cannot search the internet or do not have real-time access! ' +
        'ALWAYS output a clean Markdown comparison table (Store | Similar/Matching Item & Price | Link) using ONLY the exact verified clickable links [Title](URL) from the attached results, followed by a brief 1-sentence verdict on whether the current price is a good deal.';

      const prompt =
        `Current product: "${name}"${d && d.brand ? ' (Brand: ' + d.brand + ')' : ''}${d && d.price ? `, Current price: ${d.price} ${d.currency || ''}` : ''}\n` +
        `Current page: ${curUrl}\n\n` +
        `[LIVE MULTI-STORE SEARCH RESULTS & VERIFIED COMPARISON LINKS]:\n${block}\n\n` +
        `Compare this product with similar/matching listings from other platforms above. Highlight any cheaper options or prices mentioned in the snippets, include the clickable links so the user can open them directly, and give a 1-sentence deal verdict.`;

      const text = sanitizeLinks(await unifiedAsk(sys, [{ role: 'user', content: prompt }], 2500));
      return { ok: true, text, label: `🛒 ${ctx.t('shopCompare')}: ${name.slice(0, 60)}` };
    } catch (err) {
      return { ok: false, error: err.message === 'NO_KEY' ? 'NO_KEY' : err.message };
    }
  });
};
