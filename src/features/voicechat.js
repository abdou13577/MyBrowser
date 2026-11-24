// زر الميكروفون الحقيقي للإملاء الصوتي بأي لغة داخل خانة كتابة المساعد الذكي (#askForm)
// - يسجّل الصوت مباشرة من الميكروفون عبر AudioContext (WAV 16kHz أحادي) ويبقى الزر يومض بالأحمر مع عدّاد زمني حتى تضغط إيقاف
// - يحوّل الصوت إلى نص بدقة عالية وبأي لغة تلقائياً (العربية، الألمانية، الإنجليزية، الفرنسية، الإسبانية، الإيطالية، التركية) عبر faster-whisper المحلي بدون استهلاك رام في الخلفية
// - كما يحسّن شكل الروابط القابلة للنقر (a.ext) داخل ردود المساعد
const { ipcMain } = require('electron');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PYTHON_CANDIDATES = [
  'C:\\AI_Tools\\python\\python.exe',
  'python.exe',
  'python'
];

const L = {
  ar: { mic: 'اضغط للتحدث بالميكروفون', stop: 'اضغط لإيقاف التسجيل والتحويل لنص', busy: 'جارٍ تحويل الصوت إلى نص…', err: 'تعذّر الوصول للميكروفون أو التحويل', empty: 'لم يُسمع صوت واضح — حاول مرة أخرى' },
  en: { mic: 'Click to speak (voice input)', stop: 'Click to stop & transcribe', busy: 'Transcribing voice…', err: 'Could not access microphone or transcribe', empty: 'No clear speech detected — try again' },
  de: { mic: 'Klicken zum Sprechen (Mikrofon)', stop: 'Klicken zum Stoppen & Transkribieren', busy: 'Sprache wird umgewandelt…', err: 'Mikrofon oder Erkennung fehlgeschlagen', empty: 'Keine klare Sprache erkannt' },
  fr: { mic: 'Cliquer pour parler (micro)', stop: 'Cliquer pour arrêter et transcrire', busy: 'Transcription en cours…', err: 'Erreur micro ou transcription', empty: 'Aucune voix détectée' },
  es: { mic: 'Pulsa para hablar (micrófono)', stop: 'Pulsa para detener y transcribir', busy: 'Transcribiendo voz…', err: 'Error de micrófono o transcripción', empty: 'No se detectó voz clara' },
  it: { mic: 'Clicca per parlare (microfono)', stop: 'Clicca per fermare e trascrivere', busy: 'Trascrizione in corso…', err: 'Errore microfono o trascrizione', empty: 'Nessuna voce rilevata' },
  tr: { mic: 'Konuşmak için tıkla (mikrofon)', stop: 'Durdur ve metne çevir', busy: 'Ses metne çevriliyor…', err: 'Mikrofon veya çeviri hatası', empty: 'Net ses algılanmadı' }
};

const CSS = `
  #mbxMicBtn {
    min-width: 38px; height: 38px; padding: 0 8px; border-radius: 11px; border: 1px solid rgba(139,124,255,.35);
    background: rgba(139,124,255,.14); color: #EEF0FF; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    flex-shrink: 0; font: 600 12px/1 inherit; transition: background .15s, border-color .15s, transform .12s;
  }
  #mbxMicBtn:hover { background: rgba(139,124,255,.28); border-color: #8B7CFF; }
  #mbxMicBtn.rec { background: #E0466A; border-color: #ff8aa4; color: #fff; animation: mbxPulse 1.1s infinite; }
  #mbxMicBtn.busy { background: rgba(79,140,255,.25); border-color: #4F8CFF; color: #EEF0FF; cursor: wait; }
  #mbxMicBtn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  @keyframes mbxPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,70,106,.6); } 50% { box-shadow: 0 0 0 9px rgba(224,70,106,0); } }
  #chat .msg a.ext {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; margin: 2px 0;
    border-radius: 8px; background: rgba(79,140,255,.16); border: 1px solid rgba(79,140,255,.38);
    color: #9BC2FF; text-decoration: none; font-weight: 600; cursor: pointer; transition: background .12s;
  }
  #chat .msg a.ext:hover { background: rgba(79,140,255,.3); color: #fff; }
`;

