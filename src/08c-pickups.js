/* ==========================================================================
   WEAPONS ON THE GROUND
   On death, a soldier drops the weapon they held, with its remaining ammo.
   - weapon of the same type as one of ours (assault rifle, submachine gun,
     sniper rifle, shotgun, pistol: WEAPONS[].cat): its ammo is picked up by
     walking over it, round for round, up to the maximum reserve of our weapon;
     emptied, it disappears, otherwise it stays on the ground;
   - weapon different from those we carry (even of the same type): E swaps it for
     the weapon in hand (which drops in turn, with its ammo); on gamepad, X held.
   Weapons live much longer than bodies (5.5 s): DROP.life.
   Dropped weapons are local to each player (nothing is sent online).
   ========================================================================== */
const DROP = { life: 90, fade: 2, max: 14, swapR: 1.7, ammoR: 1.1, shadowR: 14, farR: 45, list: [], models: {}, cur: null, txt: '', msgT: 0, msg: '', prog: 0 };
const _dpV = new V3(), _dpQ = new THREE.Quaternion(), _dpQ2 = new THREE.Quaternion(), _dpF = new V3();

/* Model of the weapon lying down: the soldiers' model, laid on its side (quarter turn around the barrel) and set at the
   right height (lift: distance from the origin to the lowest point in this pose) */
function dropTemplate(key) {
  if (DROP.models[key]) return DROP.models[key];
  const g = buildWorldGun(key).group;
  const rest = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2);
  g.quaternion.copy(rest); g.updateMatrixWorld(true);
  const lift = -new THREE.Box3().setFromObject(g).min.y;
  g.quaternion.identity(); g.updateMatrixWorld(true);
  return (DROP.models[key] = { group: g, rest, lift });
}
function removeDrop(d) {
  scene.remove(d.obj);
  const i = DROP.list.indexOf(d); if (i >= 0) DROP.list.splice(i, 1);
  if (DROP.cur === d) DROP.cur = null;
}
function clearDrops() { for (const d of DROP.list.slice()) removeDrop(d); DROP.msgT = 0; }

/* Puts a weapon on the ground: pos and q (starting position and orientation), vel (throw). Returns the object or null. */
function dropWeapon(def, mag, reserve, pos, q, vel) {
  if (mag + reserve <= 0) return null;
  const T = dropTemplate(def.key);
  const obj = T.group.clone(); obj.position.copy(pos); obj.quaternion.copy(q);
  scene.add(obj);
  const d = { def, mag, reserve, obj, tpl: T, vel: vel.clone(), spin: new V3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), landed: false, landT: 0, q0: new THREE.Quaternion(), qR: new THREE.Quaternion(), age: 0 };
  DROP.list.push(d);
  while (DROP.list.length > DROP.max) removeDrop(DROP.list[0]);
  return d;
}

/* Weapon dropped by a soldier who just died: it leaves the body (from which it is removed) and falls */
function dropKilledWeapon(v, dir) {
  const A = v.arms, w = A && A.slots[A.cur]; if (!w) return;
  let mag = w.mag, reserve = w.reserve;
  // bots have a nearly infinite reserve: they only leave a part of it
  if (!v.isPlayer) reserve = Math.min(reserve, Math.round(w.def.reserve * rand(0.3, 1)));
  if (mag + reserve <= 0) mag = Math.ceil(w.def.mag / 3);
  const vel = _dpF.set(v.vel ? v.vel.x : 0, 0, v.vel ? v.vel.z : 0).multiplyScalar(0.6);
  if (dir) { vel.x += dir.x * 1.2; vel.z += dir.z * 1.2; }
  vel.y = rand(1.2, 2.2);
  const S = v.model;
  if (!v.isPlayer && S && S.gun) {
    S.gun.updateWorldMatrix(true, false);
    S.gun.getWorldPosition(_dpV); S.gun.getWorldQuaternion(_dpQ);
    S.gun.visible = false; // the body no longer has its weapon (it is made visible again on return to life, see animSoldier)
  } else {
    _dpV.set(v.pos.x, v.pos.y + 1.1, v.pos.z); _dpQ.setFromAxisAngle(UP, v.yaw || 0);
  }
  dropWeapon(w.def, mag, reserve, _dpV, _dpQ, vel);
}

