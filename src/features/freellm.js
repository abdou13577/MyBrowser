// ربط المساعد الذكي في MyBrowser تلقائياً مع FreeLLMAPI المحلي + Ollama المحلي (مجاني ويعمل فوراً بدون مفتاح!)
// الأولوية الذكية:
// 1) مفتاح Claude مدفوع (يبدأ بـ sk-ant-...) -> Anthropic
// 2) مفتاح FreeLLMAPI (من http://127.0.0.1:31415) -> FreeLLMAPI
// 3) عند عدم وجود مفتاح -> يستخدم Ollama المحلي تلقائياً (http://127.0.0.1:11434) إن كان شغّالاً!
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const FREELOCAL_URL = 'https://freellm.mybrowser.invalid/';
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

function baseUrl() {
  return `http://127.0.0.1:${readFreePort()}`;
}

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

module.exports = (ctx) => {
  const origAskClaude = ctx.askClaude;
  const origGetApiKey = ctx.getApiKey;
  let cachedFreeModel = '';
  let cachedOllamaModel = '';
  let launchedOnce = false;

  async function isFreeUp() {
    try {
      const r = await fetch(baseUrl() + '/v1/models', { signal: AbortSignal.timeout(1200) });
      return r.status === 200 || r.status === 401;
    } catch { return false; }
  }

  async function pickOllamaModel() {
    if (cachedOllamaModel) return cachedOllamaModel;
    try {
      const r = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(1500) });
      if (!r.ok) return '';
      const d = await r.json().catch(() => ({}));
      const names = (d.models || []).map(m => m.name).filter(Boolean);
      if (names.length) {
        cachedOllamaModel = names[0];
        return cachedOllamaModel;
      }
    } catch {}
    return '';
  }

  async function ensureFreeRunning() {
    if (await isFreeUp()) return true;
    if (launchedOnce) return false;
    launchedOnce = true;
    const exe = EXE_CANDIDATES.find(p => p && fs.existsSync(p));
    if (!exe) return false;
    try {
      cp.spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: true }).unref();
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 900));
        if (await isFreeUp()) return true;
      }
    } catch {}
    return false;
  }

  async function pickFreeModel(key) {
    if (cachedFreeModel) return cachedFreeModel;
    try {
      const headers = key ? { Authorization: 'Bearer ' + key } : {};
      const r = await fetch(baseUrl() + '/v1/models', { headers, signal: AbortSignal.timeout(3000) });
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

  async function askOllama(system, messages, maxTokens = 2048) {
    const model = await pickOllamaModel();
    if (!model) return null;
    const res = await fetch(OLLAMA_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: toTextOnlyMessages(system, messages)
      })
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const msg = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof msg === 'string' && msg ? msg : null;
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
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: toOpenAiMessages(system, messages)
      })
    });
    if (res.status === 401) return { needKey: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || `FreeLLMAPI HTTP ${res.status}`);
    const choice = data.choices && data.choices[0];
    const msg = choice && choice.message && choice.message.content;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.map(p => p.text || '').join('');
    return '';
  }

  async function unifiedAsk(system, messages, maxTokens = 2048, extra = {}) {
    const key = (origGetApiKey && origGetApiKey()) || '';
    // 1) مفتاح Claude مدفوع
    if (key.startsWith('sk-ant-')) return origAskClaude(system, messages, maxTokens, extra);
    // 2) مفتاح FreeLLMAPI موجود -> FreeLLMAPI أولاً
    if (key) {
      const r = await askFreeLLM(system, messages, maxTokens, key);
      if (typeof r === 'string') return r;
      if (r && r.needKey) {
        const ol = await askOllama(system, messages, maxTokens);
        if (ol) return ol;
        throw new Error('مفتاح FreeLLMAPI غير صالح — انسخه من http://127.0.0.1:' + readFreePort() + ' وضعه في إعدادات المتصفح.');
      }
    }
    // 3) بدون مفتاح: جرّب Ollama المحلي فوراً (يعمل بدون مفتاح!) ثم FreeLLMAPI
    const ol = await askOllama(system, messages, maxTokens);
    if (ol) return ol;
    const r = await askFreeLLM(system, messages, maxTokens, '');
    if (typeof r === 'string') return r;
    throw new Error('افتح FreeLLMAPI (http://127.0.0.1:' + readFreePort() + ') وانسخ مفتاح API المحلي إلى إعدادات المتصفح.');
  }

  ctx.askClaude = unifiedAsk;
  ctx.getApiKey = () => {
    const k = origGetApiKey ? origGetApiKey() : '';
    if (k) return k;
    return 'local-free-ai';
  };

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
      const one = (content) => unifiedAsk(ctx.system(), [{ role: 'user', content }]);
      if (action === 'translate') return { ok: true, text: await one(`Translate the following text into ${ctx.langName()}. Output only the translation:\n\n${text}`) };
      if (action === 'explain') return { ok: true, text: await one(`Explain this text simply:\n\n${text}`) };
      if (action === 'reply') return { ok: true, text: await one(`Suggest 3 short, polite replies with different tones to this post/comment, in the same language as the post:\n\n${text}`) };
      if (action === 'image') return { ok: true, text: await one([await imageBlock(text, w), { type: 'text', text: 'Describe this image in detail. If it contains text, transcribe and translate it.' }]) };
      if (action === 'general') {
        const msgs = (history || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
        msgs.push({ role: 'user', content: question });
        return { ok: true, text: await unifiedAsk(ctx.system(), msgs) };
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
        const msgs = (history || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
        msgs.push({ role: 'user', content: `${block}\n\n---\nMy question: ${question}` });
        return { ok: true, text: await unifiedAsk(ctx.system(), msgs) };
      }
      return { ok: false, error: 'Unknown action' };
    } catch (err) {
      return { ok: false, error: err.message === 'NO_KEY' ? 'NO_KEY' : err.message };
    }
  });

  // تشغيل FreeLLMAPI تلقائياً بهدوء بعد فتح المتصفح إن كان مثبّتاً
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
        ensureFreeRunning().then(() => { if (w) ctx.createTab(w, baseUrl()); });
      }
    });
  });
};
