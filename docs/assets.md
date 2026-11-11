# Asset list

Produced from the code by `python3 tools/dev/assets.py`, which `build.py` runs on every build: do not edit it by hand. The whole game is built by code (README, "Art direction: everything in code"); only the photo textures, the skies and the HDRIs come from files, all CC0. An asset's description is the comment written above its definition: to change it, change the comment.

300 prefabs, 39 physics props, 47 photo surfaces, 79 procedural surfaces, 19 atlases drawn at load, 8 photographed skies, 3 HDRI, 18 weapons, 18 attachments.

## Maps

| Map | Definition | Photo surfaces | Sky |
| --- | --- | --- | --- |
| Chergui | `src/02s-chergui.js` | plaster, plaster2, stone, brick, cobble, pavers, asphalt, rooftiles, wood, shutter, ashlar, concrete, crate, canvas, linen, cardboard, rollshutter, steel, paintwood, burlap, timber, palmbark |  |
| Saint-Givre | `src/02t-saintgivre.js` | plaster, stone, cobble, pavers, asphalt, wood, shutter, snow, snowpack, rock, boards, slate, barkw, ashlar, concrete, canvas, rust, steel, paintwood, burlap, timber |  |
| Port-Maël | `src/02u-portmael.js` | plaster, plaster2, stone, brick, cobble, pavers, asphalt, rooftiles, wood, shutter, concrete, rock, boards, slate, crate, canvas, linen, rust, rollshutter, steel, paintwood, timber |  |
| Floralia | `src/02v-floralia.js` | plaster, stone, wood, lawn, humus, flagstone, pathgravel, bark, ashlar, slate, concrete, steel, timber, shutter |  |
| Notos | `src/02yf-notos.js` | plaster, stone, cobble, pavers, wood, shutter, drystone, sand, canvas, linen, steel, paintwood, burlap, timber |  |
| Scoria | `src/02yh-scoria.js` | asphalt, pavers, ash, steel, wood, timber |  |
| Cirrus | `src/02yj-cirrus.js` | wood, stone, strata, lawn, dirt, flagstone, humus, canvas, burlap, timber, bark |  |
| Sirocco | `src/02yl-sirocco.js` | stone, wood, sand, dirt, pise, adobe, shingle, vase, strata, reg, canvas, woolen, steel, burlap, timber, palmbark |  |
| Bel-Horizon | `src/02yn-belhorizon.js` | plaster, slate, rooftiles, asphalt, concrete, pavers, lawn, pathgravel, wood, paintwood, rollshutter, steel, timber, bark, dirt, sand, canvas, cardboard |  |
| Selva | `src/02yq-outpost.js` | concrete, dirt, humus, lawn, pathgravel, sand | kloofendal_48d |

## Scenery prefabs

Built once in local coordinates (placed on y = 0, main face toward +z), stamped by `DECOR.place` (`src/02a-kit.js`). "Placed in": the files that call it directly.

### `src/02f-props.js`

**Crates, pallets, drums**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `crate` | s = 1.1 | Plank crate: panels, battens on the edges, diagonal braces | 02k-dynprops, 02yi-cirrus-kit, 02yj-cirrus (Cirrus), 02yp-outpost-yard |
| `pallet` |  | Wooden pallet (1.2 x 0.8) | 02l-port, 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre), 02u-portmael (Port-Maël), 02yh-scoria (Scoria), 02yo-outpost-building, and 1 others |
| `barrel` |  | 200 L metal drum: rolling hoops, bungs | 02k-dynprops, 02yp-outpost-yard |
| `jerrycan` |  | Jerrycan (20 L, military model from photos): rounded-edge body, stamped Xs on the sides, weld seam all around, three handles across the top, spout and lever cap at the front | 02k-dynprops, 02ypa-outpost-tower |
| `gasBottle` |  | Butane gas bottle (blue or orange) | 02k-dynprops |
| `cardboard` | w = 0.5, h = 0.4, d = 0.4 | Moving box | 02k-dynprops |
| `trashBag` |  | Garbage bag | 02k-dynprops |
| `blocks` |  | Stacked concrete blocks | 02s-chergui (Chergui), 02yn-belhorizon (Bel-Horizon) |
| `reel` |  | Cable drum: two plank flanges clamped by threaded rods, drilled hub, cable wound in coils, free end | 02s-chergui (Chergui), 02yh-scoria (Scoria) |

**Defenses: sandbags, jersey barriers**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `sandbag` |  | Low scenery sandbag (58 x 15 x 33 cm) | 02k-dynprops |
| `sandbagFat` |  | Wall sandbag (physics): thicker than the scenery one (22 x 60 x 40 cm), so that the courses touch; its collision is the box it occupies and follows the bag when it falls | 02k-dynprops, 02yp-outpost-yard |
| `sandbagHalf` |  | Half-bag (30 x 22 x 40 cm): half-filled bag, folded, which closes the end of an offset course | 02k-dynprops |
| `jersey` | len | Concrete jersey barrier (F profile), length len along z | 02s-chergui (Chergui) |

**Shipping containers**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `container` | open = false | 20-foot container (6.06 x 2.44 x 2.6), length along z, doors at +z. | 02s-chergui (Chergui), 02yl-sirocco (Sirocco) |

**Street furniture**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `lampPost` | lit = litOn() | Streetlight: base, tapered shaft, bracket arm, lantern; lit (lit, by default according to the ambience): glowing glass and baked light under the lantern, folded toward the ground | 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre) |
| `manhole` |  | Manhole (cast iron plate) and storm drain grate, flush with the ground | 02s-chergui (Chergui), 02yn-belhorizon (Bel-Horizon) |
| `drain` |  |  | 02s-chergui (Chergui), 02yn-belhorizon (Bel-Horizon) |
| `pebbles` | seed = 1 | Gravel and scattered small debris (minor details) | 02s-chergui (Chergui) |
| `bollard` |  | Anti-parking bollard | 02u-portmael (Port-Maël) |
| `dumpster` |  | Front-loading garbage bin (from photos): tank with sloped front face and straight back, rim, vertical ribs, lifting sleeves on the ends, two black plastic lids hinged at the back (one ajar), swivel... | 02s-chergui (Chergui), 02u-portmael (Port-Maël) |
| `tire` |  | Stack of tires | 02k-dynprops, 02yp-outpost-yard |
| `pole` |  | Wooden utility pole with crossarm and insulators | 02t-saintgivre (Saint-Givre) |

**Facades and roofs**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `acUnit` |  | Air conditioner (outdoor unit) with fan, grille and brackets; back against the wall (z = 0) | 02d-archi |
| `waterTank` |  | Polyethylene water tank on its stand (typical of Maghreb rooftops) | 02d-archi, 02yc-cyclades-buildings, 02yl-sirocco (Sirocco) |
| `dish` |  | Satellite dish on a stand | 02d-archi, 02yp-outpost-yard |
| `solarHeater` |  | Solar water heater: tilted collector, horizontal tank, base | 02d-archi, 02yc-cyclades-buildings |
| `antenna` |  | Yagi antenna | 02d-archi, 02yc-cyclades-buildings, 02yl-sirocco (Sirocco) |
| `roofHut` |  | Rooftop access structure: stairwell with door | 02d-archi |
| `pot` |  | Terracotta flower pot (filled with a tuft) | 02k-dynprops |

**Warehouse**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `rack` | L | Pallet racking: blue uprights, orange beams, loads | 02s-chergui (Chergui) |
| `generator` |  | Soundproofed generator (from photos of construction site generators): U-shaped frame on skids, arched-roof hood, louvered radiator grille at +x, hot air outlet at -x, access doors on the sides... | 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre), 02yh-scoria (Scoria), 02yl-sirocco (Sirocco), 02ypa-outpost-tower |

**Cafe, market**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `chair` |  | One-piece molded plastic terrace chair (from photos): seat with rolled edge, curved and tilted backrest, armrests that continue into front legs, splayed rear legs; stamp tint | 02k-dynprops |
| `cafeTable` |  |  | 02k-dynprops |
| `jar` | s = 1 | Terracotta jar (from photos of water jars): turned foot, round belly, shoulder, narrow neck and rolled lip; the inside of the neck goes down into shadow | 02k-dynprops |
| `spiceSack` |  | Open spice sack, rolled rim and colorful mound | 02k-dynprops |

**Unique map pieces (reusable)**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `table` |  | Wooden table (2 x 1 m, from photos of farm tables): tabletop of four jointed planks, apron under the top, tapered legs, stretcher; its chairs are physics props placed facing it (see tableSet,... | 02k-dynprops |
| `rugFloor` |  | Rug laid on the ground (2.4 x 1.6 m) | 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre) |
| `fountain` |  | Octagonal fountain: basin, molded coping, water, column and bowl | 02s-chergui (Chergui) |
| `forklift` |  | Yellow forklift (counterbalance front-loader, 1.5 t class, from photos of internal combustion forklifts): body with a profile cut out around the wheels, rounded counterweight, hood and seat, steering... | 02s-chergui (Chergui), 02u-portmael (Port-Maël) |
| `tent` |  | Military tent (7 x 4.4 m): canvas walls, gabled roof, poles, guy ropes, rolled-up door. | 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre), 02yl-sirocco (Sirocco) |
| `gateLeaf` |  | Gate leaf: nailed planks, iron strap hinges (open, flat against the wall; thickness in x) | 02s-chergui (Chergui) |
| `iBeam` | h | I-beam (post), height h | 02s-chergui (Chergui) |
| `truss` | L | Steel truss roof frame (along z, length L) | 02s-chergui (Chergui) |
| `column` | h | Souk column: molded base, shaft, capital, over height h (tintable) | 02s-chergui (Chergui) |
| `counter` |  | Merchant counter (1.6 x 2.4 m): box of vertical planks in a frame (corner posts, top rail), recessed plinth, overhanging top, goods | 02s-chergui (Chergui) |
| `lantern` |  | Moroccan brass lantern hung by a chain (from photos): links, bulb dome and its finial, six-sided glazed body between posts, cup and drop at the bottom; flame baked into the lighting volume | 02s-chergui (Chergui), 02t-saintgivre (Saint-Givre) |
| `hangLamp` | cool, len = 0.8 | Pendant under a ceiling (placed on the ceiling, hangs len m): cable, enameled shade, bulb; its light is baked into the lighting volume. | 02s-chergui (Chergui) |
| `stall` | color | Market stall (2.4 x 1.2 m): table, posts, stretched canvas (simulated: Maker.canvasCloth, held at the front and back edges and on the posts, its valance flaps in the wind), goods. | 02s-chergui (Chergui) |

