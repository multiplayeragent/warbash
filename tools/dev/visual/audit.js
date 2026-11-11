/* Audit of one or more maps: node audit.js [map...] [--parallel 3] [--skip slits,zfight]   (without a map: all)
   Runs on each map leveldesign.js, navigation.js, decor.js, slits.js, snags.js, zfight.js and crossing.js (MAP=...), compares the measurements to the thresholds of
   README, "Map design rules" (according to the map type) and to the common rules, then:
   - writes audits/<map>.json, the condensed survey (measurements, defects, what falls outside the thresholds), versioned with the map: it is the reference
     for the next change;
   - displays, map by map, what falls outside the thresholds and the difference from the previous reference (the audits/<map>.json from before this run, or
     the one in the BEFORE=... folder).
   --parallel: maps processed in parallel (2 by default; each tool opens a software-rendered Chromium). --skip: tools to skip (their
   results are taken from the previous survey); --only: the only tools to rerun, separated by commas (likewise).
   Allow 5 to 10 minutes per map. Error code if a map has a blocking defect (scenery, slot, bullet pass-through, hole, snag, navigation,
   z-fighting, a pair of key points not connected on foot). */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const HERE = __dirname, OUT = path.join(HERE, 'audits'), BEFORE = process.env.BEFORE ? path.resolve(process.env.BEFORE) : OUT;
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MAP_LIST = ['chergui', 'saintgivre', 'portmael', 'floralia', 'notos', 'scoria', 'cirrus', 'sirocco', 'belhorizon', 'outpost'];
const NAMES = { chergui: 'Chergui', saintgivre: 'Saint-Givre', portmael: 'Port-Maël', floralia: 'Floralia', notos: 'Notos', scoria: 'Scoria', cirrus: 'Cirrus', sirocco: 'Sirocco', belhorizon: 'Bel-Horizon', outpost: 'Selva' };
const TOOLS = ['leveldesign', 'navigation', 'decor', 'slits', 'snags', 'zfight', 'crossing'], onlyTools = (opt('--only', '') || '').split(',').filter(Boolean);
const skip = new Set(onlyTools.length ? TOOLS.filter((t) => !onlyTools.includes(t)) : (opt('--skip', '') || '').split(',').filter(Boolean)), parallel = +opt('--parallel', 2);
const mapList = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
// an unknown identifier: the tools would take the default map (Chergui) and the survey would go under a wrong name
for (const c of mapList) if (!MAP_LIST.includes(c)) { console.error(`unknown map: ${c} (ids: ${MAP_LIST.map((k) => k + ' = ' + NAMES[k]).join(', ')})`); process.exit(2); }
// thresholds per type (README, table "Thresholds per type")
const THRESHOLD = {
  sightline: { close: [6, 9], mid: [9, 13], open: [12, 18] }, shortSight: { close: [20, 40], mid: [5, 20], open: [0, 8] }, afar: { close: [0, 5], mid: [0, 10], open: [15, 30] },
  place: { close: [15, 100], mid: [25, 45], open: [40, 100] }, upper: { close: [5, 10], mid: [3, 10], open: [5, 12] }, coverSpots: { close: 5, mid: 5, open: 6 },
};
// deviations accepted by the owner (README, values measured in October 2026): reported, not counted
const WAIVED = { cirrus: ['afar', 'place'], sirocco: ['sightline', 'afar', 'walking', 'upper'] };

function run(tool, map, json) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [path.join(HERE, tool + '.js')].concat(json ? ['--json'] : []), { env: Object.assign({}, process.env, { MAP: map, TOP: '400' }), cwd: HERE });
    let out = '', err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
    p.on('close', (code) => { clearTimeout(t); res({ code, out, err }); });
  });
}
const parse = (s) => { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } };
const r1 = (v) => Math.round(v * 10) / 10;

