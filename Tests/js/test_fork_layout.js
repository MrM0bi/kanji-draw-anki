// Pure helpers of the section layout (Templates/src/back/kd-fork-layout.js): parsing, folding, defaults.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {window: {}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../Templates/src/back/kd-fork-layout.js'), 'utf8'), context);
const core = context.window._kdLayout.core;
const KEYS = ['elemente', 'eselsbruecken', 'notiz', 'schreibfehler', 'strichfolge', 'lesungen', 'wortbeispiele', 'links']; // KD_SECTIONS order
const plain = v => JSON.parse(JSON.stringify(v));
const all = arr => Object.values(arr).flat().sort();
const store = saved => key => saved[key] || '';

test('slots are symmetric around the centre', () => {
    assert.deepEqual(plain(core.slotsFor(1)), ['C']);
    assert.deepEqual(plain(core.slotsFor(2)), ['L1', 'R1']);
    assert.deepEqual(plain(core.slotsFor(4)), ['L2', 'L1', 'R1', 'R2']);
    assert.deepEqual(plain(core.slotsFor(5)), ['L2', 'L1', 'C', 'R1', 'R2']);
    assert.deepEqual(plain(core.slotsFor(7)), ['L3', 'L2', 'L1', 'C', 'R1', 'R2', 'R3']);
});

test('folding between odd and even counts', () => {
    const odd = {L2: ['a'], L1: ['b'], C: ['c'], R1: ['d'], R2: ['e']};
    assert.deepEqual(plain(core.fold(odd, 4, 5)), {L2: ['a'], L1: ['c', 'b'], R1: ['d'], R2: ['e']}); // centre on top of L1
    assert.deepEqual(plain(core.fold(odd, 2, 5)), {L1: ['c', 'b', 'a'], R1: ['d', 'e']});
    const even = {L3: ['a'], L2: ['b'], L1: ['c'], R1: ['d'], R2: ['e'], R3: ['f']};
    assert.deepEqual(plain(core.fold(even, 5, 6)), {L2: ['a'], L1: ['b'], C: ['c', 'd'], R1: ['e'], R2: ['f']}); // middle pair → centre
    assert.deepEqual(plain(core.fold(even, 3, 6)), {L1: ['b', 'a'], C: ['c', 'd'], R1: ['e', 'f']});
    assert.deepEqual(plain(core.fold(even, 4, 6)), {L2: ['b', 'a'], L1: ['c'], R1: ['d'], R2: ['e', 'f']});
    assert.deepEqual(plain(core.fold(even, 1, 6)), {C: ['c', 'd', 'b', 'e', 'a', 'f']});
});

test('folding adds outer columns below the outermost remaining one', () => {
    const arr = {L3: ['a'], L2: ['b'], L1: ['c'], C: ['d'], R1: ['e'], R2: [], R3: ['f']};
    assert.deepEqual(plain(core.fold(arr, 3)), {L1: ['c', 'b', 'a'], C: ['d'], R1: ['e', 'f']});
    assert.deepEqual(plain(core.fold(arr, 1)), {C: ['d', 'c', 'e', 'b', 'a', 'f']}); // centre outwards
});

test('every arrangement holds every section exactly once', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
        assert.deepEqual(all(plain(core.arrangement(n, store({}), KEYS))), [...KEYS].sort(), `n=${n}`);
    }
});

test('the one-column default is the KD_SECTIONS order', () => {
    assert.deepEqual(plain(core.arrangement(1, store({}), KEYS)), {C: KEYS});
});

test('broken or partial saved strings are repaired', () => {
    const one = core.arrangement(1, store({kdLayout1: 'links, unknown,links,elemente,,notiz'}), KEYS);
    assert.deepEqual(plain(one.C).slice(0, 3), ['links', 'elemente', 'eselsbruecken']);
    assert.deepEqual(all(plain(one)), [...KEYS].sort());
    const five = core.arrangement(5, store({kdLayout5: 'X9:links|C:elemente,elemente|R2:notiz|garbage'}), KEYS);
    assert.deepEqual(all(plain(five)), [...KEYS].sort());
    assert.deepEqual(plain(five.R2), ['notiz', 'lesungen', 'wortbeispiele']); // missing ones go to their default column
});

