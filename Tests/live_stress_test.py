#!/usr/bin/env python3
"""
KanjiDraw Live Interaction Stress Test
=======================================
Simulates real user interactions in the Anki card WebView:
  - Drawing strokes via PointerEvents on the draw-layer
  - Gear settings menu open/close (including rapid spam)
  - Theme (light/dark/system) and stroke-style changes
  - Card flips mid-stroke and mid-animation
  - Chaos mode: 100 random actions + card flips

Strategy: fire-and-forget JS via port 8767 + AnkiConnect as health-check proxy.
After each phase the AnkiConnect response time is measured — a frozen or
crashed Anki will fail or time out these checks.

Requirements:
  1. Anki running with deck "RTK Deutsch — Kanji schreiben"
  2. AnkiConnect addon (port 8765)
  3. KanjiDraw Stress Test Helper addon (port 8767)
     -> copy Tests/anki_addon_stress_helper/ into Anki's addons21/ and restart

Usage:
  python3 Tests/live_stress_test.py
"""
import json, time, sys, random, threading
import urllib.request

ANKI_PORT = 8765
EVAL_PORT  = 8767
EASE_HARD  = 2   # "Hard" rating — avoids incorrectly promoting cards

# ─── HTTP helpers ──────────────────────────────────────────────────────────────

