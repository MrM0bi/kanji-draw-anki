/* KanjiDraw: Eselsbrücken markieren – editor side.
 *
 * Sets, recolours and removes the highlight spans of the mnemonic texts:
 *   <span class="kd-kw kd-k">…</span>    the keyword
 *   <span class="kd-kw kd-c1">…</span>   component 1 (… kd-c6)
 *
 * Both editors share one core that works on the field's HTML as text plus a selection [a, b):
 *   - HTML editor (CodeMirror): the text and offsets come straight from CodeMirror.
 *   - Rich-text editor: the field's DOM is copied with two marker characters at the selection, serialised, changed
 *     by the core and written back; the markers then restore the selection. Anki's DOM mirror picks up the change.
 *
 * Evaluated by __init__.py before every call (the guard keeps one copy); `module.exports` is for the Node tests.
 */
(function (global) {
    'use strict';

    var VERSION = 1;

    // ---------------------------------------------------------------- core (no DOM)

    var CODE_RE = /^(k|c[1-6])$/;
    var KD_TOKEN_RE = /^kd-(k|c\d+)$/;
    var TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
    var VOID_RE = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    var CLASS_ATTR_RE = /(\sclass\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
    var WORD_RE = /[\p{L}\p{N}\p{M}]/u;

    var MSG = {
        noField: 'Erst in ein Feld klicken und Text auswählen.',
        noWord: 'Kein Wort an der Cursorposition – erst Text auswählen.',
        noMark: 'Hier ist keine Markierung.',
        empty: 'Die Auswahl enthält nur Leerzeichen.',
        mathjax: 'Das Feld enthält MathJax – bitte im HTML-Editor markieren.',
        badCode: 'Unbekannte Farbe.'
    };

    function classTokens(attrs) {
        var m = CLASS_ATTR_RE.exec(' ' + attrs);
        if (!m) return null;
        var v = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
        return v.split(/\s+/).filter(Boolean);
    }

    /** The highlight code of a span ('k', 'c1', …, '' for a bare kd-kw), or null if it isn't a highlight. */
    function kdCode(name, attrs) {
        if (name !== 'span') return null;
        var t = classTokens(attrs);
        if (!t || t.indexOf('kd-kw') < 0) return null;
        for (var i = 0; i < t.length; i++) {
            var m = KD_TOKEN_RE.exec(t[i]);
            if (m) return m[1];
        }
        return '';
    }

    /** All tags as {start, end} and all elements as pairs {name, attrs, code, openStart, openEnd, closeStart, closeEnd}.
     *  Unclosed elements get a zero-length close where the browser would close them (or at the end). */
    function parse(html) {
        var tags = [], pairs = [], stack = [], m, i, u;
        TAG_RE.lastIndex = 0;
        while ((m = TAG_RE.exec(html))) {
            var start = m.index, end = start + m[0].length;
            tags.push({ start: start, end: end });
            if (!m[2]) continue; // comment
            var name = m[2].toLowerCase();
            if (m[1]) {
                for (i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) break;
                if (i < 0) continue; // stray close tag
                while (stack.length - 1 > i) {
                    u = stack.pop();
                    u.closeStart = u.closeEnd = start;
                    pairs.push(u);
                }
                u = stack.pop();
                u.closeStart = start;
                u.closeEnd = end;
                pairs.push(u);
            } else {
                if (VOID_RE.test(name) || /\/\s*$/.test(m[3])) continue;
                stack.push({ name: name, attrs: m[3], code: kdCode(name, m[3]), openStart: start, openEnd: end });
            }
        }
        while (stack.length) {
            u = stack.pop();
            u.closeStart = u.closeEnd = html.length;
            pairs.push(u);
        }
        return { tags: tags, pairs: pairs };
    }

    function openTag(code) {
        return '<span class="kd-kw kd-' + code + '">';
    }

    /** The span's open tag with its colour class replaced (other classes and attributes are kept). */
    function recoloredOpen(html, p, code) {
        var tag = html.slice(p.openStart, p.openEnd);
        var others = classTokens(p.attrs).filter(function (t) { return t !== 'kd-kw' && !KD_TOKEN_RE.test(t); });
        var cls = ['kd-kw', 'kd-' + code].concat(others).join(' ');
        return tag.replace(CLASS_ATTR_RE, function (all, pre) { return pre + '"' + cls + '"'; });
    }

    function isBlank(s) {
        return s.replace(/&nbsp;/g, '').trim() === '';
    }

    /** Selection without surrounding whitespace (also &nbsp;). */
    function trim(html, a, b) {
        for (;;) {
            if (a < b && /\s/.test(html[a])) a++;
            else if (a + 6 <= b && html.substr(a, 6) === '&nbsp;') a += 6;
            else break;
        }
        for (;;) {
            if (b > a && /\s/.test(html[b - 1])) b--;
            else if (b - 6 >= a && html.substr(b - 6, 6) === '&nbsp;') b -= 6;
            else break;
        }
        return [a, b];
    }

    function tagAt(tags, pos) {
        for (var i = 0; i < tags.length; i++) if (tags[i].start < pos && pos < tags[i].end) return tags[i];
        return null;
    }

    /** The word around a cursor, or null (also inside a tag or an entity). */
    function wordAt(html, tags, pos) {
        if (tagAt(tags, pos)) return null;
        var a = pos, b = pos;
        while (a > 0 && WORD_RE.test(html[a - 1])) a--;
        while (b < html.length && WORD_RE.test(html[b])) b++;
        if (a === b) return null;
        if (html[a - 1] === '&' && html[b] === ';') return null; // inside an entity such as &nbsp;
        return [a, b];
    }

    function closeIn(p, a, b) {
        return p.closeEnd > p.closeStart ? p.closeStart >= a && p.closeEnd <= b : p.closeStart > a && p.closeStart < b;
    }

    function openIn(p, a, b) {
        return p.openStart >= a && p.openEnd <= b;
    }

    /** Widens [a, b) until every element is either wholly inside or wholly outside of it, so a span can wrap it. */
    function balance(parsed, a, b) {
        var t = tagAt(parsed.tags, a);
        if (t) a = t.start;
        t = tagAt(parsed.tags, b);
        if (t) b = t.end;
        for (var changed = true; changed;) {
            changed = false;
            parsed.pairs.forEach(function (p) {
                var o = openIn(p, a, b), c = closeIn(p, a, b);
                if (o && !c && p.closeEnd > b) { b = p.closeEnd; changed = true; }
                if (c && !o && p.openStart < a) { a = p.openStart; changed = true; }
            });
        }
        return [a, b];
    }

    /** Innermost highlight whose content contains [a, b) (tags not selected). */
    function enclosingKd(pairs, a, b) {
        var best = null;
        pairs.forEach(function (p) {
            if (p.code === null || !(p.openEnd <= a && b <= p.closeStart)) return;
            if (!best || p.openStart > best.openStart) best = p;
        });
        return best;
    }

    function unwrapEdits(p) {
        var e = [{ start: p.openStart, end: p.openEnd, text: '' }];
        if (p.closeEnd > p.closeStart) e.push({ start: p.closeStart, end: p.closeEnd, text: '' });
        return e;
    }

    /** Applies non-overlapping edits {start, end, text}; returns the new text and a position mapper. */
    function applyEdits(html, edits) {
        var sorted = edits.slice().sort(function (x, y) {
            return y.start - x.start || (y.end - y.start) - (x.end - x.start);
        });
        var out = html;
        sorted.forEach(function (e) { out = out.slice(0, e.start) + e.text + out.slice(e.end); });
        var asc = sorted.slice().reverse();
        /** Position in the new text; `assoc` > 0 puts it after text inserted exactly there. */
        function map(pos, assoc) {
            var delta = 0;
            for (var i = 0; i < asc.length; i++) {
                var e = asc[i];
                if (e.start === e.end) {
                    if (e.start < pos || (e.start === pos && assoc > 0)) delta += e.text.length;
                } else if (e.end <= pos) {
                    delta += e.text.length - (e.end - e.start);
                } else if (e.start < pos) {
                    return e.start + delta + (assoc > 0 ? e.text.length : 0); // inside a replaced range
                }
            }
            return pos + delta;
        }
        return { html: out, map: map };
    }

    function result(html, edits, a, b) {
        var r = applyEdits(html, edits);
        var na = r.map(a, 1), nb = r.map(b, -1);
        if (nb < na) nb = na;
        return { html: r.html, a: na, b: nb };
    }

    /** Highlights [a, b) with `code`; a cursor (a == b) recolours the highlight it is in, or highlights the word. */
    function apply(html, a, b, code) {
        if (!CODE_RE.test(code)) return { msg: MSG.badCode };
        var parsed = parse(html), r;
        if (a === b) {
            var at = enclosingKd(parsed.pairs, a, a);
            if (at) {
                if (at.code === code) return { html: html, a: at.openEnd, b: at.closeStart };
                return result(html, [{ start: at.openStart, end: at.openEnd, text: recoloredOpen(html, at, code) }],
                    at.openEnd, at.closeStart);
            }
            var w = wordAt(html, parsed.tags, a);
            if (!w) return { msg: MSG.noWord };
            a = w[0];
            b = w[1];
        } else {
            r = trim(html, a, b);
            a = r[0];
            b = r[1];
            if (a >= b) return { msg: MSG.empty };
            r = balance(parsed, a, b);
            a = r[0];
            b = r[1];
        }
        var edits = [];
        parsed.pairs.forEach(function (p) {
            if (p.code !== null && openIn(p, a, b)) edits = edits.concat(unwrapEdits(p));
        });
        var s = enclosingKd(parsed.pairs, a, b);
        if (s) {
            var leftBlank = isBlank(html.slice(s.openEnd, a)), rightBlank = isBlank(html.slice(b, s.closeStart));
            if (leftBlank && rightBlank) {
                if (s.code !== code || edits.length)
                    edits.push({ start: s.openStart, end: s.openEnd, text: recoloredOpen(html, s, code) });
                return result(html, edits, a, b);
            }
            // Split the enclosing highlight around the selection.
            var sOpen = html.slice(s.openStart, s.openEnd);
            if (leftBlank) edits.push({ start: s.openStart, end: s.openEnd, text: openTag(code) });
            else edits.push({ start: a, end: a, text: '</span>' + openTag(code) });
            if (!rightBlank) edits.push({ start: b, end: b, text: '</span>' + sOpen });
            return result(html, edits, a, b);
        }
        edits.push({ start: a, end: a, text: openTag(code) });
        edits.push({ start: b, end: b, text: '</span>' });
        return result(html, edits, a, b);
    }

    /** Removes the highlight at the cursor, or every highlight that overlaps [a, b). */
    function erase(html, a, b) {
        var parsed = parse(html), targets = [];
        if (a === b) {
            var at = enclosingKd(parsed.pairs, a, a);
            if (!at) {
                // cursor inside the open or close tag itself (HTML editor)
                parsed.pairs.forEach(function (p) {
                    if (p.code !== null && ((p.openStart < a && a < p.openEnd) || (p.closeStart < a && a < p.closeEnd))) at = p;
                });
            }
            if (at) targets.push(at);
        } else {
            var r = trim(html, a, b);
            if (r[0] < r[1]) { a = r[0]; b = r[1]; }
            parsed.pairs.forEach(function (p) {
                if (p.code !== null && p.openStart < b && p.closeEnd > a) targets.push(p);
            });
        }
        if (!targets.length) return { msg: MSG.noMark };
        var edits = [];
        targets.forEach(function (p) { edits = edits.concat(unwrapEdits(p)); });
        return result(html, edits, a, b);
    }

    function run(op, html, a, b, code) {
        if (a > b) { var t = a; a = b; b = t; }
        return op === 'erase' ? erase(html, a, b) : apply(html, a, b, code);
    }

    var core = { run: run, apply: apply, erase: erase, parse: parse, MSG: MSG };

    if (typeof module === 'object' && module.exports) {
        module.exports = core;
        return;
    }
    if (global.kdHl && global.kdHl.version === VERSION) return;

    // ---------------------------------------------------------------- editor (DOM)

    var M_START = '', M_END = '';
    var STYLE_ID = 'kd-hl-style';
    var BUTTON_IDS = ['kdhl-k', 'kdhl-c1', 'kdhl-c2', 'kdhl-c3', 'kdhl-c4', 'kdhl-c5', 'kdhl-c6', 'kdhl-erase'];

    // Same colours as Templates/Styling.css (.kd-k uses the default green accent).
    var LIGHT = {
        k: ['#3c752a', '#e3f4dc'],
        c1: ['#13719e', 'rgba(42, 167, 224, 0.14)'],
        c2: ['#9b33b3', 'rgba(212, 107, 232, 0.14)'],
        c3: ['#9a5a06', 'rgba(240, 160, 48, 0.16)'],
        c4: ['#1c7f53', 'rgba(63, 191, 134, 0.15)'],
        c5: ['#b8372f', 'rgba(232, 98, 92, 0.14)'],
        c6: ['#5546c8', 'rgba(138, 124, 240, 0.15)']
    };
    var DARK = {
        k: ['#7cd43b', '#1e3d28'],
        c1: ['#6fcdf4', 'rgba(42, 167, 224, 0.24)'],
        c2: ['#eba6f6', 'rgba(212, 107, 232, 0.24)'],
        c3: ['#f8c779', 'rgba(240, 160, 48, 0.24)'],
        c4: ['#7fe0b4', 'rgba(63, 191, 134, 0.24)'],
        c5: ['#f6a19c', 'rgba(232, 98, 92, 0.24)'],
        c6: ['#bcb3fa', 'rgba(138, 124, 240, 0.26)']
    };

    function fieldCss() {
        var css = 'anki-editable .kd-kw { font-weight: 700; padding: 0 0.2em; border-radius: 4px;' +
            ' -webkit-box-decoration-break: clone; box-decoration-break: clone; }\n';
        Object.keys(LIGHT).forEach(function (c) {
            css += 'anki-editable .kd-' + c + ' { color: ' + LIGHT[c][0] + '; background: ' + LIGHT[c][1] + '; }\n';
            css += ':host-context(.night-mode) anki-editable .kd-' + c + ', :host-context(.nightMode) anki-editable .kd-' + c +
                ' { color: ' + DARK[c][0] + '; background: ' + DARK[c][1] + '; }\n';
        });
        return css;
    }

    function shadowRoots(node, out) {
        out = out || [];
        var all = node.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].shadowRoot) {
                out.push(all[i].shadowRoot);
                shadowRoots(all[i].shadowRoot, out);
            }
        }
        return out;
    }

    var enabled = false, observer = null, rescanQueued = false;

    function syncStyles() {
        rescanQueued = false;
        shadowRoots(document).forEach(function (root) {
            var style = root.getElementById ? root.getElementById(STYLE_ID) : null;
            if (enabled && !style && root.querySelector('anki-editable')) {
                style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent = fieldCss();
                root.appendChild(style);
            } else if (!enabled && style) {
                style.remove();
            }
        });
    }

    function queueRescan() {
        if (rescanQueued) return;
        rescanQueued = true;
        requestAnimationFrame(syncStyles);
    }

    function showButtons(tries) {
        var found = 0;
        BUTTON_IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) { el.style.display = enabled ? '' : 'none'; found++; }
        });
        if (found < BUTTON_IDS.length && tries > 0) setTimeout(function () { showButtons(tries - 1); }, 100);
    }

    /** Called on every note load: show the buttons and field colours only for KanjiDraw notes. */
    function setup(on) {
        enabled = !!on;
        showButtons(30);
        syncStyles();
        if (!observer) {
            observer = new MutationObserver(queueRescan);
            observer.observe(document.body, { childList: true, subtree: true });
        }
        setTimeout(syncStyles, 300); // fields render after the note is loaded
    }

    /** The focused rich-text field or HTML editor. */
    function focused() {
        var el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        if (!el || !el.closest) return null;
        var cmEl = el.closest('.CodeMirror');
        if (cmEl && cmEl.CodeMirror) return { cm: cmEl.CodeMirror };
        var ed = el.closest('anki-editable') || (el.isContentEditable ? el : null);
        if (ed) {
            while (ed.parentElement && ed.parentElement.isContentEditable) ed = ed.parentElement;
            return { editable: ed };
        }
        return null;
    }

    function runCodeMirror(cm, op, code) {
        var text = cm.getValue();
        var a = cm.indexFromPos(cm.getCursor('from')), b = cm.indexFromPos(cm.getCursor('to'));
        var res = run(op, text, a, b, code);
        if (res.msg) return res.msg;
        cm.operation(function () {
            if (res.html !== text) {
                var p = 0, s = 0, n = Math.min(text.length, res.html.length);
                while (p < n && text[p] === res.html[p]) p++;
                while (s < n - p && text[text.length - 1 - s] === res.html[res.html.length - 1 - s]) s++;
                cm.replaceRange(res.html.slice(p, res.html.length - s), cm.posFromIndex(p), cm.posFromIndex(text.length - s));
            }
            cm.setSelection(cm.posFromIndex(res.a), cm.posFromIndex(res.b));
        });
        cm.focus();
        return null;
    }

    function pathTo(rootEl, node) {
        var path = [];
        while (node && node !== rootEl) {
            path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
            node = node.parentNode;
        }
        return node === rootEl ? path : null;
    }

    function follow(root, path) {
        var n = root;
        for (var i = 0; i < path.length; i++) n = n.childNodes[path[i]];
        return n;
    }

    function insertMarker(container, offset, mark) {
        if (container.nodeType === 3) {
            container.data = container.data.slice(0, offset) + mark + container.data.slice(offset);
        } else {
            container.insertBefore(container.ownerDocument.createTextNode(mark), container.childNodes[offset] || null);
        }
    }

    /** Field HTML with M_START / M_END at the selection, from an inert copy (the field itself is untouched). */
    function serializeWithMarkers(editable, range) {
        var sp = pathTo(editable, range.startContainer), ep = pathTo(editable, range.endContainer);
        if (!sp || !ep) return null;
        var tpl = document.createElement('template'), doc = tpl.content.ownerDocument;
        for (var c = editable.firstChild; c; c = c.nextSibling) tpl.content.appendChild(doc.importNode(c, true));
        var sNode = follow(tpl.content, sp), eNode = follow(tpl.content, ep);
        insertMarker(eNode, range.endOffset, M_END);
        insertMarker(sNode, range.startOffset, M_START);
        return tpl.innerHTML;
    }

    function findMarker(rootEl, mark) {
        var w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT), t;
        while ((t = w.nextNode())) {
            var i = t.data.indexOf(mark);
            if (i >= 0) {
                t.deleteData(i, 1);
                return [t, i];
            }
        }
        return null;
    }

    function runRich(editable, op, code) {
        if (editable.querySelector('anki-mathjax, anki-frame')) return MSG.mathjax;
        var root = editable.getRootNode();
        var sel = root.getSelection ? root.getSelection() : document.getSelection();
        if (!sel || !sel.rangeCount) return MSG.noField;
        var range = sel.getRangeAt(0);
        if (!editable.contains(range.startContainer) || !editable.contains(range.endContainer)) return MSG.noField;
        var marked = serializeWithMarkers(editable, range);
        if (marked === null) return MSG.noField;
        var a = marked.indexOf(M_START), html = marked.replace(M_START, '');
        var b = html.indexOf(M_END);
        html = html.replace(M_END, '');
        var res = run(op, html, a, b, code);
        if (res.msg) return res.msg;
        if (res.html !== html || res.a !== a || res.b !== b) {
            // also when only the selection changes (e.g. the word at the cursor), so it shows what was marked
            editable.innerHTML = res.html.slice(0, res.a) + M_START + res.html.slice(res.a, res.b) + M_END + res.html.slice(res.b);
            var s = findMarker(editable, M_START), e = findMarker(editable, M_END);
            var r = document.createRange();
            if (s && e) {
                r.setStart(s[0], s[1]);
                r.setEnd(e[0], e[1]);
            } else {
                r.selectNodeContents(editable);
                r.collapse(false);
            }
            sel.removeAllRanges();
            sel.addRange(r);
        }
        editable.focus();
        return null;
    }

    /** Entry point for the buttons; returns a message for a tooltip, or null. */
    function runInEditor(op, code) {
        if (!enabled) return null;
        var f = focused();
        if (!f) return MSG.noField;
        try {
            return f.cm ? runCodeMirror(f.cm, op, code) : runRich(f.editable, op, code);
        } catch (err) {
            console.error('kdHl', err);
            return 'Markieren fehlgeschlagen: ' + err;
        }
    }

    global.kdHl = { version: VERSION, core: core, setup: setup, run: runInEditor };
})(typeof window !== 'undefined' ? window : this);
