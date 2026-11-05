# Fork upgrade to upstream v3.0.0 – plan & handoff

Working document for bringing this fork (MrM0bi/kanji-draw-anki) up to date with upstream
PawMethod/kanji-draw-anki **v3.0.0** while keeping the fork's UI and data changes. Several agents work on this
one after the other, possibly on different machines. **This file is the single source of truth for the
migration.** It must be enough to continue without any earlier chat context.

This file lives on the work branch only. Before the release merge it gets folded into [`FORK.md`](../../FORK.md)
and removed (see Phase 8).

> Public repo: never commit deck content (book texts, the user's mnemonics, `.apkg` files), hostnames, IPs,
> API keys or personal paths. Data and data scripts live in the private `fix-kanji-deck` repo (see below).

---

## 0. How to resume (read this first)

1. `git fetch origin upstream && git switch t3/reconcile-v3-fork && git pull`. The work branch is
   `t3/reconcile-v3-fork` on `origin`.
2. Read **§7 Current state / next step** and the last entries of **§8 Progress log**.
3. Read the local `AGENTS.md` if present. It's git-ignored and has general repo rules plus facts about the user's
   live Anki. Copy it in by hand on a new machine. This file does not depend on it.
4. Pick the first unchecked item in **§6 Checklist** that isn't blocked. Do it, test it, tick it, add a log
   entry, update §7, **commit and push**. Then continue with the next item.
5. Before you stop (or when nearing a usage limit): commit work in progress as `wip: …` if it is in a sane
   state, update §7 with exactly where you stopped and what to do next, push.

### Rules for agents

- **Autonomy:** work as autonomously as possible. Ask the user only for decisions with real impact, manual
  steps (e.g. copying files, Tailscale/AnkiConnect setup) or manual tests (Android, Windows desktop). When you
  ask, **list the decisions you already took on your own and their possible impact** in the same message.
  Record every decision in §5 (Decisions log).
- **Git:** small commits on `t3/reconcile-v3-fork`, Conventional Commit style (`feat:`, `fix:`, `style:`,
  `docs:`, `chore:`, `wip:`), push to `origin` after every finished checklist item. Never commit to or push
  `main`. Never open/merge a PR and never finish the upgrade without the user's **explicit** consent.
- **Upstream stays untouched:** no PRs, issues or comments on PawMethod/kanji-draw-anki.
- **Writing to the user's real Anki** (fields, notes, templates, styling, anything via AnkiConnect) needs the
  user's explicit OK **every time**, after the user confirmed a fresh backup. Never touch scheduling, revlog,
  suspension or flags. Read-only AnkiConnect calls are fine, except `cardsInfo`/`getReviewsOfCards` on the whole
  deck (renders every card, spikes CPU). Use small subsets.

---

## 1. Goal and definition of done

Bring upstream v3.0.0 (tag `v3.0.0`, merged upstream PR #3 `chore/anki-26-compat`; `upstream/main` = `b853acf`
on 2026-11-03) into the fork. Keep all fork features, rebuild them on top of v3, and migrate the user's deck data
so the new v3 features work with it.

Done when **all** of this holds:
- All fork features (§4) work on v3. The new v3 features work with the user's fields.
- `cd Tests/js && npm ci && npm test` passes (or only documented pre-existing failures), `python3 Tools/build.py --check` passes.
- Headless render checks (§3, Phase 3) pass: no console errors, timing within budget, kanji + primitive,
  Card 1 + Card 2, front + back.
- The user tested on **Windows Desktop** and **Android (AnkiDroid)** and is happy.
- The data migration (Phase 4/5) is applied to the real collection, the templates/CSS are live, and it's
  verified with `modelTemplates`/`modelStyling`.
- The user gave explicit consent → PR `t3/reconcile-v3-fork` → `main` on origin, merged. No AnkiWeb publishing.

---

## 2. Environment & infrastructure

### Planned move to a server (decided 2026-11-03)

The whole project moves from the user's Windows PC + WSL to a **remote Linux server** and stays there. The
user's Anki keeps running on Windows. Its **AnkiConnect will be reachable from the server over Tailscale**.

- The AnkiConnect URL is **never committed**. Scripts read it from env `ANKICONNECT_URL` (default
  `http://127.0.0.1:8765`). There is **no API key** (user decision 2026-11-03), so the port must only be reachable
  from the user's own tailnet.
- AnkiConnect's `webBindAddress` takes **one** address. Recommended setup (manual step by the user, checklist 0.6):
  keep AnkiConnect on `127.0.0.1` and expose it to the tailnet with
  `tailscale serve --bg --tcp 8765 tcp://localhost:8765` on the Windows PC. The server then uses
  `ANKICONNECT_URL=http://<pc-tailnet-name>:8765`. Alternative: `webBindAddress` `0.0.0.0` plus a Windows firewall
  rule that only allows `127.0.0.1` and the tailnet range `100.64.0.0/10` on port 8765.
- AnkiConnect only talks to the **profile that is currently open** in the user's Anki.

### Repos and directories

| What | Where (PC/WSL before the move) | Committed? |
|---|---|---|
| This repo (templates, docs) | `~/kanji-draw-anki` (+ T3 worktrees) | yes, public: origin = github.com/MrM0bi/kanji-draw-anki, upstream = github.com/PawMethod/kanji-draw-anki |
| Data tooling, migration scripts, review decisions | `~/fix-kanji-deck`, branch `master` | private: github.com/MrM0bi/fix-kanji-deck (scripts, `STATUS.md`; `book/ sources/ old-info/ work/ deck/ .anki-test/ .venv` git-ignored) |
| Headless test Anki | `fix-kanji-deck/.anki-test/` (`tools/setup_test_anki.py`, `tools/anki_headless.sh`) | no, rebuilt from the `.apkg` |

### Files to copy by hand (not in git)

| File | Needed for | Note |
|---|---|---|
| `Kanji__🏮Benni's RTK Deutsch🏮.apkg` | everything data-related; test collection | the user's deck export (2026-11-03). Includes the 3 handwriting fonts as media. Put it in the root of this repo (git-ignored by `*.apkg`). Also copy into `fix-kanji-deck/deck/`. |
| `Kanji_Draw__RTK__Heisig_Deutsch_Kanji_schreiben.apkg` | v3 data (Radikale, Stolperfallen, Eselsbrücke, Merkhilfe) | upstream v3 deck. Can be downloaded again from AnkiWeb: <https://ankiweb.net/shared/info/2072366368>. Repo root, git-ignored. |
| `AGENTS.md` (+ symlink `CLAUDE.md -> AGENTS.md`) | general agent rules for this repo | git-ignored by the user's choice. Repo root. |
| `fix-kanji-deck/sources/` | KanjiVG, AnimCJK, KANJIDIC2, AnkiConnect zip for the test Anki | the user moves it by hand once. |
| `fix-kanji-deck/book/`, `old-info/`, `work/` | earlier data work (book scans etc.) | copyrighted / large. Move only if needed. Stays private. |
| `Backup/` (template backups) | rollback only | stays on the PC. Make new backups before every live write. |

Rebuild instead of copying: Python venvs (`uv sync --group anki --group analysis` in `fix-kanji-deck`),
`Tests/js/node_modules` (`npm ci`), `.anki-test/`.

### Server prerequisites (checklist 0.7)

`git`, `python3` (≥ 3.10), `uv`, `node` ≥ 22 + `npm`, a headless Chromium (Playwright or system chromium) for
render checks, and the Qt offscreen deps for the headless Anki (`aqt[qt6]==26.5`, `QT_QPA_PLATFORM=offscreen`).

---

## 3. Analysis summary (2026-11-03)

### Code: fork point → upstream v3

- Fork point: `569a744` (2026-04-09). Upstream since then: 50 commits, about +28.8k / −4.2k lines in 78 files.
- **New in v3:**
  - stroke-order player (`src/back/stroke-order-player.js`)
  - "Schreibfehler" view from new field `Stolperfallen` (`src/back/pitfalls.js`)
  - new component tree with zoom/fullscreen. Tapping a part colours its strokes. It needs the new `Radikale` format
    `Wert[Schlüsselwort]@Striche{Kinder}`, e.g. `吾[Ich]@8-14{五[fünf]@8-11, 口[Mund]@12-14}`
    (`src/back/primitive-tree.js`, `radical-tree.js`).
  - colour-coded mnemonics: `<span class="kd-kw kd-c1">` (component 1), `kd-k` (the keyword), `kd-p` (primitive)
  - start-point hints, pen width, left-hand mode
  - procedural music/sound engine (`src/audio/`, off by default), 9 Japanese landscape themes, flat-vector UI,
    "Danke" page
  - the side-by-side comparison view was removed
- **Build step:** shared code lives in `Templates/src/{front,back,audio}` and is copied into the 4 templates
  between markers by `python3 Tools/build.py` (`--check` for CI). See `Templates/README.md`, which also has a
  "Wo ändere ich was?" table.
- **The info modal is still upstream's design** (`.info-btn` → `#info-overlay`, pages `#info-page-main`,
  `#info-page-order`, `#info-page-pitfalls`, `navigateInfoToOrder/Pitfalls`). The fork replaced the modal with
  inline sections, so this is the main conflict area.
