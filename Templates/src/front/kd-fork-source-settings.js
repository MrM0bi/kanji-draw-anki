// fork: source chips share the existing per-card persistence; native buttons support keyboard toggling.
function kdRefreshSourceSettings() {
    var gc = getGlobalConfig();
    document.querySelectorAll('button[data-source]').forEach(function (control) {
        var category = control.getAttribute('data-source');
        var key = 'kanjiOpt' + category.charAt(0).toUpperCase() + category.slice(1);
        control.setAttribute('aria-pressed', scopedGet(key, gc[category]) === 'on' ? 'true' : 'false');
    });
}
function kdSetSource(control) {
    updateFeatureSetting(control.getAttribute('data-source'), control.getAttribute('aria-pressed') === 'true' ? 'off' : 'on');
    kdRefreshSourceSettings();
}