async function audit(map, B) {
  const t0 = Date.now(), A = { mapKey: map, naming: NAMES[map] || map, date: new Date().toISOString().slice(0, 10), measures: {}, defects: {}, outOfRange: [], waived: [] };
  // a skipped tool keeps its results from the previous survey (and, for leveldesign, what fell outside the thresholds)
  if (B) { if (skip.has('leveldesign')) { A.measures = B.measures || {}; A.outOfRange = B.outOfRange || []; A.waived = B.waived || []; } for (const t of TOOLS) if (skip.has(t) && B.defects && B.defects[t]) A.defects[t] = B.defects[t]; }
  const outOfRange = (key, txt) => ((WAIVED[map] || []).includes(key) ? A.waived : A.outOfRange).push(txt);
  if (!skip.has('leveldesign')) {
    const L = parse((await run('leveldesign', map, true)).out);
    if (!L) A.outOfRange.push('leveldesign.js no result');
    else {
      const t = L.type || 'mid', li = L.readability, sp = L.spawns, m = A.measures;
      Object.assign(m, { type: t, meanView: li.meanView, groundShortView: li.shareMeanViewUnder6m, viewsOver60m: r1((100 * L.los.over60m) / L.los.groundNodes), plazaShare: li.plazaShare, elevatedShare: L.vertical.elevatedShare,
        walking: [sp.walkAlphaToBravoMin, sp.walkAlphaToBravoMax], routes: L.routes.distinctUnderOneAndAThird, deadEnds: li.deadEnds, detour90: li.detour90, junctions: li.junctionsShortestRoute,
        landmark: li.atLeastOneLandmark === undefined ? null : li.atLeastOneLandmark, chokepoint: L.chokepoint ? { front: L.chokepoint.front, passages: L.chokepoint.passages, detail: L.chokepoint.detail.slice(0, 8) } : null,
        tightTurns: L.turns ? L.turns.reduce((s, v) => s + v.tight, 0) : null, tightTurnsAt: L.turns ? [].concat(...L.turns.map((v) => v.whereAt)).slice(0, 12) : [],
        points: L.dom.map((d, i) => ({ naming: 'ABC'[i], point: d.point, entrances: d.entrances, walkable: d.walkable, cover9m: d.cover9m, walking: [d.meanWalkAlpha, d.meanWalkBravo], seenFromSpawns: [d.spawnsAlphaThatSee, d.spawnsBravoThatSee] })) });
      const chk = (key, naming, v, [lo, hi]) => { if (v < lo || v > hi) outOfRange(key, `${naming} ${v} (${lo} to ${hi})`); };
      chk('sightline', 'mean view (m)', m.meanView, THRESHOLD.sightline[t]); chk('shortSight', 'ground with short sightline (%)', m.groundShortView, THRESHOLD.shortSight[t]); chk('afar', 'views over 60 m (%)', m.viewsOver60m, THRESHOLD.afar[t]);
      chk('place', 'plaza share (%)', m.plazaShare, THRESHOLD.place[t]); chk('upper', 'elevated network (%)', m.elevatedShare, THRESHOLD.upper[t]);
      if (sp.seenByEnemySpawnAlpha || sp.seenByEnemySpawnBravo) outOfRange('spawnPoints', `spawns seen from the enemy side: ${sp.seenByEnemySpawnAlpha} and ${sp.seenByEnemySpawnBravo}`);
      if (sp.minGap < 2.2) outOfRange('spawnPoints', `spawns ${sp.minGap} m from each other (2.2 minimum)`);
      if (m.walking[0] < 90 || m.walking[1] > 105) outOfRange('walking', `walk from one side to the other ${m.walking[0]} to ${m.walking[1]} m (90 to 105)`);
      if (m.routes < 4) outOfRange('routes', `distinct routes ${m.routes} (4 minimum)`);
      if (m.deadEnds > 2) outOfRange('deadEnds', `dead ends ${m.deadEnds} (2 maximum)`);
      if (m.detour90 > 1.5) outOfRange('detour', `detour at the 90th percentile ${m.detour90} (1.5 maximum)`);
      if (m.junctions > 8) outOfRange('junctions', `intersections on the shortest route ${m.junctions} (8 maximum)`);
      if (m.landmark === null) outOfRange('landmark', 'no landmark declared (MAP_DEFS.<id>.landmarks)'); else if (m.landmark < 60) outOfRange('landmark', `landmark seen from ${m.landmark} % of the ground (60 minimum)`);
      if (m.chokepoint && m.chokepoint.passages < 3) outOfRange('chokepoint', `${m.chokepoint.passages} passage${m.chokepoint.passages > 1 ? 's' : ''} at the narrowest point of the middle (3 minimum: no absolute chokepoint)`);
      if (m.tightTurns) outOfRange('turns', `${m.tightTurns} turn${m.tightTurns > 1 ? 's' : ''} of more than 90° on the routes`);
      const nA = (L.spawns.alpha || 1) / 3;
      m.points.forEach((p) => {
        if (p.walkable < 70) outOfRange('points', `${p.naming} walkable at ${p.walkable} % (70 minimum)`);
        if (typeof p.entrances === 'number' && (p.entrances < 2 || p.entrances > 4)) outOfRange('entrances', `${p.naming}: ${p.entrances} entrance${p.entrances > 1 ? 's' : ''} (2 to 4, or open)`);
        if (p.naming !== 'B') {
          const base = p.naming === 'A' ? p.walking[0] : p.walking[1];
          if (base < 20 || base > 30) outOfRange('points', `${p.naming} at ${base} m of walking from its base (20 to 30)`);
          if (p.cover9m < THRESHOLD.coverSpots[t]) outOfRange('points', `${p.naming}: ${p.cover9m} pieces of cover at 9 m (${THRESHOLD.coverSpots[t]} minimum)`);
          if ((p.naming === 'A' ? p.seenFromSpawns[0] : p.seenFromSpawns[1]) > nA) outOfRange('points', `${p.naming} seen from more than a third of its side's spawns`);
        } else {
          if (Math.abs(p.walking[0] - p.walking[1]) > 5) outOfRange('points', `B not equal in walking distance (${p.walking[0]} and ${p.walking[1]} m)`);
          if (p.seenFromSpawns[0] || p.seenFromSpawns[1]) outOfRange('points', 'B seen from a spawn');
        }
      });
    }
  }
  if (!skip.has('navigation')) {
    const r = await run('navigation', map, false), t = r.out + '\n' + r.err, i = t.indexOf('FAIL:'), l = i >= 0 ? t.slice(i).split('\n').slice(1).filter((x) => /^(spawn|point|domination)/.test(x)) : []; // FAIL goes to the error output
    A.defects.navigation = l;
  }
  if (!skip.has('decor')) {
    const D = parse((await run('decor', map, true)).out);
    if (D) A.defects.decor = { blockedDoors: D.doorBlocked.length, pots: D.potsBad.filter((p) => p.defects.some((d) => /sunk into|in the air/.test(d))).length, badPosters: D.decalsBad.length, bikes: D.bikesBad.length, bridgeIssues: D.headsBlocked.length, sand: D.sand.length, overlapCount: D.overlaps.length, itemList: [].concat(D.doorBlocked.map((d) => 'door ' + (d.doorway || d.door || JSON.stringify(d)).toString().slice(0, 160)), D.overlaps.map((o) => 'overlap ' + o.things)).slice(0, 40) };
  }
  if (!skip.has('slits')) {
    const F = parse((await run('slits', map, true)).out);
    if (F) A.defects.slits = { slits: F.slits.filter((f) => f.seenBy).length, bulletPass: F.passThrough.filter((f) => f.seenBy).length, wallHoles: F.wallHoles.filter((f) => f.seenBy).length, margins: F.margins.length, marginsOver30cm: F.margins.filter((m) => m.leeway > 0.3).length, itemList: [].concat(F.slits.map((f) => `slit (${f.x}, ${f.z}) ${f.deviation} cm`), F.passThrough.map((f) => `bullet pass-through (${f.x}, ${f.z}) ${f.deviation} cm`), F.wallHoles.map((t) => `hole (${t.x}, ${t.z}) ${t.wide} m`), F.margins.slice(0, 20).map((m) => `margin ${m.leeway} m (${m.x}, ${m.z}) ${m.mat}`)) };
  }
  if (!skip.has('snags')) {
    const K = parse((await run('snags', map, true)).out);
    if (K) A.defects.snags = { snagCount: K.snags.length, pathCount: K.pathCount, itemList: K.snags.slice(0, 30).map((a) => `(${a.x}, ${a.y}, ${a.z}) ${a.zone}, climb ${a.climbHeight} m, ${a.occurrences} times`) };
  }
  if (!skip.has('zfight')) {
    const Z = parse((await run('zfight', map, true)).out);
    if (Z) A.defects.zfight = { visibleCount: Z.list.filter((h) => h.seenBy > 0).length, blocking: Z.bad, itemList: Z.list.filter((h) => !h.same && h.area > 0.1 && h.seenBy > 0).slice(0, 20).map((h) => `(${h.x}, ${h.y}, ${h.z}) ${h.area} m² ${h.mats}`) };
  }
  if (!skip.has('crossing')) {
    // can the map be crossed on foot (owner feedback, October 2026): pairs of key points with no walking path, or 25% longer
    const T = parse((await run('crossing', map, true)).out);
    if (T) A.defects.crossing = { pairCount: T.badPairs.length, outOf: T.pairCount, itemList: T.badPairs.slice(0, 20).map((p) => `${p.from} > ${p.toward}: ${p.withJumps} m with jumps, ${p.walking === null ? 'no path' : p.walking + ' m'} on foot`), jumpLinks: T.jumpLinks.slice(0, 10).map((e) => `(${e.x}, ${e.z}) ${e.kind} from ${e.y0} to ${e.y1} m: ${e.n}`) };
  }
  const d = A.defects;
  A.blocking = (d.navigation ? d.navigation.length : 0) + (d.decor ? d.decor.blockedDoors + d.decor.pots + d.decor.badPosters + d.decor.bikes + d.decor.bridgeIssues + d.decor.sand + d.decor.overlapCount : 0) + (d.slits ? d.slits.slits + d.slits.bulletPass + d.slits.wallHoles : 0) + (d.snags ? d.snags.snagCount : 0) + (d.zfight ? d.zfight.blocking : 0) + (d.crossing ? d.crossing.pairCount : 0);
  A.minutes = r1((Date.now() - t0) / 60000);
  return A;
}

