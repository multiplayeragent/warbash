/* ==========================================================================
   WIND-BLOWN CLOTH: flags and laundry (owner feedback: "physics on cloth, flag, t-shirt, flying in the wind")
   Laundry, rugs and Sirocco's flag have become simulated cloths (clothPiece, below, and 02me-canvases.js); what follows applies
   to the fabrics left in the shader (Notos's Greek flag, 'cloth' and 'cyflag' materials).
   No simulation on the processor: the vertex shader makes the fabric ripple, like the foliage (02n-flora.js), but without an extra
   texture (no texture unit, nothing read from a shadow map). Each vertex carries its flexibility weight (aSw, the channel of the
   living materials, LIVING): 0 at the attachment (pole, rope), 1 at the free end. The flag sends a wave running from the pole to the end; the
   laundry swings under its rope. Like the foliage, these materials have no depth pre-pass (a moving vertex wouldn't be
   at the same place there), and their cast shadow stays that of the fabric at rest. Beyond 55 m, the fabric no longer moves.
   ========================================================================== */
LIVING.add('cloth'); LIVING.add('cyflag');
const CLOTH_U = { uClT: { value: 0 }, uClW: { value: new THREE.Vector2(0.07, 0.06) } }; // wave and swing (m at the free end)
const CLOTH_VERT = `#include <begin_vertex>
{
  float cw = aSw;
  if (cw > 0.001) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float lod = 1.0 - smoothstep(30.0, 55.0, distance(wp, cameraPosition));
    if (lod > 0.0) {
      float t = uClT, ph = dot(wp.xz, vec2(0.37, 0.29)) + wp.y * 0.21;
      float gust = 0.6 + 0.4 * sin(t * 0.4 + wp.x * 0.05 - wp.z * 0.04);
      float wave = sin(cw * 7.0 - t * 6.0 + ph) * 0.75 + sin(cw * 13.0 - t * 9.5 + ph * 1.7) * 0.25;
      float swing = sin(t * 1.6 + ph) * 0.65 + sin(t * 2.9 + ph * 1.3) * 0.35;
      transformed += objectNormal * (wave * uClW.x + swing * uClW.y) * gust * cw * lod;
    }
  }
}`;
/* Makes a scenery material flexible (after its creation, like makeLiving) */
function makeCloth(m) {
  const base = m.userData.patch;
  m.userData.patch = (s) => {
    base(s); Object.assign(s.uniforms, CLOTH_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSw; uniform float uClT; uniform vec2 uClW;').replace('#include <begin_vertex>', CLOTH_VERT);
  };
  m.onBeforeCompile = m.userData.patch; m.defines.WM_CLOTH = '';
  return m;
}
/* Hanging piece of laundry (local corners: bottom left, bottom right, top right, top left; the top is held by the rope), normal n: a simulated cloth
   (Maker.fabric, 02me-canvases.js), one particle about every 11 cm. The top is pinned at both corners (and in the middle of a wide piece): it
   sags between the pins; the rest hangs, swings in the wind, moves aside when a soldier passes, lifts in a gust. o.grp: group
   (a rope: a single mesh); o.clothKind: 'hung' (laundry), 'weighted' (rug), 'flagCloth' (o.hoist: the pole holds the left side, p0-p3,
   instead of the top); o.mat: material (the cotton of laundry, the wool of a rug, the canvas of a flag). */
function clothPiece(M, p0, p1, p2, p3, n, o = {}) {
  const at = (u, v) => { const b = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u)], t = [lerp(p3[0], p2[0], u), lerp(p3[1], p2[1], u), lerp(p3[2], p2[2], u)]; return [lerp(b[0], t[0], v), lerp(b[1], t[1], v), lerp(b[2], t[2], v)]; };
  const w = hyp3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), h = hyp3(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
  const cu = clamp(Math.round(w / 0.11) + 1, 3, o.hoist ? 9 : 7), rv = clamp(Math.round(h / 0.11) + 1, 4, 9), P = [], pin = [], maxD = [], uv = [];
  for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
    const u = i / (cu - 1), v = 1 - j / (rv - 1); // the first row is the top (index 0 pinned: the engine locates itself by it)
    P.push(at(u, v)); uv.push([u * w, v * h]); // (in meters: the material lays its photo there at its scale)
    const pinned = o.hoist ? i === 0 : j === 0 && (i === 0 || i === cu - 1 || (cu >= 5 && i === (cu - 1) >> 1));
    pin.push(pinned ? 1 : 0);
    // slack: enough to swing up to the horizontal (the length hanging under the particle), a bit more for the fluttering
    maxD.push(pinned ? 0 : o.hoist ? 0.05 + u * w * 1.1 : 0.04 + (1 - v) * h * 1.15 + (j === 0 ? 0.03 : 0));
  }
  M.fabric({ cu, rv, P, pin, maxD, uv, glow: 0.12, side: n, clothKind: o.clothKind || 'hung', grp: o.grp, mat: o.mat || (o.hoist ? 'canvas' : o.clothKind === 'weighted' ? 'woolen' : 'linen') });
}
