// Frame preload: يفعّل navigator.share و navigator.canShare قبل تشغيل أي سكربت للموقع (document_start)
// ويربطه بنافذة المشاركة الأصلية لويندوز 10/11 (WhatsApp, Telegram, Phone Link, Nearby Share, Mail...)
const { ipcRenderer, webFrame } = require('electron');

const TOKEN = '__mb_webshare_' + Math.random().toString(36).slice(2);

window.addEventListener('message', async (ev) => {
  if (ev.source !== window || !ev.data || ev.data.token !== TOKEN || ev.data.dir !== 'req') return;
  try {
    const res = await ipcRenderer.invoke('webshare:open', ev.data.payload || {});
    window.postMessage({ token: TOKEN, dir: 'res', id: ev.data.id, ok: !!(res && res.ok) }, '*');
  } catch {
    window.postMessage({ token: TOKEN, dir: 'res', id: ev.data.id, ok: false }, '*');
  }
});

const MAIN_WORLD = `(() => {
  if (window.__mbNativeShareReady) return;
  window.__mbNativeShareReady = true;
  const TOKEN = ${JSON.stringify(TOKEN)};
  let seq = 0;
  const pending = new Map();
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.token !== TOKEN || ev.data.dir !== 'res') return;
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    if (ev.data.ok) p.resolve();
    else p.reject(new DOMException('Share failed or canceled', 'AbortError'));
  });
  const shareFn = (data = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    window.postMessage({
      token: TOKEN, dir: 'req', id,
      payload: {
        title: String(data.title || document.title || '').slice(0, 200),
        text: String(data.text || '').slice(0, 600),
        url: String(data.url || location.href || '').slice(0, 2000)
      }
    }, '*');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(); } }, 8000);
  });
  const canShareFn = (data) => !data || typeof data === 'object';
  try {
    Object.defineProperty(Navigator.prototype, 'share', { value: shareFn, configurable: true, writable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', { value: canShareFn, configurable: true, writable: true });
  } catch {
    try {
      Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', { value: canShareFn, configurable: true, writable: true });
    } catch {}
  }
})()`;

try { webFrame.executeJavaScript(MAIN_WORLD); } catch {}
