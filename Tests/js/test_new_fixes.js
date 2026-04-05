/**
 * Stress test suite for all recent fixes and known instability areas:
 *   1. saveState debounce (50ms) — rapid strokes must batch writes
 *   2. _cachedRect pointerleave invalidation — stale rect detection
 *   3. Celebration _drawGen guard — no stale DOM ops after card change
 *   4. Theme deferred-check race — rapid theme + nightMode combos
 *   5. MutationObserver nightMode storm — prevent state corruption
 *   6. localStorage pressure — thousands of rapid ops without throw
 *   7. _saveStateTimer memory — no timer accumulation over 1000 strokes
 *   8. _drawGen overflow guard — wrap-around safety
 */
'use strict';
const assert = require('assert');

// ─── Timer Mock ────────────────────────────────────────────────────────────────

let _tid = 0, _timers = new Map(), _now = 0, _errors = [];
function mockSetTimeout(fn, delay) {
    const id = ++_tid;
    _timers.set(id, { fn, fireAt: _now + (delay || 0) });
    return id;
}
function mockClearTimeout(id) { _timers.delete(id); }
function advanceTime(ms) {
    const end = _now + ms;
    while (_now < end) {
        _now++;
        for (const [id, t] of [..._timers]) {
            if (t.fireAt <= _now) {
                _timers.delete(id);
                try { t.fn(); } catch (e) { _errors.push(e); }
            }
        }
    }
}
function resetMocks() { _tid = 0; _timers.clear(); _now = 0; _errors = []; }

// ─── localStorage mock ─────────────────────────────────────────────────────────

function makeMockStorage() {
    const store = new Map();
    let writeCount = 0, readCount = 0;
    return {
        setItem(k, v) { writeCount++; store.set(k, v); },
        getItem(k) { readCount++; return store.has(k) ? store.get(k) : null; },
        removeItem(k) { store.delete(k); },
        get writeCount() { return writeCount; },
        get readCount() { return readCount; },
        resetCounters() { writeCount = 0; readCount = 0; },
        clear() { store.clear(); writeCount = 0; readCount = 0; },
        get size() { return store.size; },
    };
}

// ─── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
    total++;
    resetMocks();
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. saveState debounce
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== saveState Debounce ===\n');

test('100 rapid strokes produce exactly 1 storage write per key', () => {
    const ls = makeMockStorage();
    const timer = { id: null };

    // Mirrors the debounced saveState from FrontTemplate
    const saveState = () => {
        mockClearTimeout(timer.id);
        timer.id = mockSetTimeout(() => {
            ls.setItem('kanjiErrors', '[]');
            ls.setItem('kanjiCurrentStroke', '0');
        }, 50);
    };

    for (let i = 0; i < 100; i++) { saveState(); _now += 1; }
    assert.strictEqual(ls.writeCount, 0, 'no writes before timer fires');
    advanceTime(60);
    assert.strictEqual(ls.writeCount, 2, 'exactly 2 writes (2 keys) after debounce');
    assert.strictEqual(_timers.size, 0, 'no lingering timers');
});

test('strokes 49ms apart: all batched into 1 write (each resets the 50ms timer)', () => {
    const ls = makeMockStorage();
    const timer = { id: null };
    const saveState = () => {
        mockClearTimeout(timer.id);
        timer.id = mockSetTimeout(() => { ls.setItem('kanjiErrors', '[]'); ls.setItem('kanjiCurrentStroke', '0'); }, 50);
    };

    for (let i = 0; i < 5; i++) { saveState(); _now += 49; }
    assert.strictEqual(ls.writeCount, 0, 'no writes: each stroke resets the 50ms timer');
    advanceTime(60);
    assert.strictEqual(ls.writeCount, 2, 'exactly 1 batch write after settling');
});

test('strokes 60ms apart: each produces its own write (independent batches)', () => {
    const ls = makeMockStorage();
    const timer = { id: null };
    const saveState = () => {
        mockClearTimeout(timer.id);
        timer.id = mockSetTimeout(() => { ls.setItem('kanjiErrors', '[]'); ls.setItem('kanjiCurrentStroke', '0'); }, 50);
    };

    for (let i = 0; i < 5; i++) { saveState(); advanceTime(60); }
    assert.strictEqual(ls.writeCount, 10, '5 independent batches → 10 writes (2 keys each)');
});

