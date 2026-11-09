#!/usr/bin/env python3
"""Stroke-source integrity and real front-to-back input, on isolated Anki-rendered fixtures."""
import argparse,json,re,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('testdir',type=Path);p.add_argument('--note',choices=['五','召','吾','語']);p.add_argument('--input',action='store_true');a=p.parse_args()
root=a.testdir.resolve();rd=root/'stroke_rendered';rd.mkdir(exist_ok=True)
expected={'五':[4,4],'召':[5,2,3],'吾':[7,4,3],'語':[14,7,7,4,3]}
for k in expected:
 for card in (1,2):
  for side in ('front','back'):
   source=root/'rendered'/f'{k}_c{card}_{side}.html';html='<!doctype html>'+source.read_text().replace('<meta charset="utf-8">','<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',1)
   for variant in ('plain','breaks','paragraphs','selfclosing'):
    def raw(m):
     data=m[2]
     if variant=='breaks':data=data.replace('\n','<br>')
     if variant=='paragraphs':data=''.join('<div>'+line+'</div>' for line in data.splitlines())
     if variant=='selfclosing':data=data.replace('></path>','/>')
     return m[1]+data+m[3]
    altered=re.sub(r'(<template id="kd-stroke-source">)([\s\S]*?)(</template>)',raw,html,count=1)
    (rd/f'{k}_c{card}_{side}_{variant}.html').write_text(altered)