def anki(action, **params):
    payload = json.dumps({"action": action, "version": 6, "params": params}).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{ANKI_PORT}",
        data=payload, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def js(code):
    """Fire-and-forget JS execution in the card WebView."""
    req = urllib.request.Request(f"http://127.0.0.1:{EVAL_PORT}/eval",
        data=json.dumps({"js": code}).encode(),
        headers={"Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=3).read())
    except Exception as e:
        return {"error": str(e)}

def alive(label="", timeout=2.0):
    """Assert AnkiConnect still responds within timeout — proxy for 'Anki not frozen'."""
    t0 = time.time()
    r = anki("version")
    dt = (time.time()-t0)*1000
    assert r.get("result") == 6, f"AnkiConnect dead after: {label}"
    assert dt < timeout*1000, f"AnkiConnect too slow ({dt:.0f}ms) after: {label}"
    return dt

def sleep(s): time.sleep(s)

# ─── Test Runner ───────────────────────────────────────────────────────────────

_passed = 0; _failed = 0

def test(name, fn):
    global _passed, _failed
    try:
        fn()
        _passed += 1
        print(f"  ✓ {name}")
    except AssertionError as e:
        _failed += 1
        print(f"  ✗ {name}\n    {e}")
    except Exception as e:
        _failed += 1
        print(f"  ✗ {name}\n    EXCEPTION: {e}")

def assert_(c, msg=""):
    if not c: raise AssertionError(msg)

# ─── JS snippets ───────────────────────────────────────────────────────────────

JS_DRAW = """
(function(){
    var l=document.getElementById('draw-layer');
    if(!l)return;
    var r=l.getBoundingClientRect(), cx=r.left+r.width*.5, cy=r.top+r.height*.5;
    function f(t,x,y){l.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));}
    f('pointerdown',cx-30,cy);
    for(var i=0;i<10;i++) f('pointermove',cx-30+i*6,cy+i*2);
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
})()"""

# Pointerdown without pointerup — simulates an interrupted stroke
JS_DRAW_DOWN = """
(function(){
    var l=document.getElementById('draw-layer');
    if(!l)return;
    var r=l.getBoundingClientRect(), cx=r.left+r.width*.5, cy=r.top+r.height*.5;
    l.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
})()"""

JS_OPEN_GEAR  = "(function(){var b=document.getElementById('gear-btn');if(b)b.click();})()"
JS_CLOSE_GEAR = "(function(){var b=document.getElementById('settings-close-btn');if(b)b.click();})()"

def JS_THEME(m): return f"(function(){{var rs=document.querySelectorAll('[name=\"theme-mode\"]');for(var i=0;i<rs.length;i++){{if(rs[i].value==='{m}'){{rs[i].click();return;}}}}}})()"
def JS_STYLE(s): return f"(function(){{var rs=document.querySelectorAll('[name=\"stroke-style\"]');for(var i=0;i<rs.length;i++){{if(rs[i].value==='{s}'){{rs[i].click();return;}}}}}})()"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def ensure_review():
    r = anki("guiReviewActive")
    if not r.get("result"):
        anki("guiDeckReview", name="RTK Deutsch — Kanji schreiben")
        sleep(1.0)

def flip_next():
    anki("guiShowAnswer"); sleep(0.08)
    return anki("guiAnswerCard", ease=EASE_HARD).get("error") is None

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Preflight ===\n")
# ══════════════════════════════════════════════════════════════════════════════

test("AnkiConnect reachable (v6)", lambda: assert_(anki("version")["result"] == 6))
test("Eval addon reachable (port 8767)", lambda: assert_(
    js("1+1").get("error") is None, "Port 8767 not reachable — restart Anki with the helper addon"))

ensure_review(); sleep(0.5)
test("Review session active", lambda: assert_(anki("guiReviewActive").get("result") is True))

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 1: Drawing ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_draw_20():
    for _ in range(20): js(JS_DRAW); sleep(0.05)
    dt = alive("20 strokes"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_burst():
    for _ in range(30): js(JS_DRAW); sleep(0.01)
    sleep(0.3)
    dt = alive("30-stroke burst"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_with_leave():
    """Drawing + pointerleave tests the _cachedRect invalidation fix."""
    for _ in range(10):
        js(JS_DRAW)
        js("(function(){var l=document.getElementById('draw-layer');if(l)l.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true}));})()")
        sleep(0.06)
    alive("draw + pointerleave ×10")

test("20 strokes (50ms apart)", t_draw_20)
test("30-stroke burst (10ms apart)", t_draw_burst)
test("draw + pointerleave invalidation ×10", t_draw_with_leave)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 2: Settings Menu ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_gear_10():
    for _ in range(10): js(JS_OPEN_GEAR); sleep(0.08); js(JS_CLOSE_GEAR); sleep(0.08)
    alive("gear 10× toggle")

def t_gear_rapid():
    for _ in range(20): js(JS_OPEN_GEAR); sleep(0.03); js(JS_CLOSE_GEAR); sleep(0.03)
    sleep(0.2)
    dt = alive("gear 20× rapid"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_while_gear():
    js(JS_OPEN_GEAR); sleep(0.15)
    for _ in range(5): js(JS_DRAW); sleep(0.05)
    js(JS_CLOSE_GEAR); sleep(0.2)
    alive("draw with menu open")

test("gear 10× open/close (80ms)", t_gear_10)
test("gear 20× rapid (30ms)", t_gear_rapid)
test("5 strokes with menu open — no freeze", t_draw_while_gear)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 3: Theme & Stroke Style ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_theme_cycle():
    js(JS_OPEN_GEAR); sleep(0.2)
    for m in ("light","dark","system","dark","light","system"):
        js(JS_THEME(m)); sleep(0.1)
    js(JS_CLOSE_GEAR); sleep(0.3)
    alive("theme cycle ×6")

def t_style_cycle():
    js(JS_OPEN_GEAR); sleep(0.2)
    for s in ("neon","gel","standard","neon","standard"):
        js(JS_STYLE(s)); sleep(0.1)
    js(JS_CLOSE_GEAR); sleep(0.3)
    alive("style cycle ×5")

def t_rapid_theme():
    js(JS_OPEN_GEAR); sleep(0.15)
    for _ in range(10): js(JS_THEME("dark")); sleep(0.02); js(JS_THEME("light")); sleep(0.02)
    js(JS_CLOSE_GEAR); sleep(0.4)
    dt = alive("rapid theme ×10"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_combined():
    """draw → open → theme → draw while open → close → draw"""
    js(JS_DRAW); sleep(0.05)
    js(JS_OPEN_GEAR); sleep(0.12)
    js(JS_THEME("dark")); sleep(0.08)
    js(JS_DRAW); sleep(0.05)
    js(JS_THEME("light")); sleep(0.08)
    js(JS_CLOSE_GEAR); sleep(0.2)
    js(JS_DRAW); sleep(0.05)
    alive("draw+gear+theme combined")

test("theme light/dark/system cycle ×6", t_theme_cycle)
test("stroke-style neon/gel/standard cycle ×5", t_style_cycle)
test("10× rapid dark↔light switch", t_rapid_theme)
test("draw + gear + theme combined sequence", t_combined)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 4: Card Flips ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_flip_mid_stroke():
    js(JS_DRAW_DOWN); sleep(0.04)  # pointerdown with no pointerup
    anki("guiShowAnswer"); sleep(0.05)
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.2)
    alive("flip mid-stroke")
    ensure_review()

def t_25_rapid_flips():
    times = []; errs = 0
    for _ in range(25):
        t0 = time.time()
        js(JS_DRAW); sleep(0.02)
        anki("guiShowAnswer"); sleep(0.04)
        r = anki("guiAnswerCard", ease=EASE_HARD)
        if r.get("error"): errs += 1
        times.append((time.time()-t0)*1000); sleep(0.04)
    avg = sum(times)/len(times)
    print(f"    25 flips | avg {avg:.0f}ms | errors: {errs}", end="")
    assert_(errs == 0, f"{errs} flip errors")
    ensure_review()

def t_flip_gear_open():
    js(JS_OPEN_GEAR); sleep(0.15)
    anki("guiShowAnswer"); sleep(0.05)
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.35)
    alive("flip with menu open")
    ensure_review()

def t_flip_mid_theme():
    js(JS_OPEN_GEAR); sleep(0.12)
    js(JS_THEME("dark")); sleep(0.05)
    anki("guiShowAnswer"); sleep(0.04)  # flip while theme is still being applied
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.3)
    alive("flip during theme change")
    ensure_review()

test("flip mid-stroke (pointerdown without pointerup)", t_flip_mid_stroke)
test("25× rapid draw + flip", t_25_rapid_flips)
test("flip with settings menu open", t_flip_gear_open)
test("flip during theme change", t_flip_mid_theme)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 5: Chaos Mode ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_chaos_100():
    actions = [
        lambda: js(JS_DRAW),
        lambda: js(JS_DRAW),
        lambda: js(JS_DRAW),
        lambda: js(JS_OPEN_GEAR),
        lambda: js(JS_CLOSE_GEAR),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_THEME("dark")),     js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_THEME("light")),    js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_STYLE("neon")),     js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_STYLE("standard")), js(JS_CLOSE_GEAR)),
        lambda: (anki("guiShowAnswer"), sleep(0.04), anki("guiAnswerCard", ease=EASE_HARD)),
        lambda: js(JS_DRAW_DOWN),  # interrupted stroke (no pointerup)
    ]
    errs = 0
    for _ in range(100):
        try: random.choice(actions)()
        except Exception: errs += 1
        sleep(0.025)
    sleep(0.5)
    ensure_review(); sleep(0.3)
    dt = alive("100 chaos actions")
    print(f"    100 actions | errors: {errs} | AnkiConnect: {dt:.0f}ms", end="")
    assert_(errs < 5, f"too many exceptions: {errs}")

