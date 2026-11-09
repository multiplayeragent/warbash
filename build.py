"""Assembles the game into a single HTML file: dist/index.html
three.js r147 is served by the site (assets/vendor, tools/vendor.py); the modules of src/ are concatenated in alphabetical order.
The images (assets/menu-bg.webp and its depth map assets/menu-depth.webp, assets/logo.webp) are embedded as data URIs, and
changelog.json (update log, validated here) in shell.html, in place of the markers it contains. The menu music,
dist/menu-theme.mp3, stays a file next to the HTML: build.py only puts its address (with a hash) in
the page. The photo textures of the maps too (one file per surface in dist/tex/, loaded when a map starts),
and their illustrations (dist/maps/).
Also writes dist/version.json: the identifier of the built version, which the game checks to update itself."""
import base64,datetime,glob,hashlib,html as _html,json,os,re,shutil,subprocess,sys,tempfile
sys.path.insert(0,"tools")
import minif
tags="" # three.js: dist/tex/three.<hash>.js (base, further down), served by the site like the rest
# Online lobbies (src/09d-netrelay.js): the game server module (Multiplayer Agent, loaded from its CDN) and its configuration,
# mp.config.js (placeholder key, in the repo) then mp.config.local.js (the game's real public key, outside the repo: absent from a
# fresh copy, the game stays offline). Both files are copied next to the page. No secret key goes in (guard at the end of the build).
MP_SDK="https://cdn.multiplayeragent.com/sdk/mp.global.js"
MP_HOSTS=("https://cdn.multiplayeragent.com","https://api.multiplayeragent.com","https://live.multiplayeragent.com","wss://live.multiplayeragent.com")
tags+='\n<script src="mp.config.js"></script>\n<script src="mp.config.local.js"></script>\n<script src="'+MP_SDK+'"></script>'
js="\n".join(open(f,encoding="utf-8").read() for f in sorted(glob.glob("src/*.js")))
# publisher's legal notices (src/09k-legal.js): legal.local.json, unversioned (legal.example.json shows the shape), replaces the
# bracketed values of LEGAL. A copy of the repo without this file keeps the brackets (and the warning below).
if os.path.exists("legal.local.json"):
    _leg=json.load(open("legal.local.json",encoding="utf-8"))
    _m=re.search(r"\nconst LEGAL = \{\n.*?\n\};\n",js,re.S)
    if not _m: raise SystemExit("legal.local.json: LEGAL block not found (src/09k-legal.js)")
    _b=_m.group(0)
    for _k in ("name","address","email","host"):
        if _k not in _leg: continue
        _b,_n=re.subn(r"(\n  "+_k+r": )'[^\n]*',\n",lambda m:m.group(1)+json.dumps(_leg[_k],ensure_ascii=True)+",\n",_b,count=1)
        if _n!=1: raise SystemExit("legal.local.json: field "+_k+" not found in LEGAL (src/09k-legal.js)")
    js=js[:_m.start()]+_b+js[_m.end():]
    print("legal notices: legal.local.json")
# Word filter (names, chat): the same file serves the accounts server (module); joined to the game without its "export" keywords
js=re.sub(r"^export ","",open("api/_lib/textFilter.js",encoding="utf-8").read(),flags=re.M)+"\n"+js
def data_uri(path):
    return "data:image/"+("png" if path.endswith(".png") else "webp")+";base64,"+base64.b64encode(open(path,"rb").read()).decode("ascii")
# CC0 photo textures (assets/tex/<surface>/map, normal, rough .webp, produced by tools/build_assets.py): they are no
# longer in the page. Each surface becomes a small script next to the HTML, dist/tex/<surface>.<hash>.js, which calls
# texPack(key, data); the game only loads it when starting the first map that uses it. The hash changes
# with the content: the file can stay in cache indefinitely (vercel.json). A script tag also works under file://.
packs={}
os.makedirs("dist/tex",exist_ok=True)
for d in sorted(glob.glob("assets/tex/*/")):
    key=os.path.basename(os.path.normpath(d))
    parts={}
    for kind in ("map","normal","rough"):
        f=os.path.join(d,kind+".webp")
        if not os.path.exists(f): raise SystemExit(f"assets/tex/{key}: {kind}.webp missing")
        parts[kind]=data_uri(f)
    body="texPack("+json.dumps(key)+","+json.dumps(parts)+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Photographed skies (assets/sky/<name>.webp: top half of a panorama, from horizon to zenith; <name>_lo for Low quality):
