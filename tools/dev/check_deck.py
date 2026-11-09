"""Check of the Steam Deck installer (dist/deck/installer.sh, README "Steam Deck") on any Linux: fake home folder,
fake Steam (a shortcut already there, a controls layout already chosen, layout templates), dist/ served locally, installer in
WARBASH_DECK_TEST mode (no Flatpak, no Steam shutdown or return to Game mode). Verifies with an independent read (vdf package):
shortcut, id, images, layout, launcher; a second install without duplicates; the uninstall that gives back the original file
byte for byte; an unknown file left as is; the first shortcut of a device.
python3 tools/dev/check_deck.py (after python3 build.py; once: pip install --user vdf). Exit code 1 on the slightest failure."""
import os, sys, shutil, subprocess, zlib, http.server, threading, functools, filecmp, tempfile
try:
    import vdf
except ImportError:
    sys.exit('vdf package missing: pip install --user vdf')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
T = tempfile.mkdtemp(prefix='warbash-deck-')
HOME = os.path.join(T, 'home'); STEAM = os.path.join(HOME, '.local/share/Steam')
U = os.path.join(STEAM, 'userdata/12345/config'); os.makedirs(U)
os.makedirs(os.path.join(STEAM, 'userdata/0'))  # folder "0" to ignore
other = {'appid': -1999999999, 'AppName': 'Café Emulator', 'Exe': '"/usr/bin/retroarch"', 'StartDir': '"/usr/bin/"', 'icon': '', 'ShortcutPath': '',
         'LaunchOptions': '-f', 'IsHidden': 0, 'AllowDesktopConfig': 1, 'AllowOverlay': 1, 'OpenVR': 0, 'Devkit': 0, 'DevkitGameID': '',
         'DevkitOverrideAppID': 0, 'LastPlayTime': 1700000000, 'FlatpakAppID': '', 'tags': {'0': 'favorite'}}
orig = vdf.binary_dumps({'shortcuts': {'0': other}})
open(os.path.join(U, 'shortcuts.vdf'), 'wb').write(orig)
TPL = os.path.join(STEAM, 'controller_base/templates'); os.makedirs(TPL)
for f in ('controller_neptune_gamepad_joystick.vdf', 'controller_neptune_gamepad+mouse.vdf', 'controller_neptune_gamepad_fps.vdf', 'controller_ps5_gamepad+mouse.vdf'): open(os.path.join(TPL, f), 'w').write('"controller_mappings"\n{\n}\n')
CC = os.path.join(STEAM, 'steamapps/common/Steam Controller Configs/12345/config'); os.makedirs(CC)
open(os.path.join(CC, 'configset_controller_neptune.vdf'), 'w').write('"controller_config"\n{\n\t"emulator"\n\t{\n\t\t"template"\t\t"controller_neptune_gamepad_fps.vdf"\n\t}\n}\n')
# page served locally
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=os.path.join(REPO, 'dist')))
threading.Thread(target=srv.serve_forever, daemon=True).start()
SITE = 'http://127.0.0.1:%d' % srv.server_port
fails = 0
def ok(c, m):
    global fails
    print(('ok    : ' if c else 'FAIL  : ') + m); fails += 0 if c else 1
