#!/usr/bin/env python3
"""Runtime regression checks for the fork; supply an isolated, backend-rendered test directory."""
from pathlib import Path
import argparse
import json
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description='Check back options on Anki-rendered kanji and primitive cards.');parser.add_argument('testdir',type=Path);args=parser.parse_args()
root=args.testdir.resolve()
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--allow-file-access-from-files'])
 for card in (1,2):
  ctx=browser.new_context(viewport={'width':1100,'height':1000})
  ctx.add_init_script("localStorage.setItem('kanjiThemeDesign','minimal');localStorage.setItem('kanjiThemeMode','light');localStorage.setItem('kanjiThemeAccent','blue');localStorage.setItem('kanjiSoundLevel','off');")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.goto((root/'rendered'/f'probe_c{card}.html').as_uri());page.wait_for_timeout(500)
  result=page.evaluate('''() => {
    const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
    const visible=el=>el&&getComputedStyle(el).display!=='none';
    const secs=[...document.querySelectorAll('.kd-section')].map(s=>s.dataset.sec);
    assert(secs.indexOf('eselsbruecken')<secs.indexOf('strichfolge'),'section order');
    assert(document.querySelector('.pt-root title').textContent==='Vier (Testlabel)','root keyword override');
    const n=document.querySelector('.kd-nanori-row'),g=document.querySelector('.kd-story-group-kd');
    assert(n&&g,'probe content exists');
    assert(!visible(n)&&!visible(g),'requested default content hidden');
    const setting=(name,val)=>{
      const chip=name==='opt-kanji-draw'?document.querySelector('button[data-source=kanjiDraw]'):null;
      if(chip){if((chip.getAttribute('aria-pressed')==='true')!==(val==='on'))chip.click();}
      else document.querySelector('input[name="'+name+'"][value="'+val+'"]').click();
    };
    setting('opt-nanori','on');setting('opt-kanji-draw','on');
    assert(visible(n)&&visible(g),'live on from default off');
    setting('opt-nanori','off');setting('opt-kanji-draw','off');
    assert(!visible(n)&&!visible(g),'live off');
    assert(safeGetItem(_hostCard+'_kanjiOptNanori')==='off','scoped persistence');
    setting('opt-nanori','on');setting('opt-kanji-draw','on');
    assert(visible(n)&&visible(g),'live on');
    const other=_hostCard==='c1'?'c2':'c1';switchSettingsTab(other);setting('opt-nanori','off');
    assert(visible(n),'other card setting must not affect host');switchSettingsTab(_hostCard);
    const surface=getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
    const blue=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    updateThemeSetting('accent','red');
    assert(getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()===surface,'accent changed neutral surface');
    assert(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()!==blue,'accent not applied');
    assert(surface==='#ffffff','Minimal neutral light palette');
    return {card:_hostCard,sections:secs,surface,blue,red:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()};
  }''')
  # Saved options must also apply after a card reload, before opening settings.
  page.evaluate("updateFeatureSetting('nanori','off');updateFeatureSetting('kanjiDraw','off')")
  page.reload();page.wait_for_timeout(400)
  assert page.locator('.kd-nanori-row').evaluate("e=>getComputedStyle(e).display==='none'")
  assert page.locator('.kd-story-group-kd').evaluate("e=>getComputedStyle(e).display==='none'")
  page.evaluate("updateFeatureSetting('nanori','on');updateFeatureSetting('kanjiDraw','on')")
  # Nanori-only readings hide the whole section and restore it on demand.
  page.evaluate("document.querySelectorAll('.reading-row:not(.kd-nanori-row)').forEach(e=>e.remove());updateFeatureSetting('nanori','off')")
  assert page.locator('[data-sec=lesungen]').evaluate('e=>e.hidden')
  page.evaluate("updateFeatureSetting('nanori','on')")
  assert page.locator('[data-sec=lesungen]').evaluate('e=>!e.hidden')
  page.evaluate("openSettings();navigateToPage('page-theme');")
  page.wait_for_timeout(400);page.screenshot(path=str(root/f'appearance-c{card}-light.png'),full_page=True)
  page.evaluate("updateThemeSetting('mode','dark')");page.wait_for_timeout(150)
  page.screenshot(path=str(root/f'appearance-c{card}-dark.png'),full_page=True)
  assert not errors,errors
  results.append(result);ctx.close()
 # Free-handwriting fixtures generated from the actual reference paths in a rendered card.
 ctx=browser.new_context(viewport={'width':1100,'height':1000});page=ctx.new_page()
 page.goto((root/'rendered'/'四_c1_back.html').as_uri());page.wait_for_timeout(200)
 strokes=page.evaluate('''() => [...document.querySelectorAll('#svg-bg > path[d]:not(.gel-halo)')].map(p=>{
   const len=p.getTotalLength();return {d:p.getAttribute('d'),points:Array.from({length:65},(_,i)=>{
    const pt=p.getPointAtLength(len*i/64);return {x:pt.x,y:pt.y};})};})''')
 ctx.close()
 for width in (320,1100):
  for style in ('standard','gel','ink','neon'):
   ctx=browser.new_context(viewport={'width':width,'height':1000})
   ctx.add_init_script('''localStorage.clear();sessionStorage.clear();for(const [k,v] of Object.entries('''+json.dumps({'c1_kanjiOptDrawMode':'free','c1_kanjiOptSideBySide':'on','kanjiThemeStrokeStyle':style,'kanjiThemeDesign':'minimal','kanjiThemeMode':'light','kanjiSoundLevel':'off'})+'''))localStorage.setItem(k,v);sessionStorage.setItem('kanjiFreeStrokes','''+json.dumps(json.dumps(strokes))+''');''')
   page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   page.goto((root/'rendered'/'四_c1_back.html').as_uri());page.wait_for_timeout(400)
   count=page.locator('.side-by-side-wrapper .sbs-kanji').count()
   assert count==2,(width,style,count,errors)
   assert page.locator('.sbs-kanji').first.locator('svg:not(.sbs-grid) path[d]').count()>=len(strokes)
   assert page.locator('.sbs-kanji').nth(1).locator('svg:not(.sbs-grid) path[d]').count()>=len(strokes)
   page.evaluate("updateFeatureSetting('sideBySide','off')");page.wait_for_timeout(100)
   # updateFeatureSetting changes display via close-settings upstream, so exercise that real handler now.
   page.evaluate('kanjiSettingsGlobalHandler()');page.wait_for_timeout(100)
   assert page.locator('.side-by-side-wrapper').count()==0
   page.evaluate("updateFeatureSetting('sideBySide','on');kanjiSettingsGlobalHandler()")
   page.wait_for_timeout(100)
   assert page.locator('.side-by-side-wrapper').count()==1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert not errors,errors
   if style=='standard':page.screenshot(path=str(root/f'comparison-{width}.png'),full_page=True)
   results.append({'free_comparison':True,'style':style,'width':width,'strokes':len(strokes)})
   ctx.close()
 for case,drawn in [('missing',strokes[:-1]),('extra',strokes+[strokes[0]])]:
  ctx=browser.new_context(viewport={'width':320,'height':900})
  ctx.add_init_script("localStorage.setItem('kanjiSoundLevel','off');localStorage.setItem('c1_kanjiOptDrawMode','free');localStorage.setItem('c1_kanjiOptSideBySide','on');sessionStorage.setItem('kanjiFreeStrokes',"+json.dumps(json.dumps(drawn))+");")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.goto((root/'rendered'/'四_c1_back.html').as_uri());page.wait_for_timeout(450)
  assert page.locator('.side-by-side-wrapper .sbs-kanji').count()==2,(case,errors)
  assert page.locator('.sbs-badge-row').count()==1,(case,'missing badge row')
  assert page.locator('.sbs-badge-row .'+('missing-strokes-badge' if case=='missing' else 'excess-strokes-badge')).count()==1
  page.locator('.sbs-badge-row > div').first.click()
  assert not errors,(case,errors)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  results.append({'comparison_badge':case,'width':320});ctx.close()
 browser.close()
(root/'feedback_checks.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
print('Passed',len(results),'interactive feedback checks')
