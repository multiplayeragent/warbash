/* ==========================================================================
   RECORDED SOUNDS
   The sound effects are royalty-free recordings (mostly CC0: weapons from the Free Firearm Sound Library,
   impacts, footsteps, ambiences; see README "Credits and licenses" and assets/sfx/credits.json), prepared by
   tools/build_sfx.py and delivered in packs next to the page (dist/sfx/<pack>.<hash>.js, loaded by a script
   tag: works in file:// too). Each file calls sfxPack(key, { rate, s: { id: [n, pk, MP3 in base64] } }).
   Packs: the interface (ui) when the sound starts (sfxBoot); those of the match (weapons, foley, impacts, series, voice_<language>)
   when the first match starts (sfxBootGame, during map loading): the menus stay light; a map's
   ambience (amb_<map>) loads when the map starts and is freed with it (05c-ambiance.js).
   Memory: on phones (COARSE), sounds are decoded at 32 kHz (24 kHz for ambiences and voices), impulse
   responses at the context's rate (convolution requires it), and a bank keeps at most two variants.
   As long as a sound isn't decoded (or if its pack is missing), the synthesis in 05-audio.js replaces it.
   Variants: "id-1", "id-2"... form the bank "id", from which a take is drawn without repeating the previous one.
   ========================================================================== */
const SFX_PACKS = /*__SFX_PACKS__*/ {};
const SFX_GAME = ['weaponry', 'foley', 'impacts', 'series', 'outro', 'mecha'];
// bank: id → [{ b: AudioBuffer, o: start of the sound in the buffer (s), d: duration (s), pk: instant of the peak (s) }]
// state: pack → { s: 'loading' | 'ready' | 'failed', p: promise }; of: pack → banks it has filled
const SFX = { bank: new Map(), last: new Map(), state: new Map(), cb: new Map(), of: new Map(), dec: new Map() };

function sfxPack(key, d) { const f = SFX.cb.get(key); if (f) f(d); }
/* The pack's file, through a script tag (like the textures, see fetchTexPack) */
function sfxFetch(key) {
  if (!SFX_PACKS[key]) return Promise.resolve(null);
  return new Promise((res) => {
    const s = document.createElement('script');
    const done = (d) => { if (!SFX.cb.has(key)) return; SFX.cb.delete(key); clearTimeout(timer); s.remove(); res(d); };
    const timer = setTimeout(() => done(null), 45000);
    SFX.cb.set(key, done);
    s.onerror = () => done(null);
    s.src = SFX_PACKS[key]; document.head.appendChild(s);
  });
}
/* Base64 MP3 → AudioBuffer (callbacks and promise: old Safari has only callbacks); null if the browser refuses */
function sfxDecode(ctx, b64) {
  return new Promise((res) => {
    let u;
    try { const bin = atob(b64); u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i); } catch (e) { res(null); return; }
    try { const p = ctx.decodeAudioData(u.buffer, res, () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); }
  });
}
/* Decoding context of a sound: the game's on desktop; on phones, an offline context at reduced rate
   (the buffer keeps its rate, playback resamples), except for an impulse response (ir_*) */
function sfxDecodeCtx(key, id) {
  if (!COARSE || /^ir_/.test(id)) return AU.ctx;
  const sr = Math.min(AU.ctx.sampleRate, /^(amb_|voice_|outro$)/.test(key) ? 24000 : 32000); // end: end-of-match music, 11 s stereo
  if (sr >= AU.ctx.sampleRate) return AU.ctx;
  if (!SFX.dec.has(sr)) {
    let c = null;
    try { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; c = new O(1, 1, sr); } catch (e) { c = null; } // rate refused (old Safari): we decode at the game's rate
    SFX.dec.set(sr, c);
  }
  return SFX.dec.get(sr) || AU.ctx;
}
/* Real start of the sound in the decoded buffer: some decoders leave the MP3 encoder delay at the head (576 or 1105
   samples at the file's rate), others remove it. We look for the sound's peak (pk, known at 48 kHz) near
   its expected place and keep the candidate delay that aligns it best. */
