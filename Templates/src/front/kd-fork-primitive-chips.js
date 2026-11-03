// fork: split PrimitivBedeutung-Override or -DE (comma-separated) into one .primitive-box per word plus a
// single "Primitive" label. Runs on the front and, via FrontSide, again on the back (guarded per element).
(function () {
    document.querySelectorAll('.primitive-group').forEach(function (g) {
        if (g._kdPrimDone) return;
        g._kdPrimDone = true;
        var raw = (g.textContent || '').trim();
        if (!raw) { g.style.display = 'none'; return; }
        var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var words = raw.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
        g.innerHTML = words.map(function (w) { return '<span class="primitive-box">' + esc(w) + '<' + '/span>'; }).join('') +
            '<span class="primitive-label">Primitive<' + '/span>';
    });
})();
