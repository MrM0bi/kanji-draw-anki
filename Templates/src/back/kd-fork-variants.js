// fork: "Varianten" section: the short and alternative forms of a kanji or primitive (field Varianten, FORK.md).
// Field grammar, entries separated by "||" like Stolperfallen:
//   Glyph[Name]@Position#Quelle{Beispiele}: Beschreibung <path d="…"></path>…
// Everything but the glyph and ": Beschreibung" is optional. Glyph: the form (〓 when Unicode has none).
// Name: the primitive meaning of this form. Position: links, rechts, oben, unten, einfassung, mitte, allein,
// voll (the full form, listed on primitive notes that are short forms). Quelle: buch = named in the book
// (kept in the data for searching, not shown).
// Beispiele: kanji that use this form, comma-separated. The <path> elements (KanjiVG 109×109, stroke order)
// draw the form; without them the glyph is shown as text. The glyph is kept in the field (searchable) but
// not repeated next to a drawing: fonts often lack rare forms such as 𧘇.
window._kdParseVariants = function (raw) {
    var txt = String(raw || '')
        .replace(/<br\s*\/?>/gi, ' ').replace(/<\/?div[^>]*>/gi, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    var out = [];
    txt.split(/\s*\|\|\s*/).forEach(function (chunk) {
        chunk = chunk.trim();
        if (!chunk) return;
        var m = /^([^\[\]@#{}:<]*?)\s*(?:\[([^\]]*)\])?\s*(?:@([^\s#{:]+))?\s*(?:#([A-Za-zäöü]+))?\s*(?:\{([^}]*)\})?\s*:\s*([\s\S]*)$/.exec(chunk);
        if (!m || !(m[1] || m[2])) return;
        var paths = [];
        var desc = m[6].replace(/<path\b[^>]*?\bd="([^"]+)"[^>]*?(?:\/>|>\s*<\/path>|>)/gi, function (all, d) {
            paths.push(d);
            return '';
        }).replace(/<\/path>/gi, '').trim();
        out.push({
            glyph: m[1].trim(),
            name: (m[2] || '').trim(),
            pos: (m[3] || '').trim().toLowerCase(),
            src: (m[4] || '').trim().toLowerCase(),
            examples: (m[5] || '').split(/[,、\s]+/).filter(Boolean),
            desc: desc,
            paths: paths
        });
    });
    return out;
};

window._kdRenderVariants = function (raw, target) {
    if (!target) return 0;
    var items = window._kdParseVariants(raw);
    target.innerHTML = '';
    if (!items.length) return 0;
    var NS = 'http://www.w3.org/2000/svg';
    var POS = {
        links: 'links', rechts: 'rechts', oben: 'oben', unten: 'unten', mitte: 'Mitte',
        einfassung: 'Einfassung', allein: 'allein', voll: 'Vollform'
    };
    var mk = function (tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    };
    // Replays the strokes in order (tap on the drawing)
    var play = function (svg) {
        var ps = svg.querySelectorAll('.kd-var-stroke');
        var t = 0;
        ps.forEach(function (p) {
            var len = 0;
            try { len = p.getTotalLength(); } catch (e) { }
            if (!len) return;
            var dur = Math.max(0.18, Math.min(0.5, len / 140));
            p.style.transition = 'none';
            p.style.strokeDasharray = len + ' ' + len;
            p.style.strokeDashoffset = String(len);
            void p.getBoundingClientRect();
            p.style.transition = 'stroke-dashoffset ' + dur + 's ease-in-out ' + t + 's';
            p.style.strokeDashoffset = '0';
            t += dur + 0.08;
        });
    };
    // Card like the Schreibfehler cards: badge row, then drawing + name + description, examples below.
    items.forEach(function (it) {
        var card = mk('div', 'kd-var-card');
        var main = mk('div', 'kd-var-main');
        var fig = mk('div', 'kd-var-figure');
        if (it.paths.length) {
            var svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', '0 0 109 109');
            svg.setAttribute('class', 'kd-var-svg');
            svg.setAttribute('aria-hidden', 'true');
            it.paths.forEach(function (d) {
                var p = document.createElementNS(NS, 'path');
                p.setAttribute('d', d);
                p.setAttribute('class', 'kd-var-stroke');
                svg.appendChild(p);
            });
            fig.appendChild(svg);
            fig.classList.add('tappable');
            fig.title = 'Strichfolge abspielen';
            fig.addEventListener('click', function (e) { e.stopPropagation(); play(svg); });
        } else {
            fig.appendChild(mk('span', 'kd-var-glyph-big', it.glyph || '〓'));
        }
        main.appendChild(fig);

        var body = mk('div', 'kd-var-body');
        if (it.pos) body.appendChild(mk('span', 'kd-var-pos', POS[it.pos] || it.pos));
        if (it.name) body.appendChild(mk('div', 'kd-var-name', it.name));
        if (it.desc) {
            var desc = mk('p', 'kd-var-desc');
            desc.innerHTML = it.desc;
            body.appendChild(desc);
        }
        main.appendChild(body);
        card.appendChild(main);

        if (it.examples.length) {
            var ex = mk('div', 'kd-var-examples');
            ex.appendChild(mk('span', 'kd-var-examples-label', 'In'));
            it.examples.forEach(function (k) { ex.appendChild(mk('span', 'kd-var-example', k)); });
            card.appendChild(ex);
        }
        target.appendChild(card);
    });
    return items.length;
};
