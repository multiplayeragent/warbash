#!/usr/bin/env python3
"""Style check of the texts the player sees: python3 tools/dev/check_text.py
Hunts for turns of phrase that sound "written by an AI" (rules: CLAUDE.md and README, "Text style"). Checked are the
texts passed to _t() / _tn() in src/, the text of shell.html, and the changelog.json entries.
Exit 0 if all is well, 1 otherwise. build.py calls it too."""
import json,os,re,sys
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
sys.path.insert(0,os.path.join(ROOT,'tools')); sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import i18n_keys as K
os.chdir(ROOT)

# (name, expression, advice)
SIGN_CHARS=[
 ('em or en dash', r"[\u2013\u2014\u2015]", "comma, period or parentheses"),
 ('single-character ellipsis', r"\u2026", "three ASCII dots (...)"),
 ('typographic quotes or apostrophe', r"[\u2018\u2019\u201c\u201d\u00ab\u00bb]", "straight quotes \" \" and straight apostrophe '"),
 ('arrow', r"[\u2190-\u21ff\u27a1\u2794\u279c\u25b6\u25ba]", "a verb or a comma"),
 ('symbol or emoji', r"[\u2248\u2260\u00d7\u2713\u2714\u2705\u274c\u2b50\u26a0\u2728\U0001f300-\U0001faff\u2600-\u27bf\ufe0f]", "write it out in words (x for a dimension)"),
 ('Markdown formatting', r"\*\*|`|^#+\s|^[-*]\s|^---", "plain text"),
 ('opening or closing formula', r"^Here (is|are)\b|\bIn (summary|conclusion)\b|\bit is (important|worth) (to note|noting)\b", "say the thing directly"),
 ('"it\'s not X, it\'s Y"', r"\bit.s not\b[^.]{0,80}\bit.s\b|\bnot just\b[^.]{0,60}\bbut\b", "say only Y"),
 ('buzzword', r"\b(crucial\w*|fluid\w+|seamless\w*|delve\w*|tapestry|leverage\w*|robust|unlock the power|game.?changer|immersi\w+)\b", "a simple, precise word"),
]
# Checked only on recent texts (the old changelog entries are history)
PHRASINGS=('buzzword','opening or closing formula','"it\'s not X, it\'s Y"')
def readable():
    """(origin, text) of each text seen by the player"""
    keys=K.all_keys()
    for k,w in keys.items(): yield w[0],k
    for k in K.shell_keys(): yield 'shell.html',k
    # API error messages (api/_lib/i18n.js, absent from the public copy of the code): both strings of each entry
    for m in re.finditer(r"^  '((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'",open('api/_lib/i18n.js',encoding='utf-8').read() if os.path.exists('api/_lib/i18n.js') else '',re.M):
        yield 'api/_lib/i18n.js',K.js_unescape(m.group(1)); yield 'api/_lib/i18n.js',K.js_unescape(m.group(2))
    # changelog: characters are checked everywhere, the rest (punctuation, words) only on the most recent entry,
    # the old ones are history (marked "(old)")
    for i,e in enumerate(json.load(open('changelog.json',encoding='utf-8'))):
        o='changelog.json '+e['version']+('' if i==0 else '(old)')
        for f in ('title',):
            if e.get(f): yield o,e[f]
        for c in e.get('changes',[]):
            for f in ('x',):
                if c.get(f): yield o,c[f]
def without_tags(s): return re.sub(r"<[^>]*>"," ",s)
# Legal notices: their list punctuation (colon, semicolon) is mandatory.
LEGAL=('09k-legal.js',)
def explanatory_colon(s):
    """a colon that follows a clause (3 words or more) and precedes a lowercase letter: an explanation, not a label
    (a run of labels, "Up: UAV, right: airstrike...", is not one)"""
    if s.count(':')>=3: return False
    s=without_tags(s)
    for m in re.finditer(r"([^.!?:;]*?)\s?:\s+(?=[a-zà-ÿ])",s):
        if s[:m.end(1)].count('(')>s[:m.end(1)].count(')'): continue   # "(Backspace: put back... )": a label in parentheses
        before=re.sub(r"\{\d+\}","X",m.group(1)).strip()
        if len(before.split())>=3: return True
    return False
def verify():
    errs=[];seen_set=set()
    for orig,s in readable():
        t=without_tags(s)
        previous=orig.endswith('(old)')
        for naming,p,advice in SIGN_CHARS:
            if previous and naming in PHRASINGS: continue
            if re.search(p,t,re.I|re.M):
                a=(orig,naming,s)
                if a not in seen_set: seen_set.add(a); errs.append(f"{naming}: {orig} {s[:90]!r} (prefer: {advice})")
        if not orig.startswith(LEGAL) and not previous:
            if ';' in t.replace('&amp;','').replace('&nbsp;',''):
                errs.append(f"semicolon: {orig} {s[:90]!r} (prefer: a period or a comma)")
            if explanatory_colon(t):
                errs.append(f"colon introducing an explanation: {orig} {s[:90]!r} (prefer: a period or a comma)")
    return errs
if __name__=='__main__':
    errs=verify()
    for e in errs: print('error:',e)
    print(f"{len(errs)} style problem(s)" if errs else "text style: nothing to report")
    sys.exit(1 if errs else 0)
