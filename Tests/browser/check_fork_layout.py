#!/usr/bin/env python3
"""Section layout on the back (src/back/kd-fork-layout.js): order, hiding, columns, edit mode, persistence.

Renders the repo templates itself with sample fields (no Anki, no fixtures), like Anki: body.card > #qa.
Usage: python3 check_fork_layout.py <outdir>   (screenshots and rendered pages go there)
Needs Playwright (Python) and /usr/bin/google-chrome.
"""
from pathlib import Path
import argparse
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
TPL = ROOT / 'Templates'
parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
parser.add_argument('outdir', type=Path)
args = parser.parse_args()
OUT = args.outdir.resolve()
OUT.mkdir(parents=True, exist_ok=True)

PATHS = ''.join(f'<path d="{d}"/>' for d in [
    'M24,22 C40,21 70,20 86,20', 'M50,22 C48,40 45,60 42,80', 'M30,52 C45,51 60,50 74,50 C73,62 72,74 70,86', 'M14,88 C40,87 70,86 96,86'])
FULL = {
    'Kanji': '五', 'Bedeutung-DE': 'fünf', 'PrimitivBedeutung-DE': 'Fünfer', 'SVGPfade': PATHS,
    'Radikale': '五[fünf]@1-4{一[eins]@1, 口[Mund]@2-3, 一[Boden]@4}',
    'Merksatz-DE': 'Fünf Finger hat die Hand.', 'BuchBeschreibung': 'Fünf zwischen Decke und Boden.',
    'Wortbeispiel': '五[ご]つ - fünf Stück<br>五月[ごがつ] - Mai', 'Onyomi': 'ゴ', 'Kunyomi': 'いつ.つ',
    'Notiz': 'Meine Notiz.', 'Kanjinummer-BuchDE-Edition-4': '5', 'JLPT-Level': 'N5',
    'Stolperfallen': 'order@2-3[Reihenfolge]: Erst senkrecht, dann waagrecht',
}
SPARSE = dict(FULL, Notiz='', Stolperfallen='', Wortbeispiel='')
CSS = (TPL / 'Styling.css').read_text(encoding='utf-8')


def render(src, fields, front_side=''):
    def sect(m):
        has = bool(fields.get(m.group(2), '').strip())
        return m.group(3) if has != (m.group(1) == '^') else ''
    for _ in range(4):
        src = re.sub(r'\{\{([#^])([^}]+)\}\}(.*?)\{\{/\2\}\}', sect, src, flags=re.S)
    return re.sub(r'\{\{([^}#/^]+)\}\}', lambda m: front_side if m.group(1).strip() == 'FrontSide' else fields.get(m.group(1).split(':')[-1].strip(), ''), src)


