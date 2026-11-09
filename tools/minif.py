"""Page code minification (build.py): removes comments and unneeded whitespace from the script and the stylesheet,
without renaming or rewriting anything. The code stays the same, token for token, byte for byte inside strings, `...` templates
(GLSL shaders, HTML) and regular expressions.

Script: split into tokens (strings, templates with their nested ${...}, regular expressions told apart from division
by the preceding token). Between two tokens, nothing is written, a space when the two would otherwise merge into another token
(two words, "+ +", "/ /"...), or a newline when the original had one and automatic semicolon insertion
might depend on it (after return, after a closing brace, before a word...). When in doubt, the newline
stays: it only costs one byte.

Check: tools/dev/check_minif.js compares the syntax tree of the script before and after (terser, a development tool)."""
import re

_WS = r"[ \t\f\v ﻿  -   　]"
_NL = "\n\r  "
_TOK = re.compile(r"""
 (?P<ws>(?:[ \t\f\v ﻿  -   　\n\r  ])+)
|(?P<lc>//[^\n\r  ]*)
|(?P<bc>/\*[\s\S]*?\*/)
|(?P<str>'(?:[^'\\\n\r]|\\[\s\S])*'|"(?:[^"\\\n\r]|\\[\s\S])*")
|(?P<num>(?:0[xXbBoO][0-9a-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?)
|(?P<id>(?:[A-Za-z_$\u0080-￿]|\\u[0-9a-fA-F{])(?:[\w$\u0080-￿]|\\u[0-9a-fA-F{][0-9a-fA-F}]*)*)
|(?P<p>>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.(?!\d)|\+\+|--|\+=|-=|\*=|%=|&=|\|=|\^=|/=|\*\*|<<|>>|[{}()\[\];,<>+\-*/%&|^!~?:=.@#])
""", re.X)
_REGEX = re.compile(r"/(?:[^/\\\[\n\r]|\\.|\[(?:[^\]\\\n\r]|\\.)*\])+/[A-Za-z]*")
# words after which a "/" opens a regular expression (not a division)
_KW_EXPR = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"}
# restricted productions: a newline after them changes the meaning (return\nx returns undefined)
_RESTRICT = {"return", "throw", "break", "continue", "yield", "async", "++", "--"}
# punctuation after which the statement necessarily continues: the newline that follows is useless
_NL_PREV = {"{", "(", "[", ",", ";", ":", "?", "=", "==", "===", "!=", "!==", "<", ">", "<=", ">=", "+", "-", "*", "/", "%", "**",
            "&", "|", "^", "!", "~", "&&", "||", "??", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=", "|=", "^=",
            "&&=", "||=", "??=", "<<", ">>", ">>>", "=>", ".", "?.", "..."}
# tokens that can only continue the current statement (never a semicolon insertion before them)...
_NL_NEXT = {")", "]", "}", ",", ";", ":", "?", ".", "?.", "(", "[", "=", "==", "===", "!=", "!==", "<", ">", "<=", ">=", "+", "-",
            "*", "/", "%", "**", "&", "|", "^", "&&", "||", "??", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=",
            "|=", "^=", "&&=", "||=", "??=", "<<", ">>", ">>>", "=>", "`"}
# ... except after the closing brace of an arrow function (() => {}\n(x): two statements): there, only these
_NL_NEXT_BRACE = {")", "]", "}", ",", ";", ":"}


def _word(c):
    return c.isalnum() or c in "_$\\" or ord(c) > 127


class _Tok:
    __slots__ = ("k", "t", "nl", "gap")

    def __init__(self, k, t, nl, gap):
        self.k = k; self.t = t; self.nl = nl; self.gap = gap