- Upstream fields (v3): `Kanji, Bedeutung, Merkhilfe, Eselsbrücke, Wortbeispiel, Onyomi, Kunyomi, JLPT,
  Häufigkeit, Nummer, Stolperfallen, Radikale, SVGPfade`.
- The add-on only injects settings into note types that have an `SVGPfade` field. The user's note type has it.
- The templates inside the v3 `.apkg` equal `upstream/main` (except one moved comment line).
- `Tests/js` now has `npm test` (`node --test "test_*.js"`).

### Data: user's deck vs. v3 deck

User's note type: `Mobi's Die Kanji lernen & behalten 1`, templates `Card 1`/`Card 2`. 2363 notes = 2200 kanji +
163 primitives (`Kanji` = `[name]`). 28 fields:
`Kanji, Bedeutung-DE, Bedeutung-Override, PrimitivBedeutung-DE, PrimitivBedeutung-Override, Merksatz-DE,
Merksatz-Custom, Merksatz-KI, Notiz, Kunyomi, Onyomi, Nanori, Kanjinummer-BuchDE-Edition-3,
Kanjinummer-BuchDE-Edition-4, Kanjinummer-BuchDE-Edition-4_mitPrimitive, Kanjinummer-BuchEN-Edition-6,
BuchBeschreibung, BuchPrimitivBeschreibung, Wortbeispiel, Lektion, JLPT-Level, Strichanzahl, Häufigkeit, Radikale,
Bedeutung-EN, PrimitivBedeutung-EN, Merksatz-EN, SVGPfade`.

v3 deck: note type `KanjiDraw`, 2200 notes, no primitive notes. All its fields are filled on all notes
(except Kunyomi 1490, JLPT 2004, Onyomi 2188).

Comparison of the 2199 kanji present in both (matched by `Kanji`):
- Identical: `Wortbeispiel`, `Onyomi`, `Kunyomi`, `JLPT(-Level)`, `Häufigkeit`.
  `Kanjinummer-BuchEN-Edition-6` == v3 `Nummer` on all 2199. `Kanjinummer-BuchDE-Edition-4` differs only for
  誓/斬 (1214/1215 swapped).
- `Bedeutung-DE` vs `Bedeutung`: 5 differ (昭 gleißend/gleißen, 川 Fluss/Fluß, 吐 ausspucken/spucken,
  貧 trailing `<br />`, 修 "beherschen" typo in the user's deck).
- `SVGPfade`: 17 differ (e.g. 辻 掛 悠 賭 偏 衷). Needs a case-by-case review.
- Variant: v3 has 篭, the user has 籠.
- **`Radikale`:**
  - Almost all differ. v3 adds stroke ranges and nesting (1407 notes nested).
  - 2095 also differ in components or names.
  - **v3 renamed about 128 primitive keywords** compared to the user's book-based names. Most frequent:
    Finger→Pfote ×83, Blume*→Blüten* ×61, Haus*→Hausdach* ×44, Monat/Fleisch→Fleisch ×35, Gipfel*→Felszacke* ×32,
    Getreide→Halm ×30, gefesselt*→eingewickelt* ×28, Wandersmann*→Wanderbeine* ×21, Haube*→Kapuze* ×20,
    Seite*→Beistand* ×6, schleppen*→Nachschleifen* ×6, …
  - Some decompositions differ, e.g. 六: user `六[sechs]`, v3 `亠[Zylinderhut*]@1-2, ハ[Tierbeine*]@3-4`.
  - Some entries embed raw `<path>` glyphs for glyph-less primitives (both decks, e.g. 派).
- v3 `Eselsbrücke`/`Merkhilfe` are new AI-written mnemonics by PawMethod with `kd-kw` spans. They use **v3's**
  primitive names.
- v3 `Stolperfallen` format: `kategorie@striche[Titel]: Beschreibung || …` (categories `order`, `dir`, `bend`,
  `form`).

Analysis scripts used: `fix-kanji-deck/tools/v3/` (`compare.py` etc., see there).

---

## 4. Fork features to carry over (state before the upgrade, `main` @ `4a330c0`)

The old commits (`c1d81bc`…`1a8a060`) are the reference implementation. Use `git show <sha>` for details.

| # | Feature | Old commit(s) | Carry over |
|---|---|---|---|
| F1 | User's field names in templates (`Bedeutung-DE`, `JLPT-Level`, …) | c1d81bc | yes, mapping in §5 D2 |
| F2 | Info modal → inline collapsible sections on the back (`.kd-section[data-sec]`, state in `kdSec_<sec>`) | 87e7498, acce1ec | **rebuild**, now with all new v3 content (D3) |
| F3 | Several mnemonic boxes (Merksatz-Custom, Merksatz-DE, Heisig BuchBeschreibung/BuchPrimitivBeschreibung) | 87e7498, 636d55c | yes, plus the KanjiDraw group (D6) |
| F4 | Primitive meanings as chips on the front (`PrimitivBedeutung-DE`, `.primitive-box`) | 87e7498 | yes |
| F5 | Handschriftbeispiele: setting `opt-handwriting`, 3 fonts `_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`, `_kanji_font4_KouzanGyousho.otf` (collection media, not in repo) | acce1ec | yes |
| F6 | Faster answer reveal (`fadeAndSlideIn` 0.35s → 0.1s) | acce1ec | only if v3 still needs it |
| F7 | Primitive notes (`Kanji` starts with `[`): no font samples, no tree root row, hide "Elemente" if it only names itself | 0a630e9, 95bd2a3 | yes, also check the new tree/player with primitives |
| F8 | `.gitignore`: `AGENTS.md`, `CLAUDE.md` | 8ffe328 | yes |
| F9 | Meaning overrides `Bedeutung-Override`, `PrimitivBedeutung-Override` on both fronts | 636d55c | yes |
| F10 | Nanori row in Lesungen (`.kd-nanori-label`), Notiz section (`.kd-note-box`, hidden if only `<br>`/`&nbsp;`) | 6cce6c9 | yes |
| F11 | Eselsbrücken groups: `HEISIG` label + muted stripe (`.kd-story-group-ref`, `.kd-story-group-label`) | 1a8a060 | yes |
| F12 | Header shows JLPT, Häufigkeit and a book number | 87e7498 | yes, number = `Kanjinummer-BuchDE-Edition-4` (D2) |

---

## 5. Decisions log

Decided with the user in the grill session on 2026-11-03 unless noted otherwise. Add new decisions at the end, with a date
and who decided (user / agent).

- **D1 Integration:** `git merge upstream/main` into the work branch. Resolve template conflicts by **taking
  upstream's version wholesale**, then re-add each fork feature as its own small `feat:`/`fix:` commit. Fork code is
  marked `fork:` (`<!-- fork: … -->`, `/* fork: … */`, `// fork: …`) and uses `kd-`-prefixed classes and its own
  IIFEs. Code that both cards share goes into **`Templates/src/` (new fork-only files, e.g. `src/back/kd-fork-*.js`
  with their own markers)** and gets built with `Tools/build.py`. Don't refactor upstream code. Every touched upstream line is a
  future conflict.
- **D2 Field names:** keep the user's field names; the templates are patched. Mapping upstream → user:
  `Bedeutung` → `Bedeutung-DE` (with the override logic of F9), `JLPT` → `JLPT-Level`,
  `Nummer` → `Kanjinummer-BuchDE-Edition-4` (German 4th ed. number, *not* EN-6),
  `Eselsbrücke` → `Merksatz-KI` (field keeps its name, gets v3 content, see D5), `Merkhilfe` → `Merkhilfe` (new
  field), `Stolperfallen` → `Stolperfallen` (new field). `Kanji, Wortbeispiel, Onyomi, Kunyomi, Häufigkeit,
  Radikale, SVGPfade` are the same. Don't add a `Nummer` field.
- **D3 Back layout:** **rebuild the inline sections** (no modal for this content), with all the new v3
  features. Correct behaviour and performance must be verified. Section order (stable `data-sec` keys):
  1. **Elemente**: v3 tree with zoom/fullscreen. Tapping a part colours its strokes.
  2. **Strichfolge**: stroke-order player, inline.
  3. **Eselsbrücken**: see D6.
  4. **Notiz**
  5. **Schreibfehler**: only when `Stolperfallen` is filled.
  6. **Wortbeispiele**
  7. **Lesungen**: ON / KUN / Nanori.
  8. **Links**

  All sections are collapsible and remember their state (`kdSec_<sec>`). Strichfolge and Schreibfehler start
  **collapsed** and only initialise when first opened (performance). Header: JLPT, Häufigkeit, DE-4 number.
  Render the sections from **one ordered list/config**, so a later hide/reorder setting (Phase 9) is easy.
- **D4 Keep all fork features** F1–F12. Check F6 (reveal speed) against v3's animations and drop it if it isn't
  needed.
- **D5 Data from v3:**
  - `Stolperfallen`: import as-is (new field after `Radikale`).
  - `Merkhilfe`: import as-is (new field after `Merksatz-KI`).
  - `Merksatz-KI`: **keep the field name**, overwrite with v3 `Eselsbrücke` for the 2200 kanji. Back up the old KI
    texts first. The 163 primitives keep their current KI text.
  - `Radikale`: take v3's structure (ranges, nesting) and map keywords to the user's names with a glyph → name
    table. Apply mechanical cases automatically. Everything else goes on a review page (D7). **Where v3 is more
    accurate, use v3.** This is decided case by case by the user. Primitive notes get a generated `@1-n` range.
  - Also review: the 5 `Bedeutung` diffs, the 17 `SVGPfade` diffs, 篭/籠, 誓/斬 numbering.
- **D6 Eselsbrücken boxes, in order:** Merksatz-Custom → Merksatz-DE → **`KANJIDRAW` group** (muted label like
  `HEISIG`: `Merkhilfe` hint above `Merksatz-KI`, with v3's colour-coded keywords) → **`HEISIG` group**
  (BuchBeschreibung, BuchPrimitivBeschreibung). On primitives the KanjiDraw box shows the old KI text.
- **D7 Review pages:** a generated self-contained HTML page per review topic (kanji drawn side by side, a
  recommendation + reason for each case, one click per case, export decisions as JSON). Nothing from the review
  group is applied before the user has decided. Decisions are committed as JSON in `fix-kanji-deck`.
- **D8 Colour-coding of all mnemonic texts (option b, in the data):** after the radicals are confirmed, agents read
  `Merksatz-DE`, `BuchBeschreibung` and `BuchPrimitivBeschreibung` and find where each component is mentioned,
  including indirect wording. They propose `kd-kw kd-cN` spans, the user reviews them (D7), and then the spans
  are written into the fields. Inconsistencies found in `Radikale` go back into the Radikale review. The
  keyword names inside the existing `kd-kw` spans of `Merksatz-KI` get matched to the final tree names.
- **D9 Where things live:**
  - this plan: committed on the work branch
  - [`FORK.md`](../../FORK.md): public, permanent list of fork changes
  - `AGENTS.md`: local only
  - data/migration scripts and review decisions: private `fix-kanji-deck`
  - public repo: templates, CSS, docs only
  - English for docs, German for user-facing UI strings
- **D10 Testing:**
  - Headless on the server: isolated Anki collection built from the user's `.apkg`, plus rendering in headless
    Chromium (upstream harness `Tests/browser`) with real field values.
  - Manual by the user: a separate Anki profile (e.g. `KanjiTest`) with the `.apkg` imported, on Windows Desktop
    and Android.
  - No duplicate notes in the main profile.
  - Performance budget: back side appears no more than **+50 ms** slower than upstream v3's modal back on Desktop,
    with no visible lag/flicker on Android. Measured, not guessed.
- **D11 Switch-over order on the real collection** (backup + user OK before each step):
  1. add fields (`Stolperfallen`, `Merkhilfe`, …)
  2. run the data scripts
  3. write templates + CSS
  4. verify (`modelTemplates`, `modelStyling`, sample notes)
  5. the user syncs (adding fields forces a one-way full sync, so upload from the desktop)
- **D12 Release:** the user's explicit consent is needed before finishing/merging. Then PR work branch → `main`
  on origin. No AnkiWeb publishing.
- **D13 Upstream:** leave it alone. No PRs.
- **D14 Infra:** the project moves to a remote Linux server. AnkiConnect is reached over Tailscale through env
  `ANKICONNECT_URL` (never committed). No API key, so access is limited to the tailnet (§2).
- **D15 Later (post-release):** a setting to hide and reorder the back sections (Phase 9).
- **D16 (agent, 2026-11-03) Modal removal:** upstream's `.back-actions` info button and `#info-overlay` markup are
  replaced by the inline block in one contiguous hunk per back template. Upstream's modal JS
  (`openInfoModal`, `navigateInfo*`, …) stays and no-ops without its elements. Impact: a future upstream change
  to the modal markup conflicts in that one hunk.
- **D17 (agent) Section config:** headers (title, icon, chevron), order and default state are built by JS from
  `KD_SECTIONS` in `src/back/kd-fork-sections.js`. The section bodies stay as HTML in both backs, duplicated,
  because `Tools/build.py` forbids `{{` in `src/` files. The block is marked `fork:` and must stay identical in
  both backs.
- **D18 (agent) One upstream line patched:** `src/back/primitive-tree.js` (`treeModalEl`) falls back to
  `document.scrollingElement` inside `.kd-info-inline`, so a vertical drag over the tree scrolls the page (the tree
  blocks native touch scrolling and proxies it to its scroller). Without it the tree would trap scrolling on phones.
- **D19 (agent) Lazy Schreibfehler:** the data element is `#kd-raw-pitfalls-data` (not upstream's
  `#raw-pitfalls-data`), so upstream's eager IIFE skips it; `KD_SECTIONS` calls `_kanjiRenderPitfalls` on first open.
- **D20 (agent) Strichfolge autoplay:** the player starts when its section opens, and also on card show when the
  user left the section open (upstream autoplays when its modal page opens).
- **D21 (agent) Handschriftbeispiele placement:** v3's tree draws the root in its SVG, so there is no root row any
  more. The three font samples sit in a row above the tree. The setting is on v3's "Rückseite" settings page.
- **D22 (agent) F6 kept:** the inline area fades in over 0.1s, opacity only (a transform would trap the fixed tree
  fullscreen). Upstream's info button used 0.35s.
- **D23 (agent) Primitive chips on v3's title pill:** colours derive from `--title-*`, the group wraps under the
  keyword on narrow screens, and the "Primitive" label sits inline before the chips (an overhanging label collided
  with the keyword when wrapping).
- **D30 (agent, 2026-11-04) Radikale merge rules:** top-level names from the note itself; nested names from the
  component's own note when its top level lists the same glyphs, else learnt from aligned (glyph, v3 keyword)
  pairs, else the deck's dominant name (>= 80 %), else a review decision (only 廾, 尢, 叕). Result: 2214 notes
  (2105 kanji + 109 single-component primitives, `@1-n`) migrate without a decision; 95 kanji go to review
  (76 other decomposition, 1 other order, 17 other strokes = the Issue-1 book fixes, 籠/篭). The 54 multi-part
  primitives keep their entry without ranges (tree without colouring). Every generated tree passes a range
  check (inside 1..n, children inside parents, top level covers all strokes). Where the user's strokes differ
  from v3, each user stroke joins the components of the geometrically nearest v3 stroke.
- **D31 (agent, 2026-11-04) Not reviewed:** 誓/斬 numbers: Issue 6 checked them against the German book (斬 1214,
  誓 1215); v3 follows the English edition, so the user's values stay. 籠 gets no v3 text import by default (v3's
  Stolperfallen stroke references are for 篭); its Radikale is a review case.
- **D32 (agent, 2026-11-04) Review page as a private artifact:** decisions are saved per click to the page's db
  (collection `decisions`) and read back with ArtifactData, so no JSON round trip is needed (a copyable JSON
  fallback exists). Deck content stays out of the public repo; generator in `fix-kanji-deck/tools/v3/`.
- **D33 (user + agent, 2026-11-04) Review outcome:** 84 cases v3, 4 own decomposition with v3 ranges, 7
  hand-made from the user's notes (失 one drop only; 賭 with Person's parts; 暇 own order, coloured; 喪 十 + two
  mouths + Haarspange; 僅 with Kohl's parts; 籠 strokes 7/16 belong to the dragon; 箋 Bambus + Festwagen).
  Meanings: v3 for 修 and 貧, own for 昭 川 吐. v3 component corrections: 廾 is the book's Blume (→ 艹[Blume*]);
  尤 stays whole ("Chihuahua mit einem Menschenbein", no 尢 + 丶 split); 爾 in 璽 is not split (drops 叕).
  The user asked for primitive decompositions too: 36 multi-part primitive notes get stroke ranges (agent-made
  from numbered stroke sheets); the other 18 list related forms rather than parts and keep their entry. A kanji
  component that is one of those primitives takes the primitive's own decomposition (e.g. 㦮 Festwagen =
  zwei + Straßenfest in 浅 桟 残 銭 践).
