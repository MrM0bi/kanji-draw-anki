// Exercise the real scheduler after a delayed UI tick; no audio hardware needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const audio = path.join(__dirname, '../../Templates/src/audio');
const control = fs.readFileSync(path.join(audio, '15-control.js'), 'utf8');
const graph = fs.readFileSync(path.join(audio, '05-graph.js'), 'utf8');

function player(nextT) {
    return {
        nextT, barDur: 2, bar: 0, endT: null, ending: false, needSong: false,
        step() {}, applyWant() {}, scheduled: [],
        scheduleBar(t) { this.scheduled.push(t); }
    };
}

for (const delay of [0.01, 0.19, 0.3, 12, 1000]) {
    test(`a tick delayed by ${delay}s skips overdue bars without a note burst`, () => {
        const p = player(10 - delay);
        const ctx = { now: () => 10, OFF: false, players: [p], stopTimer() {} };
        vm.createContext(ctx);
        vm.runInContext(control, ctx);
        ctx.pump(12.1);
        assert.ok(p.scheduled.length > 0);
        assert.ok(p.scheduled.every(t => t >= 10.05), p.scheduled.join(', '));
        assert.ok(p.scheduled.length <= 2, 'only schedule bars within the lookahead');
        assert.ok(p.bar >= 1);
    });
}

test('offline rendering retains every bar from time zero', () => {
    const p = player(0);
    const ctx = { now: () => 0, OFF: true, players: [p] };
    vm.createContext(ctx);
    vm.runInContext(control, ctx);
    ctx.pump(6);
    assert.deepEqual(p.scheduled, [0, 2, 4]);
});

test('an on-time live tick retains its scheduled bar', () => {
    const p = player(10.1);
    const ctx = { now: () => 10, OFF: false, players: [p], stopTimer() {} };
    vm.createContext(ctx);
    vm.runInContext(control, ctx);
    ctx.pump(12);
    assert.deepEqual(p.scheduled, [10.1]);
});

for (const [ua, expected] of [['Windows NT 10.0; QtWebEngine/6.11', 'balanced'], ['Android', 'interactive'], ['iPhone', 'interactive']]) {
    test(`${ua} requests ${expected} output latency and reuses the context`, () => {
        let calls = 0, options;
        const ctx = {
            ctx: null, disposed: false, cfg: { level: 'mid' }, navigator: { userAgent: ua },
            AC: function (opts) { calls++; options = opts; },
            bank: { warm() {} }, musicOn: () => false, makeNoise() {}, makeWaves() {}, buildGraph() {}
        };
        vm.createContext(ctx);
        vm.runInContext(graph, ctx);
        ctx.setup = () => {}; // graph construction is independent of the context options
        ctx.ensureCtx();
        ctx.ensureCtx();
        assert.equal(calls, 1);
        assert.equal(options.latencyHint, expected);
    });
}