def _tokens(src):
    """Significant tokens; each notes whether whitespace or a comment precedes it (gap) and whether it contains a newline (nl)."""
    out = []; i = 0; n = len(src); gap = False; nl = False
    stack = []          # open braces: "{" (block or object) or "${" (template expression)
    parens = []         # open parentheses: the word preceding them (if, while, for, with: a "/" after the closing one is a regex)
    prev = None         # last significant token
    after_ctrl = False  # the last token is the closing parenthesis of an if/while/for/with

    def regex_ok():
        if prev is None: return True
        if prev.k == "p":
            if prev.t in (")",): return after_ctrl
            return prev.t not in ("]", "}", "++", "--")
        if prev.k == "id": return prev.t in _KW_EXPR
        return False

    def template(j):
        """Template that starts (or resumes after a ${...}) at j: returns the end of the chunk and whether it opens an expression."""
        while j < n:
            c = src[j]
            if c == "\\": j += 2; continue
            if c == "`": return j + 1, False
            if c == "$" and j + 1 < n and src[j + 1] == "{": return j + 2, True
            j += 1
        raise ValueError("template not closed")

    while i < n:
        c = src[i]
        if c == "`" or (c == "}" and stack and stack[-1] == "${"):
            if c == "}": stack.pop()
            j, opens = template(i + 1)
            if opens: stack.append("${")
            prev = _Tok("t", src[i:j], nl, gap); out.append(prev); after_ctrl = False
            i = j; gap = nl = False; continue
        if c == "/" and i + 1 < n and src[i + 1] not in "/*" and regex_ok():
            m = _REGEX.match(src, i)
            if not m: raise ValueError(f"unreadable regular expression near {src[i:i + 40]!r}")
            prev = _Tok("r", m.group(0), nl, gap); out.append(prev); after_ctrl = False
            i = m.end(); gap = nl = False; continue
        m = _TOK.match(src, i)
        if not m: raise ValueError(f"unexpected character {c!r} vers {src[max(0, i - 30):i + 30]!r}")
        k = m.lastgroup; t = m.group(0); i = m.end()
        if k in ("ws", "lc", "bc"):
            gap = True
            if k != "lc" and any(ch in _NL for ch in t): nl = True
            continue
        ctrl = False
        if k == "p":
            if t == "{": stack.append("{")
            elif t == "}":
                if stack: stack.pop()
            elif t == "(": parens.append(prev.t if prev is not None and prev.k == "id" else "")
            elif t == ")": ctrl = bool(parens) and parens.pop() in ("if", "while", "for", "with")
        prev = _Tok("p" if k == "p" else ("id" if k == "id" else k), t, nl, gap); out.append(prev); after_ctrl = ctrl
        gap = nl = False
    if stack: raise ValueError("unbalanced braces")
    return out


def _sep(a, b):
    """Is a blank needed between a and b for them to remain two distinct tokens?"""
    x = a.t[-1]; y = b.t[0]
    if (_word(x) or a.k == "r") and _word(y): return True
    if a.k == "num" and y == ".": return True
    if (x == "+" and y == "+") or (x == "-" and y == "-"): return True
    if x == "/" and y in "/*": return True        # division followed by a regex, or end of regex: never a comment
    if x == "<" and y in "!/": return True         # ni <!-- ni </script
    if x == "-" and y == ">": return True          # ni -->
    return False


def js(src):
    toks = _tokens(src)
    out = []
    prev = None
    for t in toks:
        if prev is not None:
            if t.nl:
                keep = True
                if prev.t not in _RESTRICT:
                    if prev.k == "p" and prev.t in _NL_PREV: keep = False
                    elif t.k == "p" and t.t in (_NL_NEXT_BRACE if prev.t == "}" else _NL_NEXT): keep = False
                    elif t.k == "t" and prev.t != "}": keep = False
                out.append("\n" if keep else (" " if _sep(prev, t) else ""))
            elif t.gap and _sep(prev, t):
                out.append(" ")
            elif not t.gap and _sep(prev, t):
                out.append(" ")  # already stuck together in the original: impossible for two words, possible for a rewritten "a+ +b"
        out.append(t.t)
        prev = t
    return "".join(out)


_CSS_TOK = re.compile(r"""(?P<c>/\*[\s\S]*?\*/)|(?P<s>"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|url\((?:[^)"'\\]|\\.)*\))|(?P<w>\s+)|(?P<o>[^\s"'/]+?(?=url\(|[\s"'/]|$)|/)""", re.I)


def css(src):
    """Stylesheet: comments removed, whitespace reduced to a single space, nothing around { } ; , > nor after : and ( nor before ) !,
    no ; before }. The blank between two words (descendant selector, values, calc(a + b)) stays."""
    toks = []
    for m in _CSS_TOK.finditer(src):
        k = m.lastgroup
        if k in ("c", "w"):
            if toks and toks[-1][0] != "w": toks.append(("w", " "))
            continue
        toks.append((k, m.group(0)))
    out = []
    for i, (k, t) in enumerate(toks):
        if k == "w":
            a = out[-1][-1] if out else "{"
            b = toks[i + 1][1][0] if i + 1 < len(toks) else "}"
            if a in "{};,>:(" or b in "{};,>)!": continue
            out.append(" "); continue
        if k == "o":
            t = re.sub(r";+}", "}", t)
            if t[0] == "}" and out and out[-1].endswith(";"): out[-1] = out[-1][:-1]
        out.append(t)
    return "".join(out)
