/* Audio bench (optional): renders the game sounds offline (weapons, hit markers, eliminations, impacts, handling
   noises, menus, explosions, streaks, footsteps) with the page's real code, then measures and plots them. The sample
   packs (dist/sfx, see tools/build_sfx.py) are loaded and decoded first; --fallback 1 measures the fallback synthesis
   (without packs).

   For each sound: a 48 kHz stereo WAV file, measurements (peak, RMS level over the first 100 ms, crest
   factor, spectral centroid of the first 60 ms, duration down to -40 dB) and a PNG sheet (waveform and
   spectrogram, 0 to 12 kHz) to judge the attack, body and tail without listening.

   Installation (once):  cd tools/dev && npm install
   Usage (from the root):  node tools/dev/audio.js [version.html] [--out folder] [--sounds weaponry,hits,impacts,handling,menus,explosions,streaks,footsteps] [--fallback 1]
   Without a file: dist/index.html. Comparison: the old page in a folder next to the sound packs
   (mkdir -p /tmp/before && git show HEAD:dist/index.html > /tmp/before/before.html && ln -sfn "$PWD/dist/sfx" /tmp/before/sfx),
   then run the bench on each version with a different output; a missing pack is reported (its fallback synthesis
   would be measured in its place). Chromium: Playwright's, or the CHROME environment variable. */
const path = require('path'), fs = require('fs');
const DEV = __dirname, ROOT = path.join(DEV, '..', '..');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.error('playwright-core not found: cd tools/dev && npm install'); process.exit(1); }

const opt = { out: path.join(ROOT, 'audio-out'), sounds: 'weaponry,hits,impacts,handling,menus,explosions,streaks,footsteps', fallback: '' }, files = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) opt[a.slice(2)] = process.argv[++i]; else files.push(path.resolve(a));
}
if (!files.length) files.push(path.join(ROOT, 'dist', 'index.html'));
fs.mkdirSync(opt.out, { recursive: true });