# same packaging, key sky_<name>, loaded when starting the map that asks for one (skyPhoto in its definition)
for f in sorted(glob.glob("assets/sky/*.webp")):
    key="sky_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps({"map":data_uri(f)})+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Effect textures (assets/fx/<name>.webp, a single image: crystal fractures in Cirrus...): same packaging, key fx_<name>, loaded
# by the map or effect that asks for them (fetchTexPack)
for f in sorted(glob.glob("assets/fx/*.webp")):
    key="fx_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps({"map":data_uri(f)})+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Lighting HDRI (assets/vendor/hdri/<name>.exr, tools/vendor.py): same packaging, key hdri_<name>, the base64 string of the EXR file,
# loaded when starting the map that asks for one (src/01-core.js, loadHDRIEnvironment)
for f in sorted(glob.glob("assets/vendor/hdri/*.exr")):
    key="hdri_"+os.path.splitext(os.path.basename(f))[0]
    body="texPack("+json.dumps(key)+","+json.dumps(base64.b64encode(open(f,"rb").read()).decode("ascii"))+");\n"
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    packs[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
# Bundling (WARBASH_BUNDLE=n, for hosting limited in file count, see mp/README.md): n packs of the same family per
# file; each key points to its group (fetchTexPack loads the file, texPack ignores keys nobody expects). Default: 1, one per file.
BUNDLE=max(1,int(os.environ.get("WARBASH_BUNDLE","1") or 1))
if BUNDLE>1:
    fam=lambda k: k.split("_")[0] if k.startswith(("sky_","fx_","hdri_")) else "tex"
    groups=[]
    for k in sorted(packs,key=lambda k:(fam(k),k)):
        if groups and fam(groups[-1][0])==fam(k) and len(groups[-1])<BUNDLE: groups[-1].append(k)
        else: groups.append([k])
    for g in groups:
        if len(g)==1: continue
        body="".join(open("dist/"+packs[k],encoding="utf-8").read() for k in g)
        name="tex/b-"+hashlib.sha1(body.encode("utf-8")).hexdigest()[:10]+".js"
        if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
        for k in g: packs[k]=name
    print("grouping:",len(groups),"bundle files (",BUNDLE,"per file at most)")
# Page base: the startup data that almost never changes from one version to the next (740 KB in base64), delivered in
# two hashed scripts next to the page rather than inside it: a game update doesn't make them download again (immutable cache,
# vercel.json and the service worker). A script tag also works under file:// (an image loaded from a file couldn't
# go into WebGL). base-assets-ui, at the top of the page, before the first paint: the menu illustration and the logo, set as CSS variables
# (--key-art, --logo). baseAssets, just before the game code: window.BASE_ASSETS, with the depth map of the animated background (depth,
# src/09w-background.js), weapon wear (grain: assets/firearm/surface.webp, python3 tools/build_weapons.py, read by src/06-weapons.js), the
# fabric scans of the outfits (fabric and tint: assets/outfit/, python3 tools/build_outfits.py, read by src/06e-gear.js), the baked
# animations (anim: assets/anim/clips.bin and clips.json, node tools/dev/anim/bake.mjs from the Mixamo pack outside the repo, read by
# src/06ab-anim.js) and the level-up fanfare (rankup, assets/rankup.mp3, src/05b-rankup-sound.js). If absent (network down): the game
# starts without them, with its fallbacks.
grain="assets/firearm/surface.webp"
anim=None
if os.path.exists("assets/anim/clips.json"):
    anim=json.load(open("assets/anim/clips.json",encoding="utf-8")); anim.pop("layout",None)
    anim["b"]=base64.b64encode(open("assets/anim/clips.bin","rb").read()).decode("ascii")
    print("baked animations:",len(anim["clips"]),"clips,",len(anim["b"])//1024,"KB")
baseAssets={}
def base_assets_js(key,body):
    name="tex/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
    baseAssets[key]=name
base_assets_js("base-assets-ui","(function(s){s.setProperty('--key-art',"+json.dumps("url("+data_uri("assets/menu-bg.webp")+")")+");s.setProperty('--logo',"+json.dumps("url("+data_uri("assets/logo.webp")+")")+")})(document.documentElement.style);\n")
cloths={k:data_uri(f"assets/outfit/{k}.webp") if os.path.exists(f"assets/outfit/{k}.webp") else "" for k in ("cloths","tintScan")}
base_assets_js("baseAssets","window.BASE_ASSETS="+json.dumps({"depth":data_uri("assets/menu-depth.webp"),"grain":data_uri(grain) if os.path.exists(grain) else "",**cloths,"anim":anim,
    "rankup":base64.b64encode(open("assets/rankup.mp3","rb").read()).decode("ascii")},separators=(",",":"))+";\n")
# three.js r147 and its example modules (assets/vendor/three-r147.js, tools/vendor.py): same packaging, loaded just before the game code
three=open("assets/vendor/three-r147.js",encoding="utf-8").read()
if "</script" in three.lower(): raise SystemExit("assets/vendor/three-r147.js contains </script")
base_assets_js("three",three)
print("base:",", ".join(f"{n} ({os.path.getsize('dist/'+n)//1024} KB)" for n in baseAssets.values()))
for f in glob.glob("dist/tex/*.js"):
    if "tex/"+os.path.basename(f) not in list(packs.values())+list(baseAssets.values()): os.remove(f) # previous versions
print("photo textures:",len(packs),"files in dist/tex,",sum(os.path.getsize("dist/"+n) for n in packs.values())//1024,"KB")
# Recorded sounds (assets/sfx/<pack>/*.mp3 and meta.json, produced by tools/build_sfx.py): like the textures, a small script
# per pack next to the page, dist/sfx/<pack>.<hash>.js, which calls sfxPack(key, data) (see src/05a-sfx.js); the game
# loads the common packs at audio startup and a map's ambience when that map starts. Without them: synthesized sounds.
sfx={}
os.makedirs("dist/sfx",exist_ok=True)
for d in sorted(glob.glob("assets/sfx/*/")):
    key=os.path.basename(os.path.normpath(d)); mp=os.path.join(d,"meta.json")
    if not os.path.exists(mp): raise SystemExit(f"assets/sfx/{key}: meta.json missing (python3 tools/build_sfx.py)")
    meta=json.load(open(mp,encoding="utf-8")); s={}
    for f in sorted(glob.glob(os.path.join(d,"*.mp3"))):
        sid=os.path.splitext(os.path.basename(f))[0]
        if sid not in meta["s"]: raise SystemExit(f"assets/sfx/{key}/{sid}.mp3 absent from meta.json")
        s[sid]=meta["s"][sid]+[base64.b64encode(open(f,"rb").read()).decode("ascii")]
    if not s: continue
    body="sfxPack("+json.dumps(key)+","+json.dumps({"rate":meta["rate"],"s":s},separators=(",",":"))+");\n"
    name="sfx/"+key+"."+hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]+".js"
    sfx[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"w",encoding="utf-8").write(body)
for f in glob.glob("dist/sfx/*.js"):
    if "sfx/"+os.path.basename(f) not in sfx.values(): os.remove(f)
print("sounds:",len(sfx),"packs in dist/sfx,",sum(os.path.getsize("dist/"+n) for n in sfx.values())//1024,"KB")
# Map illustrations for the menus (assets/maps/<id>.webp, node tools/dev/illustrations.js): like the textures,
# a file next to the page, dist/maps/<id>.<hash>.webp, cached indefinitely; one more map doesn't make the page heavier.
art={}
os.makedirs("dist/maps",exist_ok=True)
for f in sorted(glob.glob("assets/maps/*.webp")):
    key=os.path.splitext(os.path.basename(f))[0]; data=open(f,"rb").read()
    name="maps/"+key+"."+hashlib.sha1(data).hexdigest()[:8]+".webp"
    art[key]=name
    if not os.path.exists("dist/"+name): open("dist/"+name,"wb").write(data)
for f in glob.glob("dist/maps/*.webp"):
    if "maps/"+os.path.basename(f) not in art.values(): os.remove(f)
print("map illustrations:",", ".join(f"{k} ({os.path.getsize('dist/'+v)//1024} KB)" for k,v in art.items()) or "none")
# Rank badges (assets/ranks.webp, a sheet of 11 cells of 256 px: python3 tools/art/process.py ranks): a file next to the page,
# dist/ranks.<hash>.webp, cached indefinitely; its address replaces the __RANK_ART__ marker (src/09sa-grades.js)
rank_art=""
for f in glob.glob("dist/ranks.*.webp"): os.remove(f)
if os.path.exists("assets/ranks.webp"):
    data=open("assets/ranks.webp","rb").read(); rank_art="ranks."+hashlib.sha1(data).hexdigest()[:8]+".webp"
    open("dist/"+rank_art,"wb").write(data)
print("rank badges:",rank_art or "none")
# End-of-match crests (assets/crests.webp, victory and defeat: python3 tools/art/process.py crests): same thing, __CREST_ART__ marker (src/09l-end.js)
crest_art=""
for f in glob.glob("dist/crests.*.webp"): os.remove(f)
if os.path.exists("assets/crests.webp"):
    data=open("assets/crests.webp","rb").read(); crest_art="crests."+hashlib.sha1(data).hexdigest()[:8]+".webp"
    open("dist/"+crest_art,"wb").write(data)
for mark,val in (("/*__TEX_PACKS__*/ {}",json.dumps(packs)),("/*__SFX_PACKS__*/ {}",json.dumps(sfx)),("/*__MAP_ART__*/ {}",json.dumps(art)),("/*__RANK_ART__*/ ''",json.dumps(rank_art)),("/*__CREST_ART__*/ ''",json.dumps(crest_art))):
    if js.count(mark)!=1: raise SystemExit("marker not found or duplicated in src/: "+mark)
    js=js.replace(mark,val)
# Syntax of the assembled script (node --check): a syntax error used to pass silently, and the page stayed blank on load (the tools
# in tools/dev/visual waited for the menu until their timeout). Skipped if node is not installed.
if shutil.which("node"):
    with tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8") as tf: tf.write(js); tmp_js=tf.name
    chk=subprocess.run(["node","--check",tmp_js],capture_output=True,text=True); os.unlink(tmp_js)
    if chk.returncode: raise SystemExit("syntax error in the assembled script (src/):\n"+"\n".join(chk.stderr.strip().split("\n")[:6]))
    print("script syntax: OK")
shell=open("shell.html",encoding="utf-8").read()
# Minification (tools/minif.py): unneeded comments and whitespace removed from the script and the stylesheet, nothing renamed or
# rewritten (same syntax tree: node tools/dev/check_minif.js). WARBASH_READABLE=1 python3 build.py keeps the code as is, to
# read a call stack or debug in the browser; do not commit (dist/ always follows the minified build).
if not os.environ.get("WARBASH_READABLE"):
    n0=len(js); js=minif.js(js)
    a=shell.index("<style>")+len("<style>"); b=shell.index("</style>",a); n1=b-a
    shell=shell[:a]+minif.css(shell[a:b])+shell[b:]
    print("minification: script",n0//1024,"KB ->",len(js)//1024,"KB, style",n1//1024,"KB ->",(shell.index("</style>")-a)//1024,"KB")
else: print("minification: none (WARBASH_READABLE)")
if shell.count("<!--SOCLE_UI-->")!=1: raise SystemExit("marker <!--SOCLE_UI--> not found or duplicated in shell.html")
if re.search(r"</script",js,re.I): raise SystemExit("the game code contains </script: it would close the tag that carries it")
html=shell.replace("<!--SOCLE_UI-->",'<script src="'+baseAssets["base-assets-ui"]+'"></script>').replace("<!--SCRIPTS-->", '<script src="'+baseAssets["baseAssets"]+'"></script>\n<script src="'+baseAssets["three"]+'"></script>'+tags+"\n<script>\n"+js+"\n</script>")
# Game icon (assets/icon/): the favicon is embedded in the page (it also works offline), the other sizes are files next to
# the HTML, dist/icons/<name>.<hash>.png, cached indefinitely (home screen icon, pinned tabs, manifest).
icons={}
os.makedirs("dist/icons",exist_ok=True)
for f in sorted(glob.glob("assets/icon/*.png")):
    key=os.path.splitext(os.path.basename(f))[0]; data=open(f,"rb").read()
    icons[key]="icons/"+key+"."+hashlib.sha1(data).hexdigest()[:8]+".png"
    if not os.path.exists("dist/"+icons[key]): open("dist/"+icons[key],"wb").write(data)
for f in glob.glob("dist/icons/*.png"):
    if "icons/"+os.path.basename(f) not in icons.values(): os.remove(f)
for k in ("favicon-64","favicon-96","apple-touch-icon","icon-192","icon-512"):
    if k not in icons: raise SystemExit("missing icon: assets/icon/"+k+".png")
# Shared link preview (og: tags of shell.html): assets/preview.jpg (composed by tools/dev/preview.py), copied like the icons with
# a fingerprint (indefinite cache). SITE is the game's public reference address (canonical link, og:url, og:image): the other
# addresses (without www, previews, old .vercel.app addresses) redirect to it or must not be referenced.
SITE=os.environ.get("WARBASH_SITE","https://warbash.play.multiplayeragent.com").rstrip("/")
data=open("assets/preview.jpg","rb").read(); preview="icons/preview."+hashlib.sha1(data).hexdigest()[:8]+".jpg"
if not os.path.exists("dist/"+preview): open("dist/"+preview,"wb").write(data)
for f in glob.glob("dist/icons/preview.*.jpg"):
    if "icons/"+os.path.basename(f)!=preview: os.remove(f)
html=html.replace("__SITE__",SITE).replace("__PREVIEW__",preview)
# Installable app manifest (Android: "Add to home screen" opens the game fullscreen, in landscape, without an address bar)
for k in ("maskable-192","maskable-512"):
    if k not in icons: raise SystemExit("missing icon: assets/icon/"+k+".png")
json.dump({"id":"/","name":"War Bash","short_name":"War Bash","description":"Online FPS in the browser: solo against bots or online with friends.",
    "start_url":"./","scope":"./","display":"fullscreen","display_override":["fullscreen","standalone"],"orientation":"landscape","categories":["games"],
    "background_color":"#0E110D","theme_color":"#0E110D","prefer_related_applications":False,
    "icons":[{"src":icons["icon-192"],"sizes":"192x192","type":"image/png","purpose":"any"},{"src":icons["icon-512"],"sizes":"512x512","type":"image/png","purpose":"any"},
             {"src":icons["maskable-192"],"sizes":"192x192","type":"image/png","purpose":"maskable"},{"src":icons["maskable-512"],"sizes":"512x512","type":"image/png","purpose":"maskable"}]},
    open("dist/manifest.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
# Service worker (assets/pwa/sw.js): at the root of dist/ to cover the whole site
shutil.copyfile("assets/pwa/sw.js","dist/sw.js")
# Steam Deck (README "Steam Deck"): the installer and the Steam shortcut images (python3 tools/dev/deck_art.py), at a fixed address
# in dist/deck/ (the installer downloads them by name)
DECK=("installer.sh","cover.jpg","capsule.jpg","hero.jpg","logo.png","icon.png")
os.makedirs("dist/deck",exist_ok=True)
for f in glob.glob("dist/deck/*"):
    if os.path.basename(f) not in DECK: os.remove(f)
for f in DECK:
    if not os.path.exists("assets/deck/"+f): raise SystemExit("assets/deck/"+f+" missing (python3 tools/dev/deck_art.py for the images)")
    if f.endswith(".sh"): open("dist/deck/"+f,"w",encoding="utf-8",newline="\n").write(open("assets/deck/"+f,encoding="utf-8").read().replace("__SITE__",SITE))
    else: shutil.copyfile("assets/deck/"+f,"dist/deck/"+f)
shutil.copyfile("assets/icon/favicon.ico","dist/favicon.ico")  # /favicon.ico: default path that search engines try
html=html.replace("__ICON_FAVICON96__",icons["favicon-96"]).replace("__ICON_FAVICON__",data_uri("assets/icon/favicon-64.png")).replace("__ICON_APPLE__",icons["apple-touch-icon"])
print("icons:",", ".join(icons))
# Update log: most recent to oldest; each production release adds an entry (see README)
log=json.load(open("changelog.json",encoding="utf-8"))
def vkey(v): return tuple(int(x) for x in v.split("."))
if not isinstance(log,list) or not log: raise SystemExit("changelog.json: non-empty list expected")
for i,e in enumerate(log):
    if not re.fullmatch(r"\d+\.\d+\.\d+",str(e.get("version",""))): raise SystemExit(f"changelog.json: invalid version (entry {i+1})")
    try: datetime.date.fromisoformat(e.get("date",""))
    except ValueError: raise SystemExit(f"changelog.json: invalid date for {e['version']} (YYYY-MM-DD expected)")
    # a title exists only for a major version (X.0.0, announced fullscreen); other entries have only their number and their list
    major=bool(re.fullmatch(r"\d+\.0\.0",e["version"]))
    if major and not str(e.get("title","")).strip(): raise SystemExit(f"changelog.json: missing title for major version {e['version']}")
    if not e.get("changes"): raise SystemExit(f"changelog.json: no changes for {e['version']}")
    for c in e["changes"]:
        if c.get("t") not in ("new","improved","fixed") or not str(c.get("x","")).strip(): raise SystemExit(f"changelog.json: invalid change for {e['version']} (t: new, improved or fixed)")
    if i and vkey(log[i-1]["version"])<=vkey(e["version"]): raise SystemExit(f"changelog.json: versions must be ordered from most recent to oldest ({e['version']})")
html=html.replace("__CHANGELOG__",json.dumps(log,ensure_ascii=False,separators=(",",":")).replace("<","\\u003c"))
print("version:",log[0]["version"])
# SEO (README "SEO"): the structured data of shell.html must stay valid JSON (otherwise search engines ignore it
# silently); robots.txt and sitemap.xml are served as is (excluded from the rewrite to the page in vercel.json).
# Vercel previews carry "X-Robots-Tag: noindex" by themselves: only the SITE address is indexed.
for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S): json.loads(bloc)
open("dist/robots.txt","w",encoding="utf-8").write("User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: "+SITE+"/sitemap.xml\n")
open("dist/sitemap.xml","w",encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    '  <url><loc>'+SITE+'/</loc><lastmod>'+log[0]["date"]+'</lastmod></url>\n</urlset>\n')
os.makedirs("dist",exist_ok=True)
for f in ("mp.config.js","mp.config.local.js"):
    if os.path.exists(f): shutil.copyfile(f,"dist/"+f)
    elif os.path.exists("dist/"+f): os.remove("dist/"+f)
local=open("mp.config.local.js",encoding="utf-8").read() if os.path.exists("mp.config.local.js") else ""
mpkey=(re.findall(r"pk_(?:live|test)_[A-Za-z0-9]{16,}",local) or [""])[0]
print("online lobbies:",("key "+mpkey[:14]+"...") if mpkey else "no key (mp.config.local.js missing): game offline")
# Menu music: assets/music/menu-theme.mp3, copied next to the HTML (not embedded); the address carries a hash for the cache. If absent: no music.
music=""
if os.path.exists("assets/music/menu-theme.mp3"):
    shutil.copyfile("assets/music/menu-theme.mp3","dist/menu-theme.mp3")
    music="menu-theme.mp3?v="+hashlib.sha1(open("dist/menu-theme.mp3","rb").read()).hexdigest()[:8]
html=html.replace("__MENU_MUSIC__",music)
print("menu music:",music or "none")
# Version identifier: hash of the page itself (marker included), written into the page and into dist/version.json.
# The game compares the two to reload itself when a new version is online (see src/09h-update.js and vercel.json).
build_id=hashlib.sha1(html.encode("utf-8")).hexdigest()[:12]
html=html.replace("__BUILD_ID__",build_id)
print("version id:",build_id)
# Content Security Policy (CSP, meta tag at the top: it follows each build): scripts from the site only, plus the
# page's inline scripts named by their fingerprint; a script slipped into the page through a flaw (onerror attribute, injected
# tag) does not run, and data only goes to the site and the game server. frame-ancestors and X-Frame-Options only
# work as a header: vercel.json. The style="" attributes of the templates need 'unsafe-inline' for styles (no execution risk).
inline=re.findall(r"<script>(.*?)</script>",html,re.S)
if len(inline)<1: raise SystemExit("CSP: inline script expected (game code)")
sha=" ".join("'sha256-"+base64.b64encode(hashlib.sha256(x.encode("utf-8")).digest()).decode("ascii")+"'" for x in inline)
net=" ".join(MP_HOSTS)
csp=("default-src 'self'; script-src 'self' "+sha+" "+MP_HOSTS[0]+"; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
     "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' "+net+"; "
     "manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
if html.count('<meta charset="utf-8">')!=1: raise SystemExit("shell.html: <meta charset=\"utf-8\"> expected once")
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">')
print("CSP:",len(inline),"inline script(s), game server")
os.makedirs("dist", exist_ok=True)
open("dist/index.html","w",encoding="utf-8").write(html)
with open("dist/version.json","w",encoding="utf-8") as f: f.write(json.dumps({"build":build_id,"version":log[0]["version"]})+"\n")
bad=[(i+1) for i,l in enumerate(html.split("\n")) if re.search("[\u2013\u2014\u2015]",l)]
if re.search(r"const LEGAL ?= ?\{[^}]*?(name|address|email|host): ?'\[",html): print("WARNING: legal notices to fill in (legal.local.json: name, address, email, host, see legal.example.json) before going online")
print("page size:",len(html),"characters, lines with forbidden dashes:",bad)
# style of the texts the player sees (tools/dev/check_text.py, README "Text style"): the build fails on the slightest deviation
import sys as _sys
_sys.path.insert(0,"tools/dev")
import check_text
style=check_text.verify()
for e in style: print("style:",e)
if style: raise SystemExit(f"{len(style)} style problem(s) in the player's texts (python3 tools/dev/check_text.py, README 'Text style')")
print("text style: nothing to report")
# the code, comments, tools and docs are in English (tools/dev/check_english.py): in-world signs and place names of the maps
# stay in their country's language (map files, tools/dev/english_allow.txt); anything else in French fails the build
import check_english
french=check_english.check(os.getcwd())
for e in french[:20]: print("french:",e)
if french: raise SystemExit(f"{len(french)} French text(s) in the code (python3 tools/dev/check_english.py)")
print("english: nothing to report")
# asset list (docs/assets.md, tools/dev/assets.py): regenerated at every build from the code, so it follows the code without anyone thinking about it
import assets as _assets
_res,_dbl=_assets.write_out()
print("asset list:",_res)
for _k,_v in _dbl.items(): print(f"WARNING: prefab defined twice, PF.{_k} ({', '.join(_v)}): the last definition replaces the other")
# Secrets guard: no secret key (sk_live_..., sk_test_...) may end up in dist/ (see tools/check_secrets.mjs). A single
# finding fails the build and removes the page, so it cannot be published by mistake.
SECRET=re.compile(r"(?<![A-Za-z0-9])sk"+r"_(?:live|test)_[A-Za-z0-9]{8,}")
leaks=[]
for root,_,names in os.walk("dist"):
    for n in names:
        f=os.path.join(root,n)
        if SECRET.search(open(f,"rb").read().decode("latin-1")): leaks.append(f)
if leaks:
    try: os.remove("dist/index.html")
    except OSError: pass
    raise SystemExit("SECRET KEY in the build, page removed: "+", ".join(leaks))
print("secrets guard: dist/ clean")