- **D34 (user + agent, 2026-11-04) Second check:** primitive parts are split down to their own parts as far as
  the deck allows (part tree from its own note, or from how the kanji trees split that glyph, when the stroke
  counts match; e.g. Marsch → Parade → Straßenfest → Pfeil + Tropfen). User fixes: Erntedankfest/Tröte stroke
  3/5 → Straßenfest, Bergziege 3 → Hörner, Spiegel = stehen + plappernde Zunge + Menschenbeine, Pegasus = Pferd
  1-4 + Truthahn 5-11; Tröte's Klang and Engel's 高 split by hand (a stroke short of the full glyph). v3's split
  of 金 is wrong everywhere: König 3-5+8, Tropfen 6, 7 (34 notes). Check page:
  https://claude.ai/artifact/JUAr4zUsoH7zPPzK1LLLjW (collections `checks`, `checks2`).
- **D35 (agent, 2026-11-04) Phase 5 recovery:** preserve completed proposals and checkpoint new batches.
  Rendering must reject any validation error or missing batch. Component branches beyond six cycle the same
  palette as the tree. The current Codex provider cannot access Claude artifact publishing/DB, so the colour
  review also saves locally and exports fingerprinted JSON; the user can return it for review decisions.
  This changes how decisions are returned, not the requirement to review before applying anything.
