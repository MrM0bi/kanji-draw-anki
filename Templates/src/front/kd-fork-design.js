// fork: design switch, second part (D25). In the minimal design the icons of known elements go back to the
// pre-v3 outline icons (the original markup is kept on the element and restored when switching back);
// everything else is restyled by the html.kd-design-minimal block in Styling.css. Runs at the end of the
// front (all markup exists) and, via FrontSide, again on the back.
(function () {
    var GEAR = '<circle cx="12" cy="12" r="3"><' + '/circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"><' + '/path>';
    var ICONS = [
        ['.gear-btn > svg', GEAR],
        ['.settings-main-title > svg', GEAR],
        ['#button-reveal > svg', '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"><' + '/path><circle cx="12" cy="12" r="3"><' + '/circle>'],
        ['#button-undo > svg', '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"><' + '/path><path d="M22 21H7"><' + '/path><path d="m5 11 9 9"><' + '/path>'],
        ['#button-skip > svg', '<path d="M12 20h9"><' + '/path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"><' + '/path>'],
        ['#button-reset > svg', '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"><' + '/path><path d="M3 3v5h5"><' + '/path>'],
        ['.category-icon.cat-grid > svg', '<path d="M4 6h16M4 12h16M4 18h7"><' + '/path>'],
        ['.category-icon.cat-front > svg', '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"><' + '/path><polyline points="22 4 12 14.01 9 11.01"><' + '/polyline>'],
        ['.category-icon.cat-back > svg', '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"><' + '/rect><path d="M9 18l6-6-6-6" transform="rotate(180 12 12)"><' + '/path>'],
        ['#settings-main .category-icon.cat-theme > svg', '<circle cx="12" cy="12" r="10"><' + '/circle><path d="M12 2a10 10 0 0 1 0 20z"><' + '/path>'],
        ['#settings-main .category-icon.cat-sound > svg', '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"><' + '/polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"><' + '/path>'],
        // Danke uses the same category classes as the settings menu, but different actions.
        ['#page-about .cat-theme > svg', '<polygon points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.2 6.4 20.2 7.5 14 3 9.6 9.2 8.7"><' + '/polygon>'],
        ['#page-about .cat-sound > svg', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"><' + '/path><path d="M9.5 8a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 14h.01"><' + '/path>']
    ];

    window._kdApplyDesign = function (design) {
        var R = document.documentElement;
        if (design) window._kdDesign = design;
        var min = window._kdDesign === 'minimal';
        R.classList.toggle('kd-design-minimal', min);
        ICONS.forEach(function (p) {
            document.querySelectorAll(p[0]).forEach(function (svg) {
                if (min) {
                    if (svg._kdOrig == null) svg._kdOrig = svg.innerHTML;
                    svg.innerHTML = p[1];
                } else if (svg._kdOrig != null) {
                    svg.innerHTML = svg._kdOrig;
                    svg._kdOrig = null;
                }
            });
        });
        if (window._kdSectionIcons) window._kdSectionIcons();
    };

    // Keep html.kd-accent-plain in sync when the accent changes (wraps upstream's updateThemeSetting, which
    // every accent radio calls; re-wrapped on each render because the front script redefines it)
    var syncAccent = function () {
        var a = 'green';
        try { a = safeGetItem('kanjiThemeAccent', getGlobalConfig().themeAccent || 'green'); } catch (e) { }
        document.documentElement.classList.toggle('kd-accent-plain', a === 'plain');
    };
    if (typeof updateThemeSetting === 'function' && !updateThemeSetting._kdWrapped) {
        var orig = updateThemeSetting;
        window.updateThemeSetting = function (category) {
            if (category === 'accent') try { safeSetItem('kanjiThemeAccent', arguments[1]); syncAccent(); } catch (e) { }
            return orig.apply(this, arguments);
        };
        window.updateThemeSetting._kdWrapped = true;
    }
    syncAccent();

    window.kdSetDesign = function (val) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        try { safeSetItem('kanjiThemeDesign', val); } catch (e) { }
        window._kdApplyDesign(val);
    };

    window._kdApplyDesign();
})();
