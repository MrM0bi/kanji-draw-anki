    // fork: pen scrolling on Anki Desktop. Qt WebEngine handles a Windows Ink pen drag like a mouse drag (it
    // selects text instead of panning), so a pen swipe could not scroll the card or the settings as it does in a
    // browser. This pans the nearest scrollable area: pen input only, only where touch-action allows panning (never
    // on the drawing pad or the component tree, which handle the pen themselves), only after a small movement (taps
    // stay taps), and it backs off when the browser starts its own pan (pointercancel / the page already scrolled).
    (function () {
        if (window._kdPenScrollBound || typeof PointerEvent === 'undefined') return;
        window._kdPenScrollBound = true;
        var SLOP = 10, st = null, fling = null;
        var root = function () { return document.scrollingElement || document.documentElement; };
        var desktop = function () { return document.documentElement.classList.contains('is-ankidesktop'); };
        // Like a browser: touch-action counts up to the nearest scroll container (e.g. the settings dialog
        // scrolls even though the locked card body has touch-action: none).
        var blocked = function (el) {
            for (; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
                if (el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
                var cs = getComputedStyle(el), ta = cs.touchAction;
                if (ta === 'none' || ta === 'pinch-zoom') return true;
                if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) return false;
            }
            return false;
        };
        var scroller = function (el, dx, dy) {
            var vertical = Math.abs(dy) >= Math.abs(dx);
            for (; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
                var cs = getComputedStyle(el);
                if (vertical && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
                if (!vertical && /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return el;
            }
            return root();
        };
        var stopFling = function () { if (fling) { cancelAnimationFrame(fling); fling = null; } };
        var end = function () { document.documentElement.classList.remove('kd-pen-panning'); st = null; };
        var eatClick = function () {
            var eat = function (e) { e.preventDefault(); e.stopPropagation(); document.removeEventListener('click', eat, true); };
            document.addEventListener('click', eat, true);
            setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
        };
        document.addEventListener('pointerdown', function (e) {
            stopFling();
            if (e.pointerType !== 'pen' || e.button > 0 || !desktop()) return;
            var el = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
            if (!el || blocked(el)) return;
            st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, el: el, box: null,
                panning: false, top0: root().scrollTop, vx: 0, vy: 0, t: performance.now() };
        }, true);
        document.addEventListener('pointermove', function (e) {
            if (!st || e.pointerId !== st.id) return;
            if (!st.panning) {
                var tx = e.clientX - st.x0, ty = e.clientY - st.y0;
                if (Math.hypot(tx, ty) < SLOP) return;
                if (root().scrollTop !== st.top0) { end(); return; } // the browser pans natively
                st.panning = true;
                st.box = scroller(st.el, tx, ty);
                document.documentElement.classList.add('kd-pen-panning');
            }
            var dx = e.clientX - st.x, dy = e.clientY - st.y, t = performance.now(), dt = Math.max(1, t - st.t);
            st.box.scrollTop -= dy;
            st.box.scrollLeft -= dx;
            st.vx = 0.7 * st.vx + 0.3 * (dx / dt); st.vy = 0.7 * st.vy + 0.3 * (dy / dt);
            st.x = e.clientX; st.y = e.clientY; st.t = t;
            var sel = window.getSelection && window.getSelection();
            if (sel && sel.rangeCount) sel.removeAllRanges();
            if (e.cancelable) e.preventDefault();
        }, true);
        document.addEventListener('pointerup', function (e) {
            if (!st || e.pointerId !== st.id) return;
            if (st.panning) {
                eatClick();
                var box = st.box, vx = st.vx, vy = st.vy, last = performance.now();
                if (performance.now() - st.t < 80 && Math.hypot(vx, vy) > 0.25) {
                    var step = function () {
                        var t = performance.now(), dt = t - last; last = t;
                        box.scrollTop -= vy * dt; box.scrollLeft -= vx * dt;
                        var k = Math.pow(0.94, dt / 16); vx *= k; vy *= k;
                        fling = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : null;
                    };
                    fling = requestAnimationFrame(step);
                }
            }
            end();
        }, true);
        document.addEventListener('pointercancel', function (e) { if (st && e.pointerId === st.id) end(); }, true);
    })();