- **D36 (user, 2026-11-04; prepared 2026-11-05) Alias-aware second pass:** recognise alternative primitive
  names and contextual images, explicitly Mund for 囗/eingepfercht. Compile a source-linked candidate
  registry from available decks, books and dictionaries first. Preserve the existing 40-batch proposals as
  the starting point. After BOTH usage resets (Claude Nov 4 ~22:21; Codex Nov 5 ~01:32, Europe/Rome), use
  independent batched Claude Opus 5.5 **medium** and GPT-6.1-sol **high** judges. Each field gets a 1–10
  current-quality rating, a 1–10 proposed-annotation confidence and exact comparable component spans.
  Repeat reviews for at least two rounds, up to TEN; target fewer than 150 distinct notes requiring manual
  attention. Only identical annotations at >=9 confidence from both judges without unresolved issues enter
  consensus. Audit 100 consensus notes in round two; changed audits reopen affected component families.
  Preserve disagreements honestly if the limit is not reached. Final user review: PRIVATE Claude artifact,
  grouped/sorted by outcome, bulk approval for resolved groups and manual review only for edge cases.
  Check native Claude artifact availability; do not silently substitute a public site or another model.
  This supersedes sending the old 943-priority-note page straight to the user. Nothing is applied without approval.
- **D24 (agent) Correction:** v3 has no left-hand mode (the analysis listed one by mistake).
- **D25 (user, 2026-11-03) Design switch:** the new v3 design is the default. Plan an option to switch to the old
  minimal design and icons (the fork's look before v3). Scope and open questions: checklist Phase 2b.
- **D27 (user, 2026-11-03) Design switch scope:** the whole design switches (settings, buttons, front, back);
  one global setting; colours: show variants. Also (user): the Primitive tag must never cover or touch other
  elements (keyword pill, other pills, gear) — checked with a bounding-box test at 320–1280 px.
- **D29 (user, 2026-11-03) Colours and tag:** new accent colour "Plain" (UI label "Schlicht", key `plain`,
  black/white). Minimal + Schlicht uses the neutral palette (variant A); minimal + any other accent keeps the
  Japan-Theme colours (variant B). The Primitive tag overlaps the corner of the pill it marks (as before v3), just
  nothing else (keyword pill, other pills, gear).
- **D28 (agent) Long keywords:** v3's title pill grows past its width limit for long one-word keywords (93 in the
  deck with 13+ letters). Title gets `lang=de` + `hyphens:auto`; without a dictionary the font steps down to fit
  (min 15 px). Generic, could go upstream.
