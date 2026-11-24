// البحث الذكي والاقتراحات الفورية في شريط العنوان (Smart Omnibox — مثل Google Chrome)
// أثناء الكتابة في شريط العنوان (#address):
// - يظهر قائمة منسدلة فورية تجمع: التبويبات المفتوحة + السجل + المفضلة + اقتراحات Google الحية بأي لغة
// - تنقّل كامل بالأسهم (↑ ↓) و Enter و Esc، وإلغاء الطلبات القديمة تلقائياً حتى لا تتداخل النتائج
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const CSS = `
  #mbxOmni {
    position: fixed; z-index: 9500; border-radius: 16px; overflow: hidden;
    background: #11132A; border: 1px solid rgba(139,124,255,.42);
    box-shadow: 0 18px 48px rgba(3,4,18,.72); padding: 6px;
    display: flex; flex-direction: column; gap: 2px; box-sizing: border-box;
    font-family: "Segoe UI Variable Text","Segoe UI","Noto Sans Arabic",system-ui,sans-serif;
  }
  #mbxOmni[hidden] { display: none !important; }
  .mbx-orow {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px;
    border: 0; border-radius: 10px; background: transparent; color: #EEF0FF;
    cursor: pointer; text-align: start; font: inherit; font-size: 13.5px;
    transition: background .1s;
  }
  .mbx-orow:hover, .mbx-orow.on { background: rgba(139,124,255,.22); }
  .mbx-oic { width: 20px; text-align: center; flex: none; font-size: 14px; opacity: .88; }
  .mbx-otxt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .mbx-otitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mbx-ourl { font-size: 11.5px; color: #8B93B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; text-align: start; }
  .mbx-obadge { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: rgba(46,230,214,.16); color: #2EE6D6; flex: none; }
`;

function injectScript() {
  return `(() => {
    const inp = document.getElementById('address'), form = document.getElementById('addressForm');
    if (!inp || !form || document.getElementById('mbxOmni')) return;
    if (!document.getElementById('mbxOmniCss')) {
      const s = document.createElement('style'); s.id = 'mbxOmniCss'; s.textContent = ${JSON.stringify(CSS)}; document.head.append(s);
    }
    const drop = document.createElement('div');
    drop.id = 'mbxOmni';
    drop.hidden = true;
    document.body.append(drop);

    let items = [], sel = -1, seq = 0, deb = null, isOpen = false;

    function position() {
      const r = form.getBoundingClientRect();
      drop.style.left = Math.max(8, r.left) + 'px';
      drop.style.top = (r.bottom + 6) + 'px';
      drop.style.width = Math.max(260, r.width) + 'px';
    }

    function setOpen(open) {
      if (isOpen === open) return;
      isOpen = open;
      drop.hidden = !open;
      window.mbExtras && window.mbExtras.omniState && window.mbExtras.omniState(open);
    }

    function close() {
      clearTimeout(deb);
      items = []; sel = -1;
      drop.innerHTML = '';
      setOpen(false);
    }

    function pick(it) {
      if (!it) return;
      close();
      inp.blur();
      if (it.kind === 'tab' && it.tabId != null) {
        window.browser && window.browser.switchTab(it.tabId);
      } else {
        const target = it.url || it.title;
        if (target) window.browser && window.browser.go(target);
      }
    }

    function render() {
      if (!items.length) { close(); return; }
      position();
      drop.innerHTML = '';
      items.forEach((it, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mbx-orow' + (idx === sel ? ' on' : '');
        const ic = document.createElement('span'); ic.className = 'mbx-oic'; ic.textContent = it.icon || '🔍';
        const txt = document.createElement('span'); txt.className = 'mbx-otxt';
        const t1 = document.createElement('span'); t1.className = 'mbx-otitle'; t1.textContent = it.title;
        txt.append(t1);
        if (it.url && it.url !== it.title) {
          const t2 = document.createElement('span'); t2.className = 'mbx-ourl'; t2.textContent = it.url;
          txt.append(t2);
        }
        b.append(ic, txt);
        if (it.badge) {
          const bg = document.createElement('span'); bg.className = 'mbx-obadge'; bg.textContent = it.badge;
          b.append(bg);
        }
        b.addEventListener('mouseenter', () => {
          sel = idx;
          drop.querySelectorAll('.mbx-orow').forEach((el, k) => el.classList.toggle('on', k === sel));
        });
        b.addEventListener('mousedown', (e) => { e.preventDefault(); pick(it); });
        drop.append(b);
      });
      setOpen(true);
    }

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      clearTimeout(deb);
      if (q.length < 2) { close(); return; }
      const mySeq = ++seq;
      deb = setTimeout(async () => {
        try {
          const list = await (window.mbExtras && window.mbExtras.omniSuggest ? window.mbExtras.omniSuggest(q) : []);
          if (mySeq !== seq || document.activeElement !== inp) return;
          items = Array.isArray(list) ? list : [];
          sel = -1;
          render();
        } catch { close(); }
      }, 150);
    });

    inp.addEventListener('keydown', (e) => {
      if (!isOpen || !items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        sel = (sel + 1) % items.length;
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel - 1 + items.length) % items.length;
        render();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Enter' && sel >= 0 && items[sel]) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(items[sel]);
      }
    }, true);

    inp.addEventListener('blur', () => { setTimeout(close, 120); });
    form.addEventListener('submit', () => { close(); });
    window.addEventListener('resize', () => { if (isOpen) position(); });
  })()`;
}