/* Yaw of orientation q (the barrel points toward -Z) */
function quatYaw(q) { _dpF.set(0, 0, -1).applyQuaternion(q); return Math.atan2(-_dpF.x, -_dpF.z); }

function stepDrop(d, dt) {
  d.age += dt;
  const o = d.obj, T = d.tpl;
  if (!d.landed) {
    d.vel.y -= 9.8 * dt;
    o.position.addScaledVector(d.vel, dt);
    _dpQ.set(d.spin.x * dt * 0.5, d.spin.y * dt * 0.5, d.spin.z * dt * 0.5, 1).normalize();
    o.quaternion.premultiply(_dpQ);
    // walls stop the weapon (small cylinder collision), air slows it a little
    _dpV.set(o.position.x, o.position.y - T.lift, o.position.z); collideCircle(_dpV, 0.12, 0.3);
    o.position.x = _dpV.x; o.position.z = _dpV.z;
    d.vel.x *= 1 - 0.8 * dt; d.vel.z *= 1 - 0.8 * dt;
    const g = groundHeight(o.position.x, o.position.z, o.position.y - T.lift, 0.15);
    if (d.vel.y <= 0 && o.position.y - T.lift <= g) {
      // landing: flat on its side, in the direction of the barrel at impact
      o.position.y = g + T.lift; d.landed = true; d.landT = 0; d.q0.copy(o.quaternion);
      d.qR.setFromAxisAngle(UP, quatYaw(o.quaternion)).multiply(T.rest);
    } else if (o.position.y < -8) { d.dead = true; }
  } else if (d.landT < 1) {
    d.landT = Math.min(1, d.landT + dt / 0.3);
    o.quaternion.slerpQuaternions(d.q0, d.qR, smoothstep(0, 1, d.landT));
  }
  // end of life: the weapon shrinks and sinks into the ground
  const left = DROP.life - d.age;
  if (left < DROP.fade) { const k = Math.max(0, left / DROP.fade); o.scale.setScalar(k); if (left <= 0) d.dead = true; }
}