- **D30 (agent, 2026-11-03) Minimal tools:** retain semantic component/pitfall colours; use flat surfaces,
  outline player icons, a plain progress line and larger tree/filter touch targets. Danke uses its own star/message
  icons rather than inheriting appearance/speaker icons from the settings menu. No upstream JS/markup changed.
- **D26 (user/agent, 2026-11-03) Title and landscape:** primitive meanings are separate pills next to the keyword
  pill, not chips inside it (user). On the back the landscape sits at the bottom of the page, not of the viewport
  (user); implemented with `.card:has(#kd-info-inline) .forest-scenery { position: absolute }`.

---

## 6. Checklist

Legend: `[ ]` open, `[x]` done, `[~]` in progress, `[!]` blocked (reason in §7). Tick items and add a log entry.

### Phase 0 – Setup & handoff (on the PC, before the move)
- [x] 0.1 Analysis of upstream v3 vs. fork vs. data (§3)
- [x] 0.2 Grill session, decisions D1–D15 (§5)
- [x] 0.3 This plan + `FORK.md` committed and pushed on `t3/reconcile-v3-fork`
- [x] 0.4 Local `AGENTS.md` updated (points here; upstream state; server move)
- [x] 0.5 `fix-kanji-deck`: v3 analysis scripts in `tools/v3/`, private repo github.com/MrM0bi/fix-kanji-deck created and pushed
- [x] 0.6 **User (manual):** move the project to the server. Clone both repos and copy the files from §2
      "Files to copy by hand". Set up Tailscale. Expose AnkiConnect to the tailnet (§2, `tailscale serve`) and
      set `ANKICONNECT_URL` on the server.
- [x] 0.7 Server prerequisites (§2): uv, node 22, chromium, `uv sync` in `fix-kanji-deck`, check
      `ANKICONNECT_URL` with a read-only `version` call

### Phase 1 – Merge upstream
- [x] 1.1 `git merge upstream/main`. Take upstream's version for all conflicted template/CSS files. Keep the fork's
      `.gitignore` lines. Commit the merge (the message lists which fork features are now missing).
- [x] 1.2 `npm ci && npm test` in `Tests/js`, `python3 Tools/build.py --check`. Record the baseline (failures that
      already exist upstream) in §7.

### Phase 2 – Rebuild fork features on v3 (Card 1 + Card 2, src/ where possible)
- [x] 2.1 F1/D2 field mapping (incl. `Nummer` → `Kanjinummer-BuchDE-Edition-4`, `Eselsbrücke` → `Merksatz-KI`)
- [x] 2.2 F9 meaning overrides + F4 primitive chips on both fronts
- [x] 2.3 D3 inline section scaffold on both backs: header, ordered section list, collapse + state, no info
      button/modal for this content. Remove or hide the upstream modal entry point with minimal diff.
- [x] 2.4 Section Elemente: v3 tree (zoom, fullscreen, stroke colouring) inline, F7 primitive handling
- [x] 2.5 Section Strichfolge: player inline, lazy init on first expand
- [x] 2.6 Section Eselsbrücken: D6 boxes + groups (F3, F11), v3 `kd-kw` styling active in all boxes
- [x] 2.7 Section Notiz (F10)
- [x] 2.8 Section Schreibfehler: pitfalls inline, lazy, only with `Stolperfallen`
- [x] 2.9 Sections Wortbeispiele, Lesungen (+ Nanori, F10), Links
- [x] 2.10 F5 Handschriftbeispiele setting (placed on the matching v3 settings subpage)
- [x] 2.11 F6 reveal speed: measure v3, then decide (log the decision)
- [x] 2.12 Font-size map / themes / dark mode / left-hand mode: check that all fork classes follow v3 settings
- [x] 2.13 Tests green (or baseline), `build.py --check` green, update `FORK.md`

