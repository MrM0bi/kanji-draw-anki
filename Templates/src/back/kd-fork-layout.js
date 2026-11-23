// fork: section layout on the back: order, hiding, columns and the edit mode ("Abschnitte", FORK.md).
// Runs before kd-fork-sections.js, which calls window._kdLayout.attach(host, KD_SECTIONS) before it builds
// the headers and L.start() after. Everything is global per device (persistence.js); '' counts as unset.
// The code uses the logical names below; core.storeKey/encode/decode map them to what is stored.
//   kdSecHidden   hidden section keys, comma-separated (all column counts)
//   kdLayout1     order for one column, comma-separated
//   kdLayout<n>   arrangement for n columns (2–7), e.g. "L1:strichfolge|C:elemente,eselsbruecken|R1:lesungen".
//                 Odd counts have a centre column C under the drawings; even ones are symmetric around the gap
//                 between L1 and R1, which sits under the drawings.
//   kdLayoutCols  auto | 1 … 7   kdLayoutSide  below | top
//                 (deck defaults: --default-layout-cols / -side in Styling.css)
//   kdSec_<key>   open/closed state with one column, kdSecW_<key> with several
// Stored form: the Anki Desktop add-on (Addon/__init__.py) keeps only keys matching kanji[A-Za-z]{1,40} with
// values of at most 64 characters, so kdLayout3 is stored as kanjiKdLayoutThree, kdSec_notiz as
// kanjiKdSecNotiz, and section keys as one-letter codes ("L1:s,f|C:e,m"). Values under the old names are
// moved over on first read.
(function () {
    var SLOTS = ['L3', 'L2', 'L1', 'C', 'R1', 'R2', 'R3'];
    var BY_DISTANCE = ['C', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3'];
    var COUNTS = [1, 2, 3, 4, 5, 6, 7];
    var MAX = 7, GAP = 16, EDGE = 16;
    // Defaults per count, set by the user on 2026-11-23 (one column: the KD_SECTIONS order in kd-fork-sections.js)
    var DEFAULT_WIDE = {
        2: { L1: ['elemente', 'schreibfehler', 'strichfolge'], R1: ['eselsbruecken', 'notiz', 'lesungen', 'wortbeispiele', 'links'] },
        3: { L1: ['schreibfehler', 'strichfolge'], C: ['elemente', 'lesungen', 'links'], R1: ['eselsbruecken', 'notiz', 'wortbeispiele'] },
        4: { L2: ['schreibfehler', 'strichfolge'], L1: ['elemente', 'links'], R1: ['eselsbruecken', 'notiz'], R2: ['lesungen', 'wortbeispiele'] },
        5: { L2: ['strichfolge'], L1: ['schreibfehler'], C: ['elemente', 'links'], R1: ['eselsbruecken', 'notiz'], R2: ['lesungen', 'wortbeispiele'] },
        6: { L3: ['strichfolge'], L2: ['schreibfehler'], L1: ['elemente'], R1: ['eselsbruecken'], R2: ['lesungen', 'wortbeispiele'], R3: ['notiz', 'links'] },
        7: { L3: ['notiz'], L2: ['strichfolge'], L1: ['schreibfehler'], C: ['elemente'], R1: ['eselsbruecken'], R2: ['lesungen', 'wortbeispiele'], R3: ['links'] }
    };

    // --- Pure helpers (Tests/js/test_fork_layout.js) ---
    var core = {};
    // Columns per side: n = 5 → L2 L1 C R1 R2, n = 4 → L2 L1 R1 R2.
    var half = function (n) { return Math.floor(n / 2); };
    core.slotsFor = function (n) {
        var h = half(n);
        return SLOTS.slice(3 - h, 4 + h).filter(function (s) { return s !== 'C' || n % 2; });
    };
    // Arrangement for `from` columns → n columns (from >= n, default n). Between odd and even counts the middle
    // changes: an odd centre goes on top of L1; an even pair L1 + R1 becomes the centre and the outer columns move
    // in by one. Then columns beyond n go below the outermost remaining column on the same side.
    core.fold = function (arr, n, from) {
        from = from || n;
        var src = {};
        BY_DISTANCE.forEach(function (s) { src[s] = (arr[s] || []).slice(); });
        if (from % 2 && !(n % 2)) {
            src.L1 = src.C.concat(src.L1);
            src.C = [];
        } else if (!(from % 2) && n % 2) {
            src.C = src.C.concat(src.L1, src.R1);
            for (var i = 1; i < 3; i++) { src['L' + i] = src['L' + (i + 1)]; src['R' + i] = src['R' + (i + 1)]; }
            src.L3 = []; src.R3 = [];
        }
        var out = {}, h = half(n);
        core.slotsFor(n).forEach(function (s) { out[s] = []; });
        BY_DISTANCE.forEach(function (s) {
            var list = src[s];
            if (!list.length) return;
            var target = s === 'C' ? (n % 2 ? 'C' : 'L1') : +s.slice(1) <= h ? s : (h ? s.charAt(0) + h : 'C');
            out[target] = out[target].concat(list);
        });
        return out;
    };
    core.parseList = function (str, keys, seen) {
        seen = seen || {};
        var out = [];
        String(str || '').split(',').forEach(function (k) {
            k = k.trim();
            if (keys.indexOf(k) >= 0 && !seen[k]) { seen[k] = 1; out.push(k); }
        });
        return out;
    };
    core.parseCols = function (str, n, keys, from) {
        var raw = {}, seen = {};
        String(str || '').split('|').forEach(function (part) {
            var i = part.indexOf(':');
            var slot = i < 0 ? '' : part.slice(0, i).trim();
            if (SLOTS.indexOf(slot) >= 0) raw[slot] = (raw[slot] || []).concat(core.parseList(part.slice(i + 1), keys, seen));
        });
        return core.fold(raw, n, from);
    };
    core.serialize = function (arr, n) {
        if (n === 1) return (arr.C || []).join(',');
        return SLOTS.filter(function (s) { return arr[s] && arr[s].length; }).map(function (s) { return s + ':' + arr[s].join(','); }).join('|');
    };
    core.defaultFor = function (n, keys) {
        if (n === 1) return { C: keys.slice() };
        var m = n;
        while (!DEFAULT_WIDE[m] && m < MAX) m++;
        var def = core.fold(DEFAULT_WIDE[m], n, m);
        Object.keys(def).forEach(function (s) { def[s] = def[s].filter(function (k) { return keys.indexOf(k) >= 0; }); });
        return def;
    };
    // Every key exactly once: a missing one goes into its default column, after its default predecessor.
    core.complete = function (arr, keys, def) {
        var have = {};
        Object.keys(arr).forEach(function (s) { arr[s].forEach(function (k) { have[k] = 1; }); });
        keys.forEach(function (k) {
            if (have[k]) return;
            var slot = arr.C ? 'C' : 'L1';
            Object.keys(def).forEach(function (s) { if (def[s].indexOf(k) >= 0 && arr[s]) slot = s; });
            var list = arr[slot], order = def[slot] || keys, at = list.length;
            for (var i = 0, known = false; i < list.length; i++) {
                var di = order.indexOf(list[i]);
                if (di < 0) continue;
                if (!known) { known = true; at = 0; }
                if (di < order.indexOf(k)) at = i + 1;
            }
            list.splice(at, 0, k);
            have[k] = 1;
        });
        return arr;
    };
    // Saved arrangement for n, else the nearest larger saved one folded down, else the default.
    core.arrangement = function (n, read, keys) {
        var arr = null;
        if (n === 1) {
            var one = read('kdLayout1');
            if (one) arr = { C: core.parseList(one, keys) };
        } else {
            for (var m = n; m <= MAX && !arr; m++) {
                var saved = read('kdLayout' + m);
                if (saved) arr = core.parseCols(saved, n, keys, m);
            }
        }
        return core.complete(arr || core.defaultFor(n, keys), keys, core.defaultFor(n, keys));
    };
    core.fits = function (n, size, width) { return n * size + (n - 1) * GAP + 2 * EDGE <= width; };
    // Column count: the setting (auto = 1 on phones, otherwise up to 7) capped by what fits the window.
    core.count = function (setting, size, width, phone) {
        var max = setting === 'auto' || !(+setting) ? (phone ? 1 : MAX) : +setting, best = 1;
        COUNTS.forEach(function (n) { if (n <= max && core.fits(n, size, width)) best = n; });
        return best;
    };
    // Outside the edit mode, outer column pairs without a shown section are dropped.
    core.shownCount = function (arr, n, hidden) {
        var used = function (s) { return (arr[s] || []).some(function (k) { return hidden.indexOf(k) < 0; }); };
        while (n > (n % 2 ? 1 : 2) && !used('L' + half(n)) && !used('R' + half(n))) n -= 2;
        return n;
    };
    // Move key to slot before beforeKey (or to the end).
    core.move = function (arr, key, slot, beforeKey) {
        Object.keys(arr).forEach(function (s) { var i = arr[s].indexOf(key); if (i >= 0) arr[s].splice(i, 1); });
        var list = arr[slot], at = beforeKey ? list.indexOf(beforeKey) : -1;
        if (at >= 0) list.splice(at, 0, key); else list.push(key);
        return arr;
    };

    // --- Storage names and codes (see the header) ---
    var CODES = { elemente: 'e', eselsbruecken: 'm', strichfolge: 's', notiz: 'n', schreibfehler: 'f', wortbeispiele: 'w', lesungen: 'l', links: 'x' };
    var NAMES = {};
    Object.keys(CODES).forEach(function (k) { NAMES[CODES[k]] = k; });
    var WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
    var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
    core.storeKey = function (k) {
        var m = /^kdLayout(\d)$/.exec(k);
        if (m) return 'kanjiKdLayout' + WORDS[+m[1]];
        m = /^kdSec(W?)_([a-z]+)$/.exec(k);
        if (m) return 'kanjiKdSec' + m[1] + cap(m[2]);
        return /^kd[A-Z]/.test(k) ? 'kanjiK' + k.slice(1) : k;
    };
    var coded = function (k) { return /^kdLayout\d$|^kdSecHidden$/.test(k); };
    core.encode = function (k, v) { return coded(k) ? String(v).replace(/[a-z]+/g, function (t) { return CODES[t] || t; }) : v; };
    core.decode = function (k, v) { return coded(k) ? String(v).replace(/[a-z]+/g, function (t) { return NAMES[t] || t; }) : v; };

    var api = window._kdLayout = { core: core, gap: GAP };
    if (typeof document === 'undefined') return;

    var rawGet = function (k) { try { var v = typeof safeGetItem === 'function' ? safeGetItem(k, '') : ''; return v == null ? '' : String(v); } catch (e) { return ''; } };
    var rawSet = function (k, v) { try { if (typeof safeSetItem === 'function') safeSetItem(k, v); } catch (e) { } };
    // Read by logical name; a value still under the old name is moved to the stored name.
    var get = function (k, d) {
        var sk = core.storeKey(k), v = rawGet(sk);
        if (v === '' && sk !== k) {
            var old = rawGet(k);
            if (old !== '') { rawSet(sk, core.encode(k, old)); rawSet(k, ''); return old; }
        }
        return v === '' ? d : core.decode(k, v);
    };
    var set = function (k, v) {
        var sk = core.storeKey(k);
        rawSet(sk, v === '' ? '' : core.encode(k, v));
        if (sk !== k && rawGet(k) !== '') rawSet(k, ''); // an old value must not come back after a reset
    };
    api.get = get;
    api.set = set;
    var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    var SVG = function (inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '<' + '/svg>'; };
    var ICONS = {
        grip: '<circle cx="9" cy="6" r="1.3"></circle><circle cx="15" cy="6" r="1.3"></circle><circle cx="9" cy="12" r="1.3"></circle><circle cx="15" cy="12" r="1.3"></circle><circle cx="9" cy="18" r="1.3"></circle><circle cx="15" cy="18" r="1.3"></circle>',
        up: '<path d="M6 15l6-6 6 6"></path>', down: '<path d="M6 9l6 6 6-6"></path>',
        left: '<path d="M15 6l-6 6 6 6"></path>', right: '<path d="M9 6l6 6-6 6"></path>',
        eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
        eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"></path>'
    };

    var S = null; // state of the attached back

    api.attach = function (host, sections) {
        var keys = sections.map(function (c) { return c.key; });
        if (S && S.ro) S.ro.disconnect(); // Anki Desktop keeps the document between cards
        // Move every value still under an old name now, so the Desktop add-on saves all of them
        ['kdSecHidden', 'kdLayoutCols', 'kdLayoutSide'].concat(COUNTS.map(function (n) { return 'kdLayout' + n; }),
            keys.map(function (k) { return 'kdSec_' + k; }), keys.map(function (k) { return 'kdSecW_' + k; }))
            .forEach(function (k) { get(k, ''); });
        S = {
            host: host, keys: keys, secs: {}, cols: {}, editing: false, n: 1,
            hidden: core.parseList(get('kdSecHidden', ''), keys)
        };
        // Sections whose fields are empty are not in the markup (Anki field conditions); a bare one keeps their place in the edit mode.
        keys.forEach(function (k) {
            var s = host.querySelector('.kd-section[data-sec="' + k + '"]');
            if (!s) {
                s = el('section', 'kd-section kd-sec-empty');
                s.setAttribute('data-sec', k);
                s.appendChild(el('div', 'kd-section-body'));
                host.appendChild(s);
            }
            S.secs[k] = s;
        });
        S.n = measureCount();
        S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, keys);
        return {
            wide: function () { return S && S.n > 1; },
            secKey: function (key) { return (S && S.n > 1 ? 'kdSecW_' : 'kdSec_') + key; },
            start: start
        };
    };
    api.alive = function () { return !!(S && S.host.isConnected); };
    api.count = function () { return S ? S.n : 1; };

    // Deck default from Styling.css (getGlobalConfig), overridden by the saved choice.
    function option(name) {
        var gc = {}, fallback = { cols: 'auto', side: 'below' }[name];
        try { gc = getGlobalConfig() || {}; } catch (e) { }
        var cap = name.charAt(0).toUpperCase() + name.slice(1); // cols → kdLayoutCols (saved), layoutCols (deck)
        return get('kdLayout' + cap, '') || gc['layout' + cap] || fallback;
    }
    api.option = option;
    // Columns are as wide as the drawing area (--dynamic-size) and must fit the space beside the page padding.
    function measureCount() {
        var probe = el('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--dynamic-size)';
        S.host.appendChild(probe);
        var size = probe.getBoundingClientRect().width || 400;
        probe.remove();
        var parent = S.host.parentElement, width = parent ? parent.getBoundingClientRect().width : window.innerWidth;
        var phone = false;
        try { phone = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; } catch (e) { }
        return core.count(option('cols'), size, width, phone);
    }

    function start(onModeChange) {
        var host = S.host;
        S.onModeChange = onModeChange;
        S.wrap = el('div', 'kd-cols');
        var tags = host.querySelector('.kd-info-tags');
        if (tags && tags.parentNode === host) host.insertBefore(S.wrap, tags.nextSibling); else host.insertBefore(S.wrap, host.firstChild);
        S.strip = el('div', 'kd-hidden-strip');
        S.strip.appendChild(el('div', 'kd-hidden-strip-label', 'Ausgeblendet <span>· gilt für alle Spaltenzahlen · hierher ziehen oder das Auge antippen</span>'));
        host.appendChild(S.strip);
        Object.keys(S.secs).forEach(function (k) { decorate(S.secs[k], k); });
        render();
        if (window.ResizeObserver) {
            var queued = false;
            S.ro = new ResizeObserver(function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () {
                    queued = false;
                    if (api.alive()) place(); else if (S && S.ro) S.ro.disconnect();
                });
            });
            S.ro.observe(document.body);
            S.ro.observe(S.wrap);
        }
        if (window._kdLayoutResize) window.removeEventListener('resize', window._kdLayoutResize);
        var t = null;
        window._kdLayoutResize = function () {
            if (!api.alive()) { window.removeEventListener('resize', window._kdLayoutResize); return; }
            clearTimeout(t);
            t = setTimeout(refresh, 120);
        };
        window.addEventListener('resize', window._kdLayoutResize);
    }

    // Recompute the column count; switching between one and several columns swaps the open/closed set.
    function refresh() {
        if (!api.alive()) return;
        var n = measureCount();
        if (n !== S.n) {
            var wasWide = S.n > 1;
            S.n = n;
            S.arr = core.arrangement(n, function (k) { return get(k, ''); }, S.keys);
            render();
            if (wasWide !== (n > 1) && S.onModeChange) S.onModeChange();
        } else render();
    }
    api.refresh = refresh;

    function render() {
        var n = S.n, arr = S.arr;
        var shown = S.editing ? n : core.shownCount(arr, n, S.hidden);
        var slots = core.slotsFor(shown);
        slots.forEach(function (s) {
            var col = S.cols[s] || (S.cols[s] = el('div', 'kd-col'));
            col.setAttribute('data-slot', s);
            S.wrap.appendChild(col);
        });
        slots.forEach(function (s) {
            (arr[s] || []).forEach(function (k) {
                var sec = S.secs[k];
                if (sec) (S.hidden.indexOf(k) >= 0 ? S.strip : S.cols[s]).appendChild(sec);
            });
        });
        Object.keys(S.cols).forEach(function (s) { if (slots.indexOf(s) < 0 && S.cols[s].parentNode) S.cols[s].remove(); });
        S.host.classList.toggle('kd-editing', S.editing);
        S.host.classList.toggle('kd-wide', shown > 1);
        S.host.classList.toggle('kd-even', shown > 1 && shown % 2 === 0);
        S.host.classList.toggle('kd-side-top', shown > 1 && option('side') === 'top');
        S.host.classList.toggle('kd-sticky', shown > 1 && !S.editing);
        S.host.style.setProperty('--kd-cols', shown);
        Object.keys(S.secs).forEach(function (k) {
            var off = S.hidden.indexOf(k) >= 0, eye = S.secs[k].querySelector('.kd-edit-eye');
            if (eye) {
                eye.innerHTML = SVG(off ? ICONS.eyeOff : ICONS.eye);
                eye.setAttribute('aria-label', (off ? 'Einblenden: ' : 'Ausblenden: ') + S.secs[k]._kdTitle);
                eye.setAttribute('aria-pressed', off ? 'true' : 'false');
            }
        });
        if (S.bar) {
            S.bar.querySelector('.kd-edit-count').textContent = n + (n === 1 ? ' Spalte' : ' Spalten');
            S.bar.querySelectorAll('.kd-edit-chip').forEach(function (c) {
                var cur = +c.dataset.n === n;
                c.classList.toggle('is-current', cur);
                if (cur) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
            });
        }
        place();
    }

    // "Neben dem Kopf": side columns start level with the top of the drawing box. With several columns (outside
    // the edit mode) every column is sticky; one taller than the window keeps scrolling until its end is visible.
    function place() {
        var host = S.host, lift = 0;
        if (host.classList.contains('kd-side-top')) {
            // Card 1 shows the drawing next to the original (.side-by-side-box), Card 2 the drawing box itself
            var top = null;
            document.querySelectorAll('.side-by-side-box, .kanji-container').forEach(function (b) {
                if (!b.getClientRects().length) return;
                var t = b.getBoundingClientRect().top;
                if (top === null || t < top) top = t;
            });
            if (top !== null) lift = Math.max(0, Math.round(S.wrap.getBoundingClientRect().top - top));
        }
        host.style.setProperty('--kd-lift', lift + 'px');
        var sticky = host.classList.contains('kd-sticky'), vh = window.innerHeight;
        Object.keys(S.cols).forEach(function (s) {
            var col = S.cols[s];
            col.style.top = sticky ? Math.min(12, vh - col.offsetHeight - 12) + 'px' : '';
        });
    }

    function save() {
        set('kdLayout' + S.n, core.serialize(S.arr, S.n));
        set('kdSecHidden', S.hidden.join(','));
    }
    function slotOf(key) {
        var found = S.arr.C ? 'C' : 'L1';
        Object.keys(S.arr).forEach(function (s) { if (S.arr[s].indexOf(key) >= 0) found = s; });
        return found;
    }
    function setHidden(key, off) {
        var i = S.hidden.indexOf(key);
        if (off && i < 0) S.hidden.push(key);
        if (!off && i >= 0) S.hidden.splice(i, 1);
    }
    function apply(focus) {
        save();
        render();
        if (focus && focus.isConnected) { try { focus.focus({ preventScroll: true }); } catch (e) { focus.focus(); } }
    }
    // Arrow buttons: up/down skip hidden neighbours; left/right keep the visible position in the next column.
    function step(key, dir, btn) {
        var slot = slotOf(key), list = S.arr[slot], i = list.indexOf(key);
        if (dir === 'up' || dir === 'down') {
            var d = dir === 'up' ? -1 : 1, j = i + d;
            while (j >= 0 && j < list.length && S.hidden.indexOf(list[j]) >= 0) j += d;
            if (j < 0 || j >= list.length) return;
            list.splice(i, 1);
            list.splice(j, 0, key);
        } else {
            var slots = core.slotsFor(S.n), to = slots[slots.indexOf(slot) + (dir === 'left' ? -1 : 1)];
            if (!to) return;
            var pos = list.filter(function (k) { return S.hidden.indexOf(k) < 0; }).indexOf(key);
            var target = S.arr[to].filter(function (k) { return S.hidden.indexOf(k) < 0; });
            core.move(S.arr, key, to, target[pos] || null);
        }
        apply(btn);
    }

    function decorate(sec, key) {
        var header = sec.querySelector('.kd-section-header');
        if (!header || header._kdEdit) return;
        header._kdEdit = true;
        sec._kdTitle = (header.querySelector('.kd-section-title') || {}).textContent || key;
        var stop = function (e) { e.stopPropagation(); };
        var grip = el('span', 'kd-edit-grip tappable', SVG(ICONS.grip));
        grip.setAttribute('aria-hidden', 'true');
        grip.title = 'Ziehen zum Verschieben';
        header.insertBefore(grip, header.firstChild);
        grip.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });
        grip.addEventListener('pointerdown', function (e) { dragStart(e, sec, key); });
        var empty = el('span', 'kd-edit-empty', 'leer auf dieser Karte');
        var title = header.querySelector('.kd-section-title');
        if (title) title.appendChild(empty);
        var ctl = el('span', 'kd-edit-ctl');
        [['left', 'nach links'], ['up', 'nach oben'], ['down', 'nach unten'], ['right', 'nach rechts']].forEach(function (b) {
            var btn = el('button', 'kd-edit-btn kd-edit-' + b[0] + ' tappable', SVG(ICONS[b[0]]));
            btn.type = 'button';
            btn.setAttribute('aria-label', sec._kdTitle + ' ' + b[1]);
            btn.addEventListener('click', function (e) { stop(e); e.preventDefault(); step(key, b[0], btn); });
            btn.addEventListener('keydown', stop);
            ctl.appendChild(btn);
        });
        var eye = el('button', 'kd-edit-btn kd-edit-eye tappable');
        eye.type = 'button';
        eye.addEventListener('click', function (e) {
            stop(e); e.preventDefault();
            setHidden(key, S.hidden.indexOf(key) < 0);
            apply(eye);
        });
        eye.addEventListener('keydown', stop);
        ctl.appendChild(eye);
        var chevron = header.querySelector('.kd-section-chevron');
        header.insertBefore(ctl, chevron || null);
    }

    // --- Drag by the grip (mouse, touch, pen) ---
    function dragStart(e, sec, key) {
        if (!S.editing || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault();
        e.stopPropagation();
        var grip = e.currentTarget, rect = sec.getBoundingClientRect(), header = sec.querySelector('.kd-section-header');
        var ph = el('div', 'kd-drop-ph');
        ph.style.height = (header ? header.offsetHeight : 52) + 'px';
        sec.parentNode.insertBefore(ph, sec);
        var dx = e.clientX - rect.left, dy = e.clientY - rect.top;
        sec.classList.add('kd-dragging');
        sec.style.width = rect.width + 'px';
        var lastX = e.clientX, lastY = e.clientY, raf = 0;
        var place = function () {
            sec.style.left = (lastX - dx) + 'px';
            sec.style.top = (lastY - Math.min(dy, 40)) + 'px';
            var target = hitContainer(lastX, lastY);
            if (!target) return;
            var before = null, items = target === S.strip ? [] : target.querySelectorAll('.kd-section');
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it === sec || !it.getClientRects().length) continue;
                var r = it.getBoundingClientRect();
                if (lastY < r.top + r.height / 2) { before = it; break; }
            }
            if (before) { if (ph.nextSibling !== before) target.insertBefore(ph, before); } else if (ph.parentNode !== target || ph.nextSibling) target.appendChild(ph);
        };
        var tick = function () {
            var edge = 70, h = window.innerHeight, v = 0;
            if (lastY < edge) v = -Math.ceil((edge - lastY) / 5);
            else if (lastY > h - edge) v = Math.ceil((lastY - (h - edge)) / 5);
            if (v) { window.scrollBy(0, v); place(); }
            raf = requestAnimationFrame(tick);
        };
        try { grip.setPointerCapture(e.pointerId); } catch (err) { }
        var move = function (ev) { lastX = ev.clientX; lastY = ev.clientY; place(); };
        var end = function () {
            cancelAnimationFrame(raf);
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', end);
            grip.removeEventListener('pointercancel', end);
            sec.classList.remove('kd-dragging');
            sec.style.left = sec.style.top = sec.style.width = '';
            var parent = ph.parentNode, next = ph.nextElementSibling;
            while (next && !next.classList.contains('kd-section')) next = next.nextElementSibling;
            ph.remove();
            if (!parent || !S.host.isConnected) return;
            if (parent === S.strip) setHidden(key, true);
            else {
                setHidden(key, false);
                core.move(S.arr, key, parent.getAttribute('data-slot'), next ? next.getAttribute('data-sec') : null);
            }
            apply();
            if (typeof _kdSnd === 'function') _kdSnd('fx', 'tick');
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
        place();
        raf = requestAnimationFrame(tick);
    }
    function hitContainer(x, y) {
        var r = S.strip.getBoundingClientRect();
        if (y >= r.top - 8 && y <= r.bottom + 8 && x >= r.left && x <= r.right) return S.strip;
        var best = null, dist = Infinity;
        core.slotsFor(S.n).forEach(function (s) {
            var col = S.cols[s];
            if (!col || !col.isConnected) return;
            var cr = col.getBoundingClientRect(), d = x < cr.left ? cr.left - x : x > cr.right ? x - cr.right : 0;
            if (d < dist) { dist = d; best = col; }
        });
        return best;
    }

    // --- Edit mode ---
    api.edit = function (on) {
        if (!api.alive()) return false;
        on = on !== false;
        if (on === S.editing) return true;
        S.editing = on;
        if (on) {
            S.bar = el('div', 'kd-edit-bar tappable');
            S.bar.setAttribute('role', 'toolbar');
            S.bar.setAttribute('aria-label', 'Layout bearbeiten');
            // Which arrangement is being edited: the current column count, highlighted among all of them
            S.bar.innerHTML = '<span class="kd-edit-label">Bearbeite nur</span><span class="kd-edit-chips" aria-hidden="true">' +
                COUNTS.map(function (c) { return '<span class="kd-edit-chip" data-n="' + c + '">' + c + '</span>'; }).join('') +
                '</span><span class="kd-edit-count"></span>';
            S.bar.title = 'Jede Spaltenzahl hat ihr eigenes Layout. Änderungen gelten nur für das hervorgehobene.';
            var reset = el('button', 'kd-edit-bar-btn tappable', 'Zurücksetzen');
            var done = el('button', 'kd-edit-bar-btn kd-edit-done tappable', 'Fertig');
            reset.type = done.type = 'button';
            reset.addEventListener('click', function (e) {
                e.stopPropagation();
                set('kdLayout' + S.n, '');
                S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, S.keys);
                render();
            });
            done.addEventListener('click', function (e) { e.stopPropagation(); api.edit(false); });
            S.bar.appendChild(reset);
            S.bar.appendChild(done);
            S.host.appendChild(S.bar);
        } else if (S.bar) {
            S.bar.remove();
            S.bar = null;
        }
        render();
        if (on) S.host.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return true;
    };
    api.editing = function () { return !!(S && S.editing); };
    // Settings page: save an option and redraw the visible back.
    api.setOption = function (key, value) {
        set(key, value);
        refresh();
    };
    // "Alle Layouts zurücksetzen": every column count and the hidden sections.
    api.resetAll = function () {
        COUNTS.forEach(function (n) { set('kdLayout' + n, ''); });
        set('kdSecHidden', '');
        if (!api.alive()) return;
        S.hidden = [];
        S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, S.keys);
        render();
    };
})();