function sfxLead(b, n, pk, rate) {
  const r = b.sampleRate / 48000, k = b.sampleRate / rate, e = pk * r, d = b.getChannelData(0);
  const lo = Math.max(0, Math.floor(e - 200 * r)), hi = Math.min(d.length, Math.ceil(e + 1105 * k + 400 * r));
  let im = lo, m = -1;
  for (let i = lo; i < hi; i++) { const v = Math.abs(d[i]); if (v > m) { m = v; im = i; } }
  let best = 0, err = Infinity;
  for (const c of [0, 576 * k, 1105 * k]) { const x = Math.abs(im - (e + c)); if (x < err) { err = x; best = c; } }
  if (b.length < n * r + best - 64) best = 0; // buffer too short to contain this delay: the decoder has already removed it
  return best / b.sampleRate;
}
/* Loads and decodes a pack (only once); returns a promise that's true if the pack is ready */
function sfxLoad(key) {
  const cur = SFX.state.get(key); if (cur) return cur.p;
  const st = { s: 'loading', p: null }; SFX.state.set(key, st);
  st.p = (async () => {
    const d = await sfxFetch(key);
    if (!d || !d.s || !AU.ctx) { st.s = 'failed'; return false; }
    const ids = new Set(); SFX.of.set(key, ids);
    for (const id of Object.keys(d.s)) {
      if (SFX.state.get(key) !== st || !AU.ctx) return false; // pack freed during decoding
      if (COARSE && +((id.match(/-(\d+)$/) || [])[1] || 0) > 2) continue; // phone: two variants per bank
      const v = d.s[id], b = await sfxDecode(sfxDecodeCtx(key, id), v[2]);
      if (!b || SFX.state.get(key) !== st) continue;
      const g = id.replace(/-\d+$/, '');
      let a = SFX.bank.get(g); if (!a) SFX.bank.set(g, a = []);
      a.push({ b, o: sfxLead(b, v[0], v[1], d.rate), d: v[0] / 48000, pk: v[1] / 48000 }); ids.add(g);
    }
    st.s = 'ready'; gpuLog('sfx ' + key + ': ' + ids.size + ' sons');
    return true;
  })();
  return st.p;
}
function sfxReady(key) { const st = SFX.state.get(key); return !!st && st.s === 'ready'; }
/* Frees a pack (ambience of a map that was left) */
function sfxUnload(key) {
  const ids = SFX.of.get(key);
  if (ids) for (const g of ids) { SFX.bank.delete(g); SFX.last.delete(g); }
  SFX.of.delete(key); SFX.state.delete(key);
}
/* When the sound starts: the interface only (the menus); the match packs follow if a match has already been started */
function sfxBoot() {
  if (SFX.boot) return; SFX.boot = true;
  sfxLoad('ui');
  if (SFX.wantGame) sfxBootGame();
}
/* Match packs, one after the other (called when a map starts, only once). Without the weapons pack, we
   fall back to the synthesized shots (computed only in that case: they weigh about twenty MB in memory). */
function sfxBootGame() {
  if (SFX.game) return;
  if (!AU.ctx) { SFX.wantGame = true; return; } // the sound hasn't started (player's first gesture): sfxBoot will take care of it
  SFX.game = true;
  (async () => {
    for (const k of SFX_GAME.concat(['voice_en'])) {
      const ok = await sfxLoad(k);
      if (k === 'weaponry') { if (ok) sfxVerbSetup(); else gunBuffersBuild(false); }
    }
  })();
}
function sfxHas(id) { const a = SFX.bank.get(id); return !!(a && a.length); }
/* A take from the bank, never the same one twice in a row */
function sfxPick(id) {
  const a = SFX.bank.get(id); if (!a || !a.length) return null;
  if (a.length === 1) return a[0];
  let i = Math.floor(Math.random() * a.length);
  if (i === SFX.last.get(id)) i = (i + 1) % a.length;
  SFX.last.set(id, i); return a[i];
}
/* Plays a take from bank id toward dest at instant t; returns { s, g, e } (source, gain, take) or null if the bank isn't ready.
   o: rate (playback speed), gain, off (seconds skipped at the start), loop (sample-accurate loop), dur (stop after dur s), e (imposed take) */
function sfxPlay(id, dest, t, o) {
  o = o || {};
  const e = o.e || sfxPick(id); if (!e || !AU.ctx) return null;
  const ctx = AU.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = e.b; if (o.rate) s.playbackRate.value = o.rate;
  g.gain.value = o.gain === undefined ? 1 : o.gain;
  s.connect(g); g.connect(dest);
  if (o.loop) { s.loop = true; s.loopStart = e.o; s.loopEnd = e.o + e.d; s.start(t, e.o + ((o.off || 0) % e.d)); }
  else { s.start(t, e.o + Math.min(o.off || 0, e.d)); if (o.dur) s.stop(t + o.dur); }
  return { s, g, e };
}
/* Fades out a voice (time constant tau) starting at t */
function sfxFadeOut(v, t, tau = 0.04) {
  if (!v) return;
  try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, tau); v.s.stop(t + tau * 8); } catch (e) { /* already stopped */ }
}

