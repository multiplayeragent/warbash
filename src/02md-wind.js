/* ==========================================================================
   WIND: a single breeze for all the flora (owner feedback: trees, plants, flowers, reeds and palms animated in the
   wind, on all maps). Like the cloths (02mc-cloths.js), everything happens in the vertex shader: no simulation on the
   processor, no extra texture unit (the BEND push field of Floralia and Cirrus stays separate, see 02n-flora.js).
   - Each vertex of a flexible material carries its flexibility weight (aSw, the channel of the living materials, LIVING): 0 at the attachment, 1 at the free
     end; a negative weight gives only the leaf flutter (a climber pressed against the wall doesn't lean into it). A cut-out
     foliage card takes the weight of its height or of its distance from the trunk (M.swFn of a prefab, swHeight and swCrown below),
     a palm frond that of its distance from the trunk (foliageQuad, option w).
   - windDisp(position, amplitudes): the gust (windGust) is a wave crossing the map in the wind direction at about ten meters
     per second, plus a fine gust doubling it; it leans the plant downwind (x), it makes the sway oscillate (y, at the
     natural frequency of each spot: two neighboring palms don't beat together) and it strengthens the leaf flutter (z).
     The wind never drops completely: a breeze remains. The leaning tip drops a little (the frond length doesn't change).
   - Each material has its amplitudes (WIND_AMP: lean, sway, flutter in meters at weight 1, and range): the foliage
     of a palm moves more than that of a snow-laden fir. Beyond the range, the plant no longer moves (fade over the outer
     half). Like Floralia's materials, these materials have no depth pre-pass or moving shadow: the cast shadow is
     that of the plant at rest (the difference is a few centimeters).
   - Direction and strength (windInit, called by makeMaterials): `vent: [x, z, force]` in a map definition if there is one; otherwise the
     map's grass direction (`grass.wind`, so grass and trees lean the same way) or a northeast breeze, and the
     strength of the wind you hear (`atmo.wind[1]`, the gain of the ambient sound, 0.07: strength 1): the wind you see is the one you hear.
     Clock: WIND_U.uWnT, advanced by the frame loop (09-game.js).
   ========================================================================== */
