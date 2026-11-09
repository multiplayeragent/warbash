/* Word filter: names (username, display name, online nickname) and lobby chat. A single file for the accounts server, which
   rejects a name (register, profile), and for the game, which masks a word in chat and replaces a nickname: build.py
   joins it to the game script, stripping the "export" keywords (it only declares there; tools/dev/check_decl.py counts it with src/).
   The text is first reduced to plain letters: lowercase, accents removed, digits and symbols that imitate a letter (4 → a, 3 → e,
   0 → o, 1 → i, 5 → s, 7 → t, @ → a, $ → s), a few Cyrillic and Greek letters that look like Latin ones; a repeated letter counts once
   more ("fuuuck"). Each entry says where and how it applies:
   - p: everywhere, anywhere in a word (insults and slurs with no innocent meaning);
   - n: in chat, the whole word; in a name, anywhere ("nazi": not "nazionale" in chat);
   - m: everywhere, whole word only (short words that hide inside innocent words: "pute" in "députe");
   - N: in names only, anywhere (common swear words, left to chat);
   - M: in names only, whole word.
   Far-right names and codes are rejected too (Nazi figures, slogans, Combat 18, 1488: owner's choice; "88" alone
   stays allowed, too many players born in 1988 have it in their name). A whole word accepts a plural (s, x) or a final e. Spaced-out letters ("n i g g e r") are joined back. The filter doesn't catch everything
   (deliberate misspellings, other alphabets): the "Report" button and moderation do the rest. */
export const FILTER_WORDS = {
  p: 'nigger nigga faggot fuck asshole arsehole bitch whore slut pussy dickhead cocksuck blowjob handjob cumshot dildo jizz tranny shemale '
    + 'rapist wetback killyourself hitler auschwitz siegheil whitepower kkk pedophil pedofil paedophil '
    + 'encule salope connard connasse conasse filsdepute niquetamere sucemabite pouffiasse grognasse enfoire batard branl gouine fiotte '
    + 'tarlouze negre bougnoul youpin bamboula salearabe salejuif salenoir '
    + 'hurensohn fotze wichser schwuchtel arschloch missgeburt hijodeputa maricon pendejo gilipollas vaffanculo stronzo frocio puttana cazzo '
    + 'caralho viado '
    // far right (no sign accepted: owner's choice)
    + 'himmler goebbels heydrich mengele eichmann fuhrer fuehrer totenkopf waffenss whitepride wpww bloodandhonour bloodhonour '
    + 'nationalsocialis aryannation aryanbrotherhood kukluxklan remigration grandremplacement',
  n: 'nazi cunt twat penis vagina vagin porn porno wank wanker',
  m: 'pute pd pede tapette nique niquer ntm fdp suce catin teub fag spic chink kike gook paki rape raped pedo kys neger heil spast puta '
    + 'zorra cabron',
  N: 'putain merde shit couille hentai nsfw onlyfans boobs bastard mierda mussolini petain aryen generationidentitaire '
    + 'wehrmacht',
  M: 'bite chatte dick cock tits sex sexe negro adolf reich duce',
};
const FILTER_SUB = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'к': 'k', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ı': 'i' };
/* Plain letters of a text (no spaces or punctuation) */
export function filterNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$€!|аеорсухіјѕкмтнвαβεηικνορτυχı]/g, (c) => FILTER_SUB[c] || c).replace(/[^a-z]/g, '');
}
let FILTER_RE = null;
function filterRes() {
  if (FILTER_RE) return FILTER_RE;
  const re = (w) => w.split('').map((c) => c + '+').join(''); // each letter may repeat
  const any = (k) => FILTER_WORDS[k].split(' ').filter(Boolean).map(re).join('|');
  FILTER_RE = {
    chatIn: new RegExp('(' + any('p') + ')'),                                         // anywhere in a chat word
    chatWord: new RegExp('^(' + any('n') + '|' + any('m') + ')(s|x|e)?$'),           // whole chat word
    nameIn: new RegExp('(' + any('p') + '|' + any('n') + '|' + any('N') + ')'),      // anywhere in a name
    nameWord: new RegExp('^(' + any('m') + '|' + any('M') + ')(s|x|e)?$'),           // whole word of a name
  };
  return FILTER_RE;
}
// neo-Nazi codes (1488, Combat 18, "14 words"), separators included; masked in chat even when split by a space
const FILTER_HATE = /1[\s_.-]*4[\s_.-]*8[\s_.-]*8|combat[\s_.-]*18|\b14[\s_.-]*words/gi;
const filterHate = (s) => { FILTER_HATE.lastIndex = 0; return FILTER_HATE.test(String(s)); };

/* Is the name (username, display name, nickname) rejected? Words split on anything that is not a letter; the whole name is
   also read as one block ("Big_D1ck": "bigdick"; "n a z i") */
export function filterName(s) {
  const R = filterRes(), t = String(s == null ? '' : s);
  if (filterHate(t)) return true;
  const words = t.toLowerCase().normalize('NFKD').split(/[^a-z0-9@$€!|̀-ͯаеорсухіјѕкмтнвαβεηικνορτυχı]+/).map(filterNorm).filter(Boolean);
  return R.nameIn.test(filterNorm(t)) || words.some((w) => R.nameWord.test(w) || R.chatWord.test(w));
}
/* Chat message, rejected words replaced with asterisks (as many as letters, 8 at most) */
export function filterText(s) {
  const R = filterRes(), parts = String(s == null ? '' : s).replace(FILTER_HATE, (m) => m.replace(/\S/g, '*')).split(/(\s+)/);
  const bad = parts.map((w) => !/^\s*$/.test(w) && (filterHate(w) || (() => { const k = filterNorm(w); return !!k && (R.chatIn.test(k) || R.chatWord.test(k)); })()));
  // spaced-out letters: three or more one-letter words in a row are read back together
  for (let i = 0; i < parts.length; i += 2) {
    let j = i; while (j < parts.length && filterNorm(parts[j]).length === 1) j += 2;
    if (j - i >= 6) { const k = filterNorm(parts.slice(i, j).join('')); if (R.chatIn.test(k) || R.chatWord.test(k)) for (let x = i; x < j; x += 2) bad[x] = true; }
    if (j > i) i = j - 2;
  }
  return parts.map((w, i) => (bad[i] ? '*'.repeat(Math.min(8, Math.max(1, w.length))) : w)).join('');
}