def t_latency_regression():
    """AnkiConnect response time must not degrade significantly after chaos."""
    dts_before = [alive() for _ in range(5)]
    avg_before = sum(dts_before)/len(dts_before)

    for _ in range(50):
        random.choice([
            lambda: js(JS_DRAW),
            lambda: js(JS_OPEN_GEAR),
            lambda: js(JS_CLOSE_GEAR),
            lambda: (js(JS_OPEN_GEAR), sleep(0.02), js(JS_THEME("dark")), js(JS_CLOSE_GEAR)),
        ])()
        sleep(0.02)
    sleep(0.5); ensure_review(); sleep(0.2)

    dts_after = [alive() for _ in range(5)]
    avg_after = sum(dts_after)/len(dts_after)
    print(f"    avg before: {avg_before:.0f}ms → after: {avg_after:.0f}ms", end="")
    assert_(avg_after < avg_before * 3 + 100,
            f"latency regression: {avg_after:.0f}ms (was {avg_before:.0f}ms)")

test("chaos mode: 100 random actions", t_chaos_100)
test("latency regression: AnkiConnect before vs after chaos", t_latency_regression)

# ─── Restore default settings ──────────────────────────────────────────────────
js(JS_OPEN_GEAR); sleep(0.15)
js(JS_STYLE("standard")); sleep(0.05)
js(JS_THEME("system")); sleep(0.05)
js(JS_CLOSE_GEAR); sleep(0.2)

# ─── Summary ──────────────────────────────────────────────────────────────────
total = _passed + _failed
print("\n" + "═"*58)
print(f"  Results: {_passed}/{total} passed, {_failed} failed")
print("═"*58 + "\n")
sys.exit(0 if _failed == 0 else 1)