def run(*args, env=None):
    e = dict(os.environ, HOME=HOME, WARBASH_DECK_TEST='1'); e.update(env or {})
    p = subprocess.run(['bash', os.path.join(REPO, 'dist/deck/installer.sh'), SITE, *args], env=e, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return p.returncode, p.stdout + p.stderr
D = os.path.join(HOME, '.local/share/war-bash')
exe = '"%s/warbash.sh"' % D; appid = zlib.crc32((exe + 'War Bash').encode()) | 0x80000000
def state():
    sc = vdf.binary_loads(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read())['shortcuts']
    cs = vdf.loads(open(os.path.join(CC, 'configset_controller_neptune.vdf')).read())['controller_config']
    return sc, cs
for n in (1, 2):
    rc, out = run()
    ok(rc == 0, f'installation {n}: code {rc}' + ('' if rc == 0 else '\n' + out))
    sc, cs = state()
    ok(len(sc) == 2, f'installation {n}: two shortcuts (ours and the existing one), no duplicate ({len(sc)})')
    ok(sc['0'] == other, f'installation {n}: existing shortcut intact')
    me = sc['1']
    ok(me['AppName'] == 'War Bash' and me['Exe'] == exe and me['appid'] & 0xffffffff == appid, f'installation {n}: our shortcut (name, launcher, ID {appid})')
    ok(me['icon'] == D + '/icon.png' and os.path.exists(me['icon']), f'installation {n}: icon')
    G = os.path.join(U, 'grid')
    for src, dst in (('cover.jpg', '%dp.jpg'), ('capsule.jpg', '%d.jpg'), ('hero.jpg', '%d_hero.jpg'), ('logo.png', '%d_logo.png')):
        f = os.path.join(G, dst % appid); ok(os.path.exists(f) and filecmp.cmp(f, os.path.join(REPO, 'dist/deck', src), shallow=False), f'installation {n}: image {dst % appid}')
    ok(cs.get('emulator', {}).get('template') == 'controller_neptune_gamepad_fps.vdf', f'installation {n}: existing layout intact')
    ok(cs.get('war bash', {}).get('template') == 'controller_neptune_gamepad+mouse.vdf' and cs.get('war bash', {}).get('template') == 'controller_neptune_gamepad+mouse.vdf', f'installation {n}: gamepad layout with mouse')
    sh = open(os.path.join(D, 'warbash.sh')).read()
    ok(f'"{SITE}/?deck=1"' in sh and '--kiosk' in sh and 'com.google.Chrome' in sh and os.access(os.path.join(D, 'warbash.sh'), os.X_OK), f'installation {n}: executable launcher, opens {SITE}/?deck=1 fullscreen')
ok(open(os.path.join(U, 'shortcuts.vdf.warbash-backup'), 'rb').read() == orig, 'backup of the original file')
# uninstall: we return exactly to the original file
rc, out = run('--uninstall')
ok(rc == 0, 'uninstall: code %d' % rc + ('' if rc == 0 else '\n' + out))
ok(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read() == orig, 'uninstall: shortcuts file identical to the original, byte for byte')
ok(not [f for f in os.listdir(os.path.join(U, 'grid')) if f.startswith(str(appid))], 'uninstall: images removed')
sc, cs = state()
ok(set(cs) == {'emulator'}, 'uninstall: layout removed, the other one kept')
ok(not os.path.exists(D), 'uninstall: launcher removed')
# unreadable file: nothing is written
bad = orig[:-1] + b'\x05\x08'
open(os.path.join(U, 'shortcuts.vdf'), 'wb').write(bad)
rc, out = run()
ok(rc != 0 and open(os.path.join(U, 'shortcuts.vdf'), 'rb').read() == bad and 'SKIP' in out, 'unknown file: install refused, file left as is')
# first shortcut of the device (no shortcuts.vdf) and without a gamepad template
os.remove(os.path.join(U, 'shortcuts.vdf')); shutil.rmtree(TPL)
rc, out = run(env={'LANG': 'en_US.UTF-8'})
sc = vdf.binary_loads(open(os.path.join(U, 'shortcuts.vdf'), 'rb').read())['shortcuts']
ok(rc == 0 and len(sc) == 1 and sc['0']['AppName'] == 'War Bash', 'no existing shortcut: file created with ours')
ok('Gamepad with Mouse Trackpad' in out, 'no gamepad template: the message says which layout to choose (in English)')
srv.shutdown(); shutil.rmtree(T, ignore_errors=True)
print('all good' if not fails else '%d failure(s)' % fails); sys.exit(1 if fails else 0)
