/* Physics props bench (see "Physics props" in the README). Loads the map, then for each prop type fires one shotgun blast
   and one explosion, lets the body settle, and exits with an error at the first defect: non-finite value, body that
   does not fall asleep, body sunk into the ground, gunshot passing through a prop, reset that does not put everything back.
   It also checks aiming (rayWorld sees non-traversable props, including fruit) and debris (bursting,
   pool, return to the original state).
   node props.js            Chergui;  MAP=saintgivre node props.js   Saint-Givre.
   Variables: CHROMIUM (browser), PAGE (other version). */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'chergui';
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  await page.evaluate(() => { MATCH.state = 'capture'; MATCH.time = 1; });
  const R = await page.evaluate(() => {
    const out = { fails: [], types: {}, n: PHYS.bodies.length, variants: PHYS.variants.size };
    const fail = (m) => out.fails.push(m);
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) updateProps(1 / 60); };
    const settle = (max) => { let t = 0; while (PHYS.awake.length && t < max) { sim(0.1); t += 0.1; } return +t.toFixed(1); };
    const finite = (tag) => { for (const b of PHYS.bodies) if (![b.p.x, b.p.y, b.p.z, b.q.x, b.q.y, b.q.z, b.q.w, b.vel.x, b.w.x].every(Number.isFinite)) { fail(tag + ': non-finite value on ' + b.d.key); return false; } return true; };
    const below = (tag) => { for (const b of PHYS.bodies) if (b.state && b.p.y < -0.02) fail(tag + ': ' + b.d.key + ' below the floor (y = ' + b.p.y.toFixed(2) + ')'); };
    const start = PHYS.bodies.map((b) => [b.p.x, b.p.y, b.p.z, b.state]);
    // aiming: a ray toward each non-traversable body hits it
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.ray) continue;
      const o = new V3(b.p.x + 3, b.p.y, b.p.z), d = new V3(-1, 0, 0);
      const h = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 3 + b.rad, b.d.through ? 1 : 0);
      if (b.d.through) { const h0 = rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, 3 + b.rad, 0); if (h0 && h0.prop === b) fail('aiming: ' + b.d.key + ' (traversable) seen by a line of sight'); }
    }
    // each type: one shotgun blast, then an explosion at 2.5 m
    for (const type of [...new Set(PHYS.bodies.filter((b) => !b.pooled).map((b) => b.d.key))]) {
      const b = PHYS.bodies.find((x) => x.d.key === type && !x.pooled);
      const p0 = b.p.clone(), dir = new V3(1, 0, 0.3).normalize();
      propShot(b, b.p.clone().addScaledVector(dir, -0.1), dir, 32);
      const t1 = settle(25);
      if (PHYS.awake.length) fail(type + ': still awake after 25 s (' + PHYS.awake.length + ' bodies)');
      const rec = { shot: { t: t1, dist: +b.p.distanceTo(p0).toFixed(2), broken: b.state === 0 } };
      if (b.state) {
        explode(new V3(b.p.x + 2.5, 0.3, b.p.z), PL.ent, 'Grenade', 7.5, 150);
        const t2 = settle(25);
        if (PHYS.awake.length) fail(type + ': still awake after the blast');
        rec.blast = { t: t2, dist: +b.p.distanceTo(p0).toFixed(2), broken: b.state === 0 };
      }
      below(type); finite(type);
      out.types[type] = rec;
      propsReset();
      const s = start[PHYS.bodies.indexOf(b)];
      if (Math.hypot(b.p.x - s[0], b.p.y - s[1], b.p.z - s[2]) > 1e-4 || b.state !== s[3]) fail(type + ': propsReset does not put the body back in place');
    }
    // fruit: a whole crate, one shot then one blast
    const fr = PHYS.bodies.filter((b) => b.d.type === 'fruit');
    if (fr.length) {
      const f0 = fr[0];
      propShot(f0, f0.p.clone().add(new V3(-0.05, 0, 0)), new V3(1, 0.1, 0), 32);
      const t = settle(25); if (PHYS.awake.length) fail('fruit: still ' + PHYS.awake.length + ' bodies awake after 25 s');
      below('fruits');
      explode(new V3(f0.p.x, f0.p.y + 1.2, f0.p.z + 1.2), PL.ent, 'Grenade', 7.5, 150);
      const t2 = settle(25); if (PHYS.awake.length) fail('fruit: still ' + PHYS.awake.length + ' bodies awake after the blast');
      below('fruits after blast'); finite('fruits');
      out.fruits = { n: fr.length, shot: t, blast: t2 };
      propsReset();
    }
    // full shot: fireRay on a prop head-on, no wall in front (the body must wake up, or burst)
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.ray) continue;
      const org = new V3(b.p.x - 3, b.p.y, b.p.z), w = rayWorld(org.x, org.y, org.z, 1, 0, 0, 3 - b.rad, 2);
      if (w) continue;
      // another prop on the line of fire (tight pots on a workbench): the bullet would hit it, not this body
      if (PHYS.bodies.some((o) => o !== b && !o.pooled && o.p.x > org.x && o.p.x < b.p.x && Math.abs(o.p.y - b.p.y) < o.rad + b.rad && Math.abs(o.p.z - b.p.z) < o.rad + b.rad)) continue;
      fireRay(PL.ent, org, new V3(1, 0, 0), WEAPONS.m4, null, false);
      if (b.state === 1 && !b.d.hold) fail('shot: ' + b.d.key + ' hit head-on but stayed asleep');
      propsReset(); break;
    }
    // chairs: each one faces the nearest table (the front of a chair is +z in its frame)
    const tables = PHYS.bodies.filter((b) => b.d.type === 'table' || b.d.type === 'cafeTable');
    for (const c of PHYS.bodies.filter((b) => b.d.type === 'chair')) {
      let t = null, td = 1e9; for (const x of tables) { const d = Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z); if (d < td) { td = d; t = x; } }
      if (!t || td > 1.4) continue;
      const fx = c.R[2], fz = c.R[8], l = Math.hypot(fx, fz) || 1, dot = (fx * (t.p.x - c.p.x) + fz * (t.p.z - c.p.z)) / l / td;
      if (dot < 0.8) fail('chair at (' + c.p.x.toFixed(1) + ', ' + c.p.z.toFixed(1) + ') turned its back to its table (cos ' + dot.toFixed(2) + ')');
      out.chairs = (out.chairs || 0) + 1;
    }
    if (typeof propsKick !== 'undefined') fail('propsKick still exists: walking on a prop must not move anything');
    // resistance: below the threshold the body does not move, above it it goes
    const hb = PHYS.bodies.find((b) => b.d.hold && !b.pooled && b.state === 1);
    if (hb) {
      const p0 = hb.p.clone(), dir = new V3(1, 0, 0);
      propShot(hb, hb.p.clone().addScaledVector(dir, -0.1), dir, hb.d.hold * 0.4);
      if (hb.state !== 1 || hb.p.distanceTo(p0) > 1e-6) fail(hb.d.key + ': a light hit must not dislodge it');
      propShot(hb, hb.p.clone().addScaledVector(dir, -0.1), dir, hb.d.hold);
      if (hb.state !== 2) fail(hb.d.key + ': repeated hits must dislodge it');
      settle(25); propsReset();
    }
    // stacking: a body resting on a single support falls when the support leaves
    let pile = null;
    for (const c of PHYS.stackers) {
      const ext = propExtent(c), under = PHYS.stackers.filter((o) => o !== c && Math.abs((c.p.y - ext[1]) - (o.p.y + propExtent(o)[1])) <= 0.12 && Math.abs(c.p.x - o.p.x) < propExtent(o)[0] + ext[0] - 0.12 && Math.abs(c.p.z - o.p.z) < propExtent(o)[2] + ext[2] - 0.12);
      if (under.length === 1) { pile = [c, under[0]]; break; }
    }
    if (pile) {
      propShot(pile[1], pile[1].p.clone(), new V3(0, 0, 1), 300);
      if (pile[0].state !== 2) fail('stacking: ' + pile[0].d.key + ' does not fall when its only support leaves');
      settle(25); below('stacking'); finite('stacking'); propsReset(); out.stacking = pile[0].d.key;
    }
    // crate: one hit dislodges it, its walls disappear and its fruits spill out
    const cr = PHYS.bodies.find((b) => b.d.type === 'fruitBox');
    if (cr) {
      const inside = PHYS.bodies.filter((f) => f.d.type === 'fruit' && Math.abs(f.p.x - cr.p.x) < 0.4 && Math.abs(f.p.z - cr.p.z) < 0.3 && Math.abs(f.p.y - cr.p.y) < 0.4), walls = PHYS.pcols.filter((c) => c.crate && c.x0 > cr.p.x - 0.5 && c.x1 < cr.p.x + 0.5 && c.z0 > cr.p.z - 0.4 && c.z1 < cr.p.z + 0.4 && c.y0 > cr.p.y - 0.4);
      propShot(cr, cr.p.clone().add(new V3(-0.2, 0, 0)), new V3(1, 0.1, 0), 30);
      if (inside.length < 10) fail('crate: ' + inside.length + ' fruits only found inside');
      if (inside.some((f) => f.state === 1)) fail('crate: fruits stayed asleep in a dislodged crate');
      if (walls.some((c) => c.y1 > 0)) fail('crate: its walls stayed');
      settle(25); below('crateTest'); finite('crateTest');
      out.crateTest = { fruits: inside.length, sideWalls: walls.length };
      propsReset();
      if (walls.some((c) => c.y1 < 0)) fail('crate: propsReset does not put the walls back');
    }
    // bike: a hit from the side knocks it over (from either side: it may be leaning against a wall)
    const bk = PHYS.bodies.find((b) => b.d.type === 'bicycle');
    if (bk) {
      let fell = false;
      for (const sx of [1, -1]) {
        propsReset(); propShot(bk, bk.p.clone().add(new V3(-0.2 * sx, 0.2, 0)), new V3(sx, 0, 0), 30); settle(25);
        below('bike'); finite('bike'); if (bk.R[4] < 0.5) fell = true;
      }
      if (!fell) fail('bike: still upright after a hit from each side');
      propsReset();
    }
    // original state
    PHYS.bodies.forEach((b, i) => { const s = start[i]; if (Math.hypot(b.p.x - s[0], b.p.y - s[1], b.p.z - s[2]) > 1e-4 || b.state !== s[3]) fail('propsReset: body ' + i + ' (' + b.d.key + ') not reset properly'); });
    out.resting = PHYS.bodies.filter((b) => b.state === 1).length;
    return out;
  });
  console.log(JSON.stringify(R.types, null, 1));
  console.log(R.fruits ? 'fruits: ' + JSON.stringify(R.fruits) : '', '\n' + R.n + ' bodies, ' + R.variants + ' variants', R.chairs ? ', ' + R.chairs + ' chairs facing their table' : '', R.stacking ? ', stacking (' + R.stacking + ')' : '', R.crateTest ? ', crate ' + JSON.stringify(R.crateTest) : '');
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
  if (R.fails.length) { console.error('FAIL:\n' + R.fails.join('\n')); process.exit(1); }
  console.log('props: all in order');
})();