function show(A, B) {
  const m = A.measures, d = A.defects, delta = (k, v) => { const o = B && B.measures ? B.measures[k] : undefined; return o === undefined || o === v || typeof v !== 'number' ? '' : ` (before ${o})`; };
  console.log(`\n${A.naming} (${A.mapKey}, ${m.type || '?'}): ${A.outOfRange.length} out of range, ${A.blocking} blocking defect${A.blocking > 1 ? 's' : ''}${B ? ` (before: ${B.outOfRange.length} and ${B.blocking})` : ''}; ${A.minutes} min`);
  if (m.meanView !== undefined) console.log(`  view ${m.meanView} m${delta('meanView', m.meanView)}, floor with short sightline ${m.groundShortView} %, views > 60 m ${m.viewsOver60m} %${delta('viewsOver60m', m.viewsOver60m)}, plaza ${m.plazaShare} %, elevated ${m.elevatedShare} %${delta('elevatedShare', m.elevatedShare)}, routes ${m.routes}, dead ends ${m.deadEnds}${delta('deadEnds', m.deadEnds)}, crossroads ${m.junctions}, chokepoint ${m.chokepoint ? m.chokepoint.front + ' m, ' + m.chokepoint.passages + ' passages' : '?'}, points ${m.points.map((p) => p.naming + ' ' + p.entrances).join(', ')}`);
  if (d.decor) console.log(`  scenery: doors ${d.decor.blockedDoors}, pots ${d.decor.pots}, posters ${d.decor.badPosters}, bikes ${d.decor.bikes}, bridges ${d.decor.bridgeIssues}, sand ${d.decor.sand}, overlaps ${d.decor.overlapCount}`);
  if (d.slits) console.log(`  render and collisions: slits ${d.slits.slits}, bullet pass-throughs ${d.slits.bulletPass}, holes ${d.slits.wallHoles}, margins ${d.slits.margins} (of which ${d.slits.marginsOver30cm} over 30 cm)`);
  if (d.snags) console.log(`  snags (you get stuck while walking, ${d.snags.pathCount} paths): ${d.snags.snagCount}`);
  if (d.zfight) console.log(`  z-fighting: ${d.zfight.visibleCount} visible spots, ${d.zfight.blocking} larger than 0.1 m² between two materials`);
  if (d.crossing) console.log(`  crossing on foot: ${d.crossing.pairCount} pair${d.crossing.pairCount > 1 ? 's' : ''} of ${d.crossing.outOf} with no walking path or one more than 25 % longer`);
  if (d.navigation) console.log(`  navigation: ${d.navigation.length} point${d.navigation.length > 1 ? 's' : ''} outside the network`);
  for (const h of A.outOfRange) console.log('  OUT OF RANGE: ' + h);
  for (const h of A.waived) console.log('  accepted: ' + h);
}

(async () => {
  const list = mapList.length ? mapList : MAP_LIST;
  fs.mkdirSync(OUT, { recursive: true });
  const res = [], todo = list.slice();
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, async () => {
    while (todo.length) {
      const map = todo.shift(), file = path.join(OUT, map + '.json'), ref = path.join(BEFORE, map + '.json');
      const B = fs.existsSync(ref) ? JSON.parse(fs.readFileSync(ref, 'utf8')) : null, A = await audit(map, B);
      fs.writeFileSync(file, JSON.stringify(A, null, 1) + '\n');
      show(A, B); res.push(A);
    }
  }));
  console.log(`\n${res.length} map${res.length > 1 ? 's' : ''}: ${res.reduce((s, a) => s + a.outOfRange.length, 0)} measurements out of range, ${res.reduce((s, a) => s + a.blocking, 0)} blocking defects; recorded in ${path.relative(process.cwd(), OUT) || OUT}`);
  process.exit(res.some((a) => a.blocking) ? 1 : 0);
})();