test('an unarranged count folds the nearest larger saved one, a saved one wins', () => {
    const saved = {kdLayout7: 'L3:links|C:elemente|R1:lesungen|R3:notiz'};
    const three = core.arrangement(3, store(saved), KEYS);
    assert.ok(three.L1.includes('links'));
    assert.deepEqual(plain(three.R1).filter(k => k === 'lesungen' || k === 'notiz'), ['lesungen', 'notiz']);
    saved.kdLayout3 = 'C:links';
    assert.deepEqual(plain(core.arrangement(3, store(saved), KEYS).C), ['elemente', 'lesungen', 'links']); // after their default predecessors
    assert.equal(core.serialize({C: ['a', 'b']}, 1), 'a,b');
    assert.equal(core.serialize({L1: ['a'], C: [], R1: ['b']}, 3), 'L1:a|R1:b');
    // the nearest larger saved count wins, whatever its parity
    const four = core.arrangement(4, store({kdLayout5: 'C:links|R2:notiz', kdLayout6: 'L3:notiz'}), KEYS);
    assert.deepEqual(plain(four.L1), ['elemente', 'links']); // the 5-column centre on top of L1
    assert.ok(four.R2.includes('notiz') && !four.L2.includes('notiz')); // not the 6-column one
});

test('column count: setting, window width and phones', () => {
    assert.equal(core.count('auto', 400, 2000, false), 4);   // 5 columns need 2096 px
    assert.equal(core.count('auto', 400, 2200, false), 5);
    assert.equal(core.count('auto', 400, 9000, false), 7);
    assert.equal(core.count('2', 400, 9000, false), 2);
    assert.equal(core.count('auto', 300, 1000, true), 1);    // phone in landscape
    assert.equal(core.count('3', 400, 3000, false), 3);
    assert.equal(core.count('7', 400, 1000, false), 2);
    assert.equal(core.count('9', 400, 9000, false), 7);      // old saved value
    assert.equal(core.count('1', 400, 3000, false), 1);
});

test('empty outer pairs are dropped, inner gaps stay', () => {
    const arr = {L2: [], L1: ['a'], C: ['b'], R1: [], R2: ['c']};
    assert.equal(core.shownCount(arr, 5, []), 5);
    assert.equal(core.shownCount(arr, 5, ['c']), 3);
    assert.equal(core.shownCount({L1: ['a'], C: ['b'], R1: []}, 3, ['a']), 1);
    assert.equal(core.shownCount({L2: [], L1: ['a'], R1: [], R2: []}, 4, []), 2);
    assert.equal(core.shownCount({L1: [], R1: []}, 2, []), 2);
});

test('stored names and values fit the Desktop add-on filter', () => {
    const KEY_RE = /^(?:c1_|c2_|c2f_)?kanji[A-Za-z]{1,40}$/; // Addon/__init__.py
    for (const k of ['kdLayout1', 'kdLayout7', 'kdSecHidden', 'kdLayoutCols', 'kdLayoutSide', 'kdSec_eselsbruecken', 'kdSecW_wortbeispiele']) {
        assert.match(core.storeKey(k), KEY_RE, k);
    }
    assert.equal(core.storeKey('kdLayout3'), 'kanjiKdLayoutThree');
    assert.equal(core.storeKey('kdSecW_notiz'), 'kanjiKdSecWNotiz');
    const full = core.serialize(core.arrangement(7, store({}), KEYS), 7);
    const enc = core.encode('kdLayout7', full);
    assert.ok(enc.length <= 64, enc);
    assert.equal(core.decode('kdLayout7', enc), full);
    assert.equal(core.decode('kdLayout7', full), full); // old values with full names still read
    assert.equal(core.encode('kdSecHidden', KEYS.join(',')).length, 15);
    assert.equal(core.encode('kdLayoutCols', 'auto'), 'auto');
});