function injectScript(lbl) {
  return `(() => {
    const T = ${JSON.stringify(lbl)};
    if (!document.getElementById('mbxVoiceCss')) {
      const s = document.createElement('style'); s.id = 'mbxVoiceCss'; s.textContent = ${JSON.stringify(CSS)}; document.head.append(s);
    }
    const form = document.getElementById('askForm'), ta = document.getElementById('question');
    if (!form || !ta || document.getElementById('mbxMicBtn')) return;
    const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.5M8.5 21.5h7"/></svg>';
    const STOP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/></svg>';

    const btn = document.createElement('button');
    btn.id = 'mbxMicBtn'; btn.type = 'button'; btn.title = T.mic; btn.setAttribute('aria-label', T.mic);
    btn.innerHTML = MIC_SVG;
    const sub = form.querySelector('button[type="submit"]');
    form.insertBefore(btn, sub || null);

    let state = 'idle'; // idle | rec | busy
    let stream = null, actx = null, srcNode = null, proc = null, chunks = [], inRate = 48000, timer = null, sec = 0;

    function encodeWav16k(buffers, srcRate) {
      let total = 0;
      for (const b of buffers) total += b.length;
      const merged = new Float32Array(total);
      let off = 0;
      for (const b of buffers) { merged.set(b, off); off += b.length; }
      const targetRate = 16000;
      const ratio = srcRate / targetRate;
      const outLen = Math.max(1, Math.floor(merged.length / ratio));
      const samples = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(merged.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
        let sum = 0;
        for (let j = start; j < end; j++) sum += merged[j];
        const s = Math.max(-1, Math.min(1, sum / (end - start)));
        samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const buf = new ArrayBuffer(44 + samples.length * 2);
      const v = new DataView(buf);
      const ws = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ws(8, 'WAVE');
      ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, targetRate, true); v.setUint32(28, targetRate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      ws(36, 'data'); v.setUint32(40, samples.length * 2, true);
      let p = 44;
      for (let i = 0; i < samples.length; i++, p += 2) v.setInt16(p, samples[i], true);
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      return btoa(bin);
    }

    function cleanupAudio() {
      clearInterval(timer); timer = null;
      try { if (proc) { proc.disconnect(); proc.onaudioprocess = null; } } catch {}
      try { if (srcNode) srcNode.disconnect(); } catch {}
      try { if (actx) actx.close(); } catch {}
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch {}
      proc = srcNode = actx = stream = null;
    }

    function resetBtn() {
      state = 'idle';
      btn.classList.remove('rec', 'busy');
      btn.innerHTML = MIC_SVG;
      btn.title = T.mic;
    }

    async function startRecording() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        actx = new (window.AudioContext || window.webkitAudioContext)();
        inRate = actx.sampleRate || 48000;
        srcNode = actx.createMediaStreamSource(stream);
        proc = actx.createScriptProcessor(4096, 1, 1);
        chunks = [];
        proc.onaudioprocess = (ev) => {
          if (state !== 'rec') return;
          chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        };
        srcNode.connect(proc);
        proc.connect(actx.destination);
        state = 'rec';
        sec = 0;
        btn.classList.add('rec');
        btn.title = T.stop;
        btn.innerHTML = STOP_SVG + '<span>0:00</span>';
        timer = setInterval(() => {
          sec++;
          const m = Math.floor(sec / 60), s = String(sec % 60).padStart(2, '0');
          const sp = btn.querySelector('span');
          if (sp) sp.textContent = m + ':' + s;
          if (sec >= 90) stopAndTranscribe();
        }, 1000);
      } catch (e) {
        cleanupAudio();
        resetBtn();
        ta.placeholder = T.err;
      }
    }

    async function stopAndTranscribe() {
      const recorded = chunks;
      const rate = inRate;
      chunks = [];
      cleanupAudio();
      if (!recorded.length) { resetBtn(); return; }
      state = 'busy';
      btn.classList.remove('rec');
      btn.classList.add('busy');
      btn.innerHTML = '<span>⏳</span>';
      btn.title = T.busy;
      try {
        const b64 = encodeWav16k(recorded, rate);
        const res = await (window.mbExtras && window.mbExtras.transcribeVoice ? window.mbExtras.transcribeVoice(b64) : null);
        if (res && res.ok && res.text) {
          ta.value = (ta.value ? ta.value.trim() + ' ' : '') + res.text.trim();
          ta.focus();
          ta.scrollTop = ta.scrollHeight;
        } else {
          const oldPh = ta.placeholder;
          ta.placeholder = (res && res.error) || T.empty;
          setTimeout(() => { ta.placeholder = oldPh; }, 3500);
        }
      } catch {
        const oldPh = ta.placeholder;
        ta.placeholder = T.err;
        setTimeout(() => { ta.placeholder = oldPh; }, 3500);
      } finally {
        resetBtn();
      }
    }

    btn.onclick = () => {
      if (state === 'busy') return;
      if (state === 'rec') stopAndTranscribe();
      else startRecording();
    };
  })()`;
}

