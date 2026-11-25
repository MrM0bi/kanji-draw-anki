#!/usr/bin/env python3
"""Pen eraser and Ctrl+Z stroke undo (Templates/src/front/kd-fork-erase.js) on Anki-rendered Card 1 fronts.

Usage: uv run --with playwright python -I Tests/browser/check_fork_erase.py <render dir from render_backend.py>

The eraser is simulated with synthetic PointerEvents (pointerType "pen", button 5, buttons 32), which is what
Chromium reports for a Windows Ink eraser. Whether Qt WebEngine passes the eraser on like this can only be
checked on a real tablet.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument('testdir', type=Path)
a = p.parse_args()
rendered = a.testdir.resolve() / 'rendered'
FRONT = (rendered / '五_c1_front.html').as_uri()
BACK = rendered / '五_c1_back.html'

# Synthetic eraser input in 109-unit box coordinates
ERASE = '''([pts, id]) => {
    const el = document.getElementById('draw-layer'), r = el.getBoundingClientRect();
    const at = (pt) => ({ clientX: r.left + pt[0] / 109 * r.width, clientY: r.top + pt[1] / 109 * r.height });
    const ev = (type, pt, button, buttons) => el.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true,
        cancelable: true, composed: true, pointerId: id, pointerType: 'pen', isPrimary: true, button, buttons,
        pressure: buttons ? 0.5 : 0 }, at(pt))));
    ev('pointerdown', pts[0], 5, 32);
    for (const pt of pts.slice(1)) ev('pointermove', pt, -1, 32);
    ev('pointerup', pts[pts.length - 1], 5, 0);
}'''
STATE = '''() => ({ saved: JSON.parse(localStorage.getItem('kanjiFreeStrokes') || '[]').map(s => s.d),
    paths: document.querySelectorAll('#draw-layer path').length,
    current: Number(localStorage.getItem('kanjiCurrentStroke') || 0),
    penalties: JSON.parse(localStorage.getItem('kanjiErrors') || '[]'),
    undo: typeof window._kdUndoStroke })'''
REUSE = '''html => { const body = new DOMParser().parseFromString(html, 'text/html').querySelector('#qa').innerHTML;
    const qa = document.querySelector('#qa'); qa.innerHTML = body;
    [...qa.querySelectorAll('script')].forEach(old => { const fresh = document.createElement('script');
        for (const at of old.attributes) fresh.setAttribute(at.name, at.value); fresh.textContent = old.textContent;
        old.replaceWith(fresh); }); }'''


def line(page, y):
    """Draw a horizontal mouse stroke across the box at height y (box units)."""
    r = page.locator('#draw-layer').bounding_box()
    py = r['y'] + y / 109 * r['height']
    page.mouse.move(r['x'] + 0.2 * r['width'], py)
    page.mouse.down()
    for i in range(1, 21):
        page.mouse.move(r['x'] + (0.2 + 0.6 * i / 20) * r['width'], py)
    page.mouse.up()
    page.wait_for_timeout(30)


def state(page):
    page.wait_for_timeout(400)  # erased/undone paths fade out before they leave the DOM
    return page.evaluate(STATE)


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
    results = []
    for width, design in ((1100, 'minimal'), (390, 'kd')):
        for mode in ('free', 'guided'):
            c = b.new_context(viewport={'width': width, 'height': 900})
            settings = {'kanjiSoundLevel': 'off', 'kanjiThemeDesign': design}
            if mode == 'guided':
                settings['c1_kanjiOptDrawMode'] = 'guided'
            c.add_init_script('for(const[k,v]of Object.entries(' + json.dumps(settings) + '))localStorage.setItem(k,v)')
            page = c.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(FRONT)
            page.wait_for_timeout(150)
            tag = f'{width}px {mode}'
            if mode == 'free':
                for y in (30, 55, 80):
                    line(page, y)
                s = state(page)
                assert len(s['saved']) == 3 and s['paths'] == 3, (tag, s)
                top, mid, bottom = s['saved']
                # Eraser through the middle stroke only; the eraser itself must not draw
                page.evaluate(ERASE, [[[54, 50], [54, 53], [54, 60]], 7])
                s = state(page)
                assert s['saved'] == [top, bottom] and s['paths'] == 2, (tag, 'erase middle', s)
                # Eraser tap away from any stroke: nothing happens
                page.evaluate(ERASE, [[[54, 100]], 7])
                s = state(page)
                assert s['saved'] == [top, bottom], (tag, 'tap', s)
                # One fast move across both strokes erases them (segment crossing)
                page.evaluate(ERASE, [[[50, 5], [50, 105]], 7])
                s = state(page)
                assert s['saved'] == [] and s['paths'] == 0, (tag, 'fast sweep', s)
                assert page.locator('#button-undo').is_disabled(), tag
                # Ctrl+Z (key reaching the page) undoes one stroke, then nothing
                for y in (30, 55):
                    line(page, y)
                first = state(page)['saved'][0]
                page.keyboard.press('Control+z')
                s = state(page)
                assert s['saved'] == [first], (tag, 'ctrl+z', s)
                # The add-on's call and the key event for the same press count once
                line(page, 80)
                assert page.evaluate('() => [window._kdUndoStroke(), window._kdUndoStroke()]') == [True, True]
                s = state(page)
                assert s['saved'] == [first], (tag, 'double call', s)
                page.wait_for_timeout(200)
                assert page.evaluate('() => window._kdUndoStroke()') is True
                assert page.evaluate('() => window._kdUndoStroke()') is False, tag
                # Card change in the same page (Anki Desktop): the old listeners are gone, the new card's work
                line(page, 40)
                page.evaluate(REUSE, (rendered / '五_c1_front.html').read_text())
                page.wait_for_timeout(150)
                for y in (30, 55):
                    line(page, y)
                page.evaluate(ERASE, [[[54, 50], [54, 60]], 9])
                page.keyboard.press('Control+z')
                s = state(page)
                assert s['saved'] == [] and s['paths'] == 0, (tag, 'after reuse', s)
                # Flip to the back in the same page: no stroke undo there, so the add-on falls back to Anki
                line(page, 30)
                page.evaluate(REUSE, BACK.read_text())
                page.wait_for_timeout(150)
                assert page.evaluate('() => !!(window._kdUndoStroke && window._kdUndoStroke())') is False, tag
            else:
                page.evaluate(ERASE, [[[20, 30], [50, 30], [90, 30]], 7])
                s = state(page)
                assert s['current'] == 0 and not any(s['penalties']) and s['paths'] == 0, (tag, 'guided eraser', s)
                assert page.evaluate('() => window._kdUndoStroke()') is False, tag
                page.keyboard.press('Control+z')
            assert not errors, (tag, errors)
            results.append(tag)
            print(tag, 'ok', flush=True)
            c.close()
    b.close()
print('all passed:', ', '.join(results))
