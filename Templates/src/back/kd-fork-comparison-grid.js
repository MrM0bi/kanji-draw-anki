// fork: pre-v3 comparison grid, using current scoped grid settings.
const buildGridSvg = () => {
    const globalConf = getGlobalConfig();
    const type = safeGetItem('c1_kanjiGridType', safeGetItem('kanjiGridType', globalConf.type));
    const style = safeGetItem('c1_kanjiGridStyle', safeGetItem('kanjiGridStyle', globalConf.style));
    const thick = safeGetItem('c1_kanjiGridThick', safeGetItem('kanjiGridThick', globalConf.thick));
    const opac = safeGetItem('c1_kanjiGridOpac', safeGetItem('kanjiGridOpac', globalConf.opac));

    if (type === 'none') return null;

    let dashValue = '3, 6', thickValue = '0.5', opacityValue = '0.5';
    if (style === 'solid') dashValue = 'none';
    if (style === 'dotted') dashValue = '0.05, 5';
    if (thick === 'thin') thickValue = '0.3';
    else if (thick === 'thick') thickValue = '1.0';
    if (opac === 'light') opacityValue = '0.25';
    if (opac === 'dark') opacityValue = '0.8';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 109 109');
    svg.setAttribute('class', 'sbs-grid');
    svg.style.opacity = opacityValue;

    const c = 54.5;
    const frag = document.createDocumentFragment();
    const addSeg = (d) => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'var(--grid-color)');
        p.setAttribute('stroke-width', thickValue);
        if (dashValue !== 'none') p.setAttribute('stroke-dasharray', dashValue);
        if (style === 'dotted') p.setAttribute('stroke-linecap', 'round');
        frag.appendChild(p);
    };

    if (type === 'cross' || type === 'full') {
        addSeg(`M ${c},${c} L ${c},0`); addSeg(`M ${c},${c} L ${c},109`);
        addSeg(`M ${c},${c} L 0,${c}`); addSeg(`M ${c},${c} L 109,${c}`);
    }
    if (type === 'full') {
        addSeg(`M ${c},${c} L 0,0`); addSeg(`M ${c},${c} L 109,0`);
        addSeg(`M ${c},${c} L 0,109`); addSeg(`M ${c},${c} L 109,109`);
    }
    svg.appendChild(frag);
    return svg;
};