LIVING.add('foliage'); LIVING.add('stem'); LIVING.add('conifer'); LIVING.add('cyfol');
const WIND_U = { uWnT: { value: 0 }, uWnD: { value: new THREE.Vector4(0.8, 0.6, 1, 0) } }; // temps ; direction (x, z), force
/* Amplitudes per material: lean under the gust, sway, flutter (m at weight 1), range (m) */
const WIND_AMP = {
  foliage: [0.3, 0.16, 0.05, 120], // fronds, bushes, dry grasses, bougainvilleas (Chergui, Sirocco)
  cyfol: [0.2, 0.12, 0.05, 90], // olive, cypress, tamarisk, fig, plane tree, agave, tufts, climbers (Notos, Sirocco)
  conifer: [0.1, 0.06, 0.018, 70], // snow-laden firs and bushes (Saint-Givre)
  stem: [0.34, 0.15, 0.015, 75], // reed stems and ribs
};
const WIND_HEAD = `uniform float uWnT; uniform vec4 uWnD;
// gust from 0 to 1.4 at point wp: a wide wave moving in the wind direction, doubled by a finer wave (two sines)
float windGust(vec3 wp) {
  vec2 d = uWnD.xy, p = vec2(-d.y, d.x);
  float a = dot(wp.xz, d), b = dot(wp.xz, p);
  float g1 = 0.5 + 0.5 * sin(a * 0.07 - uWnT * 0.9 + b * 0.05);
  float g2 = 0.5 + 0.5 * sin(a * 0.19 - uWnT * 2.3 + b * 0.11);
  return clamp((0.12 + 0.62 * g1 * g1 + 0.26 * g2 * g1) * uWnD.z, 0.0, 1.4);
}
// displacement (m) of a point: am = (lean, sway, flutter), already multiplied by the weight; four sines and cosines on top of the gust
vec3 windDisp(vec3 wp, vec3 am) {
  float g = windGust(wp);
  vec2 d = uWnD.xy, p = vec2(-d.y, d.x);
  float ph = uWnT * 2.1 + dot(wp.xz, vec2(0.37, 0.29)) + wp.y * 0.11, fa = uWnT * 7.3 + dot(wp, vec3(2.1, 3.3, 1.7));
  float so = (0.25 + 0.75 * g) * am.y, fl = (0.3 + 0.9 * g) * am.z;
  vec2 xz = d * (g * am.x + sin(ph) * so) + p * (cos(ph * 0.8 + 1.9) * so * 0.4) + vec2(sin(fa), cos(fa * 1.37 + 1.1)) * fl;
  return vec3(xz.x, -length(xz) * 0.3 + sin(fa * 0.7) * fl * 0.35, xz.y);
}`;
const WIND_VERT = `#include <begin_vertex>
{
  float sw = aSw;
  if (abs(sw) > 0.001) {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float lod = 1.0 - smoothstep(uWnA.w * 0.5, uWnA.w, distance(wp, cameraPosition));
    if (lod > 0.0) transformed += windDisp(wp, vec3(uWnA.xy * max(sw, 0.0), uWnA.z * abs(sw))) * lod;
  }
}`;
/* Makes a scenery material flexible in the wind (after its creation, like makeCloth); amp: amplitudes (WIND_AMP); o.leaf: leaf lighting from
   Floralia (matte diffuse, translucency: a palm tree backlit glows yellow-green, see leafLight in 02n-flora.js); o.cards: foliage cards
   emitted in both directions by foliageQuad, each with its normal tilted toward the sky (only one of the two faces the player):
   the material only draws the face that looks at the player (FrontSide), otherwise the two cards, in the same place, would both be lit and
   cut out, for double the per-pixel work */
function makeWind(m, amp, o = {}) {
  const base = m.userData.patch;
  m.userData.windA = { value: new THREE.Vector4(amp[0], amp[1], amp[2], amp[3]) };
  m.userData.patch = (s) => {
    base(s); Object.assign(s.uniforms, WIND_U); s.uniforms.uWnA = m.userData.windA;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSw; uniform vec4 uWnA;\n' + WIND_HEAD).replace('#include <begin_vertex>', WIND_VERT);
    if (o.leaf) leafLight(s);
  };
  m.onBeforeCompile = m.userData.patch; m.defines.WM_WIND = ''; if (o.leaf) m.defines.WM_LEAF = ''; if (o.cards) m.side = THREE.FrontSide;
  return m;
}
/* Direction and strength of the map's wind */
function windInit(def) {
  const v = def && def.vent, d = v || (def && def.grass && def.grass.wind) || [0.8, 0.6], l = hyp(d[0], d[1]) || 1;
  const aw = def && def.atmo && def.atmo.wind, f = v && v[2] !== undefined ? v[2] : aw ? clamp(aw[1] / 0.07, 0.6, 1.5) : 1;
  WIND_U.uWnD.value.set(d[0] / l, d[1] / l, f, 0);
}
/* Flexibility weights to put in a prefab's M.swFn (vertices receive swFn(x, y, z) in prefab coordinates):
   swHeight, from 0 at the foot (y0) to m at the top (y1), raised to the power k (a stem bends mostly at the top);
   swCrown, according to the distance from the trunk axis (cx, cz), up to radius r, and slightly according to height. */
const swHeight = (y0, y1, k = 1.5, m = 1) => (x, y) => m * Math.pow(clamp((y - y0) / (y1 - y0), 0, 1), k);
const swCrown = (cx, cz, y0, y1, r, m = 1) => (x, y, z) => m * clamp(0.3 * clamp((y - y0) / (y1 - y0), 0, 1) + 0.7 * hyp(x - cx, z - cz) / r, 0, 1);
