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

// ---------- البحث الحي في الويب + توليد روابط مباشرة للمواقع الشهيرة ----------
const SEARCH_INTENT = /(ابحث|بحث|دور|أعطني رابط|أعطني روابط|روابط|رابط|سيار[ةه]|سعر|أسعار|شراء|للبيع|أين أجد|kleinanzeigen|kleine anzeigen|mobile\.de|autoscout|amazon|ebay|youtube|search|find|buy|price|suche|auto kaufen|gebrauchtwagen)/i;

function buildDirectLinks(q) {
  const links = [];
  const low = q.toLowerCase();
  // تنظيف الاستعلام لاستخراج الكلمات المفتاحية للبحث المباشر
  const cleaned = q
    .replace(/(ابحث لي|ابحث عن|ابحث|في موقع|في|على موقع|على|عن سيارة|عن|أعطني روابط|أعطني رابط|kleinanzeigen\.de|kleinanzeigen|kleine anzeigen|mobile\.de|autoscout24|autoscout|amazon\.de|amazon|ebay\.de|ebay|youtube)/gi, ' ')
    .replace(/\s+/g, ' ').trim() || q.trim();
  const slug = cleaned.toLowerCase().replace(/[^a-z0-9äöüß\u0600-\u06FF]+/gi, '-').replace(/^-|-$/g, '');
  const enc = encodeURIComponent(cleaned);

  if (/klein\s*anzeigen|kleine\s*anzeigen/i.test(low)) {
    const isCar = /(سيار|auto|car|golf|bmw|mercedes|audi|vw|polo|passat|opel|ford|toyota|skoda)/i.test(low);
    const url = isCar
      ? `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(slug || cleaned)}/k0c216`
      : `https://www.kleinanzeigen.de/s-${encodeURIComponent(slug || cleaned)}/k0`;
    links.push({ title: `Kleinanzeigen: ${cleaned}`, url, desc: 'Direct Kleinanzeigen search results' });
  }
  if (/mobile\.de/i.test(low)) {
    links.push({ title: `mobile.de: ${cleaned}`, url: `https://suchen.mobile.de/fahrzeuge/search.html?q=${enc}`, desc: 'Direct mobile.de car search' });
  }
  if (/autoscout/i.test(low)) {
    links.push({ title: `AutoScout24: ${cleaned}`, url: `https://www.autoscout24.de/lst?q=${enc}`, desc: 'Direct AutoScout24 search' });
  }
  if (/amazon/i.test(low)) {
    links.push({ title: `Amazon: ${cleaned}`, url: `https://www.amazon.de/s?k=${enc}`, desc: 'Direct Amazon search' });
  }
  if (/ebay/i.test(low)) {
    links.push({ title: `eBay: ${cleaned}`, url: `https://www.ebay.de/sch/i.html?_nkw=${enc}`, desc: 'Direct eBay search' });
  }
  if (/youtube|يوتيوب/i.test(low)) {
    links.push({ title: `YouTube: ${cleaned}`, url: `https://www.youtube.com/results?search_query=${enc}`, desc: 'Direct YouTube search' });
  }
  if (!links.length) {
    links.push({ title: `Google: ${cleaned}`, url: `https://www.google.com/search?q=${enc}`, desc: 'Direct Google search' });
  }
  return { cleaned, links };
}

async function liveWebSearch(question) {
  if (!SEARCH_INTENT.test(question || '')) return '';
  const { cleaned, links } = buildDirectLinks(question);
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
      const sys = ctx.system() + ' When providing websites or search results, ALWAYS format URLs as clickable Markdown links like [Title](https://...) so the user can click them directly.';
      const one = (content) => unifiedAsk(sys, [{ role: 'user', content }]);
      if (action === 'translate') return { ok: true, text: await one(`Translate the following text into ${ctx.langName()}. Output only the translation:\n\n${text}`) };
      if (action === 'explain') return { ok: true, text: await one(`Explain this text simply:\n\n${text}`) };
      if (action === 'reply') return { ok: true, text: await one(`Suggest 3 short, polite replies with different tones to this post/comment, in the same language as the post:\n\n${text}`) };
      if (action === 'image') return { ok: true, text: await one([await imageBlock(text, w), { type: 'text', text: 'Describe this image in detail. If it contains text, transcribe and translate it.' }]) };
      if (action === 'general') {
        const webCtx = await liveWebSearch(question);
        const msgs = (history || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
        msgs.push({ role: 'user', content: question + webCtx });
        return { ok: true, text: await unifiedAsk(sys, msgs) };
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
        const webCtx = await liveWebSearch(question);
        const msgs = (history || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
        const prompt = webCtx
          ? `My question: ${question}${webCtx}\n\n(Current open tab for optional reference: ${(pctx && pctx.url) || ''})`
          : `${block}\n\n---\nMy question: ${question}`;
        msgs.push({ role: 'user', content: prompt });
        return { ok: true, text: await unifiedAsk(sys, msgs) };
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
};
