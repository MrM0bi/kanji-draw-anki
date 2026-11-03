// fork: design switch (docs/fork/v3-migration.md D25). Sets html.kd-design-minimal before the first paint.
// Global setting kanjiThemeDesign ('kd' | 'minimal'), CSS default --default-theme-design. Same storage
// chain as safeGetItem (add-on _ks, cookie _k, single cookie, localStorage), which isn't defined yet here.
(function () {
    try {
        var R = document.documentElement, k = 'kanjiThemeDesign', v = null;
        if (window._ks && window._ks[k] !== undefined) v = window._ks[k];
        if (v == null) try {
            var cs = document.cookie.split('; '), i;
            if (location.protocol !== 'file:') for (i = 0; i < cs.length; i++) if (cs[i].indexOf('_k=') === 0) { var o = JSON.parse(decodeURIComponent(cs[i].substring(3))); if (o[k] !== undefined) v = o[k]; break; }
            if (v == null) for (i = cs.length - 1; i >= 0; i--) if (cs[i].indexOf(k + '=') === 0) { v = decodeURIComponent(cs[i].substring(k.length + 1)); break; }
        } catch (e) { }
        if (v == null) try { v = localStorage.getItem(k); } catch (e) { }
        if (v == null) v = (getComputedStyle(R).getPropertyValue('--default-theme-design') || '').replace(/['"\s]/g, '');
        R.classList.toggle('kd-design-minimal', v === 'minimal');
        window._kdDesign = v === 'minimal' ? 'minimal' : 'kd';
    } catch (e) { }
})();