module.exports = (ctx) => {
  const tabBadge = () => ({ ar: 'مفتوح', en: 'Open tab', de: 'Offen', fr: 'Ouvert', es: 'Abierta', it: 'Aperta', tr: 'Açık' })[(ctx.lang() || 'en').slice(0, 2)] || 'Open';

  function localMatches(w, q) {
    const ql = q.toLowerCase();
    const out = [];
    const seen = new Set();
    // 1) التبويبات المفتوحة
    if (w && w.order) {
      for (const id of w.order) {
        const tb = ctx.tabs.get(id);
        if (!tb || !ctx.alive(tb)) continue;
        const url = tb.sleeping ? tb.sleeping.url : tb.view.webContents.getURL();
        const title = tb.sleeping ? tb.sleeping.title : (tb.view.webContents.getTitle() || url);
        if (!/^https?:\/\//i.test(url)) continue;
        if (title.toLowerCase().includes(ql) || url.toLowerCase().includes(ql)) {
          seen.add(url);
          out.push({ kind: 'tab', tabId: id, icon: '🗂', title: title.slice(0, 80), url, badge: tabBadge() });
          if (out.length >= 2) break;
        }
      }
    }
    // 2) المفضلة (Bookmarks)
    try {
      const pid = ctx.profileOf(w).id;
      const bmFile = path.join(app.getPath('userData'), 'bookmarks', pid + '.json');
      const bms = JSON.parse(fs.readFileSync(bmFile, 'utf8'));
      if (Array.isArray(bms)) {
        for (const b of bms) {
          if (!b || !b.url || seen.has(b.url)) continue;
          if ((b.title || '').toLowerCase().includes(ql) || b.url.toLowerCase().includes(ql)) {
            seen.add(b.url);
            out.push({ kind: 'bm', icon: '⭐', title: (b.title || b.url).slice(0, 80), url: b.url });
            if (out.length >= 4) break;
          }
        }
      }
    } catch {}
    // 3) السجل (History)
    try {
      const pid = ctx.profileOf(w).id;
      const hFile = path.join(app.getPath('userData'), 'history', pid + '.json');
      const hist = JSON.parse(fs.readFileSync(hFile, 'utf8'));
      if (Array.isArray(hist)) {
        for (const h of hist) {
          if (!h || !h.u || seen.has(h.u)) continue;
          if ((h.t || '').toLowerCase().includes(ql) || h.u.toLowerCase().includes(ql)) {
            seen.add(h.u);
            out.push({ kind: 'hist', icon: '🕒', title: (h.t || h.u).slice(0, 80), url: h.u });
            if (out.length >= 5) break;
          }
        }
      }
    } catch {}
    return { out, seen };
  }

  async function googleSuggest(q) {
    try {
      const hl = (ctx.lang() || 'en').slice(0, 2);
      const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(hl)}&q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(2200)
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d && d[1]) ? d[1].slice(0, 7) : [];
    } catch { return []; }
  }

  ipcMain.handle('omni:suggest', async (e, q) => {
    const query = String(q || '').trim();
    if (query.length < 2) return [];
    const w = ctx.W(e);
    const { out, seen } = localMatches(w, query);
    const sugs = await googleSuggest(query);
    for (const s of sugs) {
      const text = String(s || '').trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      out.push({ kind: 'search', icon: '🔍', title: text });
      if (out.length >= 9) break;
    }
    return out;
  });

  ipcMain.handle('omni:state', (e, open) => {
    const w = ctx.W(e);
    if (!w || !w.win || w.win.isDestroyed()) return false;
    if (ctx.isBossActive && ctx.isBossActive()) return false;
    try {
      if (open) {
        w.win.contentView.addChildView(w.ui);
      } else {
        const cur = ctx.activeTab(w);
        if (cur && ctx.alive(cur)) w.win.contentView.addChildView(cur.view);
        if (w._split && w._split.view && !w._split.view.webContents.isDestroyed()) {
          w.win.contentView.addChildView(w._split.view);
        }
      }
    } catch {}
    return true;
  });

  ctx.hooks.windowReady.push((w) => {
    try {
      if (!w || !w.ui || w.ui.webContents.isDestroyed()) return;
      w.ui.webContents.executeJavaScript(injectScript()).catch(() => {});
    } catch {}
  });
};
