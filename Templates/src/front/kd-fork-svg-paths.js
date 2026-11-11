// fork: keep raw field markup inert and construct real SVG paths explicitly. HTML line breaks between
// paths otherwise end the browser's SVG parsing context, leaving only the first stroke inside #svg-bg.
(function () {
    var source = document.getElementById('kd-stroke-source');
    var svg = document.getElementById('svg-bg');
    if (!source || !svg) return;
    var fragment = document.createDocumentFragment();
    source.content.querySelectorAll('path[d]').forEach(function (raw) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', raw.getAttribute('d'));
        fragment.appendChild(path);
    });
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(fragment);
})();