/* Each sound: name, render duration, code run in the page (the page's audio context is replaced by an offline context) */
const SOUND_LIST = {
  weaponry: [
    ...['rifle', 'smg', 'pistol', 'sniper', 'shotgun'].map((k) => [`fire-${k}-main`, 3.2, `sfxGun('${k}', null)`]),
    ...['rifle', 'smg', 'pistol', 'sniper', 'shotgun'].map((k) => [`fire-${k}-30m`, 3.2, `sfxGun('${k}', new V3(30, 1.6, 0))`]),
    ['fire-rifle-burst', 3.0, `for (let i = 0; i < 8; i++) { T(i * 60 / 780); sfxGun('rifle', null); }`],
    ['fire-smg-burst', 3.0, `for (let i = 0; i < 8; i++) { T(i * 60 / 900); sfxGun('smg', null); }`],
    ['fire-rifle-burst-hits', 3.0, `for (let i = 0; i < 10; i++) { T(i * 60 / 780); sfxGun('rifle', null); if (i > 1 && i % 2) { sfxHit(false, false); } }`],
    ['fire-pistol-three-shots', 3.0, `for (let i = 0; i < 3; i++) { T(i * 0.28); sfxGun('pistol', null); }`],
  ],
  hits: [
    ['hitMarker', 0.6, 'sfxHit(false, false)'],
    ['hit-head', 0.6, 'sfxHit(true, false)'],
    ['kill', 0.9, 'sfxHit(false, true)'],
    ['kill-head', 0.9, 'sfxHit(true, true)'],
    ['kill-chain-2', 0.9, 'sfxHit(false, true, 2)'],
    ['kill-chain-3', 0.9, 'sfxHit(false, true, 3)'],
    ['kill-chain-5', 0.9, 'sfxHit(false, true, 5)'],
    ['damageTaken', 0.9, 'sfxHurt(30)'],
    ['bullet-whiz', 0.6, 'sfxWhiz(new V3(1.2, 1.7, -3))'],
    ['alert-beep', 0.8, 'sfxBeep(1800, 2)'],
    ['grenade-bounce', 0.6, 'sfxBounce(new V3(4, 0.5, 0))'],
    ['grenade-click', 0.4, 'sfxClick(null, 2600, 0.15)'],
    ['step-snow', 0.6, "sfxStep(null, 0.3, 'snow')"],
    ['step-concrete', 0.6, "sfxStep(null, 0.3, 'concrete')"],
  ],
  impacts: ['metal', 'concrete', 'wood', 'ground', 'snow', 'glass', 'flesh'].map((m) => [`impact-${m}`, 1.0, `sfxImpact(new V3(6, 1.5, 0), '${m}')`]),
  handling: ['magout', 'magin', 'bolt', 'charge', 'pump', 'shell', 'empty', 'slap', 'pin', 'spoon', 'knife', 'throw', 'draw', 'stow', 'ads', 'pickup'].map((k) => [`mech-${k}`, 0.8, `sfxMech('${k}')`]),
  // interface sounds: sfxUiPlay directly (sfxUi groups the calls of one instant and plays after a setTimeout)
  menus: ['hover', 'click', 'back', 'tab', 'tick', 'open', 'close', 'confirm', 'go', 'error', 'notify', 'equip', 'unequip', 'camo', 'locked', 'unlock'].map((k) => [`ui-${k}`, k === 'go' ? 2.2 : 1.0, `sfxUiPlay('${k}')`]),
  explosions: [
    ['explosion-6m', 3.5, 'sfxExplosion(new V3(6, 0.3, 0))'], ['explosion-25m', 3.5, 'sfxExplosion(new V3(25, 0.3, 0))'], ['explosion-70m', 4.0, 'sfxExplosion(new V3(70, 0.3, 0))'],
    ['grenade-splash', 1.5, 'sfxPlunge(new V3(5, -0.5, 0), 0.4)'], ['explosion-water', 3.0, 'sfxPlunge(new V3(8, -0.5, 0), 1)'], ['body-fall', 1.0, 'sfxBodyFall(new V3(4, 0, 0))'],
  ],
  streaks: [
    ['end-victory', 4.6, "sfxMatchEnd('win')"], ['end-defeat', 7.8, "sfxMatchEnd('loss')"], ['end-draw', 3.0, "sfxMatchEnd('draw')"], ['level-up', 4.6, 'rankUpSound()'],
    ['announce-uav', 3.0, "sfxAnnounce('uav_ready', 'st_ready'); annTick()"], ['announce-enemy-strike', 3.0, "sfxAnnounce('air_enemy'); annTick()"],
    ['capture', 2.0, "sfxAnnounce('cap', 'st_capture')"], ['pointLost', 2.0, "sfxAnnounce('lost', 'st_lost')"], ['match-start', 2.5, "sfxAnnounce(null, 'st_start')"],
    ['terminal-press', 1.0, "sfxKs('press')"], ['lockOn', 1.0, "sfxKs('lock')"], ['bombDrop', 2.5, 'sfxBomb(new V3(10, 0, 0), 1.05)'],
  ],
  footsteps: ['concrete', 'gravel', 'grass', 'dirt', 'snow', 'metal', 'wood', 'water'].map((k) => [`step-${k}`, 0.6, `sfxStep(null, 0.26, '${k}')`])
    .concat([['jump', 0.8, "sfxJump('concrete')"], ['landing', 0.8, "sfxLand('concrete', 1)"], ['slide', 1.2, 'sfxSlide()'], ['hurt-bullet', 0.8, 'sfxHurt(30)'], ['heartbeat', 1.0, 'sfxHeart()']]),
};

