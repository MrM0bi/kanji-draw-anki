// Core of the highlighter add-on (Highlighter/editor.js): set, recolour and remove kd-kw spans in field HTML.
// Notation: "[" and "]" mark the selection, "|" a cursor; results are written the same way.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../Highlighter/editor.js');

function split(s) {
    const c = s.indexOf('|');
    if (c >= 0) return {html: s.slice(0, c) + s.slice(c + 1), a: c, b: c};
    const a = s.indexOf('['), b = s.indexOf(']') - 1;
    return {html: s.replace('[', '').replace(']', ''), a, b};
}

function show(r) {
    if (r.msg) return 'MSG: ' + r.msg;
    if (r.a === r.b) return r.html.slice(0, r.a) + '|' + r.html.slice(r.a);
    return r.html.slice(0, r.a) + '[' + r.html.slice(r.a, r.b) + ']' + r.html.slice(r.b);
}

const run = (op, s, code) => {
    const {html, a, b} = split(s);
    return show(core.run(op, html, a, b, code));
};
const apply = (s, code) => run('apply', s, code);
const erase = s => run('erase', s);
const C1 = '<span class="kd-kw kd-c1">', C2 = '<span class="kd-kw kd-c2">', K = '<span class="kd-kw kd-k">';

test('wraps a selection', () => {
    assert.equal(apply('Ein [Hund] bellt', 'c1'), `Ein ${C1}[Hund]</span> bellt`);
    assert.equal(apply('Ein [Hund] bellt', 'k'), `Ein ${K}[Hund]</span> bellt`);
});

test('trims spaces and &nbsp; from the selection', () => {
    assert.equal(apply('Ein[ Hund ]bellt', 'c1'), `Ein ${C1}[Hund]</span> bellt`);
    assert.equal(apply('Ein[&nbsp;Hund&nbsp;]bellt', 'c1'), `Ein&nbsp;${C1}[Hund]</span>&nbsp;bellt`);
    assert.equal(apply('Ein[   ]Hund', 'c1'), 'MSG: ' + core.MSG.empty);
});

test('a cursor highlights the word around it', () => {
    assert.equal(apply('Ein Hu|nd bellt', 'c2'), `Ein ${C2}[Hund]</span> bellt`);
    assert.equal(apply('Ein Hund| bellt', 'c2'), `Ein ${C2}[Hund]</span> bellt`);
    assert.equal(apply('Große Bä|ren', 'c1'), `Große ${C1}[Bären]</span>`);
    assert.equal(apply('Ein | Hund', 'c1'), 'MSG: ' + core.MSG.noWord);
    assert.equal(apply('a&nb|sp;b', 'c1'), 'MSG: ' + core.MSG.noWord);
    assert.equal(apply('<sp|an>x</span>', 'c1'), 'MSG: ' + core.MSG.noWord);
});

test('a cursor inside a highlight recolours it', () => {
    assert.equal(apply(`Ein ${C1}Hu|nd</span> bellt`, 'c3'), 'Ein <span class="kd-kw kd-c3">[Hund]</span> bellt');
    assert.equal(apply(`Ein ${C1}Hu|nd</span> bellt`, 'c1'), `Ein ${C1}[Hund]</span> bellt`);
});

test('selecting a whole highlight recolours it', () => {
    assert.equal(apply(`Ein ${C1}[Hund]</span> bellt`, 'k'), `Ein ${K}[Hund]</span> bellt`);
    assert.equal(apply(`Ein [${C1}Hund</span>] bellt`, 'k'), `Ein ${K}[Hund]</span> bellt`);
});

test('recolouring keeps other classes and attributes', () => {
    assert.equal(apply('<span title="x" class=\'kd-kw kd-c1 extra\'>Hu|nd</span>', 'c2'),
        '<span title="x" class="kd-kw kd-c2 extra">[Hund]</span>');
    assert.equal(apply('<span class="kd-kw">Hu|nd</span>', 'c2'), `${C2}[Hund]</span>`);
});

test('part of a highlight is split out', () => {
    assert.equal(apply(`${C1}großer [Hund]</span>`, 'c2'), `${C1}großer </span>${C2}[Hund]</span>`);
    assert.equal(apply(`${C1}[großer] Hund</span>`, 'c2'), `${C2}[großer]</span>${C1} Hund</span>`);
    assert.equal(apply(`${C1}ein [großer] Hund</span>`, 'c2'), `${C1}ein </span>${C2}[großer]</span>${C1} Hund</span>`);
});

test('highlights inside the selection are replaced', () => {
    assert.equal(apply(`[Ein ${C1}Hund</span> bellt]`, 'c2'), `${C2}[Ein Hund bellt]</span>`);
});

test('a selection that cuts through an element is widened to keep the HTML valid', () => {
    assert.equal(apply('<b>großer [Hund</b> bellt]', 'c1'), `${C1}[<b>großer Hund</b> bellt]</span>`);
    assert.equal(apply(`${C1}großer [Hund</span> bellt]`, 'c2'), `${C2}[großer Hund bellt]</span>`);
    assert.equal(apply('Ein [<b>Hund</b>] bellt', 'c1'), `Ein ${C1}[<b>Hund</b>]</span> bellt`);
});

test('selection boundaries inside a tag (HTML editor) snap to the tag', () => {
    assert.equal(apply('a <b cl[ass="x">Hund</b>] c', 'c1'), `a ${C1}[<b class="x">Hund</b>]</span> c`);
});

test('ordinary spans are not treated as highlights', () => {
    assert.equal(apply('<span class="other">Hu|nd</span>', 'c1'), `<span class="other">${C1}[Hund]</span></span>`);
    assert.equal(erase('<span class="other">Hu|nd</span>'), 'MSG: ' + core.MSG.noMark);
    assert.equal(erase('<span class="kd-p">Hu|nd</span>'), 'MSG: ' + core.MSG.noMark);
});

test('erase at a cursor removes that highlight only', () => {
    assert.equal(erase(`${C1}Hund</span> und ${C2}Ka|tze</span>`), `${C1}Hund</span> und Ka|tze`);
    assert.equal(erase(`${C1}Hund</span> u|nd`), 'MSG: ' + core.MSG.noMark);
});

test('erase removes the innermost highlight', () => {
    assert.equal(erase(`${C1}a ${C2}H|und</span> b</span>`), `${C1}a H|und b</span>`);
});

test('erase in the open tag (HTML editor)', () => {
    assert.equal(erase(`x <span cla|ss="kd-kw kd-c1">Hund</span>`), 'x |Hund');
});

test('erase with a selection removes every highlight it touches', () => {
    assert.equal(erase(`${C1}Hund</span> [und ${C2}Ka]tze</span> ${K}Maus</span>`),
        `${C1}Hund</span> [und Ka]tze ${K}Maus</span>`);
    assert.equal(erase(`[${C1}Hund</span> und ${C2}Katze</span>]`), '[Hund und Katze]');
    assert.equal(erase('[nichts]'), 'MSG: ' + core.MSG.noMark);
});

test('void and unclosed elements do not break parsing', () => {
    assert.equal(apply('Zeile<br>[Hund]<br>', 'c1'), `Zeile<br>${C1}[Hund]</span><br>`);
    assert.equal(apply('<div>Ein [Hund]', 'c1'), `<div>Ein ${C1}[Hund]</span>`);
});

test('unknown colour codes are rejected', () => {
    assert.equal(apply('[Hund]', 'c7'), 'MSG: ' + core.MSG.badCode);
    assert.equal(apply('[Hund]', 'x" onclick="'), 'MSG: ' + core.MSG.badCode);
});