function updateDrops(dt) {
  const L = DROP.list;
  for (let i = L.length - 1; i >= 0; i--) { stepDrop(L[i], dt); if (L[i].dead) removeDrop(L[i]); }
  // level of detail: same apparent-size threshold as the soldiers (updateSoldierLods). Far away, a lying weapon is only a few
  // pixels: no more shadow beyond DROP.shadowR, nothing beyond DROP.farR (14 weapons at most, visible from the whole map, added
  // up to 80 draw calls per frame, shadows included, over the course of the match)
  const lk = 1.8 * VIEW.h / (2 * Math.tan(camera.fov * Math.PI / 360)), th = RQ.q.lodPx, zoom = Settings.fov / camera.fov;
  for (const d of L) {
    const dist = camera.position.distanceTo(d.obj.position) / zoom, hi = lk / (dist * zoom + 0.01) > th, sh = dist < DROP.shadowR, vis = dist < DROP.farR;
    if (d.hi !== hi) { d.hi = hi; setGunLod(d.obj, hi); }
    if (d.vis !== vis) { d.vis = vis; d.obj.visible = vis; }
    if (d.sh !== sh) { d.sh = sh; for (const m of d.obj.children) if (m.userData.gunLod === 'lo') m.castShadow = sh; }
  }
  DROP.msgT -= dt;
  const P = PL.ent, A = P.arms;
  let best = null, bd = 1e9;
  if (P.alive && MATCH.state === 'playing') {
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i]; if (!d.landed) continue;
      const dx = d.obj.position.x - P.pos.x, dz = d.obj.position.z - P.pos.z, dy = d.obj.position.y - P.pos.y;
      if (dy < -0.6 || dy > 1.4) continue;
      const dist = hyp(dx, dz);
      // weapon of the same type as one of ours (the same one first): its ammo is picked up by walking over it
      const same = A.slots.find((s) => s.def.id === d.def.id), mine = same || A.slots.find((s) => s.def.cat === d.def.cat);
      if (mine && dist <= DROP.ammoR) {
        const take = Math.min(mine.def.reserve - mine.reserve, d.mag + d.reserve);
        if (take > 0) {
          mine.reserve += take;
          const fromRes = Math.min(take, d.reserve); d.reserve -= fromRes; d.mag -= take - fromRes;
          DROP.msg = _t('+{0} ammo ({1})', take, mine.def.name); DROP.msgT = 1.4; sfxMech('pickup');
          if (d.mag + d.reserve <= 0) { removeDrop(d); continue; }
        }
      }
      // another weapon, even of the same type, can be swapped for the one we hold
      if (!same && dist < DROP.swapR && dist < bd) { best = d; bd = dist; }
    }
  }
  DROP.cur = best && dropSwapAllowed() ? best : null;
  // prompt under the crosshair: the key or button of the input mode (actGlyph, 09x-invites.js); on touch, the Pick up button is on screen
  // on gamepad, pickup is X held (padReloadUse): the prompt says so, and a thin bar fills during the press
  const g = DROP.cur ? actGlyph('use') : '', a = DROP.cur && esc(A.slots[A.cur].def.name), b = DROP.cur && esc(DROP.cur.def.name), hold = inputMode() === 'pad';
  const mp = mechaPrompt(); // within reach of your mecha, or aboard: get in, get out (08g-mecha-pilote.js)
  const txt = mp ? mp : DROP.cur ? `${g ? (hold ? _t('Hold {0} to swap {1} for {2}', g, a, b) : _t('{0} Swap {1} for {2}', g, a, b)) : _t('Swap {0} for {1}', a, b)}<i>${DROP.cur.mag} / ${DROP.cur.reserve}</i>` : DROP.msgT > 0 ? esc(DROP.msg) : '';
  const el = $('pickup');
  if (txt !== DROP.txt) { DROP.txt = txt; el.innerHTML = txt; el.style.opacity = txt ? 1 : 0; }
  const prog = (DROP.cur || mp) && hold && PAD.useT > 0 && PAD.useT < PAD_HOLD ? PAD.useT / PAD_HOLD : 0;
  if (prog !== DROP.prog) { DROP.prog = prog; el.style.setProperty('--hold', prog.toFixed(3)); el.classList.toggle('hold', prog > 0); }
}
function dropSwapAllowed() { const P = PL.ent; return P.alive && P.arms.switching <= 0 && PL.knifeT <= 0 && !PL.nadeState && !KS.mode && !MECHA_P.me; }

/* E (Pick up button on touch, X held on gamepad: padReloadUse): swaps the weapon in hand for the aimed weapon on the ground */
function swapWithDrop() {
  const d = DROP.cur, P = PL.ent, A = P.arms;
  if (!d || !dropSwapAllowed() || MATCH.state !== 'playing') return;
  const old = A.slots[A.cur], yaw = P.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  PL.knifeOut = false; // the knife is put away: the new weapon comes up as after a weapon switch
  removeDrop(d);
  // the stowed weapon drops in front of us, with its remaining ammo
  _dpV.set(P.pos.x + fx * 0.5, P.pos.y + 0.9, P.pos.z + fz * 0.5); _dpQ.setFromAxisAngle(UP, yaw);
  dropWeapon(old.def, old.mag, old.reserve, _dpV, _dpQ, _dpF.set(fx * 1.6, 1.3, fz * 1.6));
  A.slots[A.cur] = { def: d.def, mag: d.mag, reserve: d.reserve };
  // same animation as a weapon switch: the weapon lowers, then the new one comes up (vmEquip at mid-course, see ctlWeapon)
  A.reload = null; A.boltT = 0; A.switching = 0.52; A.switchTo = A.cur; P.busy = false;
  VM.action = null; VM.lowerTarget = 1;
  kcEvent('vma', { sid: P.kcI, name: 'switch', dur: 0.52, data: { to: d.def.key, from: old.def.key } });
  sfxMech('pickup');
}
