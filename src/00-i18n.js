/* ==========================================================================
   TEXT HELPERS: the game is in English. _t('Level {0} of {1}', n, max) fills the {0}, {1}... placeholders;
   _tn(n, '{0} enemy', '{0} enemies', ...more) picks the singular form for n === 1 (n is {0}).
   Numbers and dates are formatted for en-US.
   ========================================================================== */
const LOCALE = 'en-US';
const PCT = '%';
function _t(s, ...a) { return a.length ? s.replace(/\{(\d+)\}/g, (m, i) => (+i < a.length ? String(a[+i]) : m)) : s; }
function _tn(n, one, many, ...a) { return _t(n === 1 ? one : many, n, ...a); }
/* Number and date in the game's locale */
function fmtNum(n, digits) { return Number(n).toLocaleString(LOCALE, digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function fmtDate(d, opts) { return d.toLocaleDateString(LOCALE, opts); }
