// fork: pen eraser and Ctrl+Z for the free drawing box. Runs inside the drawing engine (it needs its state).
// - Eraser: a Windows Ink eraser (the pen's eraser end, or a pen button set to "Erase") arrives as a pen
//   pointer with button 5 / buttons bit 32. In free mode it removes every stroke it touches; in guided mode it
//   is ignored, so it never draws a stroke that would be graded.
// - window._kdUndoStroke(): undoes the last free stroke and returns true, or returns false when there is
//   nothing to undo. The "Kanji Draw Persistence" add-on calls it for Anki's Ctrl+Z (Edit → Undo) and runs
//   Anki's own undo when it returns false. When Anki has nothing to undo, its menu entry is disabled and the
//   key reaches the page instead: the keydown listener below handles that case (and Anki versions without
//   the add-on).
const _kdIsEraser = (e) => e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) === 32);
let _kdErasing = null; // { id, last } while the eraser touches the drawing box
let _kdLastUndo = 0;

// Distance from point p to segment ab
const _kdSegDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
// Does the eraser's movement a→b come within r of the stroke?
const _kdHits = (pts, a, b, r) => {
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[i + 1] || p;
        if (_kdSegDist(p, a, b) <= r || _kdSegDist(a, p, q) <= r || _kdSegDist(b, p, q) <= r) return true;
        // Crossing segments (fast eraser movement over a thin stroke)
        const d1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        const d2 = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
        const d3 = (q.x - p.x) * (a.y - p.y) - (q.y - p.y) * (a.x - p.x);
        const d4 = (q.x - p.x) * (b.y - p.y) - (q.y - p.y) * (b.x - p.x);
        if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
    return false;
};

const _kdEraseAlong = (a, b) => {
    if (!isFreeMode || _isRewinding || !freeStrokes.length) return;
    const r = 3 + 2 * _swf(); // eraser radius plus half the stroke width, in 109-unit box coordinates
    let erased = 0;
    for (let i = freeStrokes.length - 1; i >= 0; i--) {
        if (!_kdHits(freeStrokes[i], a, b, r)) continue;
        const path = freeSVGPaths[i];
        freeStrokes.splice(i, 1);
        freeSVGPaths.splice(i, 1);
        erased++;
        if (!path || !path.parentNode) continue;
        const halo = path.previousElementSibling;
        if (halo && halo.classList.contains('gel-halo')) halo.parentNode.removeChild(halo);
        path.style.transition = 'opacity 0.15s ease-in';
        path.style.opacity = '0';
        setTimeout(() => { if (path.parentNode) path.parentNode.removeChild(path); }, 170);
    }
    if (!erased) return;
    saveFreeStrokes();
    _updateUndoBtn();
    _kdSnd('fx', 'undo');
};

const _kdEraserDown = (e) => {
    if (!_kdIsEraser(e) || !(e.target === _evTarget || _evTarget.contains(e.target))) return;
    // Never let the eraser reach startDrawing (or the pen scrolling)
    e.preventDefault(); e.stopImmediatePropagation();
    if (isDrawing) return;
    _cachedRect = null;
    const pos = getMousePos(e);
    _kdErasing = { id: e.pointerId, last: pos };
    try { _evTarget.setPointerCapture(e.pointerId); } catch (err) { }
    _kdEraseAlong(pos, pos);
};
const _kdEraserMove = (e) => {
    if (!_kdErasing || e.pointerId !== _kdErasing.id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const pos = getMousePos(e);
    _kdEraseAlong(_kdErasing.last, pos);
    _kdErasing.last = pos;
};
const _kdEraserUp = (e) => {
    if (!_kdErasing || e.pointerId !== _kdErasing.id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try { _evTarget.releasePointerCapture(e.pointerId); } catch (err) { }
    _kdErasing = null;
};

window._kdUndoStroke = () => {
    // The back side replaces the card without running this card's cleanup: a detached box has nothing to undo
    if (!_evTarget.isConnected) return false;
    if (!isFreeMode || isDrawing || _kdErasing || _isRewinding || !freeStrokes.length) return false;
    // One key press must undo one stroke, even if both the add-on and the keydown listener see it
    const now = Date.now();
    if (now - _kdLastUndo < 150) return true;
    _kdLastUndo = now;
    freeUndoAction();
    _kdSnd('fx', 'undo');
    return true;
};
const _kdUndoKey = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key || '').toLowerCase() !== 'z') return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (window._kdUndoStroke()) e.preventDefault();
};

if (window.PointerEvent) {
    document.addEventListener('pointerdown', _kdEraserDown, true);
    document.addEventListener('pointermove', _kdEraserMove, true);
    document.addEventListener('pointerup', _kdEraserUp, true);
    document.addEventListener('pointercancel', _kdEraserUp, true);
}
document.addEventListener('keydown', _kdUndoKey);
const _kdPrevCleanup = window._kanjiDrawCleanup;
window._kanjiDrawCleanup = () => {
    document.removeEventListener('pointerdown', _kdEraserDown, true);
    document.removeEventListener('pointermove', _kdEraserMove, true);
    document.removeEventListener('pointerup', _kdEraserUp, true);
    document.removeEventListener('pointercancel', _kdEraserUp, true);
    document.removeEventListener('keydown', _kdUndoKey);
    _kdErasing = null;
    window._kdUndoStroke = null;
    if (_kdPrevCleanup) _kdPrevCleanup();
};