for font in (root/'rendered').glob('_kanji_font*'):shutil.copy2(font,rd/font.name)
checks=[];inputs=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--allow-file-access-from-files'])
 profiles={'android':dict(pw.devices['Pixel 7']),'desktop':{'viewport':{'width':1100,'height':1000}}}
 for platform,options in profiles.items():
  if a.note:
   c=b.new_context(**options);c.add_init_script('for(const[k,v]of Object.entries('+json.dumps({'kanjiSoundLevel':'off','kanjiThemeDesign':'kd' if platform=='android' else 'minimal','kanjiThemeMode':'dark','c1_kanjiOptDrawMode':'guided'})+'))localStorage.setItem(k,v)')
   for variant in ('plain','breaks','paragraphs','selfclosing'):
    for card in (1,2):
     name=f'{a.note}_c{card}_back_{variant}.html';page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((rd/name).as_uri());page.wait_for_timeout(100)
     data=page.evaluate('''() => ({reference:[...document.querySelectorAll('#svg-bg > path')].map(p=>({d:p.getAttribute('d'),ns:p.namespaceURI})),glyphs:[...document.querySelectorAll('.pt-glyph')].map(g=>g.querySelectorAll('path').length),root:document.querySelectorAll('.pt-root .pt-glyph path').length,source:[...document.querySelector('#kd-stroke-source').content.querySelectorAll('path[d]')].map(p=>p.getAttribute('d'))})''')
     assert len(data['reference'])==expected[a.note][0],(platform,name,data)
     assert data['root']==expected[a.note][0] and sorted(data['glyphs'])==sorted(expected[a.note]),(platform,name,data)
     assert [p['d'] for p in data['reference']]==data['source']
     assert all(p['ns']=='http://www.w3.org/2000/svg' for p in data['reference'])
     assert not errors,(platform,name,errors)
     if a.note=='五' and card==1 and variant in ('plain','breaks'):page.locator('[data-sec=elemente]').screenshot(path=str(root/f'five-{platform}-{variant}.png'))
     checks.append({'platform':platform,'note':a.note,'card':card,'variant':variant,'reference':len(data['reference']),'glyphs':data['glyphs']});page.close()
   c.close();print(platform,a.note,'all markup variants and both cards passed',flush=True)
  if a.input:
   for mode in ('default','default_reuse','guided'):
    c=b.new_context(**options);settings={'kanjiSoundLevel':'off','kanjiThemeDesign':'minimal' if platform=='desktop' else 'kd','kanjiThemeMode':'dark'}
    if mode=='guided':settings['c1_kanjiOptDrawMode']='guided'
    c.add_init_script('for(const[k,v]of Object.entries('+json.dumps(settings)+'))localStorage.setItem(k,v)')
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((rd/'五_c1_front_plain.html').as_uri());page.wait_for_timeout(120)
    refs=page.evaluate('''() => [...document.querySelectorAll('#svg-bg > path')].map(p=>{const len=p.getTotalLength();return Array.from({length:25},(_,i)=>{const pt=p.getPointAtLength(len*i/24);return{x:pt.x,y:pt.y}})})''')
    r=page.locator('#draw-layer').bounding_box();cdp=c.new_cdp_session(page) if platform=='android' else None
    for stroke in refs:
     points=[{'x':r['x']+pt['x']/109*r['width'],'y':r['y']+pt['y']/109*r['height']} for pt in stroke]
     if cdp:
      cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]})
      for pt in points[1:]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[pt]})
      cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     else:
      page.mouse.move(**points[0]);page.mouse.down()
      for pt in points[1:]:page.mouse.move(**pt)
      page.mouse.up()
     page.wait_for_timeout(750 if mode=='guided' else 20)
    drawn=page.evaluate("({free:JSON.parse(localStorage.getItem('kanjiFreeStrokes')||'[]').length,completed:Number(localStorage.getItem('kanjiCurrentStroke')||0),penalties:JSON.parse(localStorage.getItem('kanjiErrors')||'[]')})")
    if mode.startswith('default'):assert drawn['free']==4,(platform,mode,drawn)
    else:assert drawn['completed']==4 and not any(drawn['penalties']),(platform,mode,drawn)
    if mode=='default_reuse':
     page.evaluate('''html => {const body=new DOMParser().parseFromString(html,'text/html').querySelector('#qa').innerHTML;const qa=document.querySelector('#qa');qa.innerHTML=body;[...qa.querySelectorAll('script')].forEach(old=>{const fresh=document.createElement('script');for(const a of old.attributes)fresh.setAttribute(a.name,a.value);fresh.textContent=old.textContent;old.replaceWith(fresh)});}''',(rd/'五_c1_back_plain.html').read_text())
    else:page.goto((rd/'五_c1_back_plain.html').as_uri())
    page.wait_for_timeout(120)
    comparison=page.locator('.side-by-side-wrapper').count()
    if mode.startswith('default'):
     assert comparison==1,(platform,'default-free comparison absent',errors)
     assert page.locator('.sbs-kanji').count()==2
     assert page.locator('.sbs-kanji').nth(1).locator('svg:not(.sbs-grid) > path').count()==4
     page.evaluate("updateFeatureSetting('sideBySide','off');kanjiSettingsGlobalHandler()");page.wait_for_timeout(100);assert page.locator('.side-by-side-wrapper').count()==0
     page.evaluate("updateFeatureSetting('sideBySide','on');kanjiSettingsGlobalHandler()");page.wait_for_timeout(100);assert page.locator('.side-by-side-wrapper').count()==1
     page.locator('.side-by-side-wrapper').screenshot(path=str(root/f'comparison-{platform}.png'))
    else:assert comparison==0
    assert not errors,(platform,mode,errors);inputs.append({'platform':platform,'mode':mode,'drawn':drawn,'comparison':comparison,'real_input':True});c.close()
   # Empty previews honor the side-by-side switch without inventing drawn ink.
   for enabled in (True,False):
    c=b.new_context(**options);c.add_init_script('localStorage.setItem("kanjiSoundLevel","off");localStorage.setItem("c1_kanjiOptSideBySide",'+json.dumps('on' if enabled else 'off')+')')
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((rd/'五_c1_back_plain.html').as_uri());page.wait_for_timeout(100)
    assert page.locator('.side-by-side-wrapper').count()==int(enabled)
    if enabled:
     assert page.locator('.sbs-kanji').nth(1).locator('svg:not(.sbs-grid) > path').count()==4
     assert page.locator('.side-by-side-wrapper .stroke-ghost').count()==4
    assert not errors,(platform,'empty preview',enabled,errors);inputs.append({'platform':platform,'empty_preview':True,'comparison_enabled':enabled});c.close()
 b.close()
if a.note:(root/f'stroke_checks_{a.note}.json').write_text(json.dumps(checks,ensure_ascii=False,indent=1)+'\n')
if a.input:(root/'input_checks.json').write_text(json.dumps(inputs,ensure_ascii=False,indent=1)+'\n')
combined=[case for f in root.glob('stroke_checks_*.json') for case in json.loads(f.read_text())]
(root/'render_checks.json').write_text(json.dumps(combined,ensure_ascii=False,indent=1)+'\n')
print('Passed',len(checks),'stroke cases and',len(inputs),'input/preview cases this run; total',len(combined),'stroke variants')
