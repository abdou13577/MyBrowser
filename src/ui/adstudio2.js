// ---------- بناء السيناريو للفيديو ----------
function buildStoryboard() {
  const n = Math.max(1, state.images.length);
  if (state.storyboard && Array.isArray(state.storyboard.scenes) && state.storyboard.scenes.length) {
    const sb = state.storyboard;
    return { headline: state.headline || sb.headline || '', cta: state.cta || sb.cta || '',
      scenes: sb.scenes.map(s => ({ image: Math.max(0, Math.min(n - 1, s.image | 0)), caption: s.caption || '', seconds: Math.max(1.4, Math.min(4, +s.seconds || 2.4)) })) };
  }
  const scenes = []; for (let i = 0; i < n; i++) scenes.push({ image: i, caption: '', seconds: 2.4 });
  return { headline: state.headline, cta: state.cta, scenes };
}
function timeline() {
  const sb = buildStoryboard();
  const segs = []; let t = 0;
  const intro = sb.headline ? 1.0 : 0; if (intro) { segs.push({ type: 'intro', start: 0, dur: intro }); t += intro; }
  sb.scenes.forEach(s => { segs.push({ type: 'scene', start: t, dur: s.seconds, image: s.image, caption: s.caption }); t += s.seconds; });
  const end = sb.cta ? 1.5 : 0; if (end) { segs.push({ type: 'end', start: t, dur: end }); t += end; }
  return { segs, total: t, sb };
}

// ---------- رسم إطار الفيديو عند الزمن tSec ----------
function drawVideoFrame(ctx, W, H, tl, tSec) {
  const acc = state.accent; ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
  const seg = tl.segs.find(s => tSec >= s.start && tSec < s.start + s.dur) || tl.segs[tl.segs.length - 1];
  const lt = seg ? (tSec - seg.start) / seg.dur : 1; // 0..1 داخل المقطع
  if (!seg) return;
  if (seg.type === 'scene') {
    const img = state.images[seg.image];
    const zoom = 1.06 + 0.1 * lt; const panx = 0.5 + 0.06 * Math.sin(seg.start); const pany = 0.5 + 0.05 * lt;
    drawCover(ctx, img, 0, 0, W, H, zoom, panx, pany);
    // تحوّل دخول/خروج (تعتيم)
    const fade = Math.min(1, lt / 0.12) * Math.min(1, (1 - lt) / 0.12 + 0.0001);
    if (lt < 0.12) { ctx.fillStyle = `rgba(5,6,15,${1 - lt / 0.12})`; ctx.fillRect(0, 0, W, H); }
    if (lt > 0.88) { ctx.fillStyle = `rgba(5,6,15,${(lt - 0.88) / 0.12})`; ctx.fillRect(0, 0, W, H); }
    if (seg.caption) {
      const gy = H * 0.72; const gg = ctx.createLinearGradient(0, gy - H * 0.1, 0, H); gg.addColorStop(0, 'rgba(5,6,16,0)'); gg.addColorStop(1, 'rgba(5,6,16,.9)'); ctx.fillStyle = gg; ctx.fillRect(0, gy - H * 0.1, W, H - gy + H * 0.1);
      const slide = Math.min(1, lt / 0.18); const dx = (1 - slide) * W * 0.1 * (RTL ? -1 : 1);
      const pad = W * 0.07; ctx.textAlign = RTL ? 'right' : 'left'; const ax = (RTL ? W - pad : pad) - dx;
      ctx.fillStyle = acc; roundRect(ctx, RTL ? W - pad - W * 0.1 - dx : pad - dx, H * 0.8, W * 0.1, Math.max(5, W * 0.012), 4); ctx.fill();
      const hf = fitWrap(ctx, seg.caption, W - pad * 2, 2, W * 0.08, 800, FONT); ctx.globalAlpha = slide; ctx.fillStyle = '#fff'; let y = H * 0.83;
      hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, ax, y += hf.px * 1.05); }); ctx.globalAlpha = 1;
    }
  } else if (seg.type === 'intro' || seg.type === 'end') {
    const g2 = ctx.createLinearGradient(0, 0, W, H); g2.addColorStop(0, darken(acc, 0.5)); g2.addColorStop(1, '#070816'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    // توهج
    const rg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.7); rg.addColorStop(0, acc + '55'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    const text = seg.type === 'intro' ? (tl.sb.headline || '') : (tl.sb.cta || '');
    const pop = Math.min(1, lt / 0.25) * (seg.type === 'end' ? 1 : (lt > 0.8 ? Math.max(0, (1 - lt) / 0.2) : 1));
    ctx.textAlign = 'center'; ctx.globalAlpha = Math.max(0, Math.min(1, pop));
    const big = seg.type === 'end';
    const hf = fitWrap(ctx, text, W * 0.82, 3, W * (big ? 0.13 : 0.12), 800, FONT); ctx.fillStyle = '#fff';
    let y = H * 0.44 - hf.lines.length * hf.px * 0.5;
    hf.lines.forEach(l => { ctx.font = `800 ${hf.px}px ${FONT}`; ctx.fillText(l, W / 2, y += hf.px * 1.08); });
    if (big) { // CTA pill in endcard
      const fs = W * 0.05; ctx.font = `700 ${fs}px ${FONT}`; const w = ctx.measureText(text).width + W * 0.12; const h = fs * 2.1;
      ctx.fillStyle = acc; roundRect(ctx, (W - w) / 2, y + W * 0.06, w, h, h / 2); ctx.fill();
      ctx.fillStyle = textColorOn(acc); ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, y + W * 0.06 + h / 2); ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1; ctx.textAlign = RTL ? 'right' : 'left';
    if (state.logo) drawCoverContain(ctx, state.logo, W / 2 - W * 0.09, H * (big ? 0.14 : 0.78), W * 0.18, W * 0.18);
  }
}

