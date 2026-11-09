"""Third-party libraries served by the site itself (no more jsDelivr): rebuilds assets/vendor/ from tools/dev/node_modules
(cd tools/dev && npm ci), to be rerun only if a version changes in tools/dev/package.json.
- assets/vendor/three-r147.js: three.js r147 and the example modules the game uses, concatenated (MIT license, at the top);
  build.py turns it into dist/tex/three.<hash>.js, loaded by a script tag before the game code.
- assets/vendor/hdri/<name>.exr: the Poly Haven HDRIs (CC0) packaged by @pmndrs/assets, turned back into binary; build.py turns them into
  texPack packs (key hdri_<name>), loaded at launch of the map that asks for one (src/01-core.js, loadHDRIEnvironment).
A third-party script loaded from another host would run with the player's session: served from here, it only changes with the repo."""
import base64,os,re
NM="tools/dev/node_modules/"
LIBS=["build/three.min.js","examples/js/shaders/CopyShader.js","examples/js/shaders/LuminosityHighPassShader.js","examples/js/postprocessing/EffectComposer.js",
      "examples/js/postprocessing/RenderPass.js","examples/js/postprocessing/ShaderPass.js","examples/js/postprocessing/UnrealBloomPass.js",
      "examples/js/csm/CSMFrustum.js","examples/js/csm/CSMShader.js","examples/js/csm/CSM.js","examples/js/geometries/RoundedBoxGeometry.js",
      "examples/js/libs/fflate.min.js","examples/js/loaders/EXRLoader.js","examples/js/math/SimplexNoise.js","examples/js/shaders/SSAOShader.js",
      "examples/js/postprocessing/SSAOPass.js"]
HDRI=["park","sky","sunset"]
def main():
    if not os.path.isdir(NM+"three"): raise SystemExit("tools/dev/node_modules missing: cd tools/dev && npm ci")
    ver=re.search(r'"version":\s*"([^"]+)"',open(NM+"three/package.json",encoding="utf-8").read()).group(1)
    lic=open(NM+"three/LICENSE",encoding="utf-8").read().strip()
    out=["/* three.js "+ver+" (https://github.com/mrdoob/three.js), npm package files concatenated by tools/vendor.py:\n   "
         +", ".join(LIBS)+"\n\n"+lic+"\n*/"]
    for l in LIBS:
        s=open(NM+"three/"+l,encoding="utf-8").read()
        if "</script" in s.lower(): raise SystemExit(l+" contains </script")
        out.append("/* "+l+" */\n"+s.rstrip()+"\n;")
    os.makedirs("assets/vendor/hdri",exist_ok=True)
    open("assets/vendor/three-r147.js","w",encoding="utf-8").write("\n".join(out)+"\n")
    for n in HDRI:
        s=open(NM+"@pmndrs/assets/hdri/"+n+".exr.js",encoding="utf-8").read()
        m=re.search(r"base64,([A-Za-z0-9+/=]+)'",s)
        if not m: raise SystemExit("hdri/"+n+".exr.js: data not found")
        open("assets/vendor/hdri/"+n+".exr","wb").write(base64.b64decode(m.group(1)))
    print("assets/vendor :",os.path.getsize("assets/vendor/three-r147.js")//1024,"KB of three.js,",len(HDRI),"HDRI")
main()