const PY_SCRIPT = `
import os, sys, glob, json, site
for sp in site.getsitepackages():
    for d in glob.glob(os.path.join(sp, "nvidia", "*", "bin")):
        if os.path.isdir(d):
            try: os.add_dll_directory(d)
            except Exception: pass
            os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
from faster_whisper import WhisperModel
wav_path = sys.argv[1]
def run(name, dev, ct):
    m = WhisperModel(name, device=dev, compute_type=ct)
    segs, info = m.transcribe(wav_path, vad_filter=True, beam_size=5, condition_on_previous_text=False)
    text = " ".join(s.text.strip() for s in segs if s.text).strip()
    return {"ok": True, "text": text, "lang": info.language}
res = None
for cfg in [("large-v3-turbo", "cuda", "int8_float16"), ("large-v3-turbo", "cpu", "int8"), ("base", "cpu", "int8")]:
    try:
        res = run(*cfg)
        break
    except Exception:
        continue
if not res:
    res = {"ok": False, "error": "whisper failed"}
sys.stdout.buffer.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
`;

function transcribeWavFile(wavPath) {
  return new Promise((resolve) => {
    const py = PYTHON_CANDIDATES.find(p => p.includes('\\') ? fs.existsSync(p) : true) || 'python';
    const child = cp.spawn(py, ['-c', PY_SCRIPT, wavPath], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1', HF_HUB_DISABLE_SYMLINKS_WARNING: '1' } });
    let out = '', err = '';
    const killTimer = setTimeout(() => { try { child.kill(); } catch {} resolve({ ok: false, error: 'timeout' }); }, 45000);
    child.stdout.on('data', d => { out += d.toString('utf8'); });
    child.stderr.on('data', d => { err += d.toString('utf8'); });
    child.on('error', (e) => { clearTimeout(killTimer); resolve({ ok: false, error: e.message }); });
    child.on('close', () => {
      clearTimeout(killTimer);
      try {
        const parsed = JSON.parse(out.trim());
        resolve(parsed);
      } catch {
        resolve({ ok: false, error: err.slice(-140) || 'transcribe failed' });
      }
    });
  });
}

module.exports = (ctx) => {
  const code = () => (ctx.lang() || 'ar').slice(0, 2);

  ipcMain.handle('voice:transcribe', async (_e, b64) => {
    if (!b64 || typeof b64 !== 'string') return { ok: false, error: 'empty' };
    const tmp = path.join(os.tmpdir(), `mb_voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`);
    try {
      fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
      return await transcribeWavFile(tmp);
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  });

  ctx.hooks.windowReady.push((w) => {
    try {
      if (!w || !w.ui || w.ui.webContents.isDestroyed()) return;
      const lbl = L[code()] || L.en;
      w.ui.webContents.executeJavaScript(injectScript(lbl)).catch(() => {});
    } catch {}
  });
};
