// fork: restored free-drawing comparison; shares the evaluator and style/badge helpers.
// ── SIDE-BY-SIDE ──
hideRefPaths();
const penaltyColor = m => m >= 2 ? 'var(--stroke-err)' : m === 1 ? 'var(--stroke-warn1)' : 'var(--stroke-active)';

// Left: user strokes + ghost (missing) strokes as dashed indicators
const userSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
userSvg.setAttribute('viewBox', '0 0 109 109');
ev.orderedStrokes.forEach(entry => {
    if (entry.type === 'user') {
        const stroke = entry.stroke;
        if (!stroke.d) return;
        appendStrokePath(userSvg, makeStrokePath(stroke.d, '3', gradeColor(stroke.grade)));
    } else if (entry.type === 'extra') {
        const stroke = entry.stroke;
        if (!stroke.d) return;
        const ep = makeStrokePath(stroke.d, '3', 'var(--stroke-err)');
        stripGelStyle(ep);
        ep.classList.add('stroke-extra');
        wrapInPulseGroup(userSvg, ep, 'stroke-extra-group');
    } else if (entry.type === 'ghost') {
        const origD = ev.refPathData[entry.refIdx];
        if (!origD) return;
        const gp = makeStrokePath(origD, '3', 'var(--stroke-warn2, var(--stroke-err))');
        stripGelStyle(gp);
        gp.classList.add('stroke-ghost');
        wrapInPulseGroup(userSvg, gp, 'stroke-ghost-group');
    }
});

// Right: reference paths
const refSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
refSvg.setAttribute('viewBox', '0 0 109 109');
ev.refPathData.forEach((origD, idx) => {
    if (!origD) return;
    const color = isColorBack ? penaltyColor(ev.freePS[idx] || 0) : 'var(--stroke-active)';
    const p = makeStrokePath(origD, '3', color);
    p.style.strokeDashoffset = '0';
    p.style.strokeDasharray = 'none';
    appendStrokePath(refSvg, p);
});

const wrapper = document.createElement('div');
wrapper.className = 'side-by-side-wrapper';
wrapper.innerHTML =
    '<div class="side-by-side-box"><div class="sbs-kanji"></div><div class="side-by-side-label">Du</div></div>' +
    '<div class="side-by-side-box"><div class="sbs-kanji"></div><div class="side-by-side-label">Original</div></div>';
const sbsBoxes = wrapper.querySelectorAll('.sbs-kanji');
const gridUser = buildGridSvg();
const gridRef = buildGridSvg();
if (gridUser) sbsBoxes[0].appendChild(gridUser);
if (gridRef) sbsBoxes[1].appendChild(gridRef);
preHideGroupsIfNeeded(userSvg, 'stroke-extra-group');
preHideGroupsIfNeeded(userSvg, 'stroke-ghost-group');
sbsBoxes[0].appendChild(userSvg);
sbsBoxes[1].appendChild(refSvg);

cont.style.display = 'none';
// Remove placeholder badges from cont — SBS uses its own badge row outside cont
cont.querySelectorAll('.excess-strokes-badge, .missing-strokes-badge').forEach(el => el.remove());
cont.parentNode && cont.parentNode.insertBefore(wrapper, cont.nextSibling);

// Stroke count badges for SBS view — placed in a row AFTER the SBS wrapper
// (below both drawing pads) so they don't crowd the compact SBS layout.
const sbsExtra = ev.orderedStrokes.filter(e => e.type === 'extra').length;
const sbsGhost = ev.orderedStrokes.filter(e => e.type === 'ghost').length;
if (sbsExtra > 0 || sbsGhost > 0) {
    const sbsBadgeRow = document.createElement('div');
    sbsBadgeRow.className = 'sbs-badge-row';
    if (sbsExtra > 0) {
        const eb = makeBadge('excess-strokes-badge', '<span style="font-size:11px;line-height:1">✚</span>' + (+sbsExtra === 1 ? ' 1 Strich zu viel' : ' ' + sbsExtra + ' Striche zu viel'), 'stroke-extra-group', sbsBoxes[0]);
        applyBadgeImmediate(eb);
        sbsBadgeRow.appendChild(eb);
        restoreBadgeVisibility(eb, 'stroke-extra-group', sbsBoxes[0]);
    }
    if (sbsGhost > 0) {
        const mb = makeBadge('missing-strokes-badge', '<span style="font-size:11px;line-height:1;display:inline-block;transform:rotate(45deg)">✚</span>' + (+sbsGhost === 1 ? ' 1 Strich zu wenig' : ' ' + sbsGhost + ' Striche zu wenig'), 'stroke-ghost-group', sbsBoxes[0]);
        applyBadgeImmediate(mb);
        sbsBadgeRow.appendChild(mb);
        restoreBadgeVisibility(mb, 'stroke-ghost-group', sbsBoxes[0]);
    }
    // Insert badge row after the SBS wrapper (below both drawing pads)
    wrapper.parentNode && wrapper.parentNode.insertBefore(sbsBadgeRow, wrapper.nextSibling);
}

if (isNumbers) {
    // Build an index mapping: svgPathIndex → grade (for user) or null (for ghost)
    const userSvgOrder = ev.orderedStrokes
        .map(e => e.type === 'user' ? (e.stroke && e.stroke.grade) : null);
    addNumbersGPAL(userSvg, (i) => {
        if (!isColorBack) return 'var(--text-muted)';
        const g = userSvgOrder[i];
        return g && g !== 'good' ? gradeColor(g) : 'var(--text-muted)';
    });
    adoptNumbersIntoGroups(userSvg);
    if (_isViewSwitch) userSvg.querySelectorAll('text.stroke-number').forEach(t => { t.style.animation = 'none'; t.style.opacity = '1'; });
    addNumbersGPAL(refSvg, (i) => {
        if (!isColorBack) return 'var(--text-muted)';
        return penaltyColor(ev.freePS[i] || 0) !== 'var(--stroke-active)' ? penaltyColor(ev.freePS[i] || 0) : 'var(--text-muted)';
    });
    if (_isViewSwitch) refSvg.querySelectorAll('text.stroke-number').forEach(t => { t.style.animation = 'none'; t.style.opacity = '1'; });
}

requestAnimationFrame(() => {
    wrapper.classList.add('splitting');
    requestAnimationFrame(() => { wrapper.classList.add('visible'); });
});
