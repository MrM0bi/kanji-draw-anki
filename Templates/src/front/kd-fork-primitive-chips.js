// fork: primitive meanings (PrimitivBedeutung-Override or -DE, comma-separated) as separate pills next to the
// keyword pill. The group is rendered inside the title h2 (Anki conditionals) and moved out here into a row
// wrapper, so the title pill only holds the keyword. It copies the title's inline visibility: Card 2 hides the
// title on its front (it is the answer) and reveals it on the back. Runs on the front and, via FrontSide,
// again on the back (fresh elements each time).
(function () {
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
    // fork: fit only the keyword, after its primitive meanings have been moved out. Fitting the combined
    // text shrank even "eins" to 17px on a 320px phone. Use the actual row width rather than desktop gutters.
    document.querySelectorAll('.card-title').forEach(function (t) {
        if (!t.lang) t.lang = 'de';
        var row = t.parentNode, limit = (window.innerWidth || document.documentElement.clientWidth) - 140;
        if (row.classList.contains('kd-title-row')) {
            var style = getComputedStyle(row);
            limit = row.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
        }
        var fs = parseFloat(getComputedStyle(t).fontSize) || 24;
        // Keep the established long-word fallback for platforms without German hyphenation dictionaries.
        for (var i = 0; i < 12 && fs > 15 && (t.getBoundingClientRect().width > limit + 1 || t.scrollWidth > t.clientWidth + 1); i++) {
            fs -= 1;
            t.style.setProperty('font-size', fs + 'px', 'important');
        }
    });
    // The tag belongs on the top-right pill (last pill of the first row). Which pill that is depends on the
    // wrapping, so it is moved into that pill after layout and again when the window is resized.
    var placeTags = function () {
        document.querySelectorAll('.kd-title-row .primitive-group').forEach(function (g) {
            var tag = g.querySelector('.primitive-label'), boxes = g.querySelectorAll('.primitive-box');
            if (!tag || !boxes.length) return;
            var top = Infinity, corner = null;
            boxes.forEach(function (b) { top = Math.min(top, b.offsetTop); });
            boxes.forEach(function (b) { if (Math.abs(b.offsetTop - top) < 2) corner = b; });
            if (corner && tag.parentNode !== corner) corner.appendChild(tag);
        });
    };
    placeTags();
    if (window._kdTagResize) window.removeEventListener('resize', window._kdTagResize);
    window._kdTagResize = placeTags;
    window.addEventListener('resize', placeTags);
    // fork: fonts/design changes can rewrap pills without a viewport resize. The group has display:contents,
    // so observe the actual row/pills; disconnect the previous card's observer when FrontSide runs again.
    if (window._kdTagObserver) window._kdTagObserver.disconnect();
    if (window.ResizeObserver) {
        window._kdTagObserver = new ResizeObserver(placeTags);
        document.querySelectorAll('.kd-title-row, .kd-title-row > .card-title, .primitive-box').forEach(function (el) {
            window._kdTagObserver.observe(el);
        });
    }
})();