// ---------- رسم المعاينة ----------
let previewing = false;
function draw() {
  sizeCanvasIfNeeded();
  if (state.mode === 'image') { drawImageAd(g, cv.width, cv.height, { ph: true }); }
  else { const tl = timeline(); drawVideoFrame(g, cv.width, cv.height, tl, 0.3); }
  drawTemplateThumbs();
}
let lastDimKey = '';
function sizeCanvasIfNeeded() { const key = state.mode + state.aspect; if (key !== lastDimKey) { sizeCanvas(); lastDimKey = key; } }
function drawTemplateThumbs() {
  if (state.mode !== 'image') return;
  [...tplBox.children].forEach((b, i) => { const c = b.querySelector('canvas'); const cx = c.getContext('2d'); const sv = state.template; state.template = i; const ow = cv.width; drawImageAdThumb(cx, c.width, c.height); state.template = sv; });
}
function drawImageAdThumb(ctx, W, H) { const sv = { h: state.headline, s: state.sub, c: state.cta }; state.headline = state.headline || 'Headline'; drawImageAd(ctx, W, H, {}); state.headline = sv.h; }

// ---------- موسيقى إجرائية ----------
function buildMusic(actx, dest) {
  const [r] = hexToRgb(state.accent); const base = 110 + (r / 255) * 60; // نغمة تتأثر باللون
  const master = actx.createGain(); master.gain.value = 0.0001; master.connect(dest);
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
  const freqs = [base, base * 1.26, base * 1.5, base * 2];
  const oscs = freqs.map((f, i) => { const o = actx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; const g2 = actx.createGain(); g2.gain.value = 0.18 / freqs.length; o.connect(g2); g2.connect(lp); o.start(); return o; });
  // LFO خفيف على الصوت
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.12; const lg = actx.createGain(); lg.gain.value = 0.06; lfo.connect(lg); lg.connect(master.gain); lfo.start();
  master.gain.setTargetAtTime(0.09, actx.currentTime, 0.6);
  return { stop(t) { master.gain.setTargetAtTime(0.0001, t, 0.3); oscs.forEach(o => o.stop(t + 1)); lfo.stop(t + 1); } };
}

