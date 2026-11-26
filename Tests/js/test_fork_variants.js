// Field grammar of Varianten (Templates/src/back/kd-fork-variants.js).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {window: {}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../Templates/src/back/kd-fork-variants.js'), 'utf8'), context);
const parse = raw => JSON.parse(JSON.stringify(context.window._kdParseVariants(raw)));

test('full entry with paths, examples and source', () => {
    const [v] = parse('犭[Wildhunde]@links#buch{猫, 狩}: Links im Kanji. <path d="M1,2c3,4,5,6,7,8"></path><path d="M9,9l1,1"/>');
    assert.equal(v.glyph, '犭');
    assert.equal(v.name, 'Wildhunde');
    assert.equal(v.pos, 'links');
    assert.equal(v.src, 'buch');
    assert.deepEqual(v.examples, ['猫', '狩']);
    assert.equal(v.desc, 'Links im Kanji.');
    assert.deepEqual(v.paths, ['M1,2c3,4,5,6,7,8', 'M9,9l1,1']);
});

test('several entries, optional parts, escaped and editor HTML', () => {
    const items = parse('氵@links: drei Tropfen ||<br>〓[Reiskörner]: &lt;path d="M0,0l5,5"&gt;&lt;/path&gt;<div>||</div>[Haar]@oben: ohne Glyphe');
    assert.equal(items.length, 3);
    assert.deepEqual([items[0].glyph, items[0].name, items[0].pos], ['氵', '', 'links']);
    assert.deepEqual([items[1].glyph, items[1].name, items[1].paths], ['〓', 'Reiskörner', ['M0,0l5,5']]);
    assert.deepEqual([items[2].glyph, items[2].name, items[2].pos], ['', 'Haar', 'oben']);
});

test('broken entries are skipped', () => {
    assert.deepEqual(parse(''), []);
    assert.deepEqual(parse('kein Doppelpunkt || : nur Text'), []);
});
