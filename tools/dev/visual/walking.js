/* First-person view on a step, a curb (see "Controls" in the README, applyCamera in src/08-player.js).
   The player's ground changes at once (up to STEP, 45 cm) when going up or down without jumping: the view must glide, not jump. The bench varies
   the player's height frame by frame at 60 frames per second (applyCamera called by hand, no bob) and measures the view height:
   - 30 cm climb: the view does not jump (no more than 5 cm from one frame to the next), reaches the ground within 5 mm in 0.6 s, without overshooting it;
   - 20 cm drop: likewise; 18 cm stair steps every 0.3 s: the view follows without jerk (no more than 5 cm from one frame to the next);
   - in the air (jump, fall), the view keeps its exact height; a gap larger than a step (spawn) is followed immediately.
   PAGE=other.html: another version, placed in dist/ (4.12.1, to see the old jump). MAP=saintgivre: another map. Exits with an error on the first defect. */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'chergui';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  await page.evaluate(() => { MATCH.state = 'capture'; });
  const R = await page.evaluate(() => {
    const e = PL.ent, dt = 1 / 60, out = {};
    e.alive = true; PL.bobA = 0; PL.bobT = 0; PL.shake = 0; PL.suppress = 0;
    const eye = () => camera.position.y - (e.pos.y + PL.eyeH); // height of the view above its normal position (0: it is there)
    const stand = (y) => { e.pos.y = y; e.onGround = true; e.vy = 0; for (let i = 0; i < 90; i++) applyCamera(dt, 0, false); };
    // frames: list of [player height change, in the air]; returns the absolute view heights and the final offset
    const run = (frames, air = false) => {
      const ys = []; let prev = camera.position.y;
      for (const dy of frames) { e.pos.y += dy; e.onGround = !air; applyCamera(dt, 0, false); ys.push(camera.position.y - prev); prev = camera.position.y; }
      return ys;
    };
    const maxAbs = (a) => Math.max(...a.map(Math.abs));
    const seq = (first, n) => [first, ...new Array(n - 1).fill(0)];
    // 1. 30 cm climb
    stand(1.5);
    let d = run(seq(0.3, 36)); out.upMax = maxAbs(d); out.upEnd = eye();
    stand(1.5); { const tr = []; e.pos.y += 0.3; for (let i = 0; i < 36; i++) { applyCamera(dt, 0, false); tr.push(eye()); } out.upSigned = Math.max(...tr); out.upLag = tr[0]; }
    // 2. 20 cm drop
    stand(1.5); d = run(seq(-0.2, 36)); out.downMax = maxAbs(d); out.downEnd = eye();
    stand(1.5); { const tr = []; e.pos.y -= 0.2; for (let i = 0; i < 36; i++) { applyCamera(dt, 0, false); tr.push(eye()); } out.downSigned = Math.min(...tr); }
    // 3. staircase: 18 cm every 18 frames (0.3 s), six steps
    stand(1.5); { const fr = []; for (let s = 0; s < 6; s++) fr.push(...seq(0.18, 18)); d = run(fr); out.stairMax = maxAbs(d); out.stairEnd = eye(); }
    // 4. in the air: the view follows exactly
    stand(1.5); e.onGround = false; PL.lastOn = false; { const tr = []; for (let i = 0; i < 10; i++) { e.pos.y += 0.1; e.onGround = false; applyCamera(dt, 0, false); tr.push(Math.abs(eye())); } out.airMax = Math.max(...tr); }
    // 5. spawn: a 3 m gap is followed immediately
    stand(1.5); e.pos.y += 3; applyCamera(dt, 0, false); out.tpErr = Math.abs(eye());
    return out;
  });
  console.log(JSON.stringify(R));
  ok(R.upMax < 0.05, `30 cm climb: at most ${(R.upMax * 100).toFixed(1)} cm from one frame to the next (without smoothing: 30 cm)`);
  ok(R.upLag < -0.2, `30 cm climb: the view stays below at the start (${(R.upLag * 100).toFixed(1)} cm), it slides`);
  ok(R.upSigned < 0.001, `30 cm climb: the view never exceeds its arrival height (${(R.upSigned * 1000).toFixed(1)} mm)`);
  ok(Math.abs(R.upEnd) < 0.005, `30 cm climb: arrival at ${(R.upEnd * 1000).toFixed(1)} mm in 0.6 s`);
  ok(R.downMax < 0.05 && Math.abs(R.downEnd) < 0.005 && R.downSigned > -0.001, `20 cm drop: at most ${(R.downMax * 100).toFixed(1)} cm per frame, arrival at ${(R.downEnd * 1000).toFixed(1)} mm, no overshoot`);
  ok(R.stairMax < 0.05 && Math.abs(R.stairEnd) < 0.005, `stairs of 6 steps of 18 cm: at most ${(R.stairMax * 100).toFixed(1)} cm per frame, arrival at ${(R.stairEnd * 1000).toFixed(1)} mm`);
  ok(R.airMax < 0.001, `in the air: the view keeps its exact height (${(R.airMax * 1000).toFixed(2)} mm gap)`);
  ok(R.tpErr < 0.001, `spawn (+3 m): the view follows immediately (${(R.tpErr * 1000).toFixed(2)} mm gap)`);
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND'));
  ok(errs.length === 0, `clean console${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