### Phase 2b – Option: old minimal design (D25; before Phase 6 so the user tests both)
- [x] 2b.1 Agree the scope with the user. Proposal:
      - a setting "Design: Verspielt (v3) / Minimal" on the "Erscheinungsbild" page, key `kanjiThemeDesign`
        (`kd` / `minimal`), CSS default `--default-theme-design: kd`, applied as `html.kd-design-minimal` by an early
        script (no flicker, like the theme classes)
      - minimal = no landscape scenery, plain background, the pre-v3 flat title (keyword as text, grey primitive
        boxes), plain section cards with the old feather outline icons instead of the pastel badges, plain info tags
      - all v3 features (tree, player, Schreibfehler, colour-coded mnemonics, sound) stay in both designs
      - implementation: fork-only CSS overrides under `html.kd-design-minimal`, and a second icon set in
        `KD_SECTIONS`; no edits to upstream markup
      **User decisions (2026-11-03):** the **whole design** switches (settings modal, buttons, front controls, card
      content); **one global setting**; colours: explore and show the options (v3 themes vs. the old palette).
- [x] 2b.2 Implement (both cards), render-check both designs × light/dark × kanji/primitive. **Completed**
      (`2e105c5`): setting, early class, icon swap (`src/front/kd-fork-design*.js`, `KD_SECTIONS` `ICON_MIN`), CSS
      skin (fork block at the end of `Styling.css`). Colours decided (D29): new accent "Schlicht"; minimal +
      Schlicht = neutral palette, minimal + other accents = Japan-Theme colours (`4941859`).
      Finished the v3 tools: outline player controls/plain progress, flat Schreibfehler surfaces, tree toolbar,
      sound options and Danke (including correct rating/feedback icons). Category/stroke colours stay semantic.
- [x] 2b.3 Tests, `build.py --check`, `FORK.md`

### Phase 3 – Headless verification
- [x] 3.1 Test collection on the server from the user's `.apkg` (`fix-kanji-deck/tools/setup_test_anki.py`,
      adjust hard-coded paths, e.g. `KANJI_DRAW_ADDON`)
- [x] 3.2 Render harness: real notes (kanji e.g. 一 右 語 派 籠, primitive e.g. `[spazierstock]`) × Card 1/2 ×
      front/back in headless Chromium. Screenshots, console errors, timings.
- [x] 3.3 Same measurement for pure upstream v3 (baseline for the +50 ms budget; cold vs. reused-view results in §7)
- [x] 3.4 Fix what's found. Add a short how-to for the harness to this file.

### Phase 4 – Data migration (scripts in `fix-kanji-deck`, dry run / `--apply` / `--undo`, value check, backup)
- [x] 4.1 Field-add script (`Stolperfallen` after `Radikale`, `Merkhilfe` after `Merksatz-KI`) via AnkiConnect
      (`modelFieldAdd`/`modelFieldReposition`)
- [x] 4.2 Import `Stolperfallen`, `Merkhilfe`; overwrite `Merksatz-KI` for kanji (D5)
- [x] 4.3 Radikale merge: glyph → name table, auto group, review group, primitives `@1-n`
- [x] 4.4 Review page: Radikale + Bedeutung + SVG + 篭/籠 + 誓/斬 (D7) → **user review** (done 2026-11-04,
      see D33; 誓/斬 needs none, see D31)
- [x] 4.5 Apply the review decisions in the test collection. Verify the tree and stroke colouring render.

### Phase 5 – Colour-coding (D8)
- [x] 5.1 Agents propose `kd-kw` spans for Merksatz-DE, BuchBeschreibung, BuchPrimitivBeschreibung (batched,
      JSON out), plus name alignment inside the Merksatz-KI spans
- [~] 5.2 Alias-aware two-judge panel (D36), then grouped private Claude artifact → **user review**.
      Prior 40-batch proposals are the starting point; user is not asked to review the old 943-case queue.
      Radikale issues found → back to 4.4.
- [ ] 5.3 Apply in the test collection, render-check

### Phase 6 – Test switch-over (user)
- [ ] 6.1 **User:** `KanjiTest` profile with the `.apkg`. Agent applies Phase 4/5 + templates there via
      AnkiConnect (profile must be open).
- [ ] 6.2 **User:** manual test on Windows Desktop + Android (AnkiDroid). Check cold-load cost, answer latency/flicker and
      handwriting fonts as well as features/designs; collect feedback → fixes.

### Phase 7 – Real switch-over (user OK + backup before each step, D11)
- [ ] 7.1 Add fields → 7.2 data scripts → 7.3 templates + CSS → 7.4 verify → 7.5 user syncs (full sync upload)

### Phase 8 – Release
- [ ] 8.1 Fold this file into `FORK.md`, remove `docs/fork/v3-migration.md`, update the local `AGENTS.md`
- [ ] 8.2 **User consent** → PR `t3/reconcile-v3-fork` → `main`, merge

### Phase 9 – Later
- [ ] 9.1 Setting to hide/reorder back sections (D15)

---

## 7. Current state / next step

_Update this section before you stop._

- **State (2026-11-05, server):** Phases 0–4 done. The real collection is untouched (still pre-v3
  templates/data). Final change files: `fix-kanji-deck/work/v3/out/changes_0{1,2,3}_*.json` from
  `work/v3/p4/decisions_user.json` (2 fields, 6599 imports, 2346 Radikale, after D34).
- **4.5 run (2026-11-04):** fresh profile `fix-kanji-deck/work/anki-p45` (2026-11-03 export): apply 01→02→03,
  0 failed; branch templates installed in the copy; Anki-rendered trees of the 7 hand-made cases, 昔 浅 稽 璽
  and 4 primitives, no JS errors; undo of all three → cards, revlog, flags and notes identical to the baseline.
  Repeated after D34 on `work/anki-p46`: same result (鏡 観 金 [marsch] [spiegel] [tröte] rendered).
- **Next:** run the independent alias-aware panel (D36) from private `tools/v3/panel/COORDINATOR.md`.
  Exact task metadata, source hashes, votes and convergence history stay in `work/v3/panel/run/`.
  Both stated reset times have passed. Both b01 pilots passed and the pilot gate is released.
  Pilot: 223/252 identical annotations; 199 meet consensus criteria, 53 fields on 32 notes need later panel
  review. Both recognise Mund for 囗 and retain valid original alternatives. Continue with at most two
  active batches per judge.
  Halfway checkpoint 2026-11-05 08:38 CET: 40/80 first-round votes validate (Claude b01–b22,
  GPT b01–b18), covering 9638 field votes. GPT b10/b11 recovered fully from saved checkpoints after the
  reported 06:32 reset; no failed jobs remain. Same input hashes and exact requested models/settings.
  Per-judge reset holds prevent dispatch before future resets. Task/attempt details stay in private state.
  Continue first-round dispatch; do not advance before all 80 votes validate. No final consensus/manual
  count exists yet, and this checkpoint is not a user-review assignment.
  Frozen inputs cover 2363 notes / 9411 nonempty fields. Alternative-name catalogue:
  `work/v3/panel/aliases/alternatives.md` / `.csv`, full `registry.json`, provenance `sources.md`.
  It contains 3829 German candidates, 43414 multilingual names / 4324 forms; 31 source entries include one
  unavailable endpoint. Candidates are contextual evidence, not unconditional equivalences.
  Eleven panel tests and eight existing checker regressions pass. A changed audit or uncertain verdict cannot
  silently become consensus. Final delivery requires a private Claude artifact and <=149 manual notes,
  subject to the honest ten-round failsafe. Real Anki remains untouched.
