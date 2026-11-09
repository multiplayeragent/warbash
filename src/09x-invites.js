/* ==========================================================================
   KEY PROMPTS: the key or button that commands an action, depending on the input mode, as a glyph (kbd.key, shell.html).
   - keyboard: the key actually bound (bindOf, keyLabel: 08a-binds.js), so up to date after a rebind and according to the keyboard layout;
   - controller: the button of the chosen layout (PAD_LAYOUTS, Settings.padLay: 09qc-gamepad.js), named as on an Xbox controller
     (A green, B red, X blue, Y yellow, LB RB LT RT, drawn directional pad);
   - touch: nothing (the controls are on screen).
   A text that accompanies a prompt goes through _t with a parameter ({0}: the glyph), never through a glued-together sentence.
   ========================================================================== */
const PAD_GLYPH = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', '', 'Menu', 'L3', 'R3']; // 8 (Back/View) and 12 to 15 (D-pad): see padGlyph
const PAD_FIXED = { fire: 7, ads: 6, board: 8, pause: 9, confirm: 0, back: 1 }; // buttons that don't depend on the layout
const KB_FIXED = { confirm: 'Enter', back: 'Escape', pause: 'Escape', fire: 'Mouse0', ads: 'Mouse2' };
/* Input mode in charge: 'pad' (controller), 'touch' (finger) or 'kb' (keyboard and mouse) */
function inputMode() { return PAD.drive ? 'pad' : TOUCH.on ? 'touch' : 'kb'; }
function keyGlyph(label, cls) { return `<kbd class="key${cls ? ' ' + cls : ''}">${esc(label)}</kbd>`; }
/* Controller button by its index in the standard mapping */
function padGlyph(i) {
  if (i >= 12 && i <= 15) return `<kbd class="key dp d${i - 12}" aria-label="${esc(_t('D-pad'))}"></kbd>`; // top, bottom, left, right
  if (i === 8) return keyGlyph(_t('Back'), 'pad sys');
  if (i === 9) return keyGlyph('Menu', 'pad sys');
  return keyGlyph(PAD_GLYPH[i] || '?', i <= 3 ? 'pad b' + i : 'pad sh');
}
/* Glyph of a player action (BIND_DEFS names, plus fire, ads, confirm, back, pause) in the current input mode; '' on touch */
function actGlyph(action) {
  const mode = inputMode();
  if (mode === 'touch') return '';
  if (mode === 'pad') {
    if (action in PAD_FIXED) return padGlyph(PAD_FIXED[action]);
    const lay = PAD_LAYOUTS[Settings.padLay] || PAD_LAYOUTS.default, want = action === 'use' ? 'reload' : action; // pick up a weapon: X held, the reload button (padReloadUse)
    for (const i in lay) if (lay[i] === want) return padGlyph(+i);
    return '';
  }
  if (!(action in KB_FIXED) && !BIND_DEFS.some((d) => d[0] === action)) return '';
  const code = KB_FIXED[action] || bindOf(action);
  if (code === 'Mouse0') return keyGlyph(_t('Left click'), 'mouse');
  if (code === 'Mouse2') return keyGlyph(_t('Right click'), 'mouse');
  if (code === 'Enter') return keyGlyph(_t('Enter'));
  if (code === 'Escape') return keyGlyph(_t('Esc'));
  return keyGlyph(keyLabel(code));
}
