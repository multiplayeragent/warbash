# Soldier animations: bake them from your own Mixamo account

The soldiers' body animations come from Mixamo (Adobe). Mixamo's terms let you use its animations inside a game, but not
redistribute the files on their own, so this repository does not include them. You download them once with your own
free Mixamo account; a script turns them into the compact data the game embeds (`assets/anim/clips.bin` and `clips.json`,
both gitignored).

Without them the game still runs, with simpler fallback poses for the soldiers.

## 1. Download the clips from Mixamo

1. Sign in at https://www.mixamo.com (a free Adobe account is enough).
2. Leave the default character (Y Bot) selected.
3. For each row of the table below, search for the animation, open it, and set the options:
   - **In Place**: leave it **unchecked** when the option exists. The bake measures the walking speed from the movement and
     removes the movement itself.
   - Keep the other sliders at their defaults.
4. Click **Download** with these settings:
   - Format: **FBX Binary (.fbx)**
   - Skin: **Without Skin**
   - Frames per Second: **30**
   - Keyframe Reduction: **none**
5. Rename the downloaded file to the name in the **File** column and put it in `anim-source/fbx/` at the root of the
   repository (create the folder; `anim-source/` is gitignored).

Any close match works: the bake measures speed, direction and the loop seam itself, and checks the direction against the
table. If Mixamo has no exact match, take the nearest rifle animation.

| File (`anim-source/fbx/<file>.fbx`) | Search on Mixamo | Loops |
|---|---|---|
| rifle-idle | Rifle Idle | yes |
| rifle-aim-idle | Rifle Aiming Idle | yes |
| rifle-walk-forward | Rifle Walk Forward | yes |
| rifle-walk-forward-left | Rifle Walk Forward Left | yes |
| rifle-walk-left | Rifle Walk Left (strafe) | yes |
| rifle-walk-backward-left | Rifle Walk Backward Left | yes |
| rifle-walk-backward | Rifle Walk Backward | yes |
| rifle-walk-backward-right | Rifle Walk Backward Right | yes |
| rifle-walk-right | Rifle Walk Right (strafe) | yes |
| rifle-walk-forward-right | Rifle Walk Forward Right | yes |
| rifle-run-forward | Rifle Run Forward | yes |
| rifle-run-forward-left | Rifle Run Forward Left | yes |
| rifle-run-left | Rifle Run Left (strafe) | yes |
| rifle-run-backward-left | Rifle Run Backward Left | yes |
| rifle-run-backward | Rifle Run Backward | yes |
| rifle-run-backward-right | Rifle Run Backward Right | yes |
| rifle-run-right | Rifle Run Right (strafe) | yes |
| rifle-run-forward-right | Rifle Run Forward Right | yes |
| rifle-sprint-forward | Rifle Sprint Forward | yes |
| rifle-sprint-forward-left | Rifle Sprint Forward Left | yes |
| rifle-sprint-forward-right | Rifle Sprint Forward Right | yes |
| rifle-turn-left-90 | Rifle Turn Left 90 | no |
| rifle-turn-right-90 | Rifle Turn Right 90 | no |
| rifle-crouch-idle | Rifle Crouch Idle | yes |
| rifle-crouch-aim-idle | Rifle Crouch Aiming Idle | yes |
| rifle-crouch-walk-forward | Crouch Walk Forward (rifle) | yes |
| rifle-crouch-walk-forward-left | Crouch Walk Forward Left (rifle) | yes |
| rifle-crouch-walk-left | Crouch Walk Left (rifle) | yes |
| rifle-crouch-walk-backward-left | Crouch Walk Backward Left (rifle) | yes |
| rifle-crouch-walk-backward | Crouch Walk Backward (rifle) | yes |
| rifle-crouch-walk-backward-right | Crouch Walk Backward Right (rifle) | yes |
| rifle-crouch-walk-right | Crouch Walk Right (rifle) | yes |
| rifle-crouch-walk-forward-right | Crouch Walk Forward Right (rifle) | yes |
| rifle-crouch-turn-left-90 | Crouch Turn Left 90 (rifle) | no |
| rifle-crouch-turn-right-90 | Crouch Turn Right 90 (rifle) | no |
| rifle-jump-up | Rifle Jump Up (start) | no |
| rifle-jump-loop | Rifle Jump Loop (falling) | yes |
| rifle-jump-down | Rifle Jump Down (landing) | no |
| pistol-idle | Pistol Idle | yes |
| pistol-walk-forward | Pistol Walk | yes |
| pistol-walk-backward | Pistol Walk Backward | yes |
| pistol-run-forward | Pistol Run | yes |
| pistol-run-backward | Pistol Run Backward | yes |
| pistol-strafe-left | Pistol Strafe Left | yes |
| pistol-strafe-right | Pistol Strafe Right | yes |
| action-slide | Running Slide | no |
| action-hit | Hit Reaction (rifle) | no |
| action-fire | Firing Rifle (one shot recoil) | no |
| action-grenade | Toss Grenade | no |
| action-reload | Reloading (rifle) | no |

The same list, with the clip each file becomes, is in `tools/dev/anim/clips.mjs`.

Tip: Mixamo's "Rifle 8-Way Locomotion" and "Pistol Handgun Locomotion" packs contain most of these in one download each. You
can download a pack, then rename the files you need.

## 2. Convert and bake

From the repository root:

```bash
npm --prefix tools/dev/anim install     # once: the FBX converter and three.js 0.147
node tools/dev/anim/convert.mjs          # anim-source/fbx/*.fbx -> anim-source/<clip>.glb and anim-source/manifest.json
node tools/dev/anim/cuire.mjs            # bake -> assets/anim/clips.bin and assets/anim/clips.json
python3 build.py                         # the game embeds them
```

`convert.mjs` lists any file it is still missing, and any file whose name it does not recognise. `cuire.mjs` prints one line
per clip with its speed, direction and loop seam; a direction that disagrees with the table is flagged.

## 3. Check them in the game

Start a bot match and watch the soldiers walk, run, crouch, jump and reload. `node tools/gate/match.mjs` runs a short
automated match.

The baked files stay on your machine: they are gitignored, like `anim-source/`. Each person who builds the game from this
repository bakes their own, from their own Mixamo account.
