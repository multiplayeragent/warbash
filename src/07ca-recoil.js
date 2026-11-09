/* ==========================================================================
   PLAYER AIM RECOIL
   Owner feedback: recoil was too discreet (the spirit of the old Call of Duty games), it should have more punch, without military simulation, in the spirit
   of the recent Battlefields. Player only: bots keep the old recoil (ctlShoot), their trigger already waits for their aim to come back (07b-tactics.js), and
   toughening it would make them less dangerous for no reason.
   - Each shot raises the aim (RECOIL.cat.mul times the weapon's vertical recoil v and horizontal h, attachments included: weaponDef already applied them to
     d.recoil). The first shot of a burst is a bit softer, then recoil builds over five shots up to full (rifles: "climb" pattern, which
     climbs then snakes; submachine guns: jumpy; the rest: random).
   - What softens it: shouldered aim (x0.66), crouching (x0.75). What worsens it: running or pushing the stick (x1.2), being airborne (x1.5). On touch
     (x0.75) and gamepad (x0.85) recoil is a bit weaker: you can't counter recoil with a thumb like with a mouse, and touch auto-fire
     would lose its target on every shot.
   - Aim recovery (recoilTick): when the trigger is released (0.1 s after the last shot), the aim comes back down by itself over the share of recoil
     that has not already been pulled back by hand (RECOIL.cat.back: 70% for a rifle, 90% for a sniper or pump-action rifle, whose single shot is a
     jolt), in about half a second. A held burst therefore always climbs, two or three short bursts return to the target: shooting short pays.
   - The weapon model and the view (vmKick, playerShotFx) also move more (RECOIL.vis): the shot is seen as much as it is controlled.
   Check: node tools/dev/visual/recoil-check.js (per-weapon table: climb after 1, 5, 10 shots and a magazine, hipfire, aimed, crouched,
   running; aim recovery; bots unchanged).
   ========================================================================== */
const RECOIL = {
  cat: { ar: { mul: 1.55, back: 0.7 }, smg: { mul: 1.45, back: 0.7 }, pistol: { mul: 1.3, back: 0.85 }, sniper: { mul: 1.15, back: 0.9 }, shotgun: { mul: 1.15, back: 0.9 } },
  ads: 0.66, crouch: 0.75, move: 1.2, air: 1.5, input: { kb: 1, pad: 0.85, touch: 0.75 },
  first: 0.85, peak: 1.25, ramp: 5, // first-shot coefficient of a burst, of full recoil, number of shots to reach it
  delay: 0.1, rate: 7, vis: 1.45, // delay before recovery (s), recovery speed (1/s), strength of the visible recoil of the model and view (1.3 before 5.1)
};
/* Vertical climb and horizontal drift (rad) of a player shot: n is the shot's rank in the burst (0: the first), ads the shouldering (0 to 1),
   spd the ground speed (m/s) */
function recoilShot(ent, d, n, ads, spd) {
  const K = RECOIL.cat[d.cat] || RECOIL.cat.ar, R = d.recoil;
  let m = K.mul * lerp(1, RECOIL.ads, ads) * (ent.crouch ? RECOIL.crouch : 1) * (RECOIL.input[inputMode()] || 1);
  if (spd > 2.5) m *= RECOIL.move;
  if (!ent.onGround) m *= RECOIL.air;
  if (d.bipod && ent.crouch && spd < 0.4) m *= 0.5; // bipod deployed (crouched and still): recoil is almost cancelled
  let kv = R.v * m * rand(0.9, 1.1), kh;
  if (d.pattern === 'climb') { kv *= lerp(RECOIL.first, RECOIL.peak, Math.min(1, n / RECOIL.ramp)); kh = (Math.sin(n * 0.55 + 0.6) * 1.2 + (Math.random() - 0.5) * 0.6) * R.h; }
  else if (d.pattern === 'smg') { kv *= n ? 1 : RECOIL.first + 0.1; kh = (Math.random() - 0.5) * 2.6 * R.h; }
  else kh = (Math.random() - 0.5) * 2 * R.h;
  return { kv, kh: kh * m };
}
/* Aim recovery, each frame of the living player, after the look is applied. manual: how much the player just moved the aim by hand
   (negative: downward), which counts as recoil already pulled back */
function recoilTick(dt, now, manual) {
  const A = PL.ent.arms;
  if (!(A.recPend > 0)) { A.recPend = 0; return; }
  if (manual < 0) A.recPend = Math.max(0, A.recPend + manual);
  if (now - A.lastShotAt < RECOIL.delay) { A.recArm = false; return; }
  if (!A.recArm) { A.recArm = true; A.recPend *= (RECOIL.cat[armsW(PL.ent).def.cat] || RECOIL.cat.ar).back; } // only the "recoverable" share comes back, the rest stays
  const dp = A.recPend * (1 - Math.exp(-RECOIL.rate * dt));
  PL.pitch -= dp; A.recPend -= dp;
  if (A.recPend < 1e-4) A.recPend = 0;
}