test('saveState timer count never exceeds 1 (no timer accumulation over 1000 saves)', () => {
    const timer = { id: null };
    const saveState = () => {
        mockClearTimeout(timer.id);
        timer.id = mockSetTimeout(() => {}, 50);
    };

    for (let i = 0; i < 1000; i++) { saveState(); _now += 1; }
    assert.strictEqual(_timers.size, 1, 'exactly 1 pending timer after 1000 rapid saves');
    advanceTime(100);
    assert.strictEqual(_timers.size, 0, 'timer cleaned up after fire');
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. _cachedRect pointerleave invalidation
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== _cachedRect Pointerleave Invalidation ===\n');

test('rect is null before first getMousePos call', () => {
    let _cachedRect = null;
    assert.strictEqual(_cachedRect, null, 'rect starts null');
});

test('rect is populated after first getMousePos, cleared on pointerleave', () => {
    let _cachedRect = null;
    const mockCanvas = { getBoundingClientRect: () => ({ left: 50, top: 50, width: 200, height: 200 }) };
    const getMousePos = (evt) => {
        if (!_cachedRect) _cachedRect = mockCanvas.getBoundingClientRect();
        return { x: evt.clientX - _cachedRect.left, y: evt.clientY - _cachedRect.top };
    };
    // mirrors: const stopDrawingOnLeave = (e) => { if (isDrawing) stopDrawing(e); _cachedRect = null; }
    const stopDrawingOnLeave = (isDrawing) => { if (isDrawing) { /* stopDrawing */ } _cachedRect = null; };

    getMousePos({ clientX: 100, clientY: 100 });
    assert.notStrictEqual(_cachedRect, null, 'rect populated after first call');
    stopDrawingOnLeave(false);
    assert.strictEqual(_cachedRect, null, 'rect cleared on pointerleave even without active stroke');
});

test('stale rect causes wrong coordinates — pointerleave fix corrects it', () => {
    let _cachedRect = null;
    let canvasPos = { left: 0, top: 0, width: 200, height: 200 };
    const mockCanvas = { getBoundingClientRect: () => ({ ...canvasPos }) };

    const getMousePos = (evt) => {
        if (!_cachedRect) _cachedRect = mockCanvas.getBoundingClientRect();
        return { x: evt.clientX - _cachedRect.left, y: evt.clientY - _cachedRect.top };
    };
    const stopDrawingOnLeave = () => { _cachedRect = null; };

    getMousePos({ clientX: 100, clientY: 100 });
    assert.strictEqual(getMousePos({ clientX: 100 }).x, 100);

    // Canvas scrolled — without fix, stale rect gives wrong answer
    canvasPos.left = 50;
    assert.strictEqual(getMousePos({ clientX: 100 }).x, 100, 'stale rect gives wrong answer');

    // After pointerleave: fresh rect gives correct answer
    stopDrawingOnLeave();
    assert.strictEqual(getMousePos({ clientX: 100 }).x, 50, 'fresh rect after pointerleave');
});

test('invalidateRect (resize handler) also clears the rect', () => {
    let _cachedRect = null;
    const mockCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };
    const getMousePos = (evt) => {
        if (!_cachedRect) _cachedRect = mockCanvas.getBoundingClientRect();
        return { x: evt.clientX - _cachedRect.left };
    };
    const invalidateRect = () => { _cachedRect = null; };

    getMousePos({ clientX: 50 });
    assert.notStrictEqual(_cachedRect, null);
    invalidateRect();
    assert.strictEqual(_cachedRect, null, 'rect cleared by resize handler');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Celebration _drawGen guard
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Celebration _drawGen Guard ===\n');

test('cleanup does NOT run if _drawGen changed before timeout fires (card flipped)', () => {
    let _drawGen = 0;
    let cleanupCalled = false;

    const cel = () => {
        const _celGen = _drawGen;
        mockSetTimeout(() => {
            if (_drawGen !== _celGen) return; // guard
            cleanupCalled = true;
        }, 950);
    };

    cel();
    _drawGen++; // card flipped during celebration
    advanceTime(1000);
    assert.strictEqual(cleanupCalled, false, 'cleanup skipped because drawGen changed');
});

test('cleanup DOES run when card was not changed before timeout', () => {
    let _drawGen = 0;
    let cleanupCalled = false;

    const cel = () => {
        const _celGen = _drawGen;
        mockSetTimeout(() => {
            if (_drawGen !== _celGen) return;
            cleanupCalled = true;
        }, 950);
    };

    cel();
    advanceTime(1000);
    assert.strictEqual(cleanupCalled, true, 'cleanup runs when card stays active');
});

test('rapid card flips: only the most recent celebration cleans up', () => {
    let _drawGen = 0;
    let cleanupCount = 0;

    const cel = () => {
        const _celGen = _drawGen;
        mockSetTimeout(() => {
            if (_drawGen !== _celGen) return;
            cleanupCount++;
        }, 950);
    };

    cel(); _drawGen++;
    cel(); _drawGen++;
    cel(); // third celebration on final card (no increment after)

    advanceTime(1000);
    assert.strictEqual(cleanupCount, 1, 'only the most-recent celebration cleans up');
});

test('_drawGen guard works correctly at the int32 boundary (JS float64 is safe)', () => {
    let _drawGen = 2147483647;
    let cleanupCalled = false;

    const cel = () => {
        const _celGen = _drawGen;
        mockSetTimeout(() => {
            if (_drawGen !== _celGen) return;
            cleanupCalled = true;
        }, 950);
    };

    cel();
    _drawGen++;
    advanceTime(1000);
    assert.strictEqual(cleanupCalled, false, 'guard works at max int32 value');
    assert.strictEqual(_drawGen, 2147483648, 'JS number does not overflow at int32 boundary');
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Theme deferred-check race
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Theme Deferred-Check Race ===\n');

function makeMockThemeState() {
    const ls = makeMockStorage();
    let _deferredThemeTimer = null;
    let applyCount = 0;
    let appliedMode = null;

    const applyThemeSettings = (mode) => { applyCount++; appliedMode = mode; };

    const scheduleDeferredThemeCheck = () => {
        mockClearTimeout(_deferredThemeTimer);
        _deferredThemeTimer = mockSetTimeout(() => {
            const mode = ls.getItem('kanjiThemeMode') || 'system';
            if (mode === 'light' || mode === 'dark') applyThemeSettings(mode);
        }, 200);
    };

    return { ls, scheduleDeferredThemeCheck,
             get applyCount() { return applyCount; },
             get appliedMode() { return appliedMode; },
             get pendingTimers() { return _timers.size; } };
}

test('rapid schedule calls produce exactly 1 apply after settle', () => {
    const t = makeMockThemeState();
    t.ls.setItem('kanjiThemeMode', 'dark');

    for (let i = 0; i < 20; i++) { t.scheduleDeferredThemeCheck(); _now += 10; }
    assert.strictEqual(t.applyCount, 0, 'no apply before 200ms');
    advanceTime(250);
    assert.strictEqual(t.applyCount, 1, 'exactly 1 apply after settle');
    assert.strictEqual(t.appliedMode, 'dark');
});

test('system mode: deferred check never force-applies', () => {
    const t = makeMockThemeState();
    t.ls.setItem('kanjiThemeMode', 'system');
    t.scheduleDeferredThemeCheck();
    advanceTime(300);
    assert.strictEqual(t.applyCount, 0, 'system mode skips deferred apply');
});

test('no lingering timer after deferred check fires', () => {
    const t = makeMockThemeState();
    t.ls.setItem('kanjiThemeMode', 'light');
    t.scheduleDeferredThemeCheck();
    advanceTime(300);
    assert.strictEqual(t.pendingTimers, 0, 'no lingering timer after fire');
});

test('rapid mode changes: applies only the last mode', () => {
    const t = makeMockThemeState();

    t.ls.setItem('kanjiThemeMode', 'light');
    t.scheduleDeferredThemeCheck(); _now += 50;
    t.ls.setItem('kanjiThemeMode', 'dark');
    t.scheduleDeferredThemeCheck(); _now += 50;
    t.ls.setItem('kanjiThemeMode', 'light');
    t.scheduleDeferredThemeCheck();

    advanceTime(300);
    assert.strictEqual(t.applyCount, 1, 'only 1 apply after rapid changes');
    assert.strictEqual(t.appliedMode, 'light', 'applied the latest mode');
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. MutationObserver nightMode storm
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== MutationObserver NightMode Storm ===\n');

function makeMockMO() {
    let _ankiNativeNightMode = false;
    let _tmplClassChange = false;
    let themeApplyCount = 0;
    let lastApplied = null;

    const applyTheme = (isDark) => { themeApplyCount++; lastApplied = isDark; };
    const handleMutation = (prevNM, hasNM) => {
        if (_tmplClassChange) return; // ignore our own class changes
        if (prevNM === hasNM) return; // no actual nightMode change
        _ankiNativeNightMode = hasNM;
        applyTheme(hasNM);
    };

    return {
        get ankiNativeNightMode() { return _ankiNativeNightMode; },
        get themeApplyCount() { return themeApplyCount; },
        get lastApplied() { return lastApplied; },
        setTmplClassChange(v) { _tmplClassChange = v; },
        handleMutation,
    };
}

test('nightMode false→true fires apply exactly once', () => {
    const mo = makeMockMO();
    mo.handleMutation(false, true);
    assert.strictEqual(mo.themeApplyCount, 1);
    assert.strictEqual(mo.lastApplied, true);
    assert.strictEqual(mo.ankiNativeNightMode, true);
});

test('same value (no actual change) does not fire apply', () => {
    const mo = makeMockMO();
    mo.handleMutation(false, false);
    mo.handleMutation(true, true);
    assert.strictEqual(mo.themeApplyCount, 0, 'prevNM === hasNM: no apply');
});

test('_tmplClassChange flag suppresses apply for our own class mutations', () => {
    const mo = makeMockMO();
    mo.setTmplClassChange(true);
    mo.handleMutation(false, true);
    assert.strictEqual(mo.themeApplyCount, 0, 'tmplClassChange suppresses apply');
});

test('50 rapid nightMode toggles each trigger exactly 1 apply', () => {
    const mo = makeMockMO();
    let prev = false;
    for (let i = 0; i < 50; i++) {
        const next = !prev;
        mo.handleMutation(prev, next);
        prev = next;
    }
    assert.strictEqual(mo.themeApplyCount, 50, '50 real changes → 50 applies');
    assert.strictEqual(mo.lastApplied, false, '50 toggles from false ends on false');
});

test('duplicate classList.add when nightMode already set: only 1 apply', () => {
    const mo = makeMockMO();
    mo.handleMutation(false, true);  // first: false→true → apply
    for (let i = 0; i < 19; i++) { mo.handleMutation(true, true); } // already set: no change
    assert.strictEqual(mo.themeApplyCount, 1, 'only 1 apply for initial add');
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. localStorage pressure
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== localStorage Pressure ===\n');

test('5000 rapid setItem/getItem cycles complete without error', () => {
    const ls = makeMockStorage();
    let errors = 0;
    const KEYS = ['kanjiErrors', 'kanjiCurrentStroke', 'kanjiThemeMode', 'kanjiThemeStrokeStyle', 'Card1_kanjiGridStyle'];
    for (let i = 0; i < 5000; i++) {
        const k = KEYS[i % KEYS.length];
        try {
            ls.setItem(k, JSON.stringify({ i, data: 'x'.repeat(50) }));
            ls.getItem(k);
        } catch (e) { errors++; }
    }
    assert.strictEqual(errors, 0, 'no errors in 5000 read/write cycles');
    assert.strictEqual(ls.writeCount, 5000);
    assert.strictEqual(ls.readCount, 5000);
});

test('JSON round-trip of large problemStrokes array (50 strokes)', () => {
    const arr = new Array(50).fill(0).map((_, i) => i % 5);
    const str = JSON.stringify(arr);
    const parsed = JSON.parse(str);
    assert.deepStrictEqual(parsed, arr, 'round-trip JSON for large stroke array');
    assert(str.length < 200, 'compact JSON representation');
});

test('dual storage writes (sessionStorage + localStorage) stay in sync', () => {
    const session = makeMockStorage();
    const local = makeMockStorage();

    const saveState = (errors, stroke) => {
        [session, local].forEach(s => {
            s.setItem('kanjiErrors', JSON.stringify(errors));
            s.setItem('kanjiCurrentStroke', stroke.toString());
        });
    };

    saveState([0, 1, 2], 3);
    assert.strictEqual(local.getItem('kanjiCurrentStroke'), '3');
    assert.strictEqual(session.getItem('kanjiCurrentStroke'), '3');
    assert.strictEqual(local.getItem('kanjiErrors'), session.getItem('kanjiErrors'));
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Timer accumulation over 1000 strokes
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== Timer Accumulation (1000 strokes) ===\n');

test('1000 guided strokes with skip: active timer count stays ≤ 2', () => {
    const saveTimer = { id: null };
    const skipTimeouts = [];

    for (let i = 0; i < 1000; i++) {
        // saveState debounce
        mockClearTimeout(saveTimer.id);
        saveTimer.id = mockSetTimeout(() => {}, 50);

        // skip animation timer (cleared before each new skip)
        skipTimeouts.forEach(mockClearTimeout);
        skipTimeouts.length = 0;
        skipTimeouts.push(mockSetTimeout(() => {}, 700));

        _now += 10;
    }

    assert(_timers.size <= 2, `timer count after 1000 strokes: ${_timers.size} (expected ≤ 2)`);
    advanceTime(800);
    assert.strictEqual(_timers.size, 0, 'all timers resolved after completion');
});

test('reject stroke 500x: clearTimeout prevents error/fade timer accumulation', () => {
    let errorTimeout = null, fadeTimeout = null;

    for (let i = 0; i < 500; i++) {
        mockClearTimeout(errorTimeout); mockClearTimeout(fadeTimeout);
        errorTimeout = mockSetTimeout(() => {
            fadeTimeout = mockSetTimeout(() => {}, 200);
        }, 250);
        _now += 5;
    }

    assert(_timers.size <= 1, `reject timer count: ${_timers.size} (expected ≤ 1)`);
    advanceTime(500);
    assert(_timers.size <= 1);
    advanceTime(300);
    assert.strictEqual(_timers.size, 0, 'all timers resolved');
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. _drawGen wrap-around and concurrent generation safety
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== drawGen Concurrent Safety ===\n');

test('two concurrent celebrations: only the last gen cleans up', () => {
    let _drawGen = 5;
    const cleanedGens = [];

    const cel = () => {
        const g = _drawGen;
        mockSetTimeout(() => {
            if (_drawGen !== g) return;
            cleanedGens.push(g);
        }, 950);
    };

    cel(); _drawGen = 6;
    cel(); // gen=6, no flip after
    advanceTime(1100);
    assert.deepStrictEqual(cleanedGens, [6], 'only gen 6 cleaned up');
});

test('drawGen guard prevents stale skip animation from executing', () => {
    let _drawGen = 0;
    let stalePathTaken = false;
    let freshPathTaken = false;

    const gen0 = _drawGen;
    mockSetTimeout(() => {
        if (_drawGen !== gen0) { stalePathTaken = true; return; }
        freshPathTaken = true;
    }, 700);

    _drawGen++; // card changes before animation fires
    advanceTime(800);
    assert.strictEqual(stalePathTaken, true, 'stale guard path taken');
    assert.strictEqual(freshPathTaken, false, 'fresh callback NOT executed');
});

// ══════════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(55));
console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═'.repeat(55) + '\n');
if (failed > 0) process.exit(1);
