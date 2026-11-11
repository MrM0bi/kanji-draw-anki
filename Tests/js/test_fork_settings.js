// Use the shared source itself: classic artwork must keep its original coordinate system.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = name => fs.readFileSync(path.join(__dirname, '../../Templates/src/front', name), 'utf8');

for (const [name, value, expected] of [
    ['theme-font-size', 'normal', '0 0 40 40'],
    ['theme-mode', 'system', '0 0 40 40'],
    ['opt-handwriting', 'on', '0 0 40 40'],
    ['opt-numbers', 'on', '-6 -2 54 46']
]) {
    test(`${name}: switching designs preserves both SVG geometry and original artwork`, () => {
        const attrs = {viewBox: '0 0 24 24'};
        const svg = {
            innerHTML: '<path d="M1 1L2 2"/>',
            getAttribute: key => attrs[key] ?? null,
            setAttribute(key, val) {attrs[key] = val;},
            removeAttribute(key) {delete attrs[key];}
        };
        const classes = new Set();
        const context = {
            window: {_kdDesign: 'kd'}, navigator: {},
            safeGetItem: (_, fallback) => fallback, getGlobalConfig: () => ({themeAccent: 'green'}),
            document: {
                documentElement: {classList: {toggle(key, on) {on ? classes.add(key) : classes.delete(key);}}},
                querySelectorAll(selector) {
                    return selector === `input[name="${name}"][value="${value}"] + .visual-option > svg` ? [svg] : [];
                }
            }
        };
        vm.createContext(context);
        vm.runInContext(src('kd-fork-design.js'), context);
        const original = svg.innerHTML;
        context.window._kdApplyDesign('minimal');
        assert.equal(attrs.viewBox, expected);
        assert.notEqual(svg.innerHTML, original);
        context.window._kdApplyDesign('minimal'); // repeat without losing the v3 snapshot
        context.window._kdApplyDesign('kd');
        assert.equal(attrs.viewBox, '0 0 24 24');
        assert.equal(svg.innerHTML, original);
        assert.ok(!classes.has('kd-design-minimal'));
    });
}

test('sound config takes all six deck defaults, then saved choices override them', () => {
    const saved = {};
    const context = {
        window: {_kdSndUiBound: true},
        getGlobalConfig: () => ({soundLevel: 'low', soundMusic: 'lofi', soundMusicLevel: 'low', soundStroke: 'on', soundFx: 'on', soundImmersion: 'low'}),
        safeGetItem: (key, fallback) => saved[key] ?? fallback
    };
    vm.createContext(context);
    vm.runInContext(src('sound-bridge.js'), context);
    const config = () => JSON.parse(JSON.stringify(context._kdSoundConf()));
    assert.deepEqual(config(), {level: 'low', music: 'lofi', musicLevel: 'low', stroke: 'on', fx: 'on', immersion: 'low'});
    saved.kanjiSoundLevel = 'off';
    saved.kanjiSoundMusic = 'piano';
    saved.kanjiSoundMusicLevel = 'high';
    assert.deepEqual(config(), {level: 'off', music: 'piano', musicLevel: 'high', stroke: 'on', fx: 'on', immersion: 'low'});
});

test('source chips retain independent per-card preferences when toggled or refreshed', () => {
    const stored = {}, defaults = {merksaetze: 'on', kanjiDraw: 'off', heisig: 'on'};
    let tab = 'c1';
    const controls = Object.keys(defaults).map(source => {
        const attrs = {'data-source': source};
        return {getAttribute: key => attrs[key], setAttribute(key, value) {attrs[key] = value;}};
    });
    const key = category => 'kanjiOpt' + category[0].toUpperCase() + category.slice(1);
    const context = {
        getGlobalConfig: () => defaults,
        scopedGet: (name, fallback) => stored[tab + '_' + name] ?? fallback,
        updateFeatureSetting(category, value) {stored[tab + '_' + key(category)] = value;},
        document: {querySelectorAll: () => controls}
    };
    vm.createContext(context);
    vm.runInContext(src('kd-fork-source-settings.js'), context);
    context.kdRefreshSourceSettings();
    assert.deepEqual(controls.map(c => c.getAttribute('aria-pressed')), ['true', 'false', 'true']);
    context.kdSetSource(controls[1]);
    assert.equal(stored.c1_kanjiOptKanjiDraw, 'on');
    assert.equal(controls[1].getAttribute('aria-pressed'), 'true');
    tab = 'c2';
    context.kdRefreshSourceSettings();
    assert.equal(controls[1].getAttribute('aria-pressed'), 'false');
    context.kdSetSource(controls[2]);
    assert.equal(stored.c2_kanjiOptHeisig, 'off');
    tab = 'c1';
    context.kdRefreshSourceSettings();
    assert.deepEqual(controls.map(c => c.getAttribute('aria-pressed')), ['true', 'true', 'true']);
});
