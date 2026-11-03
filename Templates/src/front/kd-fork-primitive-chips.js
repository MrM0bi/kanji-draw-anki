// fork: primitive meanings (PrimitivBedeutung-Override or -DE, comma-separated) as separate pills next to the
// keyword pill. The group is rendered inside the title h2 (Anki conditionals) and moved out here into a row
// wrapper, so the title pill only holds the keyword. It copies the title's inline visibility: Card 2 hides the
// title on its front (it is the answer) and reveals it on the back. Runs on the front and, via FrontSide,
// again on the back (fresh elements each time).
(function () {
    // German keywords can be one long word: lang="de" lets the browser hyphenate them (CSS below) instead of
    // growing the pill into the gear button. Only on the title, so CJK glyph selection elsewhere is unaffected.
    document.querySelectorAll('.card-title').forEach(function (t) {
        if (!t.lang) t.lang = 'de';
        // Without a hyphenation dictionary a long word still widens the pill past its max-width (display:table),
        // or overflows the plain title of the minimal design: step the font down until it fits (min 15px). Inline !important beats the font-size map's !important.
        var limit = (window.innerWidth || document.documentElement.clientWidth) - 140;
        var fs = parseFloat(getComputedStyle(t).fontSize) || 24;
        for (var i = 0; i < 12 && fs > 15 && (t.getBoundingClientRect().width > limit + 1 || t.scrollWidth > t.clientWidth + 1); i++) {
            fs -= 1;
            t.style.setProperty('font-size', fs + 'px', 'important');
        }
    });
    document.querySelectorAll('.card-title > .primitive-group').forEach(function (g) {
        var title = g.parentNode;
        var raw = (g.textContent || '').trim();
        if (!raw) { g.parentNode.removeChild(g); return; }
        var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var words = raw.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
        g.innerHTML = words.map(function (w) { return '<span class="primitive-box">' + esc(w) + '<' + '/span>'; }).join('') +
            '<span class="primitive-label">Primitive<' + '/span>';
        var row = document.createElement('div');
        row.className = 'kd-title-row';
        title.parentNode.insertBefore(row, title);
        row.appendChild(title);
        row.appendChild(g);
        if (title.style.visibility) g.style.visibility = title.style.visibility;
    });
})();