### `src/02g-vehicles.js`

**Cars**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `car` | model = 'sedan', o = {} | Car: model 'sedan', 'hatch' (city car), 'suv', 'mpv', 'cross' (tall family cars), 'offroad' (4x4); o: { dust, wreck, rack } (see carBuild, offroadBuild). | 02g-vehicles, 02s-chergui (Chergui), 02yl-sirocco (Sirocco), 02yp-outpost-yard |
| `bicycle` |  |  | 02k-dynprops |
| `moped` |  | Moped on its kickstand | 02s-chergui (Chergui), 02u-portmael (Port-Maël) |

**Trucks**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `truck` | model = 'army', o = {} | Truck: model 'army' (military forward cab, GBC style), 'cargo' (forward-cab carrier), 'box' (delivery van); o: { load, reefer, dust, wreck }. Old form: PF.truck() for the tarped military one. | 02g-vehicles, 02s-chergui (Chergui), 02u-portmael (Port-Maël), 02yl-sirocco (Sirocco), 02yn-belhorizon (Bel-Horizon) |
| `busWreck` |  | Burnt-out bus (11 m): shell pierced with empty bays, charred interior, on its rims |  |

### `src/02h-nature.js`

**Date palms**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `palm` | h = 7, seed = 1, o = {} | Date palm: diamond-pattern trunk with flared base, dense crown of V-arched fronds, hanging dry fronds, date clusters; variants via o.v (PALM_KINDS); o.lite: lightweight version for a large palm grove... | 02s-chergui (Chergui), 02yl-sirocco (Sirocco) |
| `bush` | s = 1 | Bush (crossed cards) | 02s-chergui (Chergui) |
| `grass` | s = 1 | Tuft of dry grasses | 02s-chergui (Chergui) |
| `bougainvillea` | w = 2.2, h = 2.6 | Bougainvillea climbing a facade (facade frame: wall plane at z = 0) | 02s-chergui (Chergui) |
| `rubble` | seed = 1, r = 1.2 | Rubble: chamfered concrete and brick blocks, dust | 02s-chergui (Chergui) |
| `gravel` | seed = 1 | Gravel: a few tight pebbles | 02h-nature |
| `stone` | seed = 1 | Single stone, smooth or split | 02h-nature |
| `chunk` | seed = 1 | Chunk of concrete or cinder block: very angular, sometimes with a bit of rebar sticking out | 02h-nature |
| `brick` | seed = 1, half = false | Solid brick (22 x 10.5 x 6.5 cm) or half brick, chamfered edges | 02h-nature |
| `brickPile` | seed = 1 | Small pile of bricks fallen from a wall: a few flat, one or two on edge or leaning | 02h-nature |
| `shard` | seed = 1 | Shard of barrel tile: extruded ring segment, placed convex-up or as a gutter | 02h-nature |
| `litter` | seed = 1 | Trash: crushed can, plastic bottle, crumpled paper | 02h-nature |
| `weed` | seed = 1 | Small tuft of dry grass growing between two stones | 02h-nature |

### `src/02i-winter.js`

**Vegetation**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `spruce` | h = 9, seed = 1, base = 0 | base: height of the first ring of branches (a trimmed square fir lets people pass underneath); otherwise 0.9 to 1.5 m | 02i-winter, 02t-saintgivre (Saint-Givre) |
| `snowBush` | s = 1 | Snowy bush (crossed cards) |  |

**Modeled snow**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `snowMound` | w = 2, d = 1.4, h = 0.7, seed = 1, mat = 'snowmat' | Rounded, bumpy snow pile (ellipse w x d, height h), placed on y = 0. | 02i-winter, 02j-rail, 02t-saintgivre (Saint-Givre) |

**Accessories**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `woodpile` | L = 2.4, H = 1.2, D = 0.5 | Woodpile: stacked split logs (end grain on the front), small plank roof; length L, height H, depth D | 02i-winter, 02t-saintgivre (Saint-Givre) |
| `fence` | L = 4 | Wooden fence (posts and two rails), length L along x; no collision (placed outside walkways) |  |
| `sled` |  | Wooden sled | 02k-dynprops |
| `snowman` |  | Snowman: three balls, coal eyes, carrot nose, branch arms, scarf and hat | 02k-dynprops |
| `skiOne` |  | A ski (175 x 8 cm) standing, tip toward +y: stamp tint. | 02k-dynprops |
| `skiPole` |  | A ski pole (1.25 m), standing | 02k-dynprops |
| `skiRack` |  | Ski rack (frame: rack back toward -z, skis set in front, leaning against the back board): base, two uprights, back board. | 02k-dynprops |

**Rock, cliff, mountains**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `boulder` | seed = 1, rx = 3, ry = 2.5, rz = 2.5 | Faceted rock block (half-axes rx, ry, rz): bumpy sphere sliced by randomly drawn planes; placed on y = 0 | 02i-winter, 02t-saintgivre (Saint-Givre), 02u-portmael (Port-Maël) |

**Lying snow, lights, wood**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `xmasTree` | h = 6, base = 0 | Decorated Christmas tree: spruce, spiral garland, baubles and star | 02t-saintgivre (Saint-Givre) |
| `plankStack` | L = 4, W = 1.2, H = 1.2 | Pile of sawn planks, layers separated by battens, length L along z | 02t-saintgivre (Saint-Givre) |
| `hayBale` |  | Rectangular hay bale (small bale, from photos): pressed slices that shift slightly, two strings around it, strands sticking out of the ends. | 02k-dynprops, 02yf-notos (Notos) |

### `src/02j-rail.js`

**Rolling stock**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `boxcar` |  | Boxcar (12.2 m between heads): body of tinted planks and steel frame, curved roof, sliding doors (+x side closed, -x side ajar onto a dark interior), ladder, brake wheel, markings | 02t-saintgivre (Saint-Givre) |
| `tankcar` |  | Tank car (10.2 m between heads): tank with domed ends on cradles, bands, dome, walkway and ladders, orange hazardous-materials plate; tank tint | 02t-saintgivre (Saint-Givre) |
| `flatcar` |  | Flatcar with stakes loaded with logs (12 m between heads) | 02t-saintgivre (Saint-Givre) |
| `snowplow` |  | Rotary snowplow (13 m): red body with rounded roof, cabs at both ends, front turbine (drum, blades, hub), adjustable discharge chute, yellow and black stripes, packed snow in the turbine | 02t-saintgivre (Saint-Givre) |

**Station equipment**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `platformBench` |  | Platform bench: cast-iron legs, wooden slats, backrest | 02t-saintgivre (Saint-Givre), 02u-portmael (Port-Maël) |
| `stationClock` |  | Platform clock with two faces, on a bracket (attached to a wall or a column, facade frame: wall at z = 0) | 02t-saintgivre (Saint-Givre) |
| `luggageCart` |  | Luggage cart: platform on four wheels, drawbar, trunks, suitcases and mail sacks | 02t-saintgivre (Saint-Givre) |
| `railSignal` |  | Railway signal: mast, round target, lights (red one lit), ladder | 02t-saintgivre (Saint-Givre) |
| `relayCabinet` |  | Signaling cabinet (relay) on legs, with a small roof |  |
| `sleeperStack` | nw = 6, nh = 10 | Pile of new sleepers: nw sleepers per layer, nh layers, wedges between the layers | 02t-saintgivre (Saint-Givre) |
| `castColumn` | h = 3.6 | Cast-iron canopy column: base, fluted shaft, capital, openwork brackets toward +z and -z | 02t-saintgivre (Saint-Givre) |

### `src/02k-dynprops.js`

**Prop prefabs**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `fruitBall` |  | Fruit: sphere of 6 cm radius (the tint makes it an orange, an apple, a lemon) | 02k-dynprops |
| `fruitBox` |  | Slats and floor of a fruit crate (60 x 40 x 19 cm): a physics body, which carries its fruit away when it goes | 02k-dynprops |
| `fruitCrate` |  | Fruit crate: the crate itself (`fruitBox` body), the walls that hold the fruit (collision reserved for props, 'crate' tag) and 15 dynamic fruits in the stamp's tint. | 02f-props |
| `potShard` |  | Terracotta shard: fragment of a pot or jar that breaks (propKid, 04b-physprops.js). | 02k-dynprops |
| `bottle` | h = 0.26 | Glass bottle (body and neck), tint of the stamp | 02k-dynprops |