async function main() {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const pg = await b.newPage({ bypassCSP: true, viewport: { width: 640, height: 360 } });
    await pg.addInitScript(`try{localStorage.setItem('dc_settings', JSON.stringify({quality:'low', sv:2, dynres:false}));localStorage.setItem('cod_seen_version','99')}catch(e){}`);
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
      if (u.includes('@pmndrs/assets@1.7.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (u.includes('peerjs')) return r.fulfill({ body: 'window.Peer=function(){};', contentType: 'application/javascript' });
      if (u.startsWith('file:')) return r.continue();
      return r.abort();
    });
    if (opt.fallback) await pg.addInitScript('window.__fallback = true');
    await pg.goto('file://' + files[0]);
    await pg.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 600000, polling: 500 });

    // rendering tools in the page: offline context, measurements, sheet
    await pg.evaluate(() => {
      window.__render = async (code, dur) => {
        const sr = 48000, off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
        const RealCtx = window.AudioContext;
        window.AudioContext = function () { return off; };
        AU.ctx = null; AU.ready = false; AU.gunBufs = {};
        if (window.__fallback) for (const k of Object.keys(SFX_PACKS)) delete SFX_PACKS[k]; // fallback synthesis only
        try { initAudio(); } finally { window.AudioContext = RealCtx; }
        // level-up fanfare: decoded by initAudio (rankUpPrepare), awaited before playing (only once, the buffer then serves every render)
        if (typeof rankUpPrepare === 'function') for (let k = 0; AU.rankBuf === null && AU.rankPending && k < 250; k++) await new Promise((r) => setTimeout(r, 20));
        // sample packs: decoded once (the buffers serve from one context to the next); real reverb put back in place
        if (typeof SFX_GAME !== 'undefined') { for (const k of ['ui'].concat(SFX_GAME, ['voice_en'])) await sfxLoad(k); sfxVerbSetup(); }
        if (typeof gunBuffersBuild === 'function' && !(typeof sfxReady === 'function' && sfxReady('weaponry'))) gunBuffersBuild(true);
        if (typeof ANN !== 'undefined') { ANN.q.length = 0; ANN.until = 0; ANN.last.clear(); } AU.hoverT = AU.lockT = -9; // clocks of the sounds with a minimum interval
        camera.position.set(0, 1.6, 0); camera.updateMatrixWorld(true);
        AU.master.gain.value = 1; if (AU.wpnVol) AU.wpnVol.gain.value = 1; // weapons: separate bus (05-audio.js)
        // T(s) shifts the context clock: following calls start s seconds later (bursts)
        // (a sound launched exactly at t = 0 loses its attack in an offline context: everything starts at 50 ms)
        let shift = 0.05; Object.defineProperty(off, 'currentTime', { get: () => shift });
        const T = (s) => { shift = 0.05 + s; };
        new Function('T', 'V3', code)(T, V3); // the game functions are global
        const buf = await off.startRendering();
        return { L: Array.from(buf.getChannelData(0)), R: Array.from(buf.getChannelData(1)), sr };
      };
    });

    const out = [];
    for (const cat of opt.sounds.split(',')) {
      for (const [name, dur, code] of SOUND_LIST[cat] || []) {
        const r = await pg.evaluate(async ([code, dur, name_]) => {
          const { L, R, sr } = await window.__render(code, dur);
          const n = L.length, mono = new Float32Array(n);
          for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) * 0.5;
          let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
          const rms = (a, b) => { let s = 0; const i0 = Math.floor(a * sr), i1 = Math.min(n, Math.floor(b * sr)); for (let i = i0; i < i1; i++) s += mono[i] * mono[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
          const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
          // first audible instant: start of the measurement (shots start at t = 0, delays are included)
          // FFT radix 2
          const fft = (re, im) => { const N = re.length; for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
            for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, c = i + k + len / 2, tr = re[c] * cr - im[c] * ci, ti = re[c] * ci + im[c] * cr; re[c] = re[a] - tr; im[c] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } };
          const NF = 1024, hop = 256, win = new Float32Array(NF); for (let i = 0; i < NF; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NF - 1));
          const frames = []; for (let s = 0; s + NF <= n; s += hop) { const re = new Float32Array(NF), im = new Float32Array(NF); for (let i = 0; i < NF; i++) re[i] = mono[s + i] * win[i]; fft(re, im); const m = new Float32Array(NF / 2); for (let k = 0; k < NF / 2; k++) m[k] = Math.hypot(re[k], im[k]); frames.push(m); }
          // centroid over the first 60 ms after the first sound
          let t0 = 0; while (t0 < n && Math.abs(mono[t0]) < 0.01 * pk) t0++;
          let num = 0, den = 0; for (let f = Math.floor(t0 / hop); f < Math.min(frames.length, Math.floor((t0 + 0.06 * sr) / hop) + 1); f++) for (let k = 1; k < NF / 2; k++) { num += k * (sr / NF) * frames[f][k]; den += frames[f][k]; }
          // share of spectral energy above 3 kHz (the "small high-pitched sounds")
          let eHi = 0, eAll = 0; for (const f of frames) for (let k = 1; k < NF / 2; k++) { const e = f[k] * f[k]; eAll += e; if (k * sr / NF > 3000) eHi += e; }
          // duration down to -40 dB below the peak
          let tEnd = 0; for (let i = n - 1; i >= 0; i--) if (Math.abs(mono[i]) > pk * 0.01) { tEnd = i; break; }
          // sheet: waveform and spectrogram
          const W = 640, H = 170, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
          g.fillStyle = '#10141a'; g.fillRect(0, 0, W, H);
          const wv = 50; g.fillStyle = '#7fd1ff';
          for (let x = 0; x < W; x++) { const a = Math.floor(x / W * n), b = Math.floor((x + 1) / W * n); let lo = 0, hi = 0; for (let i = a; i < b; i++) { lo = Math.min(lo, mono[i]); hi = Math.max(hi, mono[i]); } g.fillRect(x, wv / 2 - hi * wv / 2 * 0.95, 1, Math.max(1, (hi - lo) * wv / 2 * 0.95)); }
          const img = g.createImageData(W, H - wv - 2), kmax = Math.floor(12000 / (sr / NF));
          let mx = 0; for (const f of frames) for (let k = 0; k < kmax; k++) mx = Math.max(mx, f[k]);
          for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) {
            const f = frames[Math.min(frames.length - 1, Math.floor(x / W * frames.length))], k = Math.floor((1 - y / img.height) * kmax);
            const v = Math.max(0, Math.min(1, (20 * Math.log10(f[k] / mx + 1e-6) + 70) / 70)), o = (y * W + x) * 4;
            img.data[o] = 255 * Math.min(1, v * 2.2); img.data[o + 1] = 255 * Math.max(0, Math.min(1, v * 2.2 - 0.7)); img.data[o + 2] = 255 * (v < 0.5 ? v * 1.6 : 1 - (v - 0.5) * 1.2); img.data[o + 3] = 255;
          }
          g.putImageData(img, 0, wv + 2);
          g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(name_ + '  ' + n / sr + ' s', 4, 12);
          const i16 = new Int16Array(n * 2); for (let i = 0; i < n; i++) { i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
          let bin = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
          return { peak: db(pk), rms100: db(rms(t0 / sr, t0 / sr + 0.1)), rms500: db(rms(t0 / sr, t0 / sr + 0.5)), crest: db(pk) - db(rms(t0 / sr, t0 / sr + 0.1)), centroid: Math.round(num / Math.max(den, 1e-9)), hf: Math.round(100 * eHi / Math.max(eAll, 1e-12)), t40: +(tEnd / sr).toFixed(2), png: cv.toDataURL('image/png'), wav: btoa(bin), sr, n };
        }, [code, dur, name]).catch((e) => ({ error: String(e) }));
        if (r.error) { console.error(name, r.error); continue; }
        // WAV 16 bits
        const pcm = Buffer.from(r.wav, 'base64'), hdr = Buffer.alloc(44);
        hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
        hdr.writeUInt32LE(r.sr, 24); hdr.writeUInt32LE(r.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
        fs.writeFileSync(path.join(opt.out, name + '.wav'), Buffer.concat([hdr, pcm]));
        fs.writeFileSync(path.join(opt.out, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
        out.push({ name, peak: +r.peak.toFixed(1), rms100: +r.rms100.toFixed(1), crest: +r.crest.toFixed(1), centroid: r.centroid, hf: r.hf, t40: r.t40 });
      }
    }
    const missingOnes = await pg.evaluate(() => (typeof SFX === 'undefined' ? [] : [...SFX.state].filter(([, st]) => st.s === 'failed').map(([k]) => k)));
    if (missingOnes.length && !opt.fallback) console.error(`Sound packs not found (${missingOnes.join(', ')}): their fallback synthesis is measured in their place. The page must be next to dist/sfx (see the header).`);
    console.log('sound'.padEnd(26) + 'peak dB'.padStart(9) + 'rms100ms'.padStart(10) + 'peak/rms'.padStart(10) + 'centroid Hz'.padStart(13) + '> 3 kHz %'.padStart(11) + 'length s'.padStart(9));
    for (const o of out) console.log(o.name.padEnd(26) + String(o.peak).padStart(9) + String(o.rms100).padStart(10) + String(o.crest).padStart(10) + String(o.centroid).padStart(13) + String(o.hf).padStart(11) + String(o.t40).padStart(9));
    fs.writeFileSync(path.join(opt.out, 'measures.json'), JSON.stringify(out, null, 1));
    if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
  } finally { await b.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
