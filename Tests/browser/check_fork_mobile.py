#!/usr/bin/env python3
"""Check backend-rendered fixtures with full mobile contexts and a native-size viewport."""
import argparse
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('testdir',type=Path);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=14);a=p.parse_args()
root=a.testdir.resolve();rd=root/'mobile_rendered';rd.mkdir(exist_ok=True)
for src in (root/'rendered').glob('*.html'):
    text=src.read_text().replace('<meta charset="utf-8">','<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',1)
    (rd/src.name).write_text('<!doctype html>'+text)
for src in (root/'rendered').glob('_kanji_font*'):shutil.copy2(src,rd/src.name)
geometry='''() => {
 const assert=(ok,m)=>{if(!ok)throw Error(m)},rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
 const title=document.querySelector('.card-title'),row=document.querySelector('.kd-title-row'),boxes=[...document.querySelectorAll('.primitive-box')],gear=rect(document.querySelector('.gear-btn')),t=rect(title),pills=boxes.map(rect);
 assert(document.documentElement.scrollWidth<=innerWidth+1,'horizontal overflow');assert(!overlap(t,gear),'keyword/gear overlap');
 for(const [i,b] of pills.entries()){assert(b.x>=-1&&b.right<=innerWidth+1,'pill outside viewport');assert(!overlap(b,t)&&!overlap(b,gear),'pill overlaps keyword/gear');for(const other of pills.slice(i+1))assert(!overlap(b,other),'pills overlap')}
 const tag=document.querySelector('.primitive-label');if(tag){const r=rect(tag);assert(!overlap(r,t)&&!overlap(r,gear),'tag overlaps keyword/gear');const top=Math.min(...boxes.map(b=>b.offsetTop)),first=boxes.filter(b=>Math.abs(b.offsetTop-top)<2);assert(tag.parentNode===first[first.length-1],'tag on wrong row')}
 return {width:innerWidth,dpr:devicePixelRatio,mobileViewport:visualViewport.width,compatMode:document.compatMode,title:t,pills,share:pills.some(b=>Math.min(t.bottom,b.bottom)>Math.max(t.y,b.y)+1),primaryFont:parseFloat(getComputedStyle(title).fontSize),secondaryFont:boxes.length?parseFloat(getComputedStyle(boxes[0]).fontSize):null,visibility:boxes.map(b=>getComputedStyle(b).visibility)};
}'''
checks=[];extras=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--allow-file-access-from-files'])
    devices={n:dict(pw.devices[n]) for n in ('iPhone SE','iPhone 12 Pro','iPhone 14 Pro Max','Pixel 7','Galaxy S9+')}
    for width in (360,375):devices[f'Compact {width}px']={**pw.devices['Pixel 7'],'viewport':{'width':width,'height':800}}
    case=-1
    for name,device in devices.items():
        for design in ('kd','minimal'):
            case+=1
            if not a.start<=case<a.end:continue
            c=b.new_context(**device,color_scheme='dark');c.add_init_script('for(const[k,v]of Object.entries('+json.dumps({'kanjiSoundLevel':'off','kanjiThemeDesign':design,'kanjiThemeMode':'dark','kanjiThemePrimary':'hokkaido','kanjiThemeAccent':'blue'})+'))localStorage.setItem(k,v)')
            for card in (1,2):
                for side in ('front','back'):
                    filename=f'一_c{card}_{side}.html';page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((rd/filename).as_uri());page.evaluate("document.getAnimations().forEach(a=>{try{if(Number.isFinite(a.effect.getTiming().iterations))a.finish()}catch(e){}})");page.wait_for_timeout(80)
                    data=page.evaluate(geometry);assert data['compatMode']=='CSS1Compat';assert data['share'],(name,design,card,side,data);assert data['primaryFont']>data['secondaryFont'],(name,design,'text shrunk',data)
                    assert all(v==('hidden' if card==2 and side=='front' else 'visible') for v in data['visibility'])
                    checks.append({'device':name,'design':design,'page':filename,**data})
                    if card==1 and side=='front':
                        assert page.locator('.kanji-container').evaluate("e=>e.classList.contains('free-canvas-mode')")
                        slug=name.replace(' ','-').replace('+','plus');page.screenshot(path=str(root/f'{slug}-{design}.png'));page.screenshot(path=str(root/f'{slug}-{design}-header.png'),clip={'x':0,'y':0,'width':device['viewport']['width'],'height':210})
                        for font in ('small','large','normal'):
                            page.evaluate('f=>updateThemeSetting("fontSize",f)',font);page.wait_for_timeout(100);g=page.evaluate(geometry);assert g['share'],(name,design,font,g);assert g['primaryFont']>g['secondaryFont'];extras.append({'device':name,'design':design,'font':font,**g})
                        page.locator('#qa').evaluate("e=>e.style.width='calc(100% - 32px)'");page.wait_for_timeout(100);g=page.evaluate(geometry);assert g['share'],(name,design,'reviewer insets',g);extras.append({'device':name,'design':design,'reviewerInsets':32,**g});page.locator('#qa').evaluate("e=>e.style.width=''")
                        page.set_viewport_size({'width':device['viewport']['height'],'height':device['viewport']['width']});page.wait_for_timeout(100);g=page.evaluate(geometry);assert g['share'];extras.append({'device':name,'design':design,'landscape':True,**g})
                    assert not errors,(name,design,card,side,errors);page.close()
            c.close();print(name,design,'passed',flush=True)
    if a.end>=14:
        for design in ('kd','minimal'):
            for name in ('iPhone SE','Pixel 7'):
                c=b.new_context(**devices[name]);c.add_init_script('localStorage.setItem("kanjiSoundLevel","off");localStorage.setItem("kanjiThemeDesign",'+json.dumps(design)+')')
                for card in (1,2):
                    for side in ('front','back'):
                        filename=f'marsch_c{card}_{side}.html';page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((rd/filename).as_uri());page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert not errors;checks.append({'device':name,'design':design,'page':filename,'primitive':True});page.close()
                c.close()
        for design in ('kd','minimal'):
            c=b.new_context(**devices['iPhone SE']);c.add_init_script('localStorage.setItem("kanjiSoundLevel","off");localStorage.setItem("kanjiThemeDesign",'+json.dumps(design)+')')
            page=c.new_page();page.goto((rd/'一_c1_front.html').as_uri());page.evaluate("document.getAnimations().forEach(a=>{try{if(Number.isFinite(a.effect.getTiming().iterations))a.finish()}catch(e){}})");page.wait_for_timeout(80)
            page.evaluate('''() => document.querySelectorAll('.card-title,.primitive-box').forEach(e=>e.style.setProperty('font-size',parseFloat(getComputedStyle(e).fontSize)*2+'px','important'))''');page.wait_for_timeout(100);g=page.evaluate(geometry);extras.append({'design':design,'textScale':2,**g})
            page.evaluate('''() => {document.querySelector('.card-title').firstChild.textContent='Donaudampfschifffahrtsgesellschaft';document.querySelector('.primitive-box').firstChild.textContent='Ein außergewöhnlich langer Beispielbegriff'}''');page.wait_for_timeout(100);page.evaluate(geometry);extras.append({'design':design,'long_content':True});c.close()
    b.close()
(root/f'mobile-part-{a.start}-{a.end}.json').write_text(json.dumps({'checks':checks,'extras':extras},ensure_ascii=False,indent=1)+'\n')
parts=[json.loads(p.read_text()) for p in sorted(root.glob('mobile-part-*.json'))]
allchecks=[r for part in parts for r in part['checks']];allextras=[r for part in parts for r in part['extras']]
(root/'render_checks.json').write_text(json.dumps(allchecks,ensure_ascii=False,indent=1)+'\n');(root/'mobile_checks.json').write_text(json.dumps(allextras,ensure_ascii=False,indent=1)+'\n');print('Passed this chunk:',len(checks),'mobile variants;',len(extras),'focused cases. Total:',len(allchecks),len(allextras))
