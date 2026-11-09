#!/usr/bin/env python3
"""Check real backend-rendered fixtures and a reused-document question/answer flip.

Input: a directory containing before/ and after/ subdirectories with pages.json
and <note>_c{1,2}_{front,back}.html. Deck fields and output stay outside this repo.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('fixtures', type=Path)
p.add_argument('--start', type=int, default=0)
p.add_argument('--end', type=int, default=16)
a = p.parse_args(); root = a.fixtures.resolve(); results = []; flips = []

read_state = '''() => [...document.querySelectorAll('.card-title,.primitive-box')].map(e => {
 const s=getComputedStyle(e);
 return {kind:e.className,visibility:s.visibility,opacity:Number(s.opacity),
         name:s.animationName,duration:parseFloat(s.animationDuration)*1000,delay:parseFloat(s.animationDelay)*1000};
})'''
flip = '''html => {
 const qa=document.getElementById('qa');qa.innerHTML=html;
 for(const old of qa.querySelectorAll('script')){
  if(old.type && old.type!=='text/javascript')continue;
  const script=document.createElement('script');
  for(const attr of old.attributes)script.setAttribute(attr.name,attr.value);
  script.textContent=old.textContent;old.replaceWith(script);
 }
}'''
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
    case = -1
    for width in (320, 1100):
        for design in ('kd', 'minimal'):
            for dark in (False, True):
                for reduced in (False, True):
                    case += 1
                    if not a.start <= case < a.end:
                        continue
                    variant_start, flip_start = len(results), len(flips)
                    options = dict(pw.devices['Pixel 7']) if width == 320 else {'viewport': {'width': width, 'height': 915}}
                    if width == 320: options['viewport'] = {'width': 320, 'height': 800}
                    context = browser.new_context(**options, color_scheme='dark' if dark else 'light',
                                                  reduced_motion='reduce' if reduced else 'no-preference')
                    settings = {'kanjiSoundLevel': 'off', 'kanjiThemeDesign': design,
                                'kanjiThemeMode': 'dark' if dark else 'light'}
                    context.add_init_script('for(const[k,v]of Object.entries(' + json.dumps(settings) + '))localStorage.setItem(k,v)')
                    names = json.loads((root / 'after/pages.json').read_text())
                    for name in names:
                        page = context.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
                        page.goto((root / 'after' / name).as_uri())
                        # Explicitly set the reviewer card class, which Anki normally supplies.
                        card = int(name.split('_c')[1][0]); back = '_back' in name
                        state = page.evaluate(read_state)
                        for item in state:
                            if card == 2 and not back:
                                assert item['visibility'] == 'hidden', (name, item)
                            else:
                                assert item['visibility'] == 'visible', (name, item)
                            if reduced:
                                assert item['name'] == 'none', (name, 'reduced motion', item)
                                assert item['opacity'] == 1
                            elif back and card == 2:
                                assert item['duration'] == 150 and item['delay'] == 0, (name, item)
                            elif not back and item['name'] != 'none':
                                assert item['duration'] == 180 and item['delay'] == 0, (name, item)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), name
                        assert not errors, (name, errors)
                        results.append({'page': name, 'width': width, 'design': design, 'dark': dark,
                                        'reduced': reduced, 'state': state})
                        page.close()
                    # Actual DOM replacement with FrontSide scripts rerunning, not just standalone backs.
                    for stem in ('一', '混', 'spazierstock', 'marsch'):
                        for card in (1, 2):
                            page = context.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
                            page.goto((root / 'after' / f'{stem}_c{card}_front.html').as_uri())
                            back_html = (root / 'after' / f'{stem}_c{card}_back.html').read_text()
                            body = back_html.split('<div id="qa">', 1)[1].rsplit('</div></body>', 1)[0]
                            page.evaluate(flip, body)
                            state = page.evaluate(read_state)
                            assert all(s['visibility'] == 'visible' for s in state)
                            if card == 2 and not reduced:
                                assert all(s['duration'] == 150 and s['delay'] == 0 for s in state), state
                            if reduced:
                                assert all(s['name'] == 'none' and s['opacity'] == 1 for s in state)
                            # Restart only for inspection: a backwards-fill pill may already have finished
                            # by this tool round trip, whereas the forwards-fill title remains enumerable.
                            # Pause at 10% speed and seek the real CSS effects, not a mocked keyframe.
                            frames = page.evaluate('''() => {
                              const elements=[...document.querySelectorAll('.card-title,.primitive-box')];
                              for(const e of elements)e.style.animation='none';
                              void document.body.offsetWidth;
                              for(const e of elements)e.style.removeProperty('animation');
                              const animations=elements.flatMap(e=>e.getAnimations().map(a=>({e,a})));
                              for(const {a} of animations){a.playbackRate=0.1;a.pause()}
                              return [0,0.5,1].map(f=>{for(const {a} of animations){a.pause();a.currentTime=a.effect.getTiming().duration*f}
                                return {fraction:f,opacity:elements.map(e=>Number(getComputedStyle(e).opacity))}});
                            }''')
                            if card == 2 and not reduced:
                                assert all(x < 0.01 for x in frames[0]['opacity']), frames
                                assert all(0 < x < 1 for x in frames[1]['opacity']), frames
                            assert all(x == 1 for x in frames[-1]['opacity'])
                            assert not errors, (stem, card, errors)
                            flips.append({'stem': stem, 'card': card, 'width': width, 'design': design,
                                          'dark': dark, 'reduced': reduced, 'state': state, 'frames': frames})
                            page.close()
                    context.close()
                    (root / f'reveal-part-{case:02d}.json').write_text(json.dumps({
                        'variants': results[variant_start:], 'flips': flips[flip_start:]}, ensure_ascii=False, indent=1) + '\n')
                    print(width, design, dark, reduced, 'passed', flush=True)
    # Baseline and current computed timings, with identical backend-rendered fields.
    timings = []
    for version in ('before', 'after'):
        context = browser.new_context(viewport={'width': 1100, 'height': 915})
        context.add_init_script('localStorage.setItem("kanjiSoundLevel","off")')
        for side in ('front', 'back'):
            page = context.new_page(); page.goto((root / version / f'一_c2_{side}.html').as_uri())
            timings.append({'version': version, 'side': side, 'state': page.evaluate(read_state)}); page.close()
        context.close()
    browser.close()
parts = [json.loads(p.read_text()) for p in sorted(root.glob('reveal-part-*.json'))]
results = [r for part in parts for r in part['variants']]
flips = [r for part in parts for r in part['flips']]
(root / 'reveal_checks.json').write_text(json.dumps({'variants': results, 'flips': flips, 'timings': timings}, ensure_ascii=False, indent=1) + '\n')
print('Passed', len(results), 'card variants and', len(flips), 'reused-document flips.')
