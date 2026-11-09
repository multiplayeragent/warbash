/* ==========================================================================
   LEVEL-UP SOUND: 4 s fanfare provided by the repository owner (file "Rank_Up.mp3", created with Suno), played at each player level gained in a
   match (not at accessory unlocks). Stereo MP3 48 kHz, 162 kb/s, without cover art or tags (assets/rankup.mp3), delivered in base64 in the base bundle
   (window.BASE_ASSETS, dist/tex/baseAssets.<hash>.js, see build.py). Decoded once, when the sound starts (initAudio); if decoding is impossible (browser without MP3,
   base bundle missing), the game stays silent at that spot.
   ========================================================================== */
const RANKUP_MP3 = (window.BASE_ASSETS || {}).rankup || '';
function rankUpPrepare() {
  if (!AU.ctx || AU.rankBuf !== undefined) return;
  AU.rankBuf = null; AU.rankPending = true;
  const done = (b) => { AU.rankPending = false; if (b) AU.rankBuf = b; if (b && AU.rankWant) { AU.rankWant = false; rankUpSound(); } };
  try {
    const bin = atob(RANKUP_MP3), u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
    const p = AU.ctx.decodeAudioData(u.buffer, done, () => done(null)); if (p && p.catch) p.catch(() => done(null)); // (old Safari: callbacks only)
  } catch (e) { done(null); }
}
/* Plays the fanfare: directly on the mix (no muffling or space), at the master volume level; not yet decoded: it starts as soon as it is.
   Gain 2 (+6 dB, 3.1.0: "to be raised", owner feedback): like the end-of-match music (END_MUSIC), see README "Levels" */
function rankUpSound() {
  if (!AU.ready || !AU.ctx) return;
  if (AU.rankBuf === undefined) rankUpPrepare();
  if (AU.rankBuf) { const s = AU.ctx.createBufferSource(); s.buffer = AU.rankBuf; s.connect(uiOut(2)); s.start(); }
  else if (AU.rankPending) AU.rankWant = true;
}
