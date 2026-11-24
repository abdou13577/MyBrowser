// زر الميكروفون للإملاء الصوتي المباشر داخل خانة كتابة المساعد الذكي (#askForm)
// - يعمل بأي لغة (العربية، الألمانية، الإنجليزية، الفرنسية، الإسبانية، الإيطالية، التركية)
// - يجرّب SpeechRecognition المباشر، وإن لم يدعمه Electron على ويندوز يفتح فوراً الإملاء الصوتي المدمج في ويندوز (Win+H) داخل خانة الكتابة مباشرة!
// - كما يحسّن شكل الروابط القابلة للنقر (a.ext) داخل ردود المساعد لتظهر كأزرار أنيقة تفتح الموقع مباشرة في تبويب جديد
const { ipcMain } = require('electron');
const cp = require('child_process');

const L = {
  ar: { mic: 'تحدث بالميكروفون (إملاء صوتي)', stop: 'إيقاف الاستماع', listening: 'جارٍ الاستماع… تحدّث الآن' },
  en: { mic: 'Voice input (dictate)', stop: 'Stop listening', listening: 'Listening… speak now' },
  de: { mic: 'Spracheingabe (Mikrofon)', stop: 'Aufnahme stoppen', listening: 'Hört zu… bitte sprechen' },
  fr: { mic: 'Dictée vocale (micro)', stop: 'Arrêter', listening: 'Écoute… parlez maintenant' },
  es: { mic: 'Dictado por voz', stop: 'Detener', listening: 'Escuchando… habla ahora' },
  it: { mic: 'Dettatura vocale', stop: 'Ferma', listening: 'In ascolto… parla ora' },
  tr: { mic: 'Sesli yazma (mikrofon)', stop: 'Durdur', listening: 'Dinleniyor… konuşun' }
};

const LANG_MAP = { ar: 'ar-SA', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', tr: 'tr-TR' };

const CSS = `
  #mbxMicBtn {
    width: 38px; height: 38px; border-radius: 11px; border: 1px solid rgba(139,124,255,.35);
    background: rgba(139,124,255,.14); color: #EEF0FF; cursor: pointer; display: grid; place-items: center;
    flex-shrink: 0; transition: background .15s, border-color .15s, transform .12s;
  }
  #mbxMicBtn:hover { background: rgba(139,124,255,.28); border-color: #8B7CFF; }
  #mbxMicBtn.rec { background: #E0466A; border-color: #ff8aa4; color: #fff; animation: mbxPulse 1.1s infinite; }
  #mbxMicBtn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  @keyframes mbxPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,70,106,.55); } 50% { box-shadow: 0 0 0 8px rgba(224,70,106,0); } }
  #chat .msg a.ext {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; margin: 2px 0;
    border-radius: 8px; background: rgba(79,140,255,.16); border: 1px solid rgba(79,140,255,.38);
    color: #9BC2FF; text-decoration: none; font-weight: 600; cursor: pointer; transition: background .12s;
  }
  #chat .msg a.ext:hover { background: rgba(79,140,255,.3); color: #fff; }
`;

function injectScript(lbl, recLang) {
  return `(() => {
    const T = ${JSON.stringify(lbl)}, REC_LANG = ${JSON.stringify(recLang)};
    if (!document.getElementById('mbxVoiceCss')) {
      const s = document.createElement('style'); s.id = 'mbxVoiceCss'; s.textContent = ${JSON.stringify(CSS)}; document.head.append(s);
    }
    const form = document.getElementById('askForm'), ta = document.getElementById('question');
    if (!form || !ta || document.getElementById('mbxMicBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'mbxMicBtn'; btn.type = 'button'; btn.title = T.mic; btn.setAttribute('aria-label', T.mic);
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.5M8.5 21.5h7"/></svg>';
    const sub = form.querySelector('button[type="submit"]');
    form.insertBefore(btn, sub || null);

    let rec = null, listening = false, baseVal = '';
    const stopRec = () => {
      listening = false;
      btn.classList.remove('rec');
      btn.title = T.mic;
      try { rec && rec.stop(); } catch {}
      rec = null;
    };

    const startWinDictation = () => {
      ta.focus();
      window.mbExtras && window.mbExtras.winDictate && window.mbExtras.winDictate();
    };

    btn.onclick = () => {
      if (listening) { stopRec(); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { startWinDictation(); return; }
      try {
        rec = new SR();
        rec.lang = REC_LANG;
        rec.continuous = true;
        rec.interimResults = true;
        baseVal = ta.value ? ta.value.trim() + ' ' : '';
        listening = true;
        btn.classList.add('rec');
        btn.title = T.stop;
        ta.focus();
        rec.onresult = (ev) => {
          let fin = '', inter = '';
          for (let i = 0; i < ev.results.length; i++) {
            const tr = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) fin += tr + ' ';
            else inter += tr;
          }
          ta.value = (baseVal + fin + inter).trimStart();
          ta.scrollTop = ta.scrollHeight;
        };
        rec.onerror = (ev) => {
          const err = ev && ev.error;
          stopRec();
          // إذا لم يدعم Electron خدمة Speech السحابية (network / service-not-allowed)، نشغّل إملاء ويندوز المدمج (Win+H) تلقائياً!
          if (err === 'network' || err === 'service-not-allowed' || err === 'not-allowed') {
            startWinDictation();
          }
        };
        rec.onend = () => { stopRec(); };
        rec.start();
      } catch {
        stopRec();
        startWinDictation();
      }
    };
  })()`;
}

// تشغيل الإملاء الصوتي المدمج في ويندوز 10/11 (Win + H) مباشرة داخل خانة الكتابة النشطة
function triggerWindowsDictation() {
  if (process.platform !== 'win32') return false;
  const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Kb {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
Start-Sleep -Milliseconds 120
[Kb]::keybd_event(0x5B, 0, 0, [UIntPtr]::Zero)
[Kb]::keybd_event(0x48, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 60
[Kb]::keybd_event(0x48, 0, 2, [UIntPtr]::Zero)
[Kb]::keybd_event(0x5B, 0, 2, [UIntPtr]::Zero)
`;
  try {
    cp.spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
      detached: true, stdio: 'ignore', windowsHide: true
    }).unref();
    return true;
  } catch { return false; }
}

module.exports = (ctx) => {
  const code = () => (ctx.lang() || 'ar').slice(0, 2);
  ipcMain.handle('voice:winDictate', () => triggerWindowsDictation());

  ctx.hooks.windowReady.push((w) => {
    try {
      if (!w || !w.ui || w.ui.webContents.isDestroyed()) return;
      const c = code();
      const lbl = L[c] || L.en;
      const recLang = LANG_MAP[c] || 'ar-SA';
      w.ui.webContents.executeJavaScript(injectScript(lbl, recLang)).catch(() => {});
    } catch {}
  });
};