- **Preserved Phase 5 baseline:** all 40 batches validate: 2363 notes, 12363 spans, 1400 aligned fields.
  `work/v3/p5/review.html` displays 2360 notes; three unchanged omitted. Its 943 priority notes / 495 explicit
  warnings are input to the new panel, not a manual-review assignment. No Phase 5 proposals have been applied.
- **Phase 5 artifacts/checks:** task ids and input/proposal hashes in private `work/v3/p5/recovery_manifest.json`
  and `validation_report.json`; counts/review fingerprint in `review_summary.json`. Complete-page Chromium
  checks passed at 390/1100 px, light/dark: search, unchanged-context warnings, decision save/reload and actual
  JSON download. Packed-page decompression, complete dataset id, search, decisions/reload also passed.
  T3 screenshot preview is blocked by host AppArmor; no host configuration was changed. The standalone HTML
  remains available if the inline viewer is unavailable. Full instructions: private `tools/v3/README.md`.
- **Phase 4 test run (2026-11-04):** fresh profile `fix-kanji-deck/work/anki-p4` from the 2026-11-03 export,
  test decisions = all recommendations. Dry run → apply (2 fields, 6597 imports, 2309 Radikale; 0 failed) →
  branch templates installed in the test copy, Anki-rendered 語 学 派 六 掛 [spazierstock] both cards: tree +
  stroke colouring, no JS errors → undo of all three → cards, revlog (13154), flags (17) and all 2363 notes'
  fields identical to the baseline. (The review-case ranges were remapped differently in that run; the
  mechanical 2214 are unaffected. 4.5 repeats the run with the real decisions.)
- **Field order after 4.1:** `Merkhilfe` after `Merksatz-KI` (position 9), `Stolperfallen` after `Radikale`
  (position 25). Adding fields forces a one-way full sync (upload from the desktop), see D11.
- **Cold-load timing (2026-11-03):** Chrome 136, 412 px, 16 alternating rounds (first discarded), fresh
  contexts, upstream `b853acf` vs. fork `c468b4c`. Median paired first-frame differences (fork minus upstream):
  学 C1 **+61.6 ms**, 学 C2 **+176.8 ms**, 語 C1 **+97.3 ms**, 語 C2 **+106.4 ms**. All exceed +50 ms;
  this run does **not** clear the performance gate. Server load peaked above 11 on four cores. Script intervals
  vary greatly too (they include descheduling); no claim that the differences are only server noise. A simulated
  reviewer flip in a reused WebView is measured separately, since a cold navigation includes work before the answer.
- **Simulated reviewer flip timing (2026-11-03):** same Chromium, four fixtures, 12 alternating rounds
  (first discarded). Load the front, settle for 400 ms, replace `#qa` with the back and execute inline scripts
  in the same context; measure the next animation frame. No JS exceptions in 96 front→back cycles. Median paired
  first-frame differences: 学 C1 **−18.5 ms**, 学 C2 **+15.4 ms**, 語 C1 **−19.2 ms**, 語 C2 **+12.6 ms**.
  These headless **median** differences are within +50 ms. They do not prove a worst-case bound or native
  Qt/AnkiDroid performance. Keep the cold-load result as a Phase 6 risk; don't dismiss it as noise.
- **Approval still required later:** after the panel, the user reviews the grouped private artifact. Phase 5.3
  applies approved changes only in an isolated collection. Actual device testing waits until Phase 6.
  The panel can proceed autonomously now; the old review page is superseded by D36.
- **Render harness (private, uses deck content):** `fix-kanji-deck/tools/v3/render_cards.py`. Inputs:
  `/tmp/kd-apkg/mine_samples.json` (user notes via read-only AnkiConnect `notesInfo`), `/tmp/kd-apkg/v3.json`
  (v3 `.apkg` notes via sqlite), the three handwriting fonts copied next to the output pages (`retrieveMediaFile`).
  It simulates the post-migration fields (v3 `Stolperfallen`, `Merkhilfe`, `Merksatz-KI` <- `Eselsbrücke`,
  `Radikale` <- v3 until Phase 4) and drives `/usr/bin/google-chrome` through Playwright:
  `uv run --with playwright python -I render_cards.py <repo> <samples> <v3> <outdir> --only 語 --ls '{"kdSec_strichfolge":"0"}' --js "…" --viewport-shot`.
- **Functional verification (2026-11-03):** 240 card variants passed across ten notes × four sides × six
  design/mode/accent/width cases. No console errors or horizontal page overflow. Checks cover design icon restore,
  lazy player/pitfalls, autoplay/pause/step/speed/close, pitfall filters, handwriting visibility, tree fullscreen,
  sound/Danke navigation. Additional pointer tests on 語, C1/C2, both designs passed component stroke spotlight
  and zoom. Checked representative tool/settings screenshots at 320/1100 px.
- **Isolated Anki verification (2026-11-03):** fresh profile made from the November 3 export (2363 notes,
  4726 cards), separate from the older `.anki-test`. Anki 26.5 backend accepted the 30-field test model and
  rendered 40 sample sides after simulated v3 fields/templates were installed in that copy. SHA-256 digests of
  all `cards` and `revlog` rows stayed identical. Eight actual Anki-rendered sides (語 + primitive, C1/C2,
  front/back) also loaded without JS exceptions in Chromium. This does **not** replace Windows Qt/Android testing.
- **Repeatable checks (private tooling):** `fix-kanji-deck/tools/v3/README.md` documents the render,
  interaction and timing helpers. From an empty directory, with real sample JSON kept outside the public repo:
  1. `uv run --with playwright python -I <tooling>/tools/v3/render_cards.py <repo> <samples.json> <v3.json> <out>/cards --no-shot`.
     Copy the three handwriting fonts beside those pages. `--upstream` and a separate upstream template snapshot
     generate the baseline (only 学/語, `--sides c1_back,c2_back`).
  2. `uv run --with playwright python -I <tooling>/tools/v3/verify_rendered.py <out>/cards --cases 0,1,2`,
     then `--cases 3,4,5`. Six cases cover both designs, light/dark, neutral/coloured accents and 320/1100 px.
     All ten sampled notes, both card types, both sides. JSON/screenshot output stays private.
  3. Run `benchmark_rendered.py <upstream-cards> <fork-cards> <out>/benchmark` after other render jobs end.
     Alternating order, 16 rounds, first discarded; record inline-script duration, first frame after parsing and
     `loadEventEnd` separately. `--resume` continues saved progress if the command runner times out. Also run
     `benchmark_flip.py <upstream-cards> <fork-cards> <out>/flip` with front AND back inputs to simulate the
     reviewer lifecycle. The cold and flip measurements answer different questions; retain both.
  4. A fresh isolated collection can be made with `tools/setup_test_anki.py --base <new-directory> --apkg <latest-export> --kanji-draw-addon <repo>/Addon`.
     Never reset an existing test profile or use the old default export for the v3 check.