// ---------- معاينة الفيديو ----------
$('#playBtn').onclick = () => { if (previewing) return; playPreview(); };
async function playPreview() {
  const tl = timeline(); if (!tl.total) return;
  previewing = true; let actx, music;
  if (state.music) { try { actx = new AudioContext(); music = buildMusic(actx, actx.destination); } catch {} }
  const t0 = performance.now();
  await new Promise(res => {
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= tl.total || !previewing) { res(); return; }
      drawVideoFrame(g, cv.width, cv.height, tl, t); requestAnimationFrame(loop);
    }; loop();
  });
  previewing = false; if (music) music.stop(actx.currentTime); if (actx) setTimeout(() => actx.close(), 1200);
  draw();
}

// ---------- التصدير ----------
function pickMime() {
  const c = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {} } return 'video/webm';
}
$('#exportBtn').onclick = async () => {
  if (!state.images.length) { msg(L.needImg, 'var(--bloom)'); return; }
  if (state.rendering) return;
  $('#revealBtn').classList.add('hide');
  if (state.mode === 'image') return exportImage();
  return exportVideo();
};
async function exportImage() {
  state.rendering = true; $('#exportBtn').disabled = true; msg(L.rendering);
  try {
    sizeCanvas(); drawImageAd(g, cv.width, cv.height, {});
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const buf = await blob.arrayBuffer();
    const res = await window.ad.save(buf, 'png', 'image');
    if (res.ok) { state.lastFile = res.file; msg(L.savedI); $('#revealBtn').classList.remove('hide'); }
    else msg(L.fail + ' ' + (res.error || ''), 'var(--bloom)');
  } catch (e) { msg(L.fail + ' ' + e.message, 'var(--bloom)'); } finally { state.rendering = false; $('#exportBtn').disabled = false; draw(); }
}
async function exportVideo() {
  const tl = timeline(); if (!tl.total) { msg(L.needImg, 'var(--bloom)'); return; }
  state.rendering = true; $('#exportBtn').disabled = true; $('#playBtn').disabled = true;
  msg('● ' + L.rendering);
  sizeCanvas();
  let actx, music, dest;
  const videoStream = cv.captureStream(30);
  const tracks = [...videoStream.getVideoTracks()];
  try { actx = new AudioContext(); dest = actx.createMediaStreamDestination(); if (state.music) music = buildMusic(actx, dest); tracks.push(...dest.stream.getAudioTracks()); } catch {}
  const stream = new MediaStream(tracks);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  rec.start(100);
  const t0 = performance.now();
  await new Promise(res => { const loop = () => { const t = (performance.now() - t0) / 1000; if (t >= tl.total) { res(); return; } drawVideoFrame(g, cv.width, cv.height, tl, t); const pct = Math.round(t / tl.total * 100); msg('● ' + L.rendering + ' ' + pct + '%'); requestAnimationFrame(loop); }; loop(); });
  if (music) music.stop(actx.currentTime);
  setTimeout(() => rec.stop(), 150);
  await stopped;
  if (actx) setTimeout(() => actx.close(), 500);
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime });
  try {
    const buf = await blob.arrayBuffer();
    const res = await window.ad.save(buf, ext, 'video');
    if (res.ok) { state.lastFile = res.file; msg(L.savedV + (ext === 'webm' ? ' (webm)' : '')); $('#revealBtn').classList.remove('hide'); }
    else msg(L.fail + ' ' + (res.error || ''), 'var(--bloom)');
  } catch (e) { msg(L.fail + ' ' + e.message, 'var(--bloom)'); }
  state.rendering = false; $('#exportBtn').disabled = false; $('#playBtn').disabled = false; draw();
}
$('#revealBtn').onclick = () => { if (state.lastFile) window.ad.reveal(state.lastFile); };

// ---------- بدء ----------
async function init() {
  applyText(); setMode('video'); sizeCanvas(); draw();
  try { const has = await window.ad.hasKey(); if (!has) $('#aiHint').textContent = L.noKey; } catch {}
}
init();