def page(name, card, fields, back=True):
    front = render((TPL / f'Card-{card}/FrontTemplate.html').read_text(encoding='utf-8'), fields)
    body = render((TPL / f'Card-{card}/BackTemplate.html').read_text(encoding='utf-8'), fields, front) if back else front
    f = OUT / f'{name}.html'
    f.write_text(f'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                 f'<style>{CSS}</style></head><body class="card"><div id="qa">{body}</div></body></html>', encoding='utf-8')
    return f.as_uri()


ORDER = "() => [...document.querySelectorAll('#kd-info-inline .kd-col .kd-section')].filter(s => s.getClientRects().length).map(s => s.dataset.sec)"
DEFAULT = ['elemente', 'eselsbruecken', 'notiz', 'schreibfehler', 'strichfolge', 'lesungen', 'wortbeispiele', 'links']  # KD_SECTIONS order


def context(browser, width, height=860):
    ctx = browser.new_context(viewport={'width': width, 'height': height})
    ctx.add_init_script("localStorage.setItem('kanjiSoundLevel','off');")
    p = ctx.new_page()
    p._errors = []
    p.on('pageerror', lambda e: p._errors.append(str(e)))
    return ctx, p


def drag(p, grip_sel, x, y):
    g = p.locator(grip_sel).bounding_box()
    sx, sy = g['x'] + g['width'] / 2, g['y'] + g['height'] / 2
    p.mouse.move(sx, sy)
    p.mouse.down()
    for i in range(1, 16):
        p.mouse.move(sx + (x - sx) * i / 15, sy + (y - sy) * i / 15)
        p.wait_for_timeout(20)
    p.mouse.up()
    p.wait_for_timeout(150)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])

    # --- One column: order, arrows, hiding, drag, persistence, reset (both cards) ---
    for card in (1, 2):
        url = page(f'c{card}_back', card, FULL)
        ctx, p = context(browser, 400)
        p.goto(url)
        p.wait_for_timeout(500)
        assert p.evaluate(ORDER) == DEFAULT, p.evaluate(ORDER)
        assert p.evaluate('_kdLayout.edit(true)')
        p.wait_for_timeout(900)  # the edit mode scrolls the sections into view
        p.click('[data-sec=lesungen] .kd-edit-up')
        p.click('[data-sec=lesungen] .kd-edit-up')
        p.click('[data-sec=links] .kd-edit-eye')
        order = p.evaluate(ORDER)
        assert order[3] == 'lesungen' and 'links' not in order, order
        p.evaluate("document.querySelector('.kd-cols').scrollIntoView()")
        t = p.locator('[data-sec=elemente] .kd-section-header').bounding_box()
        drag(p, '[data-sec=eselsbruecken] .kd-edit-grip', t['x'] + 40, t['y'] + 4)
        assert p.evaluate(ORDER)[0] == 'eselsbruecken', p.evaluate(ORDER)
        p.screenshot(path=str(OUT / f'c{card}-edit-1col.png'))
        p.click('.kd-edit-done')
        assert not p.evaluate('_kdLayout.editing()')
        saved = p.evaluate("_kdLayout.get('kdLayout1', '')")
        assert saved.split(',')[:3] == ['eselsbruecken', 'elemente', 'notiz'], saved
        assert p.evaluate("_kdLayout.get('kdSecHidden', '')") == 'links'
        p.reload()
        p.wait_for_timeout(500)
        assert p.evaluate(ORDER) == [k for k in saved.split(',') if k != 'links'], p.evaluate(ORDER)
        p.evaluate("openSettings(); navigateToPage('page-sections'); kdSectionsPageSync()")
        p.wait_for_timeout(300)
        assert p.evaluate("!document.getElementById('kd-layout-edit').disabled")
        p.evaluate('kdLayoutResetAll(); kdLayoutResetAll()')
        assert p.evaluate(ORDER) == DEFAULT, p.evaluate(ORDER)
        p.goto(page(f'c{card}_front', card, FULL, back=False))
        p.wait_for_timeout(400)
        p.evaluate("openSettings(); navigateToPage('page-sections'); kdSectionsPageSync()")
        assert p.evaluate("document.getElementById('kd-layout-edit').disabled"), 'edit only on the back'
        assert not p._errors, p._errors
        ctx.close()

    # --- Sections without content appear only in the edit mode ---
    ctx, p = context(browser, 400)
    p.goto(page('c1_back_sparse', 1, SPARSE))
    p.wait_for_timeout(500)
    assert not {'notiz', 'schreibfehler', 'wortbeispiele'} & set(p.evaluate(ORDER)), p.evaluate(ORDER)
    p.evaluate('_kdLayout.edit(true)')
    assert {'notiz', 'schreibfehler', 'wortbeispiele'} <= set(p.evaluate(ORDER)), p.evaluate(ORDER)
    assert not p._errors, p._errors
    ctx.close()

    # --- Columns: default arrangement, separate open state, drag between columns, per-count arrangements ---
    COLS = "() => Object.fromEntries([...document.querySelectorAll('.kd-col')].map(c => [c.dataset.slot, [...c.querySelectorAll('.kd-section')].filter(s => s.getClientRects().length).map(s => s.dataset.sec)]))"
    url = page('c1_back_wide', 1, FULL)
    ctx, p = context(browser, 2000, 1100)
    p.goto(url)
    p.wait_for_timeout(500)
    assert p.evaluate('_kdLayout.count()') == 3
    cols = p.evaluate(COLS)
    assert cols == {'L1': ['schreibfehler', 'strichfolge'], 'C': ['elemente', 'lesungen', 'links'], 'R1': ['eselsbruecken', 'notiz', 'wortbeispiele']}, cols
    assert p.evaluate("document.querySelector('[data-sec=strichfolge]').classList.contains('collapsed')"), 'Strichfolge closed by default'
    assert not p.evaluate("document.querySelector('[data-sec=schreibfehler]').classList.contains('collapsed')"), 'Schreibfehler open by default'
    p.screenshot(path=str(OUT / 'wide-3.png'))
    p.evaluate('_kdLayout.edit(true)')
    p.wait_for_timeout(900)
    t = p.locator('[data-sec=schreibfehler] .kd-section-header').bounding_box()
    drag(p, '[data-sec=notiz] .kd-edit-grip', t['x'] + 60, t['y'] + 4)
    p.click('[data-sec=eselsbruecken] .kd-edit-left')
    cols = p.evaluate(COLS)
    assert cols['L1'][:2] == ['notiz', 'schreibfehler'] and 'eselsbruecken' in cols['C'], cols
    p.screenshot(path=str(OUT / 'wide-3-edit.png'))
    p.click('.kd-edit-done')
    assert p.evaluate("_kdLayout.get('kdLayout3', '')").startswith('L1:notiz,schreibfehler')
    assert p.evaluate("_kdLayout.get('kdLayout5', '')") in ('', None)
    # one column via the setting: the 1-column order and open state
    p.evaluate("_kdLayout.setOption('kdLayoutCols', '1')")
    assert p.evaluate('_kdLayout.count()') == 1 and p.evaluate(ORDER) == DEFAULT
    assert p.evaluate("document.querySelector('[data-sec=strichfolge]').classList.contains('collapsed')"), 'own open state for 1 column'
    p.evaluate("_kdLayout.setOption('kdLayoutCols', 'auto')")
    assert p.evaluate(COLS)['L1'][0] == 'notiz'
    # wider window: 5 columns use their own (default) arrangement; empty outer pairs are dropped
    p.set_viewport_size({'width': 3000, 'height': 1300})
    p.wait_for_timeout(500)
    assert p.evaluate('_kdLayout.count()') == 5
    cols = p.evaluate(COLS)
    assert cols['L2'] == ['strichfolge'] and cols['R2'] == ['lesungen', 'wortbeispiele'], cols
    p.evaluate("_kdLayout.edit(true)")
    for k in ('strichfolge', 'lesungen', 'wortbeispiele'):
        p.click(f'[data-sec={k}] .kd-edit-eye')
    p.click('.kd-edit-done')
    assert sorted(p.evaluate(COLS)) == ['C', 'L1', 'R1'], p.evaluate(COLS)
    p.set_viewport_size({'width': 2000, 'height': 1100})
    p.wait_for_timeout(500)
    cols = p.evaluate(COLS)
    assert cols['L1'] == ['notiz', 'schreibfehler'], ('kdLayout3 kept, Strichfolge hidden everywhere', cols)
    # side columns beside the drawings; sticky columns while the page scrolls
    p.evaluate("_kdLayout.setOption('kdLayoutSide', 'top'); window.scrollTo(0, 0)")
    p.wait_for_timeout(300)
    tops = p.evaluate("[...document.querySelectorAll('.kd-col')].map(c => [c.dataset.slot, Math.round(c.getBoundingClientRect().top)])")
    centre = dict(tops)['C']
    assert all(t < centre - 100 for s, t in tops if s != 'C'), tops
    box = p.evaluate("Math.round(document.querySelector('.side-by-side-box').getBoundingClientRect().top)")
    assert all(abs(t - box) <= 1 for s, t in tops if s != 'C'), ('side columns start level with the drawing box', box, tops)
    p.screenshot(path=str(OUT / 'wide-3-top.png'))
    p.evaluate("document.querySelector('[data-sec=eselsbruecken] .kd-section-body').style.minHeight = '1800px'")
    p.wait_for_timeout(300)
    p.mouse.wheel(0, 900)
    p.wait_for_timeout(400)
    r1 = p.evaluate("document.querySelector('.kd-col[data-slot=R1]').getBoundingClientRect().top")
    c = p.evaluate("document.querySelector('.kd-col[data-slot=C]').getBoundingClientRect().top")
    assert 0 <= r1 <= 14 and c < -100, (r1, c)
    p.screenshot(path=str(OUT / 'wide-3-sticky.png'))
    # even count: symmetric, the middle pair stays below the head, the outer pair starts beside it
    p.evaluate("document.querySelector('[data-sec=eselsbruecken] .kd-section-body').style.minHeight = ''")
    p.set_viewport_size({'width': 3000, 'height': 1300})
    p.evaluate("_kdLayout.resetAll(); _kdLayout.setOption('kdLayoutCols', '4'); window.scrollTo(0, 0)")
    p.wait_for_timeout(500)
    assert p.evaluate('_kdLayout.count()') == 4
    tops = dict(p.evaluate("[...document.querySelectorAll('.kd-col')].map(c => [c.dataset.slot, Math.round(c.getBoundingClientRect().top)])"))
    assert sorted(tops) == ['L1', 'L2', 'R1', 'R2'], tops
    assert tops['L1'] == tops['R1'] and tops['L2'] == tops['R2'] < tops['L1'] - 100, tops
    mid = p.evaluate("(() => { const a = document.querySelector('.kd-col[data-slot=L1]').getBoundingClientRect(), b = document.querySelector('.kd-col[data-slot=R1]').getBoundingClientRect(); return (a.right + b.left) / 2 - innerWidth / 2; })()")
    assert abs(mid) <= 2, ('gap between L1 and R1 is centred', mid)
    p.screenshot(path=str(OUT / 'wide-4-top.png'))
    assert not p._errors, p._errors
    ctx.close()

    # --- Values under the old kd… names move to names the Desktop add-on keeps (kanji[A-Za-z], <= 64 chars) ---
    ctx, p = context(browser, 2000, 1100)
    ctx.add_init_script("""if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
        localStorage.setItem('kdLayout3', 'L1:notiz,strichfolge|C:elemente|R1:lesungen');
        localStorage.setItem('kdLayout6', 'L3:links|R3:notiz');
        localStorage.setItem('kdSecHidden', 'links');
        localStorage.setItem('kdSecW_lesungen', '1'); }""")
    p.goto(url)
    p.wait_for_timeout(500)
    cols = p.evaluate(COLS)
    assert cols['L1'][-2:] == ['notiz', 'strichfolge'] and 'links' not in sum(cols.values(), []), cols  # Schreibfehler filled in from the defaults
    stored = p.evaluate("Object.fromEntries(['kanjiKdLayoutThree', 'kanjiKdLayoutSix', 'kanjiKdSecHidden', 'kanjiKdSecWLesungen', 'kdLayout3', 'kdLayout6', 'kdSecHidden', 'kdSecW_lesungen'].map(k => [k, safeGetItem(k, '')]))")
    assert stored['kanjiKdLayoutThree'].startswith('L1:n,s|C:e') and stored['kanjiKdLayoutSix'] == 'L3:x|R3:n', stored
    assert stored['kanjiKdSecHidden'] == 'x' and stored['kanjiKdSecWLesungen'] == '1', stored
    assert not any(stored[k] for k in ('kdLayout3', 'kdLayout6', 'kdSecHidden', 'kdSecW_lesungen')), stored
    assert p.evaluate("document.querySelector('[data-sec=lesungen]').classList.contains('collapsed')")
    p.reload()
    p.wait_for_timeout(500)
    assert p.evaluate(COLS)['L1'][-2:] == ['notiz', 'strichfolge'], 'migrated values survive a reload'
    assert not p._errors, p._errors
    ctx.close()
    browser.close()
print('check_fork_layout: OK')
