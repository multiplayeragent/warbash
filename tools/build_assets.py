"""Builds assets/tex/: CC0 textures (Poly Haven, ambientCG) resized to WebP, one folder per surface
(map.webp, normal.webp, rough.webp) and the credits list (credits.json). build.py makes one file per surface of it
next to the page (dist/tex/), which the game loads at the launch of the first map that uses it."""
import io, json, os
from PIL import Image, ImageOps, ImageStat

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
PH = str(ROOT / 'assets_src' / 'polyhaven')
AC = str(ROOT / 'assets_src' / 'ambientcg')
# game key: (source, folder, color/normal/roughness files, roughness channel, options)
SETS = {
  'plaster': ('Poly Haven', 'white_plaster_rough_01', f'{PH}/white_plaster_rough_01/diff.jpg', f'{PH}/white_plaster_rough_01/nor.jpg', f'{PH}/white_plaster_rough_01/arm.jpg', 'G', {'level': 205, 'desat': 0.55}),
  'asphalt': ('ambientCG', 'Asphalt021', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_Color.jpg', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_NormalGL.jpg', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_Roughness.jpg', 'L', {'level': 92, 'desat': 0.3}),
  'pavers': ('ambientCG', 'Concrete012', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_Color.jpg', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_NormalGL.jpg', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_Roughness.jpg', 'L', {'level': 175, 'desat': 0.4}),
  'cobble': ('Poly Haven', 'cobblestone_floor_001', f'{PH}/cobblestone_floor_001/diff.jpg', f'{PH}/cobblestone_floor_001/nor.jpg', f'{PH}/cobblestone_floor_001/arm.jpg', 'G', {'level': 150, 'desat': 0.35}),
  'brick': ('ambientCG', 'Bricks066', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_Color.jpg', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_NormalGL.jpg', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_Roughness.jpg', 'L', {'level': 190, 'desat': 0.8}),
  'stone': ('Poly Haven', 'rustic_stone_wall_02', f'{PH}/rustic_stone_wall_02/diff.jpg', f'{PH}/rustic_stone_wall_02/nor.jpg', f'{PH}/rustic_stone_wall_02/arm.jpg', 'G', {'level': 150, 'desat': 0.25}),
  'plaster2': ('Poly Haven', 'clay_plaster', f'{PH}/clay_plaster/diff.jpg', f'{PH}/clay_plaster/nor.jpg', f'{PH}/clay_plaster/arm.jpg', 'G', {'level': 195, 'desat': 0.45}),
  'shutter': ('Poly Haven', 'wood_shutter', f'{PH}/wood_shutter/diff.jpg', f'{PH}/wood_shutter/nor.jpg', f'{PH}/wood_shutter/arm.jpg', 'G', {'level': 175, 'desat': 0.85}),
  'rooftiles': ('Poly Haven', 'clay_roof_tiles_03', f'{PH}/clay_roof_tiles_03/diff.jpg', f'{PH}/clay_roof_tiles_03/nor.jpg', f'{PH}/clay_roof_tiles_03/arm.jpg', 'G', {'level': 0, 'desat': 0.0}),
  'wood': ('Poly Haven', 'weathered_brown_planks', f'{PH}/weathered_brown_planks/diff.jpg', f'{PH}/weathered_brown_planks/nor.jpg', f'{PH}/weathered_brown_planks/arm.jpg', 'G', {'level': 0, 'desat': 0.35, 'rgb': (176, 148, 120)}), # (October 2026: less orange, same brightness; it looked painted)
  # Cirrus: the layered rock of the cliffs and the ground layers (they replace the procedural surfaces of the same name for the map
  # that asks for them; Floralia keeps its own). Downloaded from dl.polyhaven.org (2K jpg: diff, nor_gl, arm)
  'strata': ('Poly Haven', 'cliff_side', f'{PH}/cliff_side/diff.jpg', f'{PH}/cliff_side/nor.jpg', f'{PH}/cliff_side/arm.jpg', 'G', {'level': 150, 'desat': 0.5}),
  'lawn': ('Poly Haven', 'aerial_grass_rock', f'{PH}/aerial_grass_rock/diff.jpg', f'{PH}/aerial_grass_rock/nor.jpg', f'{PH}/aerial_grass_rock/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'nsize': 512, 'mul': (0.72, 1.0, 0.5)}),
  'dirt': ('Poly Haven', 'forest_ground_04', f'{PH}/forest_ground_04/diff.jpg', f'{PH}/forest_ground_04/nor.jpg', f'{PH}/forest_ground_04/arm.jpg', 'G', {'level': 125, 'desat': 0.1, 'nsize': 512}),
  'flagstone': ('Poly Haven', 'stone_pathway', f'{PH}/stone_pathway/diff.jpg', f'{PH}/stone_pathway/nor.jpg', f'{PH}/stone_pathway/arm.jpg', 'G', {'level': 150, 'desat': 0.25}),
  'humus': ('Poly Haven', 'forest_leaves_02', f'{PH}/forest_leaves_02/diff.jpg', f'{PH}/forest_leaves_02/nor.jpg', f'{PH}/forest_leaves_02/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'nsize': 512}),
  # Notos: dry-stone low walls and base ground (the paving with whitened joints and the lime stay procedural); Scoria: ash
  # (the vesicular basalt, the cushion moss and the lava stay procedural: the photos tried were less readable)
  'drystone': ('Poly Haven', 'stone_wall', f'{PH}/stone_wall/diff.jpg', f'{PH}/stone_wall/nor.jpg', f'{PH}/stone_wall/arm.jpg', 'G', {'level': 0, 'desat': 0.0}),
  # Sirocco: the reg, ground of gravel and packed sand of the camps and tracks (the forest soil, dead leaves included, was nothing like a desert)
  'reg': ('Poly Haven', 'sandy_gravel_02', f'{PH}/sandy_gravel_02/diff.jpg', f'{PH}/sandy_gravel_02/nor.jpg', f'{PH}/sandy_gravel_02/arm.jpg', 'G', {'level': 112, 'desat': 0.1, 'nsize': 512}),
  'sand': ('Poly Haven', 'dense_sand', f'{PH}/dense_sand/diff.jpg', f'{PH}/dense_sand/nor.jpg', f'{PH}/dense_sand/arm.jpg', 'G', {'level': 168, 'desat': 0.0, 'nsize': 512}),
  'ash': ('Poly Haven', 'gravel_stones', f'{PH}/gravel_stones/diff.jpg', f'{PH}/gravel_stones/nor.jpg', f'{PH}/gravel_stones/arm.jpg', 'G', {'level': 48, 'desat': 0.3, 'nsize': 512}),
  # Chergui, Saint-Givre, Floralia: cut stone; Chergui, Saint-Givre, Port-Maël, Floralia: concrete; Saint-Givre: snow, packed snow,
  # rock, planks, slate, conifer bark (Port-Maël shares rock, planks and slate); Floralia: bark, gravel of the paths (the rockery of the
  # greenhouse stays procedural: its photo was blander; so does the corrugated sheet metal: camouflage-like blotches on the roofs)
  'ashlar': ('Poly Haven', 'seaworn_sandstone_brick', f'{PH}/seaworn_sandstone_brick/diff.jpg', f'{PH}/seaworn_sandstone_brick/nor.jpg', f'{PH}/seaworn_sandstone_brick/arm.jpg', 'G', {'level': 158, 'desat': 0.2}),
  'concrete': ('Poly Haven', 'concrete_wall_009', f'{PH}/concrete_wall_009/diff.jpg', f'{PH}/concrete_wall_009/nor.jpg', f'{PH}/concrete_wall_009/arm.jpg', 'G', {'level': 158, 'desat': 0.6}),
  'snow': ('Poly Haven', 'snow_02', f'{PH}/snow_02/diff.jpg', f'{PH}/snow_02/nor.jpg', f'{PH}/snow_02/arm.jpg', 'G', {'level': 221, 'desat': 0.6, 'nsize': 512, 'mul': (0.95, 0.98, 1.06)}),
  'snowpack': ('Poly Haven', 'snow_01', f'{PH}/snow_01/diff.jpg', f'{PH}/snow_01/nor.jpg', f'{PH}/snow_01/arm.jpg', 'G', {'level': 202, 'desat': 0.5, 'nsize': 512, 'mul': (0.95, 0.98, 1.06)}),
  'rock': ('Poly Haven', 'rock_face', f'{PH}/rock_face/diff.jpg', f'{PH}/rock_face/nor.jpg', f'{PH}/rock_face/arm.jpg', 'G', {'level': 117, 'desat': 0.9}),
  'boards': ('Poly Haven', 'wooden_planks', f'{PH}/wooden_planks/diff.jpg', f'{PH}/wooden_planks/nor.jpg', f'{PH}/wooden_planks/arm.jpg', 'G', {'level': 80, 'desat': 0.1}),
  'slate': ('Poly Haven', 'roof_slates_03', f'{PH}/roof_slates_03/diff.jpg', f'{PH}/roof_slates_03/nor.jpg', f'{PH}/roof_slates_03/arm.jpg', 'G', {'level': 68, 'desat': 0.4, 'mul': (0.92, 0.98, 1.12)}),
  'barkw': ('Poly Haven', 'pine_bark', f'{PH}/pine_bark/diff.jpg', f'{PH}/pine_bark/nor.jpg', f'{PH}/pine_bark/arm.jpg', 'G', {'level': 35, 'desat': 0.2}),
  'bark': ('Poly Haven', 'bark_willow_02', f'{PH}/bark_willow_02/diff.jpg', f'{PH}/bark_willow_02/nor.jpg', f'{PH}/bark_willow_02/arm.jpg', 'G', {'level': 99, 'desat': 0.1}),
  'pathgravel': ('Poly Haven', 'gravel_floor_02', f'{PH}/gravel_floor_02/diff.jpg', f'{PH}/gravel_floor_02/nor.jpg', f'{PH}/gravel_floor_02/arm.jpg', 'G', {'level': 171, 'desat': 0.0, 'nsize': 512, 'mul': (1.06, 1.0, 0.86)}),
  # Sirocco: the rammed earth of the ksar (packed earth), the mud bricks of the kasbah, the pebbles and cracked silt of the wadi bed
  'pise': ('Poly Haven', 'excavated_soil_wall', f'{PH}/excavated_soil_wall/diff.jpg', f'{PH}/excavated_soil_wall/nor.jpg', f'{PH}/excavated_soil_wall/arm.jpg', 'G', {'level': 172, 'desat': 0.5, 'nsize': 512}),
  'adobe': ('Poly Haven', 'clay_block_wall', f'{PH}/clay_block_wall/diff.jpg', f'{PH}/clay_block_wall/nor.jpg', f'{PH}/clay_block_wall/arm.jpg', 'G', {'level': 158, 'desat': 0.15, 'nsize': 512}),
  'shingle': ('Poly Haven', 'dry_river_pebbles', f'{PH}/dry_river_pebbles/diff.jpg', f'{PH}/dry_river_pebbles/nor.jpg', f'{PH}/dry_river_pebbles/arm.jpg', 'G', {'level': 150, 'desat': 0.35, 'nsize': 512, 'mul': (1.08, 1.0, 0.9)}),
  'vase': ('Poly Haven', 'mud_cracked_dry_riverbed_002', f'{PH}/mud_cracked_dry_riverbed_002/diff.jpg', f'{PH}/mud_cracked_dry_riverbed_002/nor.jpg', f'{PH}/mud_cracked_dry_riverbed_002/arm.jpg', 'G', {'level': 158, 'desat': 0.1, 'nsize': 512}),
  # objects of all the maps (October 2026, owner's request: real textures on all assets): crates, canvases,
  # jute (sacks, bales), painted wood (doors, shutters, cladding), cardboard, steel, rust, roller shutters. rgb: target average color (sRGB), that of the surface
  # procedural that they replace (measured in the game), so that the tints set by the vertices stay right; metal: the
  # blue channel of the roughness carries the metal mask (arm.B), re-read by texLabPack for the masked materials (ma); size: size of the surface
  # procedural one replaced, with no extra graphics memory
  # solid wood of posts, beams, rails and round timbers (no plank joints: the plank photo, laid on a 15 cm post,
  # drew joints that ran all the way around it) and palm bark
  'timber': ('Poly Haven', 'rough_wood', f'{PH}/rough_wood/diff.jpg', f'{PH}/rough_wood/nor.jpg', f'{PH}/rough_wood/arm.jpg', 'G', {'level': 0, 'desat': 0.2, 'rgb': (176, 148, 120), 'size': 512}),
  'palmbark': ('Poly Haven', 'palm_tree_bark', f'{PH}/palm_tree_bark/diff.jpg', f'{PH}/palm_tree_bark/nor.jpg', f'{PH}/palm_tree_bark/arm.jpg', 'G', {'level': 0, 'desat': 0.3, 'rgb': (119, 93, 64), 'size': 512}),
  # crates, pallets, cages: wide raw wood planks (six per crate face), knots and nail holes (October 2026: the earlier
  # thin-slat wall, raw_plank_wall, drew a dozen per face, like corrugated sheet metal)
  'crate': ('Poly Haven', 'brown_planks_09', f'{PH}/brown_planks_09/diff.jpg', f'{PH}/brown_planks_09/nor.jpg', f'{PH}/brown_planks_09/arm.jpg', 'G', {'level': 0, 'desat': 0.15, 'rgb': (167, 133, 88), 'size': 512}),
  # fabrics (fabrics workstream, October 2026): a real thick loose-weave canvas for tents, tarps, awnings and stalls (the earlier fine linen
  # was unreadable at two meters), the earlier linen for laundry (a cotton jersey, tried, was plain at this size), a woven wool for Bedouin tents and rugs
  'canvas': ('ambientCG', 'Fabric066', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_Color.jpg', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_NormalGL.jpg', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'linen': ('Poly Haven', 'rough_linen', f'{PH}/rough_linen/diff.jpg', f'{PH}/rough_linen/nor.jpg', f'{PH}/rough_linen/arm.jpg', 'G', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'woolen': ('ambientCG', 'Fabric031', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_Color.jpg', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_NormalGL.jpg', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'burlap': ('Poly Haven', 'hessian_230', f'{PH}/hessian_230/diff.jpg', f'{PH}/hessian_230/nor.jpg', f'{PH}/hessian_230/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'rgb': (159, 135, 95), 'size': 512}),
  'paintwood': ('Poly Haven', 'distressed_painted_planks', f'{PH}/distressed_painted_planks/diff.jpg', f'{PH}/distressed_painted_planks/nor.jpg', f'{PH}/distressed_painted_planks/arm.jpg', 'G', {'level': 0, 'desat': 0.55, 'rgb': (210, 209, 208), 'size': 512}),
  'cardboard': ('ambientCG', 'Cardboard004', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_Color.jpg', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_NormalGL.jpg', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 0.0, 'rgb': (183, 143, 96), 'nsize': 512, 'size': 256}),
  'rust': ('Poly Haven', 'rust_coarse_01', f'{PH}/rust_coarse_01/diff.jpg', f'{PH}/rust_coarse_01/nor.jpg', f'{PH}/rust_coarse_01/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'rgb': (111, 58, 24), 'metal': True, 'size': 512}),
  'steel': ('ambientCG', 'Metal062C', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Color.jpg', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_NormalGL.jpg', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 0.8, 'rgb': (196, 197, 199), 'metal': f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Metalness.jpg', 'size': 512}),
  'rollshutter': ('Poly Haven', 'rusty_metal_shutter', f'{PH}/rusty_metal_shutter/diff.jpg', f'{PH}/rusty_metal_shutter/nor.jpg', f'{PH}/rusty_metal_shutter/arm.jpg', 'G', {'level': 0, 'desat': 0.85, 'rgb': (207, 206, 206), 'metal': True, 'size': 512}),
}
SIZE = {'map': 1024, 'normal': 1024, 'rough': 512}
Q = {'map': 80, 'normal': 82, 'rough': 76}

def webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()

# credits: those already built are kept; a surface whose sources are not on disk (assets_src/ is ignored by git) keeps
# its assets/tex/ files as they are
CRED = ROOT / 'assets' / 'tex' / 'credits.json'
credits, total = (json.load(open(CRED, encoding='utf-8')) if CRED.exists() else []), 0
ONLY = [k for k in os.environ.get('ONLY', '').split(',') if k] # ONLY=reg,sand: rebuild only these surfaces
for key, (src, name, fc, fn, fr, ch, opt) in SETS.items():
    if ONLY and key not in ONLY: continue
    if not all(os.path.exists(f) for f in (fc, fn, fr)):
        print(f'{key:10s} sources missing: assets/tex/{key} kept'); continue
    c = Image.open(fc).convert('RGB').resize((opt.get('size', SIZE['map']),) * 2, Image.LANCZOS)
    if opt['desat']:
        g = ImageOps.grayscale(c).convert('RGB'); c = Image.blend(c, g, opt['desat'])
    if opt.get('mul'): # tint (Cirrus lawn: greener, like its blades)
        k3 = opt['mul']; c = Image.merge('RGB', [ch.point(lambda v, k=k: max(0, min(255, int(v * k)))) for ch, k in zip(c.split(), k3)])
    if opt.get('rgb'): # target average color, channel by channel
        st = ImageStat.Stat(c).mean
        c = Image.merge('RGB', [ch.point(lambda v, k=t / max(m, 1): max(0, min(255, int(v * k)))) for ch, t, m in zip(c.split(), opt['rgb'], st)])
    if opt['level']:
        m = sum(ImageStat.Stat(c).mean) / 3; k = opt['level'] / max(m, 1)
        c = c.point(lambda v: max(0, min(255, int(v * k))))
    n = Image.open(fn).convert('RGB').resize((opt.get('nsize', opt.get('size', SIZE['normal'])),) * 2, Image.LANCZOS) # nsize: smaller relief (ground layers)
    r = Image.open(fr)
    rr = (r.convert('RGB').split()[1] if ch == 'G' else r.convert('L')).resize((min(SIZE['rough'], opt.get('size', 1024)),) * 2, Image.LANCZOS)
    mt = rr
    if opt.get('metal'): # arm.B (Poly Haven), or the separate metal map (ambientCG: metal = its path)
        mt = (Image.open(opt['metal']).convert('L') if isinstance(opt['metal'], str) else r.convert('RGB').split()[2]).resize((min(SIZE['rough'], opt.get('size', 1024)),) * 2, Image.LANCZOS)
    r = Image.merge('RGB', (rr, rr, mt))
    d = ROOT / 'assets' / 'tex' / key; os.makedirs(d, exist_ok=True); sizes = {}
    for kind, im in (('map', c), ('normal', n), ('rough', r)):
        data = webp(im, Q[kind]); total += len(data); sizes[kind] = len(data) // 1024
        open(d / (kind + '.webp'), 'wb').write(data)
    credits = [c for c in credits if c['key'] != key] + [{'key': key, 'asset': name, 'source': src, 'licence': 'CC0 1.0'}]
    print(f'{key:10s} {name:26s} {src:10s}', sizes, 'KB')
open(CRED, 'w', encoding='utf-8').write(json.dumps(credits, ensure_ascii=False, indent=1) + '\n')
print('total', total // 1024, 'KB')
