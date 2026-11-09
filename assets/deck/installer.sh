#!/bin/bash
# War Bash on Steam Deck: installs the game into Steam, from Desktop Mode (README "Steam Deck").
# Run by the "Install War Bash" file the game downloads (main menu button on Steam Deck), or by hand:
#   curl -fsSL __SITE__/deck/installer.sh | bash
#   bash installer.sh [game address] [--uninstall]
# It installs Chrome (Flathub, per user, no password) and gives it access to the controller, writes a launcher that opens the online
# game fullscreen (?deck=1: the game's Deck mode), closes Steam, adds the shortcut (shortcuts.vdf) with its artwork (grid folder) and
# the gamepad controller layout, then goes back to Gaming Mode. The game updates like the web version: the launcher opens the site.
# The shortcuts file is rewritten only if reading it back gives exactly the same bytes (otherwise nothing is touched), with a
# backup next to it. Running the installer again replaces the shortcut instead of adding one. WARBASH_DECK_TEST=1: no Flatpak, no
# Steam shutdown and no return to Gaming Mode (for testing off a Steam Deck).
set -u
SITE="__SITE__"
MODE=install
for a in "$@"; do
  case "$a" in
    --uninstall) MODE=uninstall ;;
    http://*|https://*) SITE="${a%/}" ;;
  esac