- **Environment (server):** repos in `~/Repos/kanji-draw-anki` and `~/Repos/fix-kanji-deck`. `ANKICONNECT_URL` is
  a fish universal variable; bash subshells don't see it, so read it with `fish -c 'echo $ANKICONNECT_URL'` and
  export it. `version` answers 6 over Tailscale. Python 3.14 system, `uv sync --group anki --group analysis` in
  `fix-kanji-deck` works.
- **Test baseline:** `npm test` 11/11 files pass, `Tools/build.py --check` ok, `Tools/check_scripts.py` ok.
  **Flaky:** `test_algorithms.js` timing checks ("< 2ms", "< 3ms") sometimes fail when `node --test` runs files in
  parallel on the loaded 4-core server. They pass alone. Not a regression.

---

## 8. Progress log

Newest last. One entry per finished item or session: date, agent/machine, what, commit.

- 2026-11-03 · Claude (PC/WSL) · Analysis + grill session, plan and FORK.md written (0.1–0.4).
- 2026-11-03 · Claude (PC/WSL) · Private repo MrM0bi/fix-kanji-deck created and pushed with `tools/v3/` (0.5). User decided: no AnkiConnect API key, use Tailscale only.
- 2026-11-03 · Claude (server) · 0.6/0.7 verified (repos, files, AnkiConnect over Tailscale, uv, node 22). Merged upstream v3.0.0, conflicts taken from upstream (1.1, `edf1045`). Baseline recorded (1.2).
- 2026-11-03 · Claude (server) · Phase 2: field names (2.1), overrides + chips (2.2), inline sections with tree, player, Eselsbrücken groups, Notiz, Schreibfehler, Lesungen/Nanori, links (2.3–2.9, `faece31`), Handschriftbeispiele (2.10), reveal speed + font-size map (2.11/2.12), FORK.md (2.13). Decisions D16–D24.
- 2026-11-03 · Claude (server) · 3.3 first timing run, inconclusive because the server was under load (numbers in §7).
- 2026-11-03 · Claude (server) · User feedback: primitive pills separated from the title pill, landscape at the page bottom on the back (`27927b4`). Planned the minimal-design option (D25, Phase 2b).
- 2026-11-03 · Claude (server) · Primitive tag clearance + long keywords (`ff8e9da`). Minimal-design prototype (`2e105c5`), colour variants A/B rendered for the user.
- 2026-11-03 · Claude (server) · Accent "Schlicht" + palette rule (D29), tag back on its pill's corner, minimal fixes.
- 2026-11-03 · Claude (server) · Minimal + coloured accent: primitive pills are surface-coloured with a theme border instead of grey (user found the grey odd; compared 4 options).
- 2026-11-03 · Claude (server) · Primitive tag lifted up/right: covers only the pill edge (3px), attached to the top-right pill (user).
- 2026-11-03 · Claude (server) · v3-design tag overlaps the pill edge (~7px); design options renamed "Verspielt" / "Minimal" (user asked for e.g. "Cute"; German label chosen).

- 2026-11-03 · Codex (server) · Finished the Minimal skin for v3 tools and settings (2b.2/2b.3, `c468b4c`); isolated latest-export Anki collection imported (2363 notes, 4726 cards), rendered 40 sample sides through Anki backend, card/revlog hashes unchanged.

- 2026-11-03 · Codex (server) · Phase 3: 240 card variants passed; component spotlight/zoom and Anki backend output checked. Paired cold loads exceeded +50 ms; reused-view flip medians stayed within it (details §7). Native device/cold-load validation remains Phase 6. Repeatable helpers committed to private tooling (`b0faf5a`, `75199ba`). Next: Phase 4.
- 2026-11-04 · Claude (server) · Phase 4.1–4.3 tooling (`fix-kanji-deck` `eaf7beb`, `65ed7ed`), tested apply/undo on a fresh test profile; review page published (4.4), waiting for the user.
- 2026-11-04 · Claude (server) · User review applied (D33): custom trees, v3 corrections, 36 primitive decompositions (`fix-kanji-deck` `278113f`); 4.5 test apply/render/undo clean. Next: Phase 5.
- 2026-11-04 · Claude (server) · Second check (D34): deep primitive trees, user fixes, 金 split corrected (`fix-kanji-deck` `a36e21a`, latest); final test apply/render/undo clean on `anki-p46`. Next: Phase 5.

- 2026-11-04 · Codex (server) · Resumed interrupted Phase 5: preserved 19 proposal files, repaired validation/typos, added fail-closed rendering, palette cycling and portable decision export. Seven checker regressions and mobile light/dark save/export/reload/search/correction checks pass. Twenty-one batches still need completion; recovery manifest tracks them.

- 2026-11-04 · Codex (server) · First replacement batch `b40` validated (23 notes, 65 spans). Fixed review generation so an uncertainty without proposed marks remains visible with unchanged context; 8 checker/generator regressions pass. Other replacement workers continue; task ids remain in the private recovery manifest.

- 2026-11-04 · Codex (server) · All 40 colour batches validate (2363 notes, 12363 spans, 1400 aligned fields). Complete review and packed inline version built/tested; user review is next (5.2), before any test-collection apply (5.3). Full counts and caveats are in §7; live Anki remains untouched.

- 2026-11-05 · Codex (server) · Prepared source-linked alternative names and the persistent two-judge panel
  (D36). Frozen 2363-note/9411-field inputs; nine panel and eight existing checker tests pass. Both requested
  reset times passed. Next: b01 pilots with exact requested models/settings, followed by repeated batched
  review and a private Claude approval artifact. No collection writes.

- 2026-11-05 · Codex (server) · Both b01 pilots validate (60 notes / 252 fields each); 223 identical outputs,
  199 high-confidence issue-free agreements. Pilot gate released for the remaining first-round batches.
  Claude reports native Artifact publishing available; owner-only publication remains to verify at delivery.

- 2026-11-05 · Codex (server) · Ingested Claude b10/b11 (240/239 fields). Recovered interrupted GPT b10/b11
  checkpoints after the reported 06:32 reset; added safe retry IDs, attempt history and per-judge reset holds.
  Eleven panel and eight checker tests pass. All work remains proposed; no collection writes.

- 2026-11-05 · Codex (server) · Halfway through first-round judging: 40/80 batch votes validate, 9638 field
  votes. Both interrupted GPT batches recovered fully; exact judges/settings unchanged. Continue from
  private coordinator state. No collection writes or user approval requested at this interim stage.