**Setup: chairs facing their table, ski rack**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `snowball` |  | Snowball: radius-1 sphere, scaled (the snowman's bottom: 0.4; its middle: 0.3; its head: 0.2) | 02k-dynprops |
| `snowHat` |  |  | 02k-dynprops |
| `carrot` |  |  | 02k-dynprops |
| `scarf` |  |  | 02k-dynprops |
| `twig` |  |  | 02k-dynprops |

**Fisherman's rowboat**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `rowboat` |  | 3.4 m by 1.3 m hull, flat bottom, raised bow, transom; white gunwale, two thwarts, two oars. | 02k-dynprops, 02u-portmael (Port-Maël) |

### `src/02l-port.js`

**Boats**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `trawler` | o | Trawler (stern trawling): hull, two-level wheelhouse (raked windows, doors, portholes), mast and radar, stern gantry with net drum, trawl doors, winch, hatch cover, fenders. | 02u-portmael (Port-Maël) |
| `lifeRing` |  | Life ring (orange, white bands), in the xy plane, center at y = 0 | 02l-port |
| `ropeCoil` |  | Coiled rope on the deck | 02k-dynprops, 02l-port, 02ye-cyclades-deco |
| `fishBin` |  |  | 02l-port |
| `fishBinSolid` |  | Physics fish bin, empty (with its collision), and top bin of a pile: ice bed included, collision up to the ice | 02k-dynprops |
| `fishBinIce` |  |  | 02k-dynprops |
| `fishBinStackDyn` | n = 2, k = 0 | Pile of physics bins (on the ground, off the moving boats): same bins and same tints as fishBinStack, dynamic fish | 02l-port, 02u-portmael (Port-Maël), 02yf-notos (Notos) |
| `fishOne` |  | A 30 cm fish, lying down (frame: its center), stamp tint | 02k-dynprops |
| `fishBinStack` | n = 2, k = 0 |  | 02l-port |
| `dinghy` | hull = [0.85, 0.85, 0.82], seed = 1 | Motorboat (5.6 m): open hull, bench, console, outboard motor; to float (floatAdd) or rest on a cradle | 02u-portmael (Port-Maël) |
| `sailboat` | seed = 1 | Sailboat at anchor (distant): white hull, cabin top, mast and boom, furled sail | 02u-portmael (Port-Maël), 02yf-notos (Notos) |
| `bitt` |  | Cast-iron mooring bollard (bollard with a swollen head) on its base plate | 02u-portmael (Port-Maël), 02yf-notos (Notos), 02yj-cirrus (Cirrus) |

**Quay equipment**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `netPile` | seed = 1, w = 2.2, d = 1.6, h = 0.9 | Pile of fishing net: bumpy heap (two net tints), orange floats, headrope; low collision | 02u-portmael (Port-Maël), 02ye-cyclades-deco |
| `lobsterPot` |  | Crustacean pot: lying cylindrical frame, netting, funnel; stacked in rows | 02k-dynprops |
| `lobsterPots` | nx = 3, ny = 2, nz = 2, seed = 1 |  | 02u-portmael (Port-Maël), 02yf-notos (Notos) |
| `buoy` | c = [0.95, 0.42, 0.1], r = 0.3 | Mooring or pot buoy (orange or white sphere and its ring) | 02k-dynprops |
| `quayLadder` | depth = 2.2 | Quay ladder: iron uprights and rungs sealed into the facing (frame: quay face at z = 0, water toward +z) | 02u-portmael (Port-Maël), 02yf-notos (Notos) |
| `lifeRingStand` |  | Life ring post: small post, buoy box, the buoy hanging on it | 02u-portmael (Port-Maël), 02yf-notos (Notos) |
| `quayCrane` | reach = 9 | Unloading crane (quay crane on a pedestal, modeled on photos of lattice-boom harbor cranes): bolted base plate, conical pedestal, slewing ring, rotating platform with the machinery room, the... | 02u-portmael (Port-Maël) |
| `gantryCrane` | w = 11, L = 25, H = 10 | Handling gantry (boat lift) straddling the basin: four legs on wheels, two beams along z, hoists and straps. | 02u-portmael (Port-Maël) |
| `iceMachine` |  | Flake ice machine (modeled on photos of auction hall machines): feet, stainless steel ice bin with panels and hatch, evaporator drum and its gear motor, condensing unit with two screened fans,... | 02u-portmael (Port-Maël) |
| `marketStall` | seed = 1 | Auction stall (2.4 x 1.1 m): stainless steel table on trestles, bed of ice and fish, price slate or scale | 02u-portmael (Port-Maël) |
| `dial` |  | Sales dial: suspended light box, two faces (frame: center of the box) | 02u-portmael (Port-Maël) |
| `conveyor` | L = 10 | Sales belt (auction hall belt conveyor, from photos) of length L along x, height 0.9 m: U-shaped side rails, drums at both ends, belt on top and return run below, braced adjustable feet, low railing... | 02u-portmael (Port-Maël) |
| `coldRoom` | w = 4, d = 3, h = 3 | Cold room in insulated panels (from photos): white panels with vertical joints on all four faces, aluminum angle trim on the edges, sliding door with seal and handle, rail, stainless steel baseboard,... | 02u-portmael (Port-Maël) |
| `icePallet` |  | Pallet of ice bags (shrink-wrapped) | 02u-portmael (Port-Maël) |

### `src/02p-plants.js`

**Broadleaf trees**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `tree` | kind, h = 9, r = 3.4, seed = 1, o = {} | Tree: kind, h (total height), r (crown radius), seed; o: shape ('round', 'spread', 'tall'), th (bare trunk height), lean, n (cards), trunk ('bark'), sz (card size) | 02r-greenhouse, 02v-floralia (Floralia), 02w-gardens, 02y-paris, 02yj-cirrus (Cirrus), 02yn-belhorizon (Bel-Horizon) |
| `willow` | h = 8, r = 3.4, seed = 1 | Weeping willow: light crown and curtain of strands that hang down to the water | 02w-gardens |

**Palms, tree ferns, banana plants, bamboos**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `palmG` | h = 6, seed = 1, kind = 'palm' | Green palm: ringed, curved stipe, crown of V-shaped fronds that droop. | 02r-greenhouse |
| `treeFern` | h = 2.4, seed = 1 | Tree fern: brown fibrous stipe, dense crown of large fronds | 02r-greenhouse, 02w-gardens |
| `banana` | h = 3.2, seed = 1 | Banana plant: green false trunk, large torn leaves that droop | 02r-greenhouse |
| `bamboo` | n = 7, h = 7.5, seed = 1 | Bamboo clump: smooth ringed culms, drooping branches and leaves. | 02w-gardens |

**Understory plants and flower beds**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `fern` | kind = 'fernA', s = 1, seed = 1, n = 9 | Ground fern: about ten fronds that droop. | 02r-greenhouse, 02w-gardens |
| `rosette` | kind = 'monstera', atlas = 'leafA', size = 1, n = 6, seed = 1, o = {} | Rosette of large upright leaves (monstera, alocasia, philodendron, dwarf banana, calathea, hosta...): n cards tilted outward | 02r-greenhouse, 02w-gardens, 02ypb-outpost-jungle |
| `clump` | kind = 'grass', atlas = 'leafB', w = 0.7, h = 0.6, n = 3, seed = 1, o = {} | Tuft of crossed cards (flowers, grasses, lavender, tulips...): n vertical cards of width w and height h around the axis | 02q-garden, 02r-greenhouse, 02v-floralia (Floralia), 02w-gardens, 02ypb-outpost-jungle |
| `liana` | w = 1.4, h = 2.6, seed = 1 | Hanging vine (sprite A, attached at the top): vertical card of width w, height h, from the ground y = 0 to the attachment point y = h | 02r-greenhouse |
| `hanging` | kind = 'wisteria', w = 1.0, h = 2.4, seed = 1 | Ivy or wisteria pressed flat: same principle, hanging from a horizontal support (sprite B) | 02w-gardens |
| `reeds` | h = 2.0, seed = 1 | Reeds, papyrus, cattails: tall crossed cards | 02w-gardens |
| `papyrus` | h = 2.4, seed = 1 |  | 02r-greenhouse |
| `lilies` | r = 2, n = 9, seed = 1, flowers = 0.35 | Water lilies: leaves lying flat on the water (sprite A, 2 x 2 cell: large leaves and flowers), n cards within a radius r | 02r-greenhouse, 02w-gardens |

### `src/02q-garden.js`

**Hedges, topiaries, furniture**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `topiary` | kind = 'cone', s = 1 | Topiary in a stone pot: cone, ball, spiral or cube of boxwood, h height of the foliage | 02v-floralia (Floralia) |
| `gbench` |  | Park bench: wooden slats on cast-iron sides, backrest. | 02q-garden |
| `urn` | kind = 'roseP', atlas = 'leafB', s = 1 | Stone urn on a pedestal, with its plant (kind: PF.clump sprite) | 02w-gardens |

**Plant scatter**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `toro` | s = 1 | Japanese stone lantern (tōrō): base, shaft, fire chamber, roof, ball | 02w-gardens |

### `src/02r-greenhouse.js`

**Rockery: blocks, walls**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `rockG` | seed = 1, rx = 1.2, ry = 1, rz = 1.2 | Faceted rock block (like PF.boulder) in the rockery material: pinkish ochre sandstone, tint of your choice | 02r-greenhouse, 02w-gardens, 02ypb-outpost-jungle |

### `src/02v-floralia.js` (Floralia)

**Bases: the Orangerie and the gardeners' sheds**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `wheelbarrow` |  | Gardener's wheelbarrow: tray, wheel, handles (fixed scenery) | 02v-floralia (Floralia) |

### `src/02w-gardens.js`

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `pine` | h = 4.5, seed = 1 | Cloud-pruned pine (niwaki): twisted trunk, tiers of needle cushions laid flat | 02w-gardens |

**Lawns, promenade, path, enclosure**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `gardenLamp` | lit = litOn() | Park street lamp in dark green cast iron: ornate base, fluted shaft, faceted lantern, spire | 02w-gardens |

### `src/02y-paris.js`

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `farLamp` | lit = litOn() | Boulevard street lamp: dark green cast-iron shaft, curved bracket, lantern; no collision | 02y-paris |
| `morris` |  | Morris column: green shaft, poster band, dome roof | 02y-paris |

### `src/02ye-cyclades-deco.js`

**Trees**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `cyOlive` | h = 4.4, seed = 1 | Olive tree: gnarled trunk that divides into three main limbs, silvery crown in three masses | 02yf-notos (Notos) |
| `cyCypress` | h = 8, seed = 1 | Cypress: dark, tight flame | 02yf-notos (Notos) |
| `cyTamarisk` | h = 3.8, seed = 1 | Tamarisk: pale twisted trunk, long hanging blue-green plumes | 02yf-notos (Notos) |
| `cyFig` | h = 4.4, seed = 1 | Fig tree: short trunk, wide dome of large lobed leaves | 02yf-notos (Notos) |
| `cyPlane` | h = 10.5, seed = 1 | Plane tree of the square: pale, massive trunk, vast crown; its shadow is baked into the lighting | 02yf-notos (Notos) |

**Plants**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `cyAgave` | s = 1 |  | 02yf-notos (Notos) |
| `cyOpuntia` | s = 1 |  | 02yf-notos (Notos) |
| `cyBush` | s = 1, seed = 1 | Tuft: variety chosen by the seed (geranium, rosemary, oleander, lavender) | 02yc-cyclades-buildings, 02yf-notos (Notos), 02yl-sirocco (Sirocco) |
| `cyGrass` | s = 1 |  | 02yl-sirocco (Sirocco) |
| `cyClimber` | kind, w = 2.2, h = 2.6 | Climbing plant on a wall (facade frame): bougainvillea, jasmine, vine or ivy | 02yc-cyclades-buildings, 02ye-cyclades-deco |
| `cyJasmine` | w = 1.8, h = 2.4 |  |  |

**Pots, tavern furniture**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `cyPot` | kind = 0 | Flowering terracotta pot: kind 0 geranium, 1 rosemary, 2 dwarf agave, 3 jasmine | 02ye-cyclades-deco |
| `cyUmbrella` | c = [0.95, 0.95, 0.92] | Tavern parasol: pole, white and blue canvas; no collision (the canvas is above head height). | 02yf-notos (Notos) |

**Boats and seaside**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `cyKaiki` | o = {} | Caique: painted wooden hull with a high stem, waterline stripe, plank deck, small wheelhouse, masthead light, nets. | 02ye-cyclades-deco, 02yf-notos (Notos) |
| `cyCat` | seed = 1 | Seated cat (from behind, turned toward ry): coat from the seed | 02yf-notos (Notos) |

### `src/02yg-scoria-kit.js`

**Objects**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `tpHeli` |  | Station helicopter (light single-turbine), parked, nose toward -z: white fuselage, tail boom and outro in the team color (paint), canopy, skids, stopped rotor. | 02yh-scoria (Scoria) |

**Furniture and instruments of the research center (local frame: y up, front face toward +z)**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `tpBench` |  | Central laboratory bench (2.9 x 1.4 m island, double-sided): low cabinets on both sides, black resin top, reagent shelf in the middle and its flasks, a microscope on one side, a scale on the other | 02yh-scoria (Scoria) |
| `tpHood` |  | Fume hood (1.6 m wide): low cabinet, cheeks, raised glass, interior lighting, extraction duct |  |
| `tpConsole` | len | Control desk (len along x, 1 m deep): cabinet, top, row of lit screens facing +z | 02yh-scoria (Scoria) |
| `tpRack` |  | Server rack (0.6 x 0.7 m, 2.1 m high): dark perforated door, indicator lights (screen strips) | 02yh-scoria (Scoria) |
| `tpDrums` |  | Drum recorders (seismographs) on their table: base, paper drum, glass cover; 1.8 m along x | 02yh-scoria (Scoria) |
| `tpBunk` |  | Bunk beds (2 x 0.9 m): steel frame, mattresses, ladder | 02yh-scoria (Scoria) |
| `tpGps` |  | GPS antenna for deformation monitoring: concrete pillar, disc antenna under its radome, cabinet and solar panel | 02yh-scoria (Scoria) |
| `tpWeather` |  | Weather mast (6 m): cup anemometer, wind vane, louvered shelter, solar panel, guy wires | 02yh-scoria (Scoria) |
| `tpGas` |  | Gas measurement station (near the fumaroles): pole, analyzer cabinet, air intake, solar panel | 02yh-scoria (Scoria) |

### `src/02yi-cirrus-kit.js`

**Objects**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `stColumn` | h = 4, broken = false, seed = 1 | Stone ruin column: plinth, fluted shaft, capital; h: height; broken: shaft broken at a bevel (no capital). | 02yj-cirrus (Cirrus) |
| `stBlock` | w = 1.4, h = 0.9, d = 0.8, seed = 1 | Block of cut stone (fallen from a ruin): low cover | 02yj-cirrus (Cirrus) |
| `stRock` | s = 1.6, seed = 1, squash = 0.75 | Rock: irregular block of layered rock (rockMesh), collision of its tightened box; s: size (m), squash: flattening | 02yj-cirrus (Cirrus) |
| `stCrystals` | h = 1.6, seed = 1 | Cluster of crystals planted in the ground (pale blue, self-luminous); h: height of the tallest | 02yj-cirrus (Cirrus) |
| `stSpire` | h = 5, r = 1.4, seed = 1 | Rock spire (h: height, r: radius at the base): large block of layered rock that cuts the views from one island to another; collision of its shaft, tightened | 02yj-cirrus (Cirrus) |
| `stMenhir` | h = 3.6, w = 1.2, seed = 1 | Standing stone (menhir): upright block, slightly leaning, of the ruins' stone | 02yj-cirrus (Cirrus) |
| `stStele` | w = 4.6, h = 3.6, d = 0.9, seed = 1 | Stele: large stone slab standing at a bridgehead (it blocks the view from one end of the archipelago to the other, you walk around it), a crystal set in each face; w: width, h: height, d: thickness. | 02yj-cirrus (Cirrus) |
| `stRuinWall` | L = 4, h = 2.28, seed = 1, br = 0.55 | Ruined wall: a stretch of ashlar wall 0.7 m thick, along local x (from -L/2 to L/2), whose top is broken course by course (0.38 m): h at the start, about half of it at the end, the break starting at... | 02yj-cirrus (Cirrus) |
| `stTrilithon` | seed = 1 | Trilithon: two standing stones and their lintel (you pass underneath) | 02yj-cirrus (Cirrus) |
| `stTent` | col, w = 3.2, L = 4.2, h = 2.4 | Expedition tent: canvas stretched over a ridge (two slopes down to the ground, closed gables), in the camp's color; stops bullets and soldiers (w: width, L: length, h: ridge). | 02yj-cirrus (Cirrus) |
| `stCrateStack` | seed = 1 | Crate pile: two at the bottom, one on top (high cover) | 02yj-cirrus (Cirrus) |

### `src/02yk-sirocco-kit.js`

**Sandstone massifs**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `smScree` | seed = 1 | Scree: two to four small angular blocks of sandstone fallen from the wall (30 cm at most), no collision | 02yk-sirocco-kit |
| `smRock` | s = 1.6, seed = 1, squash = 0.75 | Isolated sandstone rock (cover): block cut into facets, collision of its tightened box; s: size (m), squash: flattening | 02yk-sirocco-kit, 02yl-sirocco (Sirocco) |

**Desert objects**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `smFire` |  | Fire pit: ring of blackened stones, dead embers, pot on three stones | 02yl-sirocco (Sirocco) |
| `smBedouin` | w = 7, d = 4.4, seed = 1 | Bedouin tent: low, wide roof in strips of dark wool (a light band from time to time), sagging between the posts, raised at the front (the open side, +z), closed at the back and on the sides down to... | 02yl-sirocco (Sirocco) |
| `smReeds` | s = 1 | Reed tuft (Notos atlas) | 02yl-sirocco (Sirocco) |
| `smAcacia` | h = 4.6, seed = 1, dead = false | Acacia (umbrella tree of the wadis): twisted trunk, flat crown in a sheet, no leaves below (you can see under it) | 02yl-sirocco (Sirocco) |
| `smPalmFar` | h = 8, seed = 1 | Distant palm tree prefab (few vertices, no collision or shadow of its own): same fronds as PF.palm, in three segments; trunk more or less thick and crown more or less large depending on the seed | 02yl-sirocco (Sirocco) |
| `smCart` |  | Handcart (wood, two solid wheels on an axle), resting on its shafts; collisions of the bed and the wheels, and a low box under the shafts (you step over it, you no longer bump into it). | 02yl-sirocco (Sirocco) |

**The airliner wreck**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `smSeats3` |  | Block of three cabin seats (frame: the floor, the middle of the block; looking toward +x): navy blue seat and back, headrest with a gray and white striped cover on the back, gray-green armrests,... | 02yk-sirocco-kit |
| `smPilotSeat` |  | Pilot seat (toward +x): base, anthracite seat and back, light sheepskin cover, headrest, armrests | 02yk-sirocco-kit |
| `smJetEngine` |  | Turbofan engine torn off its pylon (frame: the sand under it, the air intake toward +x): gray nacelle, fan and cone, nozzle and exhaust cone, the torn pylon above; sunk by 12 cm; one collision | 02yk-sirocco-kit |
| `smULD` | seed = 1 | Airliner cargo container (LD3) thrown out of the hold, that the storm has uncovered (frame: the sand under it): aluminum box 1.53 m deep (x), 1.56 m wide at the base and 2 m at the top, the contoured... | 02yl-sirocco (Sirocco) |

### `src/02ym-houses-kit.js`

**Street and gardens**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `fdBin` | lid = [0.98, 0.78, 0.12] | Wheeled bin (anthracite gray tub, lid in the collection color) | 02ym-houses-kit |
| `fdMailbox` |  | Post-mounted mailbox (beige plastic, as in the photos) | 02yn-belhorizon (Bel-Horizon) |
| `fdLamp` | lit = litOn() | Development street lamp: tapered gray pole, flat lantern; lit (by default according to the ambience, litOn): glowing diffuser and warm-white LED light baked under the lantern, folded toward the ground | 02yn-belhorizon (Bel-Horizon) |
| `fdPool` | r = 2.2 | Above-ground pool with tubular frame (diameter 2 r, 1.22 m high): light blue liner, PVC coping, posts, ladder; the water is placed separately (pondAdd, basin you can enter), and so are its collisions... | 02yn-belhorizon (Bel-Horizon) |
| `fdTrampoline` | r = 1.8 | Trampoline with safety net: frame and mat at 0.8 m, foam posts, taut net; collisions separate (fdNetCols: the net stops soldiers, but not shots or sight) | 02yn-belhorizon (Bel-Horizon) |
| `fdShed` | w = 2.2, d = 2.0, tint = [0.62, 0.52, 0.4] | Garden shed in wood-effect PVC (w x d, double door on the +z face), gable roof in steel sheeting | 02yn-belhorizon (Bel-Horizon) |
| `fdSwing` |  | Garden swing set: green steel tube frame (3 m), two seats; only the feet stop you | 02yn-belhorizon (Bel-Horizon) |
| `fdDryer` |  | Umbrella clothes dryer: pole, four arms, lines (the laundry, simulated cloth, is hung at placement: fdDryerLaundry) | 02yn-belhorizon (Bel-Horizon) |
| `fdGardenTable` |  | Round white resin garden table and its folded parasol (physical prop, fdGardenTable) | 02ym-houses-kit |
| `fdChair` |  | White molded resin armchair (physical prop, fdChair): seat, reclined back, four legs, armrests; front toward +z | 02ym-houses-kit |
| `fdBbq` |  | Kettle barbecue on a tripod | 02ym-houses-kit |
| `fdTri` | tint, sign | Recycling drop-off container (glass, paper): metal tub 1.5 x 1.5 x 1.7, domed roof, openings, pictogram | 02yn-belhorizon (Bel-Horizon) |
| `fdTransformer` |  | Transformer station: beige concrete cabin, metal doors, vents, "danger of death" sign | 02yn-belhorizon (Bel-Horizon) |
| `fdSlide` |  | Wooden garden slide: small tower (floor at 1 m) closed with planks, ladder on the -x side, tarped sandbox at the foot, wavy lime-green 2 m slide toward +z; under the slide, stepped collisions | 02yn-belhorizon (Bel-Horizon) |
| `fdSofa` | tint = [0.52, 0.5, 0.48] | Sofa (moving house): gray fabric, armrests | 02yn-belhorizon (Bel-Horizon) |
| `fdMupi` |  | Advertising panel (street furniture): backlit 1.3 x 2 m panel on a post, the poster of the last lots on both sides | 02yn-belhorizon (Bel-Horizon) |
| `fdCaravan` |  | Parked caravan (5.6 m, white body with stripe, windows, door, drawbar, wheels); front: drawbar toward -z | 02yn-belhorizon (Bel-Horizon) |
| `fdBall` | c = [0.9, 0.2, 0.15] | Child's plastic ball (physical prop, fdBall, a: its color; it rolls, bullets push it). | 02ym-houses-kit |
| `fdGnome` |  | Ceramic garden gnome (physical prop, fdGnome: it falls, and shatters into pieces under bullets): pointed red cap, white beard, blue jacket, green base | 02ym-houses-kit |

**Building Site**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `fdMixer` |  | Site cement mixer (physical prop, fdMixer): A-shaped red tube frame on two wheels and two feet, tilted orange drum on its fork, motor, tilting handwheel; wheels toward +z | 02ym-houses-kit |
| `fdWheelbarrow` |  | Site wheelbarrow (physical prop, fdWheelbarrow): flared, open galvanized sheet-metal tray, a bit of sand inside, tube handles resting on the wheel (front, +z) and on two feet at the back, black grips | 02ym-houses-kit |
| `fdBlockPallet` |  | Shrink-wrapped pallet of cinder blocks (1.2 x 1.0, 1 m) | 02yn-belhorizon (Bel-Horizon) |
| `fdSkip` |  | Site skip (3.6 x 1.8): yellow sheet metal, flared sides, rubble | 02yn-belhorizon (Bel-Horizon) |
| `fdToilet` | tint = [0.2, 0.42, 0.68] | Site toilet cabin (1.2 x 1.2 m, 2.3 m high): molded plastic shell with vertical ribs, white roof, door on the front (+z) with its free/occupied latch, vent pipe at the back; one solid collision | 02yn-belhorizon (Bel-Horizon) |

### `src/02yoa-outpost-props.js`

**Upper floor: office kit (sheet 2)**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opDesk` | w = 1.6, d = 0.8, ped = 2, tone = 1 | 01 Office desk (w x d, 0.75 m): warm wood top, olive steel drawer pedestals (o.ped: 2 sides, 1, 0), modesty panel | 02yo-outpost-building, 02yoa-outpost-props |
| `opSwivel` |  | 02 Swivel chair: five-star base on casters, gas column, olive seat and backrest, armrests; seated facing +z. | 02yo-outpost-building |
| `opVisitor` | arms = true | 03 Visitor chair (also the briefing chair, sheet item 13): black steel tube frame, olive seat and back; facing +z. | 02yo-outpost-building |
| `opMonitor` | scr | 04 Monitor (0.6 m, on a desk): black stand, bezel, lit screen (atlas cell scr); 05 keyboard and mouse in front; 06 computer tower (o.tower: beside, on the floor: dx) | 02yo-outpost-building |
| `opTower` |  |  | 02yo-outpost-building |
| `opTaskLamp` |  | 07 Task lamp: weighted base, two arms, shade with a lit bulb (no light of its own: the room's fittings light it) | 02yo-outpost-building |
| `opFiling` |  | 08 Filing cabinet: four olive drawers with handles and label holders (0.46 x 0.62, 1.32 m) | 02yo-outpost-building |
| `opBookcase` | w = 1.2, seed = 0 | 09 Bookcase (w, 1.8 m, 0.4 deep): olive steel shelves, binders in colors, file boxes (collision placed with it, like the shelving) | 02yo-outpost-building |
| `opMapBoard` | w = 2.0, h = 1.2, cell = OPS.mapW | 10 Wall map board (2.0 x 1.2): the jungle terrain map in a wooden frame; 11 whiteboard (1.8 x 1.2): aluminum frame, marker tray | 02yo-outpost-building |
| `opWhiteboard` |  |  | 02yo-outpost-building |
| `opPlanTable` | L = 2.0, D = 1.0, map = true | 12 Planning table (2.0 x 1.0, 0.75 m): wood top, steel legs and stretcher, the terrain map laid on it, rolled maps | 02yo-outpost-building |
| `opRadioConsole` |  | 14 Radio console (1.8 x 0.8): desk with olive radio sets (front panels from the atlas, knobs), handset, headset, microphone | 02yo-outpost-building |
| `opRack` |  | 15 Equipment rack (0.6 x 0.8, 1.8 m): black cabinet, perforated door frame, units with indicator lights | 02yo-outpost-building |
| `opLocker` | n = 2, dw = 0.45, h = 1.8 | 16 Storage locker (n doors of dw, h high: 1.8 m upstairs, 2.0 m for the hall's three-door one, 0.5 deep): olive, louvered vents, handles | 02yo-outpost-building, 02ypa-outpost-tower |
| `opClock` |  | 17 Wall clock (0.4 m): black rim, face from the atlas | 02yo-outpost-building, 02ypa-outpost-tower |
| `opBin` |  | 18 Waste bin (0.28 m, 0.32 high): black wire-mesh basket | 02yo-outpost-building, 02ypa-outpost-tower |
| `opCeilLight` | L = 1.2 | 19 Ceiling light, LED strip (1.2 x 0.18 x 0.08): hung under the ceiling (origin at the ceiling, body below), lit diffuser | 02yo-outpost-building, 02ypa-outpost-tower |
| `opWallStrip` | L = 0.9 | Wall strip light (L x 0.1, back at z = 0): dark housing, lit diffuser | 02yo-outpost-building |
| `opMiniCrate` |  | Small olive crate of the reception counter (0.35 x 0.25, 0.25 m): lid seam, dark corners, a latch | 02yo-outpost-building |
| `opVent` | w = 0.4, h = 0.3, tint = [0.86, 0.86, 0.84] | 20 Wall vent (0.4 x 0.3): frame and slanted louvers | 02yo-outpost-building |
| `opKitchen` | w = 1.6, front = false | 21 Kitchenette counter (w x 0.6, 0.9 m): olive base cabinets, steel top with its inset basin and faucet, wall cabinet; 22 mini fridge (0.55 x 0.6, 0.85 m) | 02yo-outpost-building |
| `opFridge` |  |  | 02yo-outpost-building |
| `opToilet` |  | 23 Toilet (white ceramic bowl, seat and lid, cistern against the wall at z = 0); 24 handwash basin, faucet, mirror (wall-mounted) | 02yo-outpost-building |
| `opBasin` |  |  | 02yo-outpost-building |

**Ground floor: hall kit (sheet 3)**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opReception` | w = 2.4 | 1 Reception desk (2.4 x 0.8, 1.1 m): concrete-look front with an olive kick strip, warm wood counter top, work top behind at 0.75 | 02yo-outpost-building |
| `opPrepTable` |  | 3 Preparation table (2.4 x 1.2, 0.9 m): galvanized steel frame and top, green work mat, lower shelf; small crates on the shelf, one on the mat | 02yo-outpost-building |
| `opBench` | L = 2.0 | 4 Bench (L x 0.4, 0.45 m): wooden seat on two steel frames | 02yo-outpost-building |
| `opWorkbench` | L = 2.4 | 5 Workbench (L x 0.8, 0.9 m): thick wood top, olive drawer cabinets under both ends, back rail; vise | 02yo-outpost-building |
| `opPegboard` |  | 6 Tool pegboard (1.8 x 0.9, wall-mounted, centered at its middle): perforated gray board, wrenches, pliers, hammers, yellow bins | 02yo-outpost-building |
| `opShelving` | L = 1.8, h = 1.3, d = 0.6 | 7 Steel shelving (L x d, h: 1.3 m in the hall): galvanized posts and shelves, olive crates on each level (medium ones, or small ones turned, on a deep shelf; small ones lengthwise on a shallow one). | 02yo-outpost-building |
| `opAmmo` | k = 0 | 8, 9 Olive ammunition crates: 0 large (1.2 x 0.8 x 0.6), 1 small (0.6 x 0.4 x 0.4), 2 medium (0.6 x 0.5 x 0.35): ribbed lid, handles, latches, yellow stencil bands | 02yo-outpost-building, 02yoa-outpost-props, 02yp-outpost-yard |
| `opCart` |  | 11 Rolling cart (1.2 x 0.6, 0.9 m): two steel shelves on casters, push handle | 02yo-outpost-building |
| `opHandTruck` |  | 12 Hand truck (dolly), leaning: yellow frame, nose plate, two wheels. | 02yo-outpost-building |
| `opFirstAid` |  | 13 First aid cabinet (0.45 x 0.55, wall-mounted, centered); 14 fire extinguisher on its bracket (wall-mounted, bottom at y = 0); 15 electrical panel | 02yo-outpost-building, 02ypa-outpost-tower |
| `opExtinguisher` |  |  | 02yo-outpost-building, 02ypa-outpost-tower |
| `opElecPanel` |  |  | 02yo-outpost-building |
| `opSink` |  | 16 Utility sink (0.9 x 0.6, 0.9 m): stainless basin on legs, faucet; 17 water cooler (0.35 x 0.35, 1.3 m with its blue bottle); 18 industrial waste bin (0.4 x 0.4, 0.8 m, olive with lid) | 02yo-outpost-building |
| `opCooler` |  |  | 02yo-outpost-building |
| `opWasteBin` |  |  | 02yo-outpost-building |
| `opHeater` |  | Water heater of the utility annex (0.5 m across, 1.5 m): white enamel tank on three feet, two pipes up the wall, a small control box | 02yo-outpost-building |
| `opPlant` |  | Potted plant (0.75 m): grey pot, long green leaves | 02yo-outpost-building |
| `opMapStand` |  | Stand of rolled maps (0.4 x 0.4, 0.8 m): open wooden box, five rolls standing in it | 02yo-outpost-building |
| `opFan` |  | 20 Wall fan (wall-mounted, back at z = 0): bracket, motor, blades in a wire cage | 02yo-outpost-building |
| `opDrain` |  | 22 Floor drain (0.5 x 0.5): steel grate on a dark sump, flush with the floor | 02yo-outpost-building |

**Exterior and roof equipment**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opAcBig` | w = 1.9, d = 1.3, h = 0.95 | Rooftop AC unit (w x d, h; the main one 1.9 x 1.3, 0.95 m): grey-beige casing, horizontal louvers on the long sides, fan grille on top, base rails | 02yo-outpost-building |
| `opMast` |  | Telecom mast (about 3.4 m with its antennas): three-legged lattice, three sector panel antennas, a small dish, cable ladder | 02yo-outpost-building |
| `opHatch` |  | Roof hatch box (1.0 x 1.0, 0.55 m): concrete upstand, olive steel lid, hinges, latch |  |
| `opWallLamp` |  | Bulkhead wall lamp over a door (wall-mounted): dark housing, lit lens below | 02yo-outpost-building, 02ypa-outpost-tower |
| `opElecBox` | down = 1.0 | Exterior electrical cabinet (0.55 x 0.75, wall-mounted, bottom at y = 0): gray steel, warning pictogram, conduits down into the ground | 02yo-outpost-building |

### `src/02yp-outpost-yard.js`

**Props**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opyCrate` | w = 1.2, h = 0.6, d = 0.8, v = 0 | Olive supply crate (1.2 x 0.6 x 0.8 or 0.6 x 0.4 x 0.4) | 02yp-outpost-yard, 02ypa-outpost-tower |
| `opyLocker` |  | Steel locker (0.6 x 0.45, 1.85 m), olive; door toward +z: louvers, handle |  |
| `opyCot` |  | Folding army cot (2 x 0.72 m): olive canvas bed, steel X legs, folded blanket and pillow at one end | 02ypa-outpost-tower |
| `opyRadio` |  | Field radio set (on a table): olive case, dial panel, handset on its cord, whip antenna | 02ypa-outpost-tower |
| `opyPhone` |  | Field telephone: olive box with its crank, handset on the cradle | 02ypa-outpost-tower |
| `opySearchlight` | post = 1.3 | Searchlight on its post (post m): steel tube, a U-yoke on a turntable, the drum with its bezel and glass face, its cable; aimed toward +z, slightly down | 02ypa-outpost-tower |
| `opyBinoculars` |  | Binoculars set down on a ledge | 02ypa-outpost-tower |
| `opyChair` |  | Folding steel chair (olive): seat, back, tube legs | 02ypa-outpost-tower |
| `opyTable` | w = 1.2, d = 0.7 | Field table (1.2 x 0.7 m): olive steel frame, plywood top | 02ypa-outpost-tower |
| `opyShelf` | w = 1.8, h = 1.85, seed = 1, dbl = false | Steel shelving (w along x, 0.5 deep, h high), four levels loaded with boxes, crates, cans and jerrycans (seeded) | 02ypa-outpost-tower |
| `opyWorkbench` |  | Workbench (2.4 x 0.8 m): thick plank top, olive steel drawers, vise, tools, pegboard behind (toward -z) | 02ypa-outpost-tower |
| `opyFlood` |  | Floodlight pole (7 m): galvanized tapered pole on a concrete footing, crossbar with two lamps aimed toward +z, junction box | 02yp-outpost-yard |
| `opyTarpStack` |  | Tarped stack: two pallets end to end, two crates high (the building's ammunition crates), under an olive canvas tarp that sags between them and hangs in folds down the sides, lashed with a rope; mud... | 02yp-outpost-yard |
| `opyGenset` |  | Generator set on its skid (1.4 x 1.5 m, 1.75 m to the top of its hood; the exhaust to 2 m): olive enclosure with louvres, a door panel and its latches, the exhaust stack with its rain cap, a lifting... | 02yp-outpost-yard |
| `opyDrumRack` |  | Drum rack (the water tank's footprint, 2.2 x 2.2 m): a low steel frame with two tiers of drums, a third on top in one corner | 02yp-outpost-yard |
| `opyWaterTank` |  | Water tank on its steel stand: 2.3 m vertical olive drab tank (matte paint) on a 1.6 m platform, ladder, outlet pipe and tap | 02yp-outpost-yard |
| `opyBooth` |  | Guard booth (1.9 x 1.9 m): olive corrugated walls, window band on three sides, door on the back (-z), flat roof with an overhang; closed: a block of cover (its glass stops soldiers, not shots) | 02yp-outpost-yard |
| `opyBarrier` |  | Barrier arm (5.5 m) raised on its post: concrete footing, olive housing, red and white pole at about 80 degrees, counterweight | 02yp-outpost-yard |

**Static cover pieces (one collision each)**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opyJersey` | len | Jersey barrier (len m, along z): mid-grey weathered concrete, drip stains running down from the top, mud splashed up its foot in the earth's colour (a soft gradient, 10 to 25 cm) | 02yp-outpost-yard |

### `src/02ypa-outpost-tower.js`

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opyCooler` |  | Water cooler (sheet 3 item 17): white cabinet, smooth blue bottle upside down on top, two taps | 02ypa-outpost-tower |

### `src/02ypb-outpost-jungle.js`

**Leaf masses**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opjMass` | r, h, seed, deep, near | Leaf mass r (radius), h (height): an ellipsoid sitting on the ground (squashed at random: no round outline), its lower half widened to a cylinder (a skirt of leaves down to the ground; now and then a... | 02ypb-outpost-jungle |
| `opjTree` | h, r, seed, th, lite | Broadleaf canopy tree (h, crown radius r, bare trunk th; lite: no branches, fewer cards): a leaning trunk forking into three to five clumps of foliage round the top, each a small mass of tilted and... | 02ypb-outpost-jungle |
| `opjTrunk` | h, seed | Bare trunk of the second row (h m): the stem of a tree whose crown is lost in the canopy above, a fork near the top | 02ypb-outpost-jungle |

**Plants of the jungle's edge**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opjBanana` | h = 3.2, seed = 1, leaf = 0 | Banana plant: olive false trunk, large torn leaves that droop (PF.banana on the jungle's sprites) | 02ypb-outpost-jungle |
| `opjFern` | s = 1, seed = 1, n = 9 | Ground fern: fronds that arch out from the crown and droop (PF.fern on the jungle's sprites), one in three darker | 02ypb-outpost-jungle |
| `opjFan` | h = 1.8, seed = 1 | Fan palm: a short ringed trunk, fan leaves on long stalks, held up and out, the old ones hanging | 02ypb-outpost-jungle |

**Open-ground cover**

| Prefab | Parameters | Description | Placed in |
| --- | --- | --- | --- |
| `opjPalm` | h = 10, seed = 1, kind = 'palm' | Coconut palm: a stipe about 0.38 m thick at the foot, leaning and curving; a crown 6 to 7 m wide of 14 pinnate fronds (upright, spreading, drooping) and two dead ones hanging brown; there are many of... | 02ypb-outpost-jungle |

## Physics props

Objects that fall, roll and shatter (`propType`, README "Physics props").

| Type | Prefab | Mass (kg) | Sound | File |
| --- | --- | --- | --- | --- |
| `fruitBox` | `fruitBox` | 1.4 | wood | `src/02k-dynprops.js` |
| `fruit` | `fruitBall` | 0.2 | fruit | `src/02k-dynprops.js` |
| `shard` | `potShard` | 0.05 | clay | `src/02k-dynprops.js` |
| `pot` | `pot` | 6 | clay | `src/02k-dynprops.js` |
| `jar` | `jar` | 7 | clay | `src/02k-dynprops.js` |
| `spiceSack` | `spiceSack` | 9 | soft | `src/02k-dynprops.js` |
| `sandbagLow` | `sandbag` | 12 | soft | `src/02k-dynprops.js` |
| `ropeCoil` | `ropeCoil` | 6 | soft | `src/02k-dynprops.js` |
| `chair` | `chair` | 2.5 | plastic | `src/02k-dynprops.js` |
| `cafeTable` | `cafeTable` | 6 | metal | `src/02k-dynprops.js` |
| `jerrycan` | `jerrycan` | 1.6 | metal | `src/02k-dynprops.js` |
| `gasBottle` | `gasBottle` | 14 | metal | `src/02k-dynprops.js` |
| `trashBag` | `trashBag` | 3 | soft | `src/02k-dynprops.js` |
| `sled` | `sled` | 6 | wood | `src/02k-dynprops.js` |
| `ski` | `skiOne` | 2.2 | wood | `src/02k-dynprops.js` |
| `skiPole` | `skiPole` | 0.4 | wood | `src/02k-dynprops.js` |
| `table` | `table` | 26 | wood | `src/02k-dynprops.js` |
| `barrel` | `barrel` | 24 | metal | `src/02k-dynprops.js` |
| `sandbag` | `sandbagFat` | 16 | soft | `src/02k-dynprops.js` |
| `sandbagHalf` | `sandbagHalf` | 8 | soft | `src/02k-dynprops.js` |
| `tire` | `tire` | 9 | soft | `src/02k-dynprops.js` |
| `hayBale` | `hayBale` | 22 | soft | `src/02k-dynprops.js` |
| `lobsterPot` | `lobsterPot` | 8 | metal | `src/02k-dynprops.js` |
| `fishBin` | `fishBinSolid` | 1.3 | plastic | `src/02k-dynprops.js` |
| `fishBinIce` | `fishBinIce` | 4 | plastic | `src/02k-dynprops.js` |
| `fish` | `fishOne` | 0.45 | fruit | `src/02k-dynprops.js` |
| `snowman` | `` |  |  | `src/02k-dynprops.js` |
| `snowball` | `snowball` | 900 | snow | `src/02k-dynprops.js` |
| `snowHat` | `snowHat` | 0.3 | soft | `src/02k-dynprops.js` |
| `carrot` | `carrot` | 0.1 | soft | `src/02k-dynprops.js` |
| `scarf` | `scarf` | 0.3 | soft | `src/02k-dynprops.js` |
| `twig` | `twig` | 0.1 | wood | `src/02k-dynprops.js` |
| `rowboat` | `` |  |  | `src/02k-dynprops.js` |
| `fdGardenTable` | `fdGardenTable` |  |  | `src/02ym-houses-kit.js` |
| `fdChair` | `fdChair` |  |  | `src/02ym-houses-kit.js` |
| `fdBbq` | `fdBbq` |  |  | `src/02ym-houses-kit.js` |
| `fdGnome` | `fdGnome` | 4 | clay | `src/02ym-houses-kit.js` |
| `fdMixer` | `fdMixer` |  |  | `src/02ym-houses-kit.js` |
| `fdWheelbarrow` | `fdWheelbarrow` |  |  | `src/02ym-houses-kit.js` |

## Photo surfaces

CC0 photos brought to a common range (`tools/build_assets.py`), one file per surface next to the page, loaded at the launch of the map that asks for it.

| Surface | Photo | Source | License | Maps |
| --- | --- | --- | --- | --- |
| `adobe` | clay_block_wall | Poly Haven | CC0 1.0 | Sirocco |
| `ash` | gravel_stones | Poly Haven | CC0 1.0 | Scoria |
| `ashlar` | seaworn_sandstone_brick | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Floralia |
| `asphalt` | Asphalt021 | ambientCG | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Scoria, Bel-Horizon |
| `bark` | bark_willow_02 | Poly Haven | CC0 1.0 | Floralia, Cirrus, Bel-Horizon |
| `barkw` | pine_bark | Poly Haven | CC0 1.0 | Saint-Givre |
| `boards` | wooden_planks | Poly Haven | CC0 1.0 | Saint-Givre, Port-Maël |
| `brick` | Bricks066 | ambientCG | CC0 1.0 | Chergui, Port-Maël |
| `burlap` | hessian_230 | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Notos, Cirrus, Sirocco |
| `canvas` | Fabric066 | ambientCG | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Notos, Cirrus, Sirocco, Bel-Horizon |
| `cardboard` | Cardboard004 | ambientCG | CC0 1.0 | Chergui, Bel-Horizon |
| `cobble` | cobblestone_floor_001 | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Notos |
| `concrete` | concrete_wall_009 | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Bel-Horizon, Selva |
| `crate` | brown_planks_09 | Poly Haven | CC0 1.0 | Chergui, Port-Maël |
| `dirt` | forest_ground_04 | Poly Haven | CC0 1.0 | Cirrus, Sirocco, Bel-Horizon, Selva |
| `drystone` | stone_wall | Poly Haven | CC0 1.0 | Notos |
| `flagstone` | stone_pathway | Poly Haven | CC0 1.0 | Floralia, Cirrus |
| `humus` | forest_leaves_02 | Poly Haven | CC0 1.0 | Floralia, Cirrus, Selva |
| `lawn` | aerial_grass_rock | Poly Haven | CC0 1.0 | Floralia, Cirrus, Bel-Horizon, Selva |
| `linen` | rough_linen | Poly Haven | CC0 1.0 | Chergui, Port-Maël, Notos |
| `mecha` | green_metal_rust | Poly Haven | CC0 1.0 |  |
| `mechadark` | blue_metal_plate | Poly Haven | CC0 1.0 |  |
| `paintwood` | distressed_painted_planks | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Notos, Bel-Horizon |
| `palmbark` | palm_tree_bark | Poly Haven | CC0 1.0 | Chergui, Sirocco |
| `pathgravel` | gravel_floor_02 | Poly Haven | CC0 1.0 | Floralia, Bel-Horizon, Selva |
| `pavers` | Concrete012 | ambientCG | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Notos, Scoria, Bel-Horizon |
| `pise` | excavated_soil_wall | Poly Haven | CC0 1.0 | Sirocco |
| `plaster2` | clay_plaster | Poly Haven | CC0 1.0 | Chergui, Port-Maël |
| `plaster` | white_plaster_rough_01 | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos, Bel-Horizon |
| `reg` | sandy_gravel_02 | Poly Haven | CC0 1.0 | Sirocco |
| `rock` | rock_face | Poly Haven | CC0 1.0 | Saint-Givre, Port-Maël |
| `rollshutter` | rusty_metal_shutter | Poly Haven | CC0 1.0 | Chergui, Port-Maël, Bel-Horizon |
| `rooftiles` | clay_roof_tiles_03 | Poly Haven | CC0 1.0 | Chergui, Port-Maël, Bel-Horizon |
| `rust` | rust_coarse_01 | Poly Haven | CC0 1.0 | Saint-Givre, Port-Maël |
| `sand` | dense_sand | Poly Haven | CC0 1.0 | Notos, Sirocco, Bel-Horizon, Selva |
| `shingle` | dry_river_pebbles | Poly Haven | CC0 1.0 | Sirocco |
| `shutter` | wood_shutter | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos |
| `slate` | roof_slates_03 | Poly Haven | CC0 1.0 | Saint-Givre, Port-Maël, Floralia, Bel-Horizon |
| `snow` | snow_02 | Poly Haven | CC0 1.0 | Saint-Givre |
| `snowpack` | snow_01 | Poly Haven | CC0 1.0 | Saint-Givre |
| `steel` | Metal062C | ambientCG | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos, Scoria, Sirocco, Bel-Horizon |
| `stone` | rustic_stone_wall_02 | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos, Cirrus, Sirocco |
| `strata` | cliff_side | Poly Haven | CC0 1.0 | Cirrus, Sirocco |
| `timber` | rough_wood | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos, Scoria, Cirrus, Sirocco, Bel-Horizon |
| `vase` | mud_cracked_dry_riverbed_002 | Poly Haven | CC0 1.0 | Sirocco |
| `wood` | weathered_brown_planks | Poly Haven | CC0 1.0 | Chergui, Saint-Givre, Port-Maël, Floralia, Notos, Scoria, Cirrus, Sirocco, Bel-Horizon |
| `woolen` | Fabric031 | ambientCG | CC0 1.0 | Sirocco |

## Procedural surfaces

Generated on the GPU at map load (`TEXLAB`); a photo surface of the same name replaces them.

| Surface | Size (px) | Description | File |
| --- | --- | --- | --- |
| `sand` | 1024 | red desert sand: wind ripples, grains, gravel | `src/02b-texlab.js` |
| `dirt` | 512 | packed earth: stains, fine cracks, pebbles | `src/02b-texlab.js` |
| `concrete` | 512 | poured concrete: pores, clouds, formwork joints | `src/02b-texlab.js` |
| `corrugated` | 512 | galvanized corrugated sheet metal: waves, zinc spangles, rust streaks | `src/02b-texlab.js` |
| `paint` | 512 | painted sheet metal (tinted by vertices): fine flaking, scratches, rust streaks, grime | `src/02b-texlab.js` |
| `carpaint` | 512 | car body paint (tinted): smooth glossy clear coat (5.1, the sky reflects in it), rare dust veils, micro-scratches | `src/02b-texlab.js` |
| `lattice` | 256 | mashrabiya lattice (turned wood): alpha = opacity | `src/02b-texlab.js` |
| `cardboard` | 256 | corrugated cardboard: fibers, adhesive tape, stains | `src/02b-texlab.js` |
| `steel` | 512 | brushed or galvanized steel | `src/02b-texlab.js` |
| `charred` | 512 | burnt and rusted metal (wrecks) | `src/02b-texlab.js` |
| `cement_tiles` | 1024 | souk cement tiles: four-lobed pattern, worn enamel, joints | `src/02b-texlab.js` |
| `canvas` | 512 | awning canvas (tinted): weave, folds, dirt | `src/02b-texlab.js` |
| `burlap` | 512 | burlap of the sandbags | `src/02b-texlab.js` |
| `rubber` | 256 | tire rubber: block treads | `src/02b-texlab.js` |
| `crate` | 512 | crate planks (pine): wood grain, nails, joints | `src/02b-texlab.js` |
| `plastic` | 256 | molded plastic (tinted) | `src/02b-texlab.js` |
| `glass` | 256 | dirty window glass | `src/02b-texlab.js` |
| `gravel` | 512 | flat-roof gravel | `src/02b-texlab.js` |
| `farfacade` | 512 | distant facade: a one-story bay (window, shutters, band) for background silhouettes | `src/02b-texlab.js` |
| `rug` | 512 | woven rug (kilim) for the stalls | `src/02b-texlab.js` |
| `paintwood` | 512 | painted wood of doors and shutters (tinted): vertical planks, flaking paint | `src/02b-texlab.js` |
| `rollshutter` | 512 | shop roller shutter (tinted): horizontal slats, rust, grime | `src/02b-texlab.js` |
| `ashlar` | 1024 | dry-stone rubble (low walls, plinths, ashlar) | `src/02b-texlab.js` |
| `palmbark` | 512 |  | `src/02h-nature.js` |
| `snow` | 1024 | fresh snow: wind ripples (sastrugi), bluish hollows, grain and sparkles (lower roughness) | `src/02i-winter.js` |
| `snowpack` | 1024 | packed snow: footprints, ruts, smooth ice patches, gray slush in places | `src/02i-winter.js` |
| `rock` | 1024 | cliff rock (granite): strata, cracks, lichen | `src/02i-winter.js` |
| `boards` | 512 | larch cladding (horizontal grooved planks): golden brown, grayed by weather, knots | `src/02i-winter.js` |
| `barkw` | 512 | spruce bark: elongated plates, dark cracks (barkw and not bark: the floral map, 02n-flora.js, has its own optional bark under that name; the same name... | `src/02i-winter.js` |
| `slate` | 512 | slates (station roof): staggered rows, irregular edges, blue-gray shades | `src/02i-winter.js` |
| `rust` | 512 | rusted iron (rails, bogies, fittings): flakes, pitting; alpha = mask of sound metal | `src/02i-winter.js` |
| `logend` | 512 | end grain of logs: concentric rings around the tile corner (center of the cut faces), splits | `src/02i-winter.js` |
| `hull` | 512 | painted steel hull (tinted by vertices): welded plates, rust streaks under the scuppers, fender scratches, grime toward the waterline; alpha = metal mask... | `src/02l-port.js` |
| `net` | 256 | fishing net: diamond mesh (alpha = opacity), green or blue nylon thread tinted by vertices | `src/02l-port.js` |
| `crushedice` | 512 | crushed ice of the stalls: translucent shards, shine | `src/02l-port.js` |
| `grating` | 256 | steel grating (walkways): grid of welded flat bars, alpha = opacity | `src/02l-port.js` |
| `ripple` | 512 |  | `src/02m-water.js` |
| `lawn` | 1024 | lawn: blades, tufts, tone varying from lush to dry grass, daisies and buttercups | `src/02n-flora.js` |
| `pathgravel` | 1024 | fine path gravel: light pebbles, dark grains | `src/02n-flora.js` |
| `humus` | 1024 | humus: dark soil, dead leaves, moss patches | `src/02n-flora.js` |
| `bark` | 512 | bark: vertical ridges, dark hollows, lichen patches | `src/02n-flora.js` |
| `hedge` | 512 | trimmed hedge: tight leaves in discs, shadows between the clumps (opaque) | `src/02n-flora.js` |
| `rockery` | 1024 | rockery: ocher sandstone with wavy horizontal strata, fine grain, fine cracks following blocks, low moss patches | `src/02n-flora.js` |
| `haussmann` | 512 | Parisian apartment building facade, one bay of one floor (3.4 m x 3.3 m): cut stone, tall French window with glazing bars, wrought-iron railing | `src/02n-flora.js` |
| `haussrdc` | 512 | ground floor of a bay (3.4 m x 4.2 m): stone rustication, large arched glazed opening or dark door | `src/02n-flora.js` |
| `paving` | 512 | dark paved roadway: square cobbles in staggered rows, dark joints | `src/02n-flora.js` |
| `flagstone` | 1024 | light stone slabs of the paths and copings | `src/02n-flora.js` |
| `slabs` | 1024 | irregular gray-beige schist slabs, with joints painted in lime (in places: the lime flakes off) | `src/02yb-cyclades.js` |
| `limewash` | 512 | brushed lime: thicker brush strokes, microcracks, dust veil; tint by vertices | `src/02yb-cyclades.js` |
| `drystone` | 512 | dry stone: flat rubble stones of varied tints, dark recessed joints, lichens (tinted by vertices) | `src/02yb-cyclades.js` |
| `ash` | 1024 | ash and scoria: black grains, reddish lapilli, a few pale pumice stones, ripples left by the wind | `src/02yg-scoria-kit.js` |
| `basalt` | 1024 | basalt: cooled lava, vesicles, cracks, rust oxidation veil, glassy shards | `src/02yg-scoria-kit.js` |
| `moss` | 512 | woolly moss of the lava fields: gray-green cushions, darker hearts, black gaps | `src/02yg-scoria-kit.js` |
| `panel` | 512 | composite facade panels (tinted by the vertices): 1.2 x 0.6 m layout, recessed joints, dust veil at the foot | `src/02yg-scoria-kit.js` |
| `jacket` | 512 | aluminum pipe sheathing: smooth sheet metal, overlap joints every 0.9 m, dents, streaks | `src/02yg-scoria-kit.js` |
| `vinyl` | 512 | floor of the labs and rooms: 60 cm vinyl tiles, speckles, fine joints, traces of foot traffic | `src/02yg-scoria-kit.js` |
| `lava` | 512 | moving lava: plates of dark crust, incandescent cracks and channels (the material lights itself, see lavaTp) | `src/02yg-scoria-kit.js` |
| `ceiltile` | 512 | drop ceiling: 60 cm mineral tiles (pits, fine cracks), white-lacquered T-grid frame | `src/02yg-scoria-kit.js` |
| `strata` | 1024 | layered rock (sandstone and marl): horizontal bands of uneven tints and thicknesses, wavy, carved joints, cracks, grain | `src/02yi-cirrus-kit.js` |
| `sandstone` | 1024 | red sandstone of the cliffs: beds of uneven thickness, wavy, cross-bedding in each bed, vertical joints specific to each bed, hollowed seams between two beds,... | `src/02yk-sirocco-kit.js` |
| `dune` | 1024 | dune sand: curved wind ripples (long back, steep face), erased in patches, fine grain, shades from ocher to golden | `src/02yk-sirocco-kit.js` |
| `cinderblock` | 512 |  | `src/02ym-houses-kit.js` |
| `opPanel` | 1024 | cast-in-place concrete in 1 m formwork panels (one tile: 2 x 2 panels): smooth faces, fine recessed joints, four tie holes per panel, panel-to-panel shade,... | `src/02yoa-outpost-props.js` |
| `opWallIn` | 512 | inner faces of the concrete walls and the columns: grey-beige painted concrete, faint formwork joints, the lanes of the roller, soft grime clouds (scuffs and... | `src/02yoa-outpost-props.js` |
| `opCeilTx` | 512 | underside of the slabs: the walls' pale concrete, faint joints, grey tie holes (no rust) | `src/02yoa-outpost-props.js` |
| `opWood` | 512 | wood of the tops, bench seats and frames: one matte honey tan, a fine straight grain along u (no clouds, no gloss) | `src/02yoa-outpost-props.js` |
| `opPaintTx` | 512 | drab matte paint on steel (doors, cabinets, lockers, crates), tinted by the vertices: faint mottling, a fine grain, a few small chips down to the primer (no... | `src/02yoa-outpost-props.js` |
| `opSteelTx` | 512 | steel of the stairs, rails, posts and fittings, tinted by the vertices: brushed along u, an even grain, a few rust specks | `src/02yoa-outpost-props.js` |
| `opyLink` | 512 | galvanized chain-link: diamonds of woven wire, rust spots; alpha = opacity | `src/02yp-outpost-yard.js` |
| `opyCorrS` | 512 | the same sheet, matte and soft (the shed, the booth, the guard room): ribs by their shading only, half the relief, no pale ridge | `src/02yp-outpost-yard.js` |
| `opyCorr` | 512 | painted corrugated sheet (tinted by vertices: olive green of the shed, the gates, the booth): vertical ribs, chipped paint showing the zinc, rust streaks under... | `src/02yp-outpost-yard.js` |
| `opyMud` | 512 | wet tropical mud (the yard after the shower, layer under the dry packed earth): grey-brown, smooth, hollows holding water (dark and glossy), now and then a... | `src/02yp-outpost-yard.js` |
| `opyBoard` | 512 | weathered boards about 15 cm (the tower cabin): grey-brown, dark joints, grain along the boards, a knot now and then, grey bleaching | `src/02yp-outpost-yard.js` |
| `opyEarth` | 512 | trodden earth of the yard, damp: grey-brown, scuffed in broad patches, a rare small stone (no crack, no repeat that reads) | `src/02yp-outpost-yard.js` |
| `opyRut` | 512 | a wheel rut (the tile 5.6 m along it, 0.7 m across; alpha = its extent): a worn wet track about 0.3 m wide whose width wanders and whose edges break up, tread... | `src/02yp-outpost-yard.js` |
| `opyFilm` | 256 | mud lapping over a concrete edge (the tile across it: 0.5 m, the edge at the bottom; alpha = its extent): a thin film of dried earth, thick at the edge, frayed... | `src/02yp-outpost-yard.js` |
| `opyTarp` | 512 | olive tarpaulin (tinted): heavy cloth, broad folds and creases, water stains, no fine weave (it would shimmer) | `src/02yp-outpost-yard.js` |
| `opjCanopy` | 512 | forest canopy seen from afar (the hills): tree crowns in clumps, lit on top, dark hollows between them, no fine grain (no speckle) | `src/02yp-outpost-yard.js` |
| `opyLitter` | 512 | jungle floor: dark leaf litter (brown and olive leaves, twigs) | `src/02yp-outpost-yard.js` |

## Atlases drawn at load

| Atlas | Description | File |
| --- | --- | --- |
| `foliageAtlas` |  | `src/02c-materials.js` |
| `signAtlas` |  | `src/02c-materials.js` |
| `decalAtlas` | Decals (1024², 4 x 4 grid, alpha): 0 to 3 posters, 4 and 5 stencils, 6 and 7 graffiti, 8 streak, 9 dirt, 10 crack, 11 impacts, 12 oil stain, 13 tire tracks, 14... | `src/02c-materials.js` |
| `coniferAtlas` |  | `src/02i-winter.js` |
| `winterSignAtlas` |  | `src/02i-winter.js` |
| `winterDecalAtlas` |  | `src/02i-winter.js` |
| `portSignAtlas` |  | `src/02l-port.js` |
| `portDecalAtlas` |  | `src/02l-port.js` |
| `cySignAtlas` |  | `src/02yb-cyclades.js` |
| `cyDecalAtlas` |  | `src/02yb-cyclades.js` |
| `cyFloraAtlas` |  | `src/02yb-cyclades.js` |
| `tpSignAtlas` |  | `src/02yg-scoria-kit.js` |
| `tpDecalAtlas` |  | `src/02yg-scoria-kit.js` |
| `fdSignAtlas` |  | `src/02ym-houses-kit.js` |
| `opSignAtlas` |  | `src/02yoa-outpost-props.js` |
| `opAtlas` | Atlas cell i on a quad of the current frame (local uv): facing +z at depth z, or laid flat (o.flat: facing +y at height z) | `src/02yoa-outpost-props.js` |
| `opStainAtlas` |  | `src/02yoa-outpost-props.js` |
| `opyAtlas` |  | `src/02yp-outpost-yard.js` |
| `opjLeafAtlas` |  | `src/02ypb-outpost-jungle.js` |

## Skies and lighting

Photographed skies (`assets/sky/`, top half of a Poly Haven panorama, CC0): `kloofendal_48d`, `kloofendal_misty_morning`, `kloppenheim_02`, `quarry_01`, `qwantani_dawn`, `qwantani_dusk_2`, `sunflowers`, `wasteland_fire`.

Lighting HDRIs (`assets/vendor/hdri/`, Poly Haven, CC0): `park`, `sky`, `sunset`.

## Weapons

Models built by code (`src/06c-models.js`), stats in `src/06i-weapons.js`.

| Weapon | Name | Category |
| --- | --- | --- |
| `m4` | M4A1 | Assault rifle |
| `mp5` | MP5 | Submachine gun |
| `l96` | L96A1 | Sniper rifle |
| `m1014` | M1014 | Shotgun |
| `m9` | M9 | Pistol |
| `ak47` | AK-47 | Assault rifle |
| `scarh` | SCAR-H | Assault rifle |
| `famas` | FAMAS F1 | Assault rifle |
| `mp7` | MP7 | Submachine gun |
| `ump45` | UMP-45 | Submachine gun |
| `vector` | Vector | Submachine gun |
| `svd` | Dragunov SVD | Sniper rifle |
| `m82` | Barrett M82 | Sniper rifle |
| `rem870` | Remington 870 | Shotgun |
| `aa12` | AA-12 | Shotgun |
| `usp` | USP .45 | Pistol |
| `glock18` | Glock 18 | Pistol |
| `deagle` | Desert Eagle | Pistol |

## Attachments

`ATT` catalog (`src/06p-attachments.js`), models built by code.

| Attachment | Name | Slot |
| --- | --- | --- |
| `red` | Red dot | optic |
| `holo` | Holographic | optic |
| `sil` | Suppressor | muzzle |
| `comp` | Compensator | muzzle |
| `brake` | Muzzle brake | muzzle |
| `choke` | Tight choke | muzzle |
| `long` | Long barrel | barrel |
| `short` | Short barrel | barrel |
| `vgrip` | Vertical grip | under |
| `agrip` | Angled grip | under |
| `bipod` | Bipod | under |
| `laser` | Laser sight | side |
| `fmag` | Fast mag | mag |
| `xmag` | Extended mag | mag |
| `hstock` | Reinforced stock | stock |
| `nostock` | No stock | stock |
| `hp` | Hollow point | ammo |
| `slug` | Slug | ammo |