done
# https only (http for a test on this machine: tools/dev/check_deck.py): the launcher and what it downloads never travel in clear
if ! [[ "$SITE" =~ ^https://[A-Za-z0-9.:-]+$ || "$SITE" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]]; then echo "Invalid address: $SITE"; exit 1; fi
APP="War Bash"
DIR="$HOME/.local/share/war-bash"
TEST="${WARBASH_DECK_TEST:-}"
t() { printf '%s\n' "$1"; }
pause() { [ -n "$TEST" ] && return; [ -t 0 ] || [ -e /dev/tty ] || return; t "Press Enter to close this window."; read -r _ < /dev/tty || true; }
fail() { echo; t "FAILED: $1"; pause; exit 1; }

echo "=== $APP ==="
command -v python3 >/dev/null || fail "python3 not found."
command -v curl >/dev/null || fail "curl not found."

# Steam: the usual SteamOS install, otherwise ~/.steam/steam
STEAM=""
for d in "$HOME/.local/share/Steam" "$HOME/.steam/steam"; do [ -d "$d/userdata" ] && { STEAM="$(readlink -f "$d")"; break; }; done
[ -n "$STEAM" ] || fail "Steam not found. Start Steam once, sign in, then run the installer again."

if [ "$MODE" = install ]; then
  # 1. Chrome (Flatpak) and the controller
  if [ -z "$TEST" ]; then
    command -v flatpak >/dev/null || fail "Flatpak not found."
    if ! flatpak info com.google.Chrome >/dev/null 2>&1; then
      t "Installing Google Chrome from Flathub (a few minutes)..."
      flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || fail "Cannot reach Flathub."
      flatpak install --user -y flathub com.google.Chrome || fail "Chrome installation failed."
    fi
    # without access to /run/udev, Chrome in Flatpak does not see the Steam Deck's controller
    flatpak override --user --filesystem=/run/udev:ro com.google.Chrome || fail "Could not give Chrome access to the controller."
  fi

  # 2. Launcher and artwork
  mkdir -p "$DIR" || fail "Cannot create $DIR."
  t "Downloading the game artwork..."
  for f in cover.jpg capsule.jpg hero.jpg logo.png icon.png; do
    curl -fsSL "$SITE/deck/$f" -o "$DIR/$f" || fail "Could not download $f."
  done
  # a Chrome profile for the game alone: its own progress and settings, and its own window (a Chrome already open does not take it)
  cat > "$DIR/warbash.sh" <<EOF
#!/bin/bash
# $APP launcher on Steam Deck, written by the installer ($SITE/deck/installer.sh): the online game, fullscreen, with the controller.
exec flatpak run --branch=stable --arch=x86_64 --command=/app/bin/chrome com.google.Chrome \\
  --user-data-dir="\$HOME/.var/app/com.google.Chrome/data/war-bash" --kiosk --no-first-run --no-default-browser-check \\
  --password-store=basic --autoplay-policy=no-user-gesture-required --hide-crash-restore-bubble --disable-features=Translate \\
  "$SITE/?deck=1"
EOF
  chmod +x "$DIR/warbash.sh"
  # also in the Desktop Mode application menu
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/war-bash.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$APP
Exec="$DIR/warbash.sh"
Icon=$DIR/icon.png
Categories=Game;
EOF
fi

# 3. Steam closed while writing (it rewrites its files when it quits)
if [ -z "$TEST" ] && pgrep -x steam >/dev/null; then
  t "Closing Steam..."
  steam -shutdown >/dev/null 2>&1 &
  for _ in $(seq 60); do pgrep -x steam >/dev/null || break; sleep 1; done
  pgrep -x steam >/dev/null && fail "Steam did not close. Quit Steam, then run the installer again."
fi

# 4. Shortcut, artwork, controller layout (Python: the shortcuts file is binary)
PY="$(mktemp)"
cat > "$PY" <<'PYEOF'
import glob, os, re, shutil, struct, sys, zlib
mode, steam, d, app = sys.argv[1:5]
exe = '"%s/warbash.sh"' % d
appid = zlib.crc32((exe + app).encode('utf-8')) | 0x80000000  # shortcut id, written in shortcuts.vdf: the artwork files are named after it
names = [app.lower(), app.lower().replace(':', '')]            # shortcut key in the controller layouts (without the colon in some versions)

# --- binary VDF (shortcuts.vdf): 00 table, 01 string, 02 32-bit integer, 03 float, 07 64-bit integer, 08 end of table
def bparse(b):
    pos = 0
    def rmap():
        nonlocal pos
        out = []
        while True:
            ty = b[pos]; pos += 1
            if ty == 8: return out
            e = b.index(b'\0', pos); k = b[pos:e]; pos = e + 1
            if ty == 0: out.append([k, 0, rmap()])
            elif ty == 1: e = b.index(b'\0', pos); out.append([k, 1, b[pos:e]]); pos = e + 1
            elif ty in (2, 3): out.append([k, ty, b[pos:pos + 4]]); pos += 4
            elif ty == 7: out.append([k, ty, b[pos:pos + 8]]); pos += 8
            else: raise ValueError('type %d' % ty)
    root = rmap()
    if pos != len(b): raise ValueError('unexpected end')
    return root
def bdump(m):
    o = bytearray()
    for k, ty, v in m:
        o.append(ty); o += k + b'\0'
        o += bdump(v) if ty == 0 else (v + b'\0' if ty == 1 else v)
    o.append(8); return bytes(o)
def field(e, name):
    for f in e:
        if f[0].decode('utf-8', 'replace').lower() == name.lower(): return f
    return None

# --- text VDF (controller layouts): quoted strings and braces, kept as they are
def tparse(s):
    toks = re.findall(r'"((?:[^"\\]|\\.)*)"|([{}])', re.sub(r'//[^\n]*', '', s))
    pos = 0
    def rmap():
        nonlocal pos
        out = []
        while pos < len(toks):
            q, br = toks[pos]; pos += 1
            if br == '}': return out
            nq, nbr = toks[pos]; pos += 1
            out.append([q, rmap()] if nbr == '{' else [q, nq])
        return out
    return rmap()
def tdump(m, ind=0):
    o = ''
    for k, v in m:
        if isinstance(v, list): o += '\t' * ind + '"%s"\n' % k + '\t' * ind + '{\n' + tdump(v, ind + 1) + '\t' * ind + '}\n'
        else: o += '\t' * ind + '"%s"\t\t"%s"\n' % (k, v)
    return o

def backup(f):
    if os.path.exists(f) and not os.path.exists(f + '.warbash-backup'): shutil.copyfile(f, f + '.warbash-backup')

users = [u for u in glob.glob(os.path.join(steam, 'userdata', '*')) if os.path.basename(u).isdigit() and os.path.basename(u) != '0']
if not users: print('NOUSER'); sys.exit(3)
# "gamepad with mouse trackpad" layout: picked among this Steam install's templates (the name varies between versions)
tpl = sorted(os.path.basename(f) for f in glob.glob(os.path.join(steam, 'controller_base', 'templates', '*.vdf')))
pick = next((f for f in tpl if 'neptune' in f and 'gamepad' in f and 'mouse' in f), None)
ok = 0
for u in users:
    uid = os.path.basename(u)
    cfg = os.path.join(u, 'config'); os.makedirs(cfg, exist_ok=True)
    sf = os.path.join(cfg, 'shortcuts.vdf')
    raw = open(sf, 'rb').read() if os.path.exists(sf) else b'\x00shortcuts\x00\x08\x08'
    try:
        root = bparse(raw)
        if bdump(root) != raw: raise ValueError('read-back differs')
        if not root or root[0][1] != 0: raise ValueError('no shortcuts table')
        sc = root[0][2]
    except Exception as e:
        print('SKIP %s %s' % (uid, e)); continue
    # our shortcut: by its name or by its launcher
    mine = [e for e in sc if e[1] == 0 and ((field(e[2], 'AppName') and field(e[2], 'AppName')[2].decode('utf-8', 'replace').lower() == app.lower())
            or (field(e[2], 'Exe') and b'war-bash/warbash.sh' in field(e[2], 'Exe')[2]))]
    olds = [struct.unpack('<I', field(e[2], 'appid')[2])[0] for e in mine if field(e[2], 'appid')]
    sc[:] = [e for e in sc if e not in mine]
    if mode == 'install':
        s = lambda v: v.encode('utf-8')
        i32 = lambda v: struct.pack('<I', v & 0xffffffff)
        entry = [[b'appid', 2, i32(appid)], [b'AppName', 1, s(app)], [b'Exe', 1, s(exe)], [b'StartDir', 1, s('"%s"' % d)],
                 [b'icon', 1, s(d + '/icon.png')], [b'ShortcutPath', 1, b''], [b'LaunchOptions', 1, b''], [b'IsHidden', 2, i32(0)],
                 [b'AllowDesktopConfig', 2, i32(1)], [b'AllowOverlay', 2, i32(1)], [b'OpenVR', 2, i32(0)], [b'Devkit', 2, i32(0)],
                 [b'DevkitGameID', 1, b''], [b'DevkitOverrideAppID', 2, i32(0)], [b'LastPlayTime', 2, i32(0)], [b'FlatpakAppID', 1, b''],
                 [b'tags', 0, []]]
        sc.append([b'', 0, entry])
    for n, e in enumerate(sc): e[0] = str(n).encode()  # index 0, 1, 2... with no gap
    backup(sf)
    open(sf + '.tmp', 'wb').write(bdump(root)); os.replace(sf + '.tmp', sf)
    # artwork: cover (p), horizontal capsule, banner (_hero), logo; those of an old id are removed
    grid = os.path.join(cfg, 'grid'); os.makedirs(grid, exist_ok=True)
    for a in set(olds) | {appid}:
        for f in glob.glob(os.path.join(grid, '%d*' % a)):
            if re.fullmatch(r'%d(p|_hero|_logo)?\.(png|jpg|jpeg|webp)' % a, os.path.basename(f)): os.remove(f)
    if mode == 'install':
        for src, dst in (('cover.jpg', '%dp.jpg'), ('capsule.jpg', '%d.jpg'), ('hero.jpg', '%d_hero.jpg'), ('logo.png', '%d_logo.png')):
            shutil.copyfile(os.path.join(d, src), os.path.join(grid, dst % appid))
    # controller layout: without it, Steam may give the shortcut a keyboard and mouse layout, which Chrome does not read
    cc = os.path.join(steam, 'steamapps', 'common', 'Steam Controller Configs', uid, 'config')
    cf = os.path.join(cc, 'configset_controller_neptune.vdf')
    if pick or os.path.exists(cf):
        try:
            m = tparse(open(cf, encoding='utf-8').read()) if os.path.exists(cf) else [['controller_config', []]]
            body = m[0][1]
            body[:] = [kv for kv in body if kv[0] not in names]
            if mode == 'install' and pick:
                for n in names: body.append([n, [['template', pick]]])
            os.makedirs(cc, exist_ok=True); backup(cf)
            open(cf + '.tmp', 'w', encoding='utf-8').write(tdump(m)); os.replace(cf + '.tmp', cf)
        except Exception as e:
            print('NOTPL %s %s' % (uid, e))
    ok += 1
print('APPID %d' % appid)
print('TEMPLATE %s' % (pick or '-'))
print('USERS %d' % ok)
sys.exit(0 if ok else 4)
PYEOF
OUT="$(python3 "$PY" "$MODE" "$STEAM" "$DIR" "$APP")"; RC=$?
rm -f "$PY"
echo "$OUT" | grep -E '^(SKIP|NOTPL)' || true
[ $RC -eq 3 ] && fail "No Steam account on this device. Sign in to Steam once, then run the installer again."
[ $RC -ne 0 ] && fail "The Steam shortcut could not be written."
if [ "$MODE" = uninstall ]; then
  rm -rf "$DIR" "$HOME/.local/share/applications/war-bash.desktop"
  t "$APP has been removed from Steam."
else
  echo "$OUT" | grep -q '^TEMPLATE -$' && t "Controller layout: pick Gamepad with Mouse Trackpad in Steam if the controller does not respond in game."
  t "$APP is installed in Steam."
fi

# 5. Back to Gaming Mode (SteamOS), otherwise Steam restarted
[ -n "$TEST" ] && exit 0
if command -v steamos-session-select >/dev/null; then
  t "Returning to Gaming Mode in 5 seconds..."
  sleep 5
  steamos-session-select
else
  (setsid steam >/dev/null 2>&1 &)
  pause
fi