/* ---------- Reverb: real impulse responses ----------
   A street (slap of the facades) for the whole game; plus a concrete room on desktop, heard as you
   enter under a roof (VM.sky). On phones, a single, shortened convolution. */
function sfxIR(id, max) {
  const e = sfxPick(id); if (!e) return null;
  const ctx = AU.ctx, sr = e.b.sampleRate, n = Math.min(Math.floor(e.d * sr), Math.floor(max * sr)), i0 = Math.floor(e.o * sr), fade = Math.floor(0.25 * sr);
  const ch = Math.min(2, e.b.numberOfChannels), out = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const src = e.b.getChannelData(Math.min(c, ch - 1)), d = out.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (src[i0 + i] || 0) * (i > n - fade ? (n - i) / fade : 1);
  }
  return out;
}
function sfxVerbSetup() {
  if (!AU.ctx || !AU.conv || AU.verbReal) return;
  if (AU.ctx.sampleRate !== (SFX.bank.get('ir_out') || [{ b: {} }])[0].b.sampleRate) return; // buffer decoded in another context (audio bench)
  const out = sfxIR('ir_out', COARSE ? 1.2 : 1.8); if (!out) return;
  AU.conv.buffer = out; AU.verbReal = true;
  if (!COARSE && sfxHas('ir_in')) {
    const inb = sfxIR('ir_in', 1.6);
    if (inb) {
      const c = AU.ctx.createConvolver(); c.buffer = inb; AU.verbInG.connect(c); c.connect(AU.wpnG); AU.convIn = c;
    }
  }
}
/* Share of the indoor reverb (0 outside, 1 under a roof), smoothed; called every frame */
function sfxTick(dt) {
  if (!AU.ready) return;
  const inside = MATCH.state === 'playing' ? 1 - clamp(VM.sky === undefined ? 1 : VM.sky, 0, 1) : 0;
  AU.inside = (AU.inside || 0) + (inside - (AU.inside || 0)) * Math.min(1, dt * 4);
  // crossfade of the two reverbs (street, room): a target only when the interior has changed by at least 2%, and at most ten times per second
  // (setTargetAtTime on every frame added 560 events per second to the two timelines at 280 frames per second)
  if (AU.convIn && performance.now() - (AU.verbT || 0) > 100 && Math.abs(AU.inside - (AU.verbIn === undefined ? -1 : AU.verbIn)) > 0.02) {
    const t = AU.ctx.currentTime; AU.verbT = performance.now(); AU.verbIn = AU.inside;
    AU.verbOutG.gain.setTargetAtTime(1 - AU.inside * 0.7, t, 0.1); AU.verbInG.gain.setTargetAtTime(AU.inside * 1.1, t, 0.1);
  }
  annTick();
  ambTick(dt);
}

/* ---------- Radio announcements ----------
   Killstreaks, objectives: a short signal (stinger) and, if the "Voice announcements" option is
   checked, a radio phrase (squelch, voice, end of transmission) in the game's language. One announcement at a time: the others
   wait their turn (at most 4 s, otherwise they are dropped). line at null: the signal alone (match start, 09y-countdown.js). */
const ANN = { q: [], until: 0, last: new Map() };
function sfxAnnounce(line, sting) {
  if (!AU.ready) return;
  const now = AU.ctx.currentTime;
  if (now - (ANN.last.get(line) || -9) < 2.5) return; // same announcement twice (two events for the same streak)
  ANN.last.set(line, now);
  let sg = null;
  if (sting && sfxHas(sting)) { sg = uiOut(0.8); sfxPlay(sting, sg, now + 0.02); }
  // after a musical signal, the voice waits for its attack to pass (otherwise it lands on top and can't be understood)
  if (line && Settings.voice !== false && sfxHas('v_' + line)) ANN.q.push({ line, t: now, at: now + (sg ? 0.45 : 0), sg });
}
function annTick() {
  if (!ANN.q.length) return;
  const now = AU.ctx.currentTime;
  if (now < ANN.until - 0.05 || now < ANN.q[0].at) return;
  const a = ANN.q.shift();
  if (now - a.t > 4) return;
  const o = uiOut(1.0), t = now + 0.03;
  // the signal fades under the voice (-12 dB)
  if (a.sg) { const g = a.sg.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.2, t + 0.12); }
  sfxPlay('r_on', o, t, { gain: 0.55 });
  const v = sfxPlay('v_' + a.line, o, t + 0.12, { gain: 1.15 });
  const end = t + 0.12 + (v ? v.e.d : 0.8);
  sfxPlay('r_off', o, end + 0.04, { gain: 0.5 });
  ANN.until = end + 0.4;
}
