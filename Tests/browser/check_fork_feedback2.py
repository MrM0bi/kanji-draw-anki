#!/usr/bin/env python3
"""Verify the second Windows-feedback fixes on real Anki-rendered fixtures."""
import argparse
import json
from itertools import product
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('testdir',type=Path);parser.add_argument('--start',type=int,default=0);parser.add_argument('--end',type=int,default=16);args=parser.parse_args()
root=args.testdir.resolve();results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--allow-file-access-from-files'])
    for card in ((1,2) if args.start==0 else ()):
        context=browser.new_context(viewport={'width':1100,'height':1000})
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto((root/'rendered'/f'probe_c{card}.html').as_uri());page.wait_for_timeout(250)
        defaults=page.evaluate('''() => {
            const assert=(ok,msg)=>{if(!ok)throw Error(msg)},gc=getGlobalConfig();
            for(const [k,v] of Object.entries({handwriting:'on',kanjiDraw:'off',nanori:'off',sideBySide:'on',themeDesign:'kd',themeMode:'system',themeAccent:'green',themePrimary:'random'}))assert(gc[k]===v,k+' default');
            for(const [k,v] of Object.entries({level:'low',music:'lofi',musicLevel:'low',immersion:'low',stroke:'on',fx:'on'}))assert(_kdSoundConf()[k]===v,k+' sound default');
            for(const [name,value] of Object.entries({'opt-handwriting':'on','opt-nanori':'off','opt-side-by-side':'on','theme-design':'kd','theme-mode':'system','theme-accent':'green','theme-primary':'random','sound-level':'low','sound-music':'lofi','sound-immersion':'low','sound-music-level':'low','sound-stroke':'on','sound-fx':'on'}))assert(document.querySelector('input[name="'+name+'"][value="'+value+'"]').checked,'checked '+name);
            assert((document.querySelector('button[data-source=merksaetze]').getAttribute('aria-pressed')==='true'),'Merksätze default');
            assert(!(document.querySelector('button[data-source=kanjiDraw]').getAttribute('aria-pressed')==='true'),'KanjiDraw default');
            assert((document.querySelector('button[data-source=heisig]').getAttribute('aria-pressed')==='true'),'Heisig default');
            assert(document.querySelector('.kd-story-group-kd').hidden,'KanjiDraw hidden');
            assert(document.querySelector('.kd-nanori-row').hidden,'Nanori hidden');
            assert(document.querySelector('.kanji-font-examples').classList.contains('is-visible'),'handwriting shown');
            return {card:_hostCard,sound:_kdSoundConf(),scene:document.documentElement.dataset.jpTheme};
        }''')
        assert not errors,errors;results.append({'defaults':defaults});context.close()
    # Both card tabs, designs, colour modes and narrow/wide settings layouts.
    for case,(card,design,dark,width) in enumerate(product((1,2),('minimal','kd'),(False,True),(320,1100))):
        if not args.start<=case<args.end:continue
        context=browser.new_context(viewport={'width':width,'height':1000})
        settings={'kanjiThemeDesign':design,'kanjiThemeMode':'dark' if dark else 'light','kanjiThemeAccent':'green','kanjiThemePrimary':'neutral','kanjiSoundLevel':'off'}
        context.add_init_script('for(const [k,v] of Object.entries('+json.dumps(settings)+'))localStorage.setItem(k,v);')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto((root/'rendered'/f'probe_c{card}.html').as_uri());page.wait_for_timeout(450)
        page.evaluate("openSettings();navigateToPage('page-theme')");page.wait_for_timeout(300)
        report=page.evaluate('''() => {
            const assert=(ok,msg)=>{if(!ok)throw Error(msg)},h=document.documentElement;
            const options=[...document.querySelectorAll('.accent-option')],heights=options.map(e=>e.getBoundingClientRect().height),circles=options.map(e=>e.querySelector('.accent-swatch').getBoundingClientRect().height);
            assert(Math.max(...heights)-Math.min(...heights)<1,'accent button heights');
            assert(Math.max(...circles)-Math.min(...circles)<1,'accent circle heights');
            const fonts=[...document.querySelectorAll('input[name=theme-font-size] + div svg')];
            const artwork=fonts.map(svg=>{const b=svg.getBBox(),v=svg.viewBox.baseVal;assert(b.x>=v.x-1&&b.x+b.width<=v.x+v.width+1,'font icon outside view box');assert(Math.abs(b.x+b.width/2-v.x-v.width/2)<v.width*.08,'font icon off centre');return {viewBox:svg.getAttribute('viewBox'),x:b.x,width:b.width};});
            for(const tab of ['c1','c2']){
                switchSettingsTab(tab);
                for(const accent of ['green','blue','purple','orange','red','teal','plain']){
                    document.querySelector('input[name=theme-accent][value='+accent+']').click();
                    const applied=getComputedStyle(h).getPropertyValue('--accent').trim(),highlight=getComputedStyle(document.querySelector('#page-theme')).getPropertyValue('--active-tab-color').trim();
                    assert(safeGetItem('kanjiThemeAccent')===accent,'stored accent');assert(highlight===applied,'wrong tab accent '+tab+' '+accent);
                    const check=document.createElement('span');check.style.color=h.classList.contains('nightMode')?'var(--accent)':'color-mix(in srgb,var(--accent) 65%,#000)';document.body.appendChild(check);
                    if(h.classList.contains('kd-design-minimal'))assert(getComputedStyle(document.querySelector('.tag-frequency')).color===getComputedStyle(check).color,'frequency not accented');check.remove();
                }
            }
            switchSettingsTab(_hostCard);
            document.querySelector('input[name=theme-accent][value=green]').click();
            return {artwork,heights,circles};
        }''')
        # Round-trip switching must restore all of v3's SVG markup AND its coordinate systems.
        page.evaluate('''() => {
            kdSetDesign('kd');const svg=document.querySelector('input[name=theme-font-size][value=normal] + div svg');
            const original=svg.outerHTML;kdSetDesign('minimal');kdSetDesign('minimal');kdSetDesign('kd');
            if(svg.outerHTML!==original)throw Error('design icon round trip');
        }''')
        page.evaluate('kdSetDesign('+json.dumps(design)+')')
        if card==1 and design=='minimal':
            page.locator('#page-theme').screenshot(path=str(root/f'feedback2-appearance-{dark}-{width}.png'))
        # All eight combinations of source switches must affect precisely their source.
        page.evaluate("navigateToPage('page-back');switchSettingsTab(_hostCard)")
        for bits in range(8):
            page.evaluate('''bits => {
                const sources=['merksaetze','kanjiDraw','heisig'],classes=['merksaetze','kd','ref'];
                sources.forEach((source,i)=>{const input=document.querySelector('button[data-source='+source+']'),on=!!(bits&(1<<i));if((input.getAttribute('aria-pressed')==='true')!==on)input.click();});
                classes.forEach((source,i)=>{if(document.querySelector('.kd-story-group-'+source).hidden===!!(bits&(1<<i)))throw Error('wrong source '+source)});
                if(document.querySelector('[data-sec=eselsbruecken]').hidden!==(bits===0))throw Error('empty mnemonic section');
            }''',bits)
        page.evaluate('''() => {
            const other=_hostCard==='c1'?'c2':'c1';switchSettingsTab(other);
            document.querySelectorAll('button[data-source]').forEach(input=>{if(input.getAttribute('aria-pressed')==='true')input.click()});
            if([...document.querySelectorAll('[data-sec=eselsbruecken] .kd-story-group')].some(g=>g.hidden))throw Error('other card affected host');
            switchSettingsTab(_hostCard);
            if([...document.querySelectorAll('button[data-source]')].some(input=>input.getAttribute('aria-pressed')!=='true'))throw Error('source UI tab state');
        }''')
        if card==1 and design=='minimal':page.locator('#page-back').screenshot(path=str(root/f'feedback2-back-{dark}-{width}.png'))
        # Native toggle buttons must operate once per Space/Enter key.
        chip=page.locator('button[data-source=merksaetze]');chip.focus();page.keyboard.press('Space')
        assert chip.get_attribute('aria-pressed')=='false'
        page.keyboard.press('Enter');assert chip.get_attribute('aria-pressed')=='true'
        # Persisted source choices override new CSS defaults on the next card render.
        page.reload();page.wait_for_timeout(100)
        assert page.locator('button[data-source=kanjiDraw]').get_attribute('aria-pressed')=='true'
        assert page.locator('.kd-story-group-kd').evaluate('e=>!e.hidden')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        results.append({'card':card,'design':design,'dark':dark,'width':width,**report});context.close()
        print('UI case',case,'passed',flush=True)
    # Primitive-meaning pills: both skins and each font scale, with a real note's meanings.
    for design,font in (product(('kd','minimal'),('small','normal','large')) if args.end==16 else []):
        context=browser.new_context(viewport={'width':320,'height':915})
        context.add_init_script('for(const [k,v] of Object.entries('+json.dumps({'kanjiThemeDesign':design,'kanjiThemeFontSize':font,'kanjiSoundLevel':'off'})+'))localStorage.setItem(k,v);')
        page=context.new_page();page.goto((root/'rendered'/'probe-chips_c1_front.html').as_uri());page.wait_for_timeout(100)
        sizes=page.evaluate('''() => {
            const pill=document.querySelector('.primitive-box'),title=document.querySelector('.card-title');
            if(!pill)throw Error('no primitive meaning fixture');
            const secondary=parseFloat(getComputedStyle(pill).fontSize),primary=parseFloat(getComputedStyle(title).fontSize);
            if(secondary>=primary)throw Error('primitive meaning too large');
            if(document.documentElement.scrollWidth>innerWidth+1)throw Error('title overflow');
            return {primary,secondary};
        }''')
        page.screenshot(path=str(root/f'feedback2-pills-{design}-{font}.png'));results.append({'pills':True,'design':design,'font':font,**sizes});context.close()
    browser.close()
(root/f'feedback2_checks_{args.start}_{args.end}.json').write_text(json.dumps(results,indent=2,ensure_ascii=False)+'\n')
print('Passed',len(results),'feedback-round-2 cases (all source combinations and accent colours in both tabs).')
