/**
 * test_banners.js — Banner HTML/CSS/JS tests
 *
 * Tests:
 *   - AnkiDroid Legacy swipe-gesture warning (#legacy-gesture-warning)
 *   - Anki Desktop addon-missing hint (#addon-hint)
 *   - Both banners present in Card-1 AND Card-2 FrontTemplates
 *   - pointer-events: auto when visible
 *   - Copy button with clearTimeout guard
 *   - Dismiss logic (localStorage / sessionStorage)
 *   - AnkiWeb link for addon
 *   - JS detection logic (AnkiDroidJS / pycmd / _kanjiAddonLoaded)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const assert = require('assert').strict;

const base = path.resolve(__dirname, '../..');
const c1f  = fs.readFileSync(path.join(base, 'Templates/Card-1/FrontTemplate.html'), 'utf8');
const c2f  = fs.readFileSync(path.join(base, 'Templates/Card-2/FrontTemplate.html'), 'utf8');
const css  = fs.readFileSync(path.join(base, 'Templates/Styling.css'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}

// ── 1. HTML presence ──
console.log('── 1. HTML presence ──');

test('C1: #legacy-gesture-warning exists', () => {
    assert(c1f.includes('id="legacy-gesture-warning"'), 'Missing legacy-gesture-warning in Card-1');
});
test('C1: #addon-hint exists', () => {
    assert(c1f.includes('id="addon-hint"'), 'Missing addon-hint in Card-1');
});
test('C2: #legacy-gesture-warning exists', () => {
    assert(c2f.includes('id="legacy-gesture-warning"'), 'Missing legacy-gesture-warning in Card-2');
});
test('C2: #addon-hint exists', () => {
    assert(c2f.includes('id="addon-hint"'), 'Missing addon-hint in Card-2');
});

// ── 2. AnkiDroid Legacy banner ──
console.log('\n── 2. AnkiDroid Legacy banner ──');

test('C1: lgw-dismiss button present', () => {
    assert(c1f.includes('id="lgw-dismiss"'), 'Missing dismiss button in C1');
});
test('C2: lgw-dismiss button present', () => {
    assert(c2f.includes('id="lgw-dismiss"'), 'Missing dismiss button in C2');
});
test('C1: lgw dismiss stores localStorage key kanji-lgw-dismissed', () => {
    assert(c1f.includes("'kanji-lgw-dismissed'"), 'Should persist dismiss in localStorage');
});
test('C2: lgw dismiss stores localStorage key kanji-lgw-dismissed', () => {
    assert(c2f.includes("'kanji-lgw-dismissed'"), 'Should persist dismiss in localStorage');
});
test('C1: lgw JS checks AnkiDroidJS + isNewMode guard', () => {
    const match = c1f.match(/typeof AnkiDroidJS[\s\S]{0,300}isNewMode/);
    assert(match, 'Legacy banner check should guard against new study mode');
});
test('C2: lgw JS checks AnkiDroidJS + isNewMode guard', () => {
    const match = c2f.match(/typeof AnkiDroidJS[\s\S]{0,300}isNewMode/);
    assert(match, 'Legacy banner check should guard against new study mode');
});
test('C1: lgw shown with setTimeout 80ms', () => {
    const match = c1f.match(/typeof AnkiDroidJS !== 'undefined'[\s\S]{0,650}},\s*80\s*\)/);
    assert(match, 'Banner should appear with 80ms delay');
});

// ── 3. Addon-missing hint banner ──
console.log('\n── 3. Addon-missing hint banner ──');

test('C1: addon-hint-copy button present', () => {
    assert(c1f.includes('id="addon-hint-copy"'), 'Missing copy button in C1');
});
test('C2: addon-hint-copy button present', () => {
    assert(c2f.includes('id="addon-hint-copy"'), 'Missing copy button in C2');
});
test('C1: addon code 905251277 in banner', () => {
    assert(c1f.includes('905251277'), 'Addon code missing from C1 banner');
});
test('C2: addon code 905251277 in banner', () => {
    assert(c2f.includes('905251277'), 'Addon code missing from C2 banner');
});
test('C1: AnkiWeb link in addon-hint', () => {
    assert(c1f.includes('https://ankiweb.net/shared/info/905251277'), 'AnkiWeb link missing from C1');
});
test('C2: AnkiWeb link in addon-hint', () => {
    assert(c2f.includes('https://ankiweb.net/shared/info/905251277'), 'AnkiWeb link missing from C2');
});
test('AnkiWeb link opens in new tab (target=_blank)', () => {
    assert(c1f.includes('target="_blank"'), 'Link should open in new tab');
});
test('AnkiWeb link has rel=noopener', () => {
    assert(c1f.includes('rel="noopener"'), 'Link should have rel=noopener for security');
});
test('C1: addon-hint dismiss stores sessionStorage key', () => {
    assert(c1f.includes("'kanji-addon-hint-dismissed'"), 'Should store dismiss flag in sessionStorage');
});
test('C2: addon-hint dismiss stores sessionStorage key', () => {
    assert(c2f.includes("'kanji-addon-hint-dismissed'"), 'Should store dismiss flag in sessionStorage');
});
test('C1: addon-hint JS checks pycmd (Desktop only)', () => {
    const match = c1f.match(/typeof pycmd\s*===\s*'function'/);
    assert(match, 'addon-hint should only show on Anki Desktop (pycmd check)');
});
test('C2: addon-hint JS checks pycmd (Desktop only)', () => {
    const match = c2f.match(/typeof pycmd\s*===\s*'function'/);
    assert(match, 'addon-hint should only show on Anki Desktop (pycmd check)');
});
test('C1: addon-hint JS checks !_kanjiAddonLoaded sentinel', () => {
    const match = c1f.match(/!window\._kanjiAddonLoaded/);
    assert(match, 'Should check _kanjiAddonLoaded sentinel before showing banner');
});
test('C2: addon-hint JS checks !_kanjiAddonLoaded sentinel', () => {
    const match = c2f.match(/!window\._kanjiAddonLoaded/);
    assert(match, 'Should check _kanjiAddonLoaded sentinel before showing banner');
});

// ── 4. Copy button ──
console.log('\n── 4. Copy button ──');

test('C1: copy button uses textarea trick (Qt WebEngine compat)', () => {
    assert(c1f.includes("createElement('textarea')"), 'Should use textarea for clipboard in Qt WebEngine');
});
test('C2: copy button uses textarea trick (Qt WebEngine compat)', () => {
    assert(c2f.includes("createElement('textarea')"), 'Should use textarea for clipboard in Qt WebEngine');
});
test('C1: copy button removes textarea after copy', () => {
    assert(c1f.includes('document.body.removeChild(el)'), 'Should remove textarea after copy');
});
test('C1: copy button clears previous timer on rapid click (clearTimeout guard)', () => {
    const match = c1f.match(/clearTimeout\(b\._ct\)/);
    assert(match, 'Should clear previous timer to prevent stacking on rapid clicks');
});
test('C2: copy button clears previous timer on rapid click (clearTimeout guard)', () => {
    const match = c2f.match(/clearTimeout\(b\._ct\)/);
    assert(match, 'Should clear previous timer to prevent stacking on rapid clicks');
});

// ── 5. CSS — pointer-events ──
console.log('\n── 5. CSS pointer-events ──');

test('CSS: banners hidden by default (display:none or pointer-events:none)', () => {
    // display:none is sufficient — it fully removes from interaction
    const lgwHidden = css.includes('#legacy-gesture-warning') &&
        (css.match(/#legacy-gesture-warning\s*\{[\s\S]{0,200}display\s*:\s*none/) ||
         css.match(/#legacy-gesture-warning\s*\{[\s\S]{0,300}pointer-events\s*:\s*none/));
    const ahHidden  = css.includes('#addon-hint') &&
        (css.match(/#addon-hint\s*\{[\s\S]{0,200}display\s*:\s*none/) ||
         css.match(/#addon-hint\s*\{[\s\S]{0,300}pointer-events\s*:\s*none/));
    assert(lgwHidden, '#legacy-gesture-warning should be hidden by default');
    assert(ahHidden,  '#addon-hint should be hidden by default');
});
test('CSS: lgw-visible enables pointer-events:auto', () => {
    const match = css.match(/\.lgw-visible\s*\{[\s\S]{0,100}pointer-events\s*:\s*auto/);
    assert(match, '.lgw-visible should set pointer-events:auto');
});
test('CSS: addon-hint-visible enables pointer-events:auto', () => {
    const match = css.match(/\.addon-hint-visible\s*\{[\s\S]{0,100}pointer-events\s*:\s*auto/);
    assert(match, '.addon-hint-visible should set pointer-events:auto');
});

// ── 6. CSS — theming ──
console.log('\n── 6. CSS theming ──');

test('CSS: addon-hint uses template CSS variables (not hardcoded colors)', () => {
    const block = css.match(/#addon-hint\s*\{([\s\S]{0,400})\}/);
    assert(block, '#addon-hint block not found');
    assert(block[0].includes('var(--surface)') || block[0].includes('var(--text'), 'Should use CSS vars for theming');
});
test('CSS: nightMode overrides for addon-hint accent color exist', () => {
    const match = css.match(/\.nightMode.*addon-hint|addon-hint.*\.nightMode/);
    assert(match || css.includes('nightMode') && css.includes('#addon-hint strong'), 'Should have nightMode override for blue accent');
});
test('CSS: lgw uses template CSS variables', () => {
    const block = css.match(/#legacy-gesture-warning\s*\{([\s\S]{0,400})\}/);
    assert(block, '#legacy-gesture-warning block not found');
    assert(block[0].includes('var(--'), 'Should use CSS vars for theming');
});

// ── 7. Installation instructions ──
console.log('\n── 7. Installation path ──');

test('C1: installation path mentions Extras', () => {
    assert(c1f.includes('Extras'), 'Installation path should mention Extras menu');
});
test('C1: installation path mentions Erweiterungen', () => {
    assert(c1f.includes('Erweiterungen'), 'Installation path should mention Erweiterungen');
});
test('C2: installation path mentions Extras', () => {
    assert(c2f.includes('Extras'), 'Installation path should mention Extras menu');
});

// ── Summary ──
console.log('\n' + '═'.repeat(50));
console.log(`  Results: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log('═'.repeat(50));
if (failed > 0) process.exit(1);
