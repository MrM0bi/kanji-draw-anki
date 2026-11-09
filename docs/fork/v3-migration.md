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
- **D37 (agent, 2026-11-05) Comparable repeat reviews:** first-round differences include harmless
  span-length choices. From round two, use whole inflected words and meaningful compound image units;
  preserve concrete component identities and first clear mentions. Confidence below 9 needs a specific
  competing interpretation or missing evidence, not merely a changed mark or documented alternative name.
  Thresholds remain unchanged; agreement alone is not evidence. Freeze each round's instructions with
  its input hash and reject changed protocols. Preserve the original first-round instructions/votes.
- **D38 (agent, 2026-11-06) Audit scope and third-round conventions:** a keyword-only audit disagreement
  must not reopen unrelated stable component families. Reopen changed or explicitly questioned identities;
  preserve evidence-backed uncertainty scopes, fail closed when those are unknown, and keep every failed
  audit field pending. Do not change votes or confidence thresholds. From round three, mark the first clear
  mention of each distinct keyword meaning, repeated synonyms once; primitive self-names use keyword
  colour, genuine constituents keep their identities. Resolve shared keyword/component occurrences by
  explicit sentence role, and prefer the keyword only when the role is indistinguishable. Whole specifically
  documented image names retain their inflections; other compounds use the meaningful lexical unit.
  These formatting conventions do not erase genuine semantic/tree uncertainty. Preserve earlier frozen rounds.
- **D39 (agent, 2026-11-06) Accepted-vote integrity:** automatic quota retries can resume superseded children.
  Stop old attempts before retrying, check assignment ownership before each child write, and archive/hash
  accepted raw outputs. Refuse changed duplicate ingestion. Preserve stale writes separately and restore
  counted results from accepted snapshots or retained normalized annotations, without changing votes/scores.
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
- [x] 5.2 Alias-aware two-judge panel (D36/D40/D41) → **user review**, completed 2026-11-08 via the
      local HTML export (native Claude Artifact unavailable). Exact decisions imported; see D42.
      Prior 40-batch proposals are the starting point; user is not asked to review the old 943-case queue.
      Radikale issues found → back to 4.4.
- [x] 5.3 Approved changes applied/verified/undone/reapplied in a fresh test collection; 224 card variants pass (D42).

### Phase 6 – Test switch-over (user)
- [x] 6.1 **User:** imported the prepared, isolated Phase-4/5 test package and provided Windows feedback
      (November 8). No real-collection or AnkiConnect writes were needed.
- [~] 6.2 **User:** manual test on Windows Desktop + Android (AnkiDroid). Check cold-load cost, answer latency/flicker and
      handwriting fonts as well as features/designs; collect feedback → fixes.
      Windows UI and mobile title accepted; user reports comparison/full strokes appear to work on AnkiDroid (D51).
      Audio parked (D46). Remaining end-to-end Phase 6 coverage has not been explicitly confirmed.

### Phase 7 – Real switch-over (user OK + backup before each step, D11)
- [x] 7.0 Live preflight, fresh-backup apply/undo/reapply and 320 browser variants passed (D52/D53).
- [x] 7.1 Add fields, 7.2 approved data scripts, 7.3 templates/CSS and 7.4 live verification (D54).
- [x] 7.5 User confirms mobile sync completed; handwriting fonts display correctly after media download (D55).

### Phase 8 – Release
- [ ] 8.1 Fold this file into `FORK.md`, remove `docs/fork/v3-migration.md`, update the local `AGENTS.md`
- [ ] 8.2 **User consent** → PR `t3/reconcile-v3-fork` → `main`, merge

### Phase 9 – Later
- [ ] 9.1 Setting to hide/reorder back sections (D15)

---

## 7. Current state / next step

_Update this section before you stop._

- **State (2026-11-09, server):** Phases 0–5 and live steps 7.1–7.4 are done. Windows UI feedback
  (D43/D44/D45), mobile title/default and comparison/stroke fixes (D48/D49/D50) are installed on the real
  study profile after explicit user approval (D54), mobile sync completed (D55). Audio remains parked (D46).
  D56's faster title/pill reveal (D57) and three user-selected missing parents (D58) are installed and
  verified after separate fresh-backup approvals. No agent sync was performed for either follow-up.
  The user authorized feature-scoped local Conventional Commits for the current template-branch state
  (D59/D60), without pushing or including the separate private tooling repository. Further live writes and repository release
  (Phase 8) need separate consent.
  Final change files: `fix-kanji-deck/work/v3/out/changes_0{1,2,3}_*.json` from
  `work/v3/p4/decisions_user.json` (2 fields, 6599 imports, 2346 Radikale, after D34).
- **4.5 run (2026-11-04):** fresh profile `fix-kanji-deck/work/anki-p45` (2026-11-03 export): apply 01→02→03,
  0 failed; branch templates installed in the copy; Anki-rendered trees of the 7 hand-made cases, 昔 浅 稽 璽
  and 4 primitives, no JS errors; undo of all three → cards, revlog, flags and notes identical to the baseline.
  Repeated after D34 on `work/anki-p46`: same result (鏡 観 金 [marsch] [spiegel] [tröte] rendered).
- **Next (D60):** the user confirms the D58 changes worked; missing-parent review is complete:
  3 approve / 37 keep, nothing undecided. Only the
  three selected groups and their necessary colour-class corrections are installed and verified; see D58.
  No further audit rounds are requested. User can preview/sync the follow-ups; repository release remains
  separately unapproved. The current source/test/documentation state is captured in the feature-scoped
  D60 commit series; no push is requested. User confirmed earlier mobile sync/fonts in D55. The real model still has 30
  fields / 2363 notes; its data baseline is D54 plus the separately approved 05 parent/colour patch.
  All four live templates/CSS exactly match the tested working tree after D57 and are unchanged by D58.
  Note/card IDs, tags, card modification
  times, flags, suspension/burial state and checked review history are unchanged. Recovery snapshots and
  receipts are private. This scoped write authorization is complete; further writes and repository release
  require new user instruction/approval. Never import an old KanjiTest package into the study profile.
- **Remaining Phase 6 coverage:** native-device checks use the isolated test package and NEW Windows
  `KanjiTest-v7` profile. User reports the comparison/full-stroke fixes appear to work on AnkiDroid (D51);
  keep the current package and do not repeat that diagnosis unless a new issue appears. Audio investigation is parked at the user's request (D46),
  since Piano seems unaffected; do not start a Windows agent session unless requested.
  Android setup and a three-note preview checklist are ready in private
  `work/v3/panel/approved-20261108/AnkiDroid-v3-Kurztest-20261108.md` (D47): official Parallel.A/B,
  separate empty collection directory, no AnkiWeb login; updated to Feedback6 for comparison and SVG loading. User confirms the prior title fix.
  The first package and its proofs stay archived. Acceptance does not replace the remaining coverage of both
  card directions/designs/themes and Android device checks.
  Test instructions: private `work/v3/panel/approved-20261108/KanjiTest-Feedback6-README.txt`. The package contains
  the November 3 study snapshot, so never import it into the real profile or sync it to the real AnkiWeb account.
  The isolated Linux test is complete; it does not substitute for Windows Qt/AnkiDroid testing. Plan the
  Android check safely after the Windows result. The approved live switch-over is completed in D54;
  old test copies remain isolated, and further live changes require fresh approval and backup.
- **Approved Phase 5:** returned review export fingerprint and all 9411 choices verified. 5260 field edits
  on 2363 notes; 4151 approved fields already match post-Phase-4 data. Change file:
  `fix-kanji-deck/work/v3/out/changes_04_colours.json`, applied after 01/02/03. Original decision export,
  approval manifest, checksums and verification are in `work/v3/panel/approved-20261108/`.
  No votes/scores/trees/content were independently revised. Known imperfections retained per user choices.
- **Full migration verification:** fresh `work/anki-p5-approved-20261108-final`: 2 new fields, 6599 imports,
  2346 Radikale and 5260 colour edits. Exact-old dry runs, apply/verify, idempotence, complete reverse undo,
  then reapply. Cards/revlog unchanged throughout; undo restored all note fields and tags too.
  56 Anki-backend rendered sides, 224 Chromium variants across both designs/light/dark/320+1100 widths,
  plus 16 explicit visible-colour checks. Package round trip preserves all fields, templates, 30-field model,
  2363 notes/4726 cards/13154 reviews and three handwriting fonts.
- **Panel history:** six completed rounds, 204 accepted votes with hash archives; final recommendations
  were 8842 fields at >=9, 155 at exactly-8 minimum and 414 unresolved fields on 323 notes. User D41
  stopped repetition and waived the <=149 cap; November 8 export resolves every field, no deferrals.
  Counts/scores remain historical evidence, not rewritten by user choices. Native Claude Artifact tools
  unavailable in OpenCode; local review was clearly labelled, nothing published elsewhere.
  Alias registry: 3829 German candidates/31 source entries (one unavailable), in private panel/aliases/.
- **Preserved Phase 5 baseline:** all 40 batches validate: 2363 notes, 12363 spans, 1400 aligned fields.
  `work/v3/p5/review.html` displays 2360 notes; three unchanged omitted. Its 943 priority notes / 495 explicit
  warnings are input to the new panel, not a manual-review assignment. The approved panel successor has now been applied in the isolated test only (D42).
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
  (position 26, corrected multi-add indexing in D42). Adding fields forces a one-way full sync (upload from the desktop), see D11.
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
- **Approval state:** user review and isolated Phase 5.3 are complete (D42); the explicit scoped live
  migration was authorized and verified in D54. Actual-device feedback is recorded in Phase 6. User
  confirmed mobile sync in D55. Further live edits and Phase 8 release require new approval. No further judge rounds.
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

- 2026-11-05 · Codex (server) · Recorded Claude b23/b24 (233/237 fields), bringing validated votes to 42/80.
  After the user-requested wait until the reported 13:03 Codex reset, resume GPT b19/b20 from complete
  validated drafts for their remaining checks. Failure histories and snapshots preserved; no collection writes.

- 2026-11-05 · Codex (server) · Recorded GPT b27, bringing validated first-round votes to 60/80. After the
  reported 18:04 Codex reset, resume saved GPT/Claude checkpoints. Claude's unspecified API rate limit is
  handled with one retry first; the other judge keeps its slots. Twelve panel and eight checker tests pass.

- 2026-11-05 18:28 CET · Codex (server) · Claude first-round coverage complete: 40 batches / 9411 fields validated.
  Total 73/80 votes; seven GPT votes remain before comparison and repeat rounds. No collection writes.

- 2026-11-05 · Codex (server) · 76/80 votes validate. Preserved the complete interrupted GPT b37 draft and
  enabled a one-shot resume at 23:05 CET after the reported reset; gpt dispatch held until then. No active
  task polling, model fallback or collection writes. GPT b38 can still deliver its completion independently.

- 2026-11-05 · Codex (server) · Recorded the subsequent GPT b38 quota failure (no checkpoint). The same
  enabled 23:05 CET continuation covers both failed jobs; no duplicate schedule or early dispatch.

- 2026-11-05 · Codex (server) · User used a reset token and requested immediate continuation. Disabled
  the old timed resume and lifted the hold; renewed retry IDs for b37/b38 with preserved history/drafts.

- 2026-11-05 19:03 CET · Codex (server) · All 80 first-round votes validated and compared; round two prepared
  with unresolved fields plus a 100-note agreement audit. Froze round instructions and clarified harmless
  span conventions (D37); 13 panel and 8 checker tests pass. No manual review or collection apply yet.

- 2026-11-05 19:15 CET · Codex (server) · Four round-two votes validate. Preserved eight concrete protocol
  objections for a future formal round where literal-first rationales skipped earlier clear meanings.
  Original votes and active frozen inputs remain untouched; objections are questions, not votes.
  Fourteen panel and eight checker tests pass. No collection writes or manual review requested.

- 2026-11-06 00:02 CET · Codex (server) · Nine round-two votes validate. Resume two ten-note GPT checkpoints
  after the reported 23:39 reset; preserve exact judges/settings and immutable active inputs.

### D40 – User-authorized judge and threshold change (2026-11-07)

Claude reached its weekly limit. Remaining panel work uses Haiku 5.5 through OpenCode at high
(`openrouter/anthropic/claude-haiku-5.5`, variant high), paired with GPT-6.1-sol high. Historical Opus
votes retain their actual provenance; the legacy `opus` slot ID is retained for schema continuity.
The old Claude retry timer is disabled. Round five is 15/18 votes accepted; Haiku completes b07–b09.
Round five still requires >=9 from both judges. Starting round six, the user authorizes >=8 from both,
with exact annotation agreement, no issues and no uncertain verdicts still required. Final private report
must clearly separate agreements with either judge at 8 from agreements with both >=9, including separate
bulk approval groups. State records the effective-round schedule; comparison writes `report_groups.json`.
No historical vote/score or frozen r01–r05 protocol/input is changed. Twenty-one panel and eight checker
tests pass, including threshold timing, group separation, unchanged blocker checks and provider selection.
Final private Claude Artifact delivery is still required; availability must be checked when ready.

- Round five completed (2026-11-07): 18/18 votes validate, 639 fields / 489 notes per judge. 425 exact
  matches; 60 meet its unchanged >=9 rule. Consensus is now 8832/9411 fields. All 188 accepted archive
  hashes verified. Round six is frozen at 579 fields / 446 notes, 16 jobs, threshold >=8 from both judges.
  Haiku 5.5/OpenCode high replaces the legacy Opus slot; GPT-6.1-sol high remains unchanged. Nine original
  audit cases remain in judge work. Separate report groups currently contain 8832 agreements at 9-plus
  and none at 8; round-six comparison may populate the latter. New frozen protocol SHA256:
  54bd15cadca9eebe539d071740c470d558731ce9744f9c44bfac89083c85a820. No historical scores changed.

### D41 – Stop repetitions after round six (user, 2026-11-07)

Finish round six, then present the planned private review. The user waives the <=149-note cap and
accepts more manual cases; prioritize a quick process through separate >=9 and confidence-8 bulk groups,
recurring-decision groups and individual edge cases. Do not launch round seven. Preserve all unresolved
fields, scores, issues and audit concerns. At 14/16 validated votes, final Haiku b08 and GPT b08 recovery
remain. GPT reported reset 20:42 CET has passed; 26-note checkpoint/snapshot preserved. No Anki writes.

### Final panel handoff (2026-11-07)

Round six completed, all 16 votes valid and all 204 accepted raw archive hashes verified. 379 exact matches;
165 new agreements at the authorized >=8 threshold. Final: 8842 fields at >=9 from both, 155 agreements
involving exactly 8, 414 unresolved fields across 323 notes. The user waived the 149-note target; no round
seven was created. Eight original audit fields remain explicit unresolved cases. Recurring open categories:
124 same-but-uncertain, 58 keyword-only differences, 99 component/text-base differences, 133 tree/content
blockers. Note counts overlap across categories. 1349 consensus fields on 689 notes restore source wording.

Local review generated in private `work/v3/panel/final-review/` (HTML, full JSON, summary, findings and
instructions), packaged as `work/v3/panel/kanji-abschlusspruefung.zip`. Separate >=9 / confidence-8 bulk
approvals; optional explicit approval of same-but-lower-confidence proposals; per-note/field choices, defer,
local saving, export/import. Nothing preapproved, no live Anki writes. All fields covered exactly once.
22 panel tests, 8 checker regressions and decision-logic/coverage checks pass. Browser visual preview is
blocked by host AppArmor, so no claim of real-browser visual verification. Native Artifact/ArtifactData
publishing is unavailable through OpenCode (final child metadata inspection); this is a local-only delivery,
not a published Claude Artifact. No substitute host used. Await user's exported decisions; actual collection
apply still needs explicit consent and backup. No commits or pushes made for this work.

### D42 – User decisions imported; isolated migration complete (2026-11-08)

The user returned the final review JSON and accepted remaining imperfections for now. Validated the exact
review id, all source/candidate/annotation signatures, bulk groups and individual overrides. Preserved the
original export (SHA256 bb8cb7f770a794bc63833a05456849b380c2b948f10e241a155efc369d2abf13).
All 9411 fields resolved, no deferrals. Explicit choices are 127 Claude, 34 GPT and 132 current; bulk approvals
supply the rest. General feedback favouring Claude is recorded, not used to override any explicit decision.
Generated 5260 field changes (2341 Merksatz-DE, 2331 BuchBeschreibung, 127 BuchPrimitivBeschreibung,
391 Merksatz-KI, 70 Merkhilfe), with exact expected post-Phase-4 old values. Review-only <mark> markup is
never applied; the official renderer regenerates Anki kd-kw spans and validates each reviewed signature.

A generic `fix_deck.py` bug calculated the second new field's index before the first insertion; planning now
simulates prior additions and apply recalculates relative to the named predecessor. A regression proves both
fields land correctly. Fresh full apply/undo/reapply succeeds with all scheduling/flags/revlog hashes intact.
224 Chromium variants and 16 visible-colour checks pass; package re-import preserves all fields/templates,
counts, history and fonts. 22 panel + 5 approval/schema + 8 checker tests pass; build --check/script checks pass.
Test-only package is ready at `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-20261108.apkg`, SHA256
891c43bf045db221e4d7d45759457ab3c32ccc61c72388da22f1dbb810263362. Next is a NEW Windows KanjiTest
profile/device check, not live apply. No real collection access/writes, commits, pushes or new judge rounds.


### D43 – Windows UI feedback and audio stability (user, 2026-11-08)

The user likes the first test package and requests back-section order, a translated tree-root label,
furigana spacing, KanjiDraw/Nanori switches, the old handwriting/reference comparison, appearance-icon
corrections, and neutral Minimal surfaces with an independently chosen accent. Implemented in both card
settings/shared back sources; the drawing comparison is Card 1 free mode, matching the pre-v3 feature.
Defaults keep KanjiDraw/Nanori visible and restore the comparison. Existing scoped settings remain compatible.
The comparison uses the current evaluator/styles, with stroke numbers and extra/missing-stroke toggles.

Minimal retains neutral surfaces regardless of accent; Schlicht is simply the monochrome accent. Menus,
sections and 49 settings choices use their classic outline icons where available. The Minimal selector uses
theme text colour, and the Schlicht swatch clips the dark half without pale top/left edges. The root uses
Bedeutung-Override / Bedeutung-DE and the same SVG pill layout as its children. Primitive behaviour is unchanged.

Windows audio is procedural Web Audio, not Anki's normal recorded-file player. A delayed live scheduler could
submit a bar up to 200ms in the past. Audio 1.2.1 skips overdue bars with a 50ms lead and requests `balanced`
output latency on Windows (`interactive` elsewhere). Both are narrow generic changes; the browser may ignore
the latency hint, and actual Windows driver/Qt playback has not been measured here. Lofi also deliberately
contains vinyl clicks. No claim that the user's hardware crackling is definitively fixed.

Verification: build/syntax checks, 11 original Node suites plus 10 real-module audio regressions, 224 Chromium
card variants, 12 focused interactions, and five 20-second offline genre renders without clipping/NaNs. The
concurrent Node run hit the already documented <2ms timing flake; serial execution passes. Screenshots were
visually inspected for root labels, responsive comparison and light/dark appearance settings. This covers the
requested layout, colour, icon and spacing changes; actual device rendering/audio remain Phase 6.

Updated isolated copy: private `work/anki-v3-feedback-20261108`; note fields/tags/cards/flags/revlog stay identical
to the approved source. Follow-up package: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback-20261108.apkg`.
Use only a NEW KanjiTest-v2 profile: this still contains the old November 3 scheduling snapshot. No real deck
writes, commits, pushes, new judge rounds or changes to the approved content choices.

D43 export round-trip passed: all note fields/templates identical, 2363 notes, 4726 cards, 30 fields,
13154 review rows and three fonts. Package SHA256: `98650388090f73dd8fc8e4a09da23c20137e1bab25ff414c2dc2a82e1445f883`.
Focused results/proofs and the short German retest checklist are preserved in private state.device_feedback.
AGENTS.md, FORK.md and private STATUS.md were updated; no commit was made.


### D44 – Second Windows feedback: geometry, source switches and defaults (2026-11-08)

User requests correction of oversized/off-centre Minimal icons, a uniformly sized Schlicht button, an
apparent accent shift, accent-coloured frequency ratings, less comparison whitespace, independent mnemonic
source switches, slightly larger primitive meanings, and new back/appearance/sound defaults.

Classic icon replacement had copied path/text contents without their original view boxes. Preserve both
artwork and viewBox through repeated design switching; 40-unit font/system/handwriting icons now fit their
24px display. Number icons include a little extra room for their outer labels. The apparent colour shift was
Erkennen's paired secondary highlight (green→teal, blue→purple); global settings and Minimal now highlight
the actual chosen accent. The frequency tag follows that accent. All swatches share border-box sizing;
Schlicht alone used to be 4px shorter. Narrow colour grids wrap to maintain useful targets.

Comparison whitespace came from min-height: var(--dynamic-size) on the wrapper while the two pads were
half-size. Removing it makes the wrapper follow its content. Primitive meanings grow from 16→18px in
Verspielt and 18→20px in Minimal, with small/large font overrides that remain below the title.

Rückseite now has three independent native-checkbox source switches: Merksätze (custom + German stories),
KanjiDraw and Heisig. Source visibility and the checkbox UI persist per card; an all-hidden mnemonic section
can be restored. Preserve the existing KanjiDraw storage key. The shared source-control functions must be
in the main settings script so the first radio refresh can call them; runtime checks cover this initial load.

CSS defaults: Merksätze/Heisig on, KanjiDraw/Nanori off, comparison Nebeneinander, handwriting on;
Verspielt/System/green/random Japan theme; sound low/lofi/immersion-low/music-level-low/stroke-on/fx-on.
Sound radio refresh and the bridge now resolve the same CSS defaults. Saved choices override defaults;
no resetting user preferences, live collection edits, content changes, commits or new judge rounds.

Shared preview could not open: host AppArmor blocks T3's browser sandbox. Used the existing local Chromium
renderer without host/security changes, and visually inspected desktop/phone, light/dark settings and compact
comparison. Final checks and package hash are recorded with the export below.

D44 verification complete: 224 Chromium variants, 24 new feedback cases plus 12 back-interaction cases,
26 Node tests, build/syntax and diff checks pass. Fresh defaults and saved-value precedence both checked;
all eight source combinations and seven accent colours in both tabs passed. Visual inspection confirmed
correct icon geometry, equal swatch heights, tight comparison, frequency accent and larger secondary pills.
Long combined browser runs were terminated; the same matrix completed in bounded chunks with all 224
unique variants and all 24 new cases accounted for. No score/content changes or unverified substitutions.

Paket: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback2-20261108.apkg`.
SHA256: `98b3b917e19312bf0f4b414c4e65f6d4c5ec1ec2c6d84ce0e01589b2a36f2237`.
Round-trip preserves every field/template, 2363 notes, 4726 cards, 30 fields, 13154 reviews and three fonts.
Current isolated DB/proof: `work/anki-v3-feedback2-20261108`; state.device_feedback_round2 is the latest
handoff. AGENTS.md, FORK.md and STATUS.md updated. The global settings highlight fix could also go upstream;
no PR, commit or real-collection write was made. Next is the user's device retest, with saved preferences retained.


### D45 – Comparison gap, classic frequency badge, chosen source chips and Voicemeeter (2026-11-08)

The user likes the compact comparison and requests a little top space, a frequency badge closer to pre-v3,
compact alternatives to checkboxes, and investigation of persistent music issues with Voicemeeter. Inspected
4a330c0: the frequency badge has a tinted surface/readable text and a plain three-line bar icon. Restored that
treatment using the selected hue (darker text on light surfaces). Back-side icon initialization and repeated
Minimal/Verspielt swaps preserve the appropriate artwork. Comparison pads gain exactly 8px top padding.

Presented three interactive, local-only alternatives: one-row chips, expandable multi-select, and one native
select containing all eight combinations. User explicitly chose A. Implemented one row of native toggle buttons
with aria-pressed, mouse/touch/Space/Enter interaction and existing c1_/c2_ persistence. No source preferences,
defaults or approved note fields were changed. All-hidden sources can still be restored. Prototype HTML and
four-width/theme checks are private `work/v3/ui-feedback3-20261108/`.

Voicemeeter is a plausible cause, not a confirmed diagnosis. VB-Audio's official guide documents crackles,
dropouts, A1 master-device stability, buffer sizes and device conflicts. Recommended a controlled Piano test
with VM active versus VM fully closed/direct hardware output, accounting for exclusive-device conflicts.
Prepared `windows-audio-investigation-20261108.zip`: Windows agent brief, read-only 30s WebView observer,
exact engine bundle and a local browser comparison page. The Linux smoke test confirms only that the kit
starts/switches/stops; it cannot verify Windows routing/hardware. Engine remains 1.2.1. Also flag synchronous
sample creation and pagehide waiting as code candidates to correlate, without making speculative changes.
Official reference: https://voicemeeter.com/quick-tips-stutters-crackling-sound-robot-voice/ .

Verification: 32 targeted card variants; 18 source/default/font cases; 12 frequency/spacing cases; 4 real
mouse/touch cases; 27 Node tests; build/syntax/diff checks; and prototype interaction checks. Prior broad
224-variant validation stays archived rather than being repeated for this focused change. Export helper's
optional explicit expected count defaults to 224. Package round-trip preserves every field/template, 2363 notes,
4726 cards, 30 fields, 13154 review rows and 3 fonts. One older long combined back test was terminated;
focused source/input/comparison checks completed. No real collection, scheduling, fields, commits or pushes touched.

Package: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback3-20261108.apkg`.
SHA256: `073abdb39b5180fe07422e4920abaef4e72805df86aac1e020f447d8a5cfa8c2`.
Current private copy: `work/anki-v3-feedback3-20261108`. State.device_feedback_round3 is the latest handoff;
source-selector choice A is recorded separately from the immutable note-review decisions. AGENTS.md/FORK.md/
STATUS.md updated. Audio follow-up is superseded by D46; remaining native-device checks are still pending.

### D46 – UI accepted; audio investigation parked (2026-11-08)

The user accepts the latest UI and reports Piano seems free of the crackling/hanging issue. They suspect
their specific setup and ask to leave audio alone for now. The cause remains unconfirmed. Keep engine 1.2.1,
sound defaults (including LoFi) and the existing package unchanged. Retain the private diagnosis kit for
possible future use, but do not start further diagnostics or a Windows agent session unless requested.
This is a documentation-only handoff update; it does not complete all Phase 6 checks or authorize real-deck writes.

### D47 – Prepare a short, separate AnkiDroid check (2026-11-08)

Continued Phase 6 after UI acceptance. Rechecked the existing Feedback3 package SHA256 against its verified
round-trip manifest; no package or template changes. Official AnkiDroid FAQ/release/manual confirm the
Parallel.A/B apps, unique collection directory and in-app import path. Stable release checked: 2.25.3.
Prepared a private German five-minute checklist for 四, 派 and [marsch], both card directions, drawing,
tree/player/fonts, source controls, themes and saved settings. Test app stays signed out of AnkiWeb.
The private package README now reflects the parked audio investigation instead of recommending new diagnostics.

No Android device or emulator is available in this session. The checklist awaits the user's native result;
browser preview does not establish actual review-rating transition performance. Phase 6 remains open and
Phase 7 still requires explicit consent and a fresh backup. AGENTS.md and the private handoff are updated.

### D48 – Frei default and independently wrapping title pills (2026-11-08)

The user reports stacked title pills on mobile and requests Frei by default in general. Changed the CSS
default plus both fronts' configuration fallbacks to free; the actual drawing-mode fallback matches. Saved
global/per-card Geführt settings remain authoritative, with no preference reset or persistence-format change.

Primitive pills now participate individually in the keyword's flex row via a display:contents wrapper.
The shared row reserves space for the gear/tag, and long primitive labels may wrap inside their pill.
Both designs use enough row gap for the tag when a pill moves below the keyword. The existing hidden-answer
wrapper remains on Card 2. A per-render cleaned-up ResizeObserver keeps the tag on the top-right primitive
pill when fonts/design/layout change. No new runtime dependencies or audio changes.

Verification: 64 backend-rendered sides, 48 Chromium variants, 30 font/persistence/drawing cases, 27 Node
tests and build/syntax/diff checks pass. Both cards/designs at 320/393/450/1100 px; saved global/scoped
Geführt remains effective. Narrow Minimal large-font testing caught and fixed a tag/keyword overlap by
reserving a 14px row gap. Visually inspected real mobile renders. Native WebKit/Android are not verified.

Private package: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback4-20261108.apkg`.
SHA256: `5078e26b4f79f05cb1e480c289e07184778b0f323eb6e077ce9e62f77b4200eb`. Round trip: all fields/templates identical, 2363 notes,
4726 cards, 30 fields, 13154 reviews and 3 fonts. Current private copy: `work/anki-v3-feedback4-20261108`;
state.device_feedback_round4 holds proof. Prior test packages stay archived.
No real-collection data or scheduling changes, commits or pushes. Native mobile retest is still pending.


### D49 – Reproduce and fix the remaining narrow-phone stack (2026-11-08)

The user reports the D48 package still stacks the word pills and explicitly asks for mobile browser
reproduction. Reproduced the old package at 320, 360 and 375 CSS px using actual mobile Chromium contexts
(UA, touch, DPR 2–4.5, standards-mode device-width viewport). D48's test only required shared rows from
393px upward, and its narrow desktop contexts did not capture this. Its historical passing results stay archived.

Phone title rows now use available container width, reserve only 32px beside the gear, remove the title's
120px minimum and reduce pill padding without reducing normal font sizes. The tag stays inside its pill on
phones. Keyword fitting now runs after primitives move out and measures the actual row; previously even
eins shrank unnecessarily to 17px at 320px. Long words and larger text can wrap. Frei and saved preferences
are unchanged; Card 2 still hides answer meanings on its front. No audio, approved content or study data edits.

New regression `Tests/browser/check_fork_mobile.py` requires shared short-pill rows even at 320px and tests
both designs/card directions, three font sizes, reviewer insets, rotation, 200% text and long content. Seven
profiles: iPhone SE, iPhone 12 Pro, iPhone 14 Pro Max, Pixel 7, Galaxy S9+, compact 360px and 375px. Passed:
72 mobile card variants, 74 focused cases, 16 additional wide layouts, 27 Node tests, build/syntax/diff checks.
New fixture wrappers model the native viewport; a Chromium iPhone profile does not establish native WebKit behavior.
The shared browser failed twice due to host AppArmor, so local Playwright was used. The same block prevented
html_preview, while html_render displayed an inline comparison of the actual emulated screenshots. No host changes.
The initial long test process was terminated (143); the checker now supports bounded --start/--end chunks,
and all four chunks completed with persisted results. No failed/incomplete run is counted as a passing check.

Current private copy: `work/anki-v3-feedback5-20261108`; state.device_feedback_round5 holds proofs.
Package: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback5-20261108.apkg`.
SHA256: `a79c06269071c186e65189cd2c3ffc87a5794a691865ae6f8ee9795aa50d5176`.
Full round trip plus a default-option Feedback4→Feedback5 import verify new templates/CSS and unchanged
fields/tags/cards/revlog: 2363 notes, 4726 cards, 30 fields, 13154 reviews, three fonts. Use only an isolated test
collection (new Windows profile KanjiTest-v6); native phone retest remains pending. Prior exports/proofs stay archived.
No real-collection writes, commits, pushes, new judge rounds or audio investigation. AGENTS.md/FORK.md/handoffs updated.


### D50 – AnkiDroid comparison and full stroke loading (2026-11-08)

User confirms the title fix works, but reports no side-by-side after drawing or in preview, plus only the
first stroke for 五 and 召/locken and component families. Confirmed app: AnkiDroid. User says no affected notes
were edited/saved in its editor. Read-only AnkiConnect inspection of the reachable named test profile found
four selected notes/30 fields and exact Feedback5 templates/CSS. SVGPfade/Radikale for 五, 召, 吾 and 語 match
the isolated package, with 4/5/7/14 strokes. No AnkiConnect writes or whole-deck card rendering.

Comparison root cause is confirmed: four back-side mode checks still defaulted to guided after the front
changed to free. Reproduced with actual touch input and a full page flip: stored ink survived, evaluation
and comparison did not run. All checks now share the configured default. Empty free previews also honor
comparison, using missing-stroke ghosts; switching comparison off retains the single-pad fallback.

SVG parsing reproduction: inserting HTML br between otherwise intact paths ends the live SVG after its
first path, producing the same one-line tree. This is NOT proof of the actual phone-side trigger. A known
AnkiDroid editor newline issue was inspected, but the user's no-edit report means editor corruption must
not be assumed. Both fronts now hold raw SVGPfade in an inert template and construct SVG-namespace paths
before initialization. Only d is copied: all 23,738 source paths have only this attribute. Source order,
geometry and note fields stay unchanged. Normal, br, div-wrapper and self-closing variants pass, including
nested 五 in 吾/語. These generic parsing/default fixes are upstream candidates; no upstream action was taken.

Verification: 80 backend-rendered sides; 64 stroke/namespace/tree cases (four families, both cards, Android
mobile emulation and desktop); 10 actual touch/mouse/full-reload/reused-document/empty-preview cases;
16 kanji/primitive smoke cases; 27 Node tests; build/syntax/diff checks. Guided 五 matches four strokes without
penalties; fresh default-free mode needs no saved key. Test initially assumed SVG node DOM order remained
fixed, but selection legitimately moves the root last; assertions now check root explicitly and all glyph
counts independently of paint order. No production workaround was added for that test assumption.

Current private copy: `work/anki-v3-feedback6-20261108`; state.device_feedback_round6 holds proof.
Package: `work/v3/panel/approved-20261108/Kanji-v3-KanjiTest-Feedback6-20261108.apkg`.
SHA256: `45a872cb1a2c14f0994e635039e662b8fed14e964ab02485b0e0357a114cff27`.
Full round trip and default Feedback5→Feedback6 import preserve all fields/tags/cards/revlog and deliver
exact templates/CSS: 2363 notes, 4726 cards, 30 fields, 13154 reviews, three fonts. Test collection only
(new Windows profile KanjiTest-v7). Native phone retest remains pending; if SVGs still lose strokes, compare
an affected Android test-note export and actual rendered DOM/app/WebView versions before changing data.
No real-collection writes, scheduling/flag changes, commits, pushes or audio work. AGENTS.md/FORK.md/handoffs updated.


### D51 – User reports mobile comparison/strokes working (2026-11-08)

User feedback after Feedback6: "seems to have worked." Record this as a positive native AnkiDroid result
for the reported side-by-side and missing-stroke issues. No additional diagnosis, code changes, tests or
package export are needed on that feedback alone. The exact original mobile SVG trigger remains unproven;
user previously reported no editor saves, so do not retroactively claim editor corruption. Audio stays parked.
This confirms the reported fixes, not every remaining Phase 6 item or authorization for Phase 7. No real
collection changes, commits or pushes. AGENTS.md and the private handoff reflect the result.

### D52 – Read-only live migration preflight (2026-11-08)

User confirmed switching to the real profile and making a backup. Read-only AnkiConnect inspection
verified the expected model identity, 2363 notes/4726 cards, all 28 fields, and the pre-v3 templates/CSS
against 4a330c0. All target notes remain in the expected deck; handwriting font files are present.
The only field difference from the migration baseline is HTML escaping of an arrow. Staged private
changes preserve that encoding with exact expected-old checks; the original approvals remain untouched.
The proposed result has 30 fields and 13905 net field edits across 2363 notes. Build and syntax checks pass.

At this checkpoint the fresh backup had not yet been supplied (subsequently received and tested in D53).
Older isolated tests do not establish preservation of a new snapshot. No real
collection writes, schedule/flag changes, new review rounds, commits or pushes. Live approval follows
the fresh-copy rehearsal. AGENTS.md and the private handoff record the snapshot and staged inputs.

### D53 – Fresh full-backup rehearsal (2026-11-09)

The user's new full collection backup was read from the supplied private uploads folder, hashed, decoded
into a new directory and inspected with read-only/immutable SQLite and trusted_schema disabled. No add-ons
or external resources were loaded. Its target note fields, tags, card IDs, schema, templates and CSS exactly
match the D52 live snapshot. A refreshed read-only check also confirms flags and latest target review agree.

On a disposable database copy, all four staged phases passed exact-old planning, apply and read-back
verification: 2 fields, 6599 imports, 2346 trees, 5260 colour operations. Net edits: 13905 fields on 2363 notes.
Every card and review row, all other notes/models/templates, deck settings and flags retain identical hashes.
Full reverse undo restores every field/tag, original schema, templates and CSS; reapply passes too. The
last colour phase is idempotent. Anki backend rendered 80 sides across 20 kanji/primitive notes.
The first two harness attempts stopped before applying anything (missing raw SQLite collation registration,
then differing blob representations between SQLite and the backend); their logs/copies remain preserved.
The corrected third attempt passed. All 320 Chromium variants passed (80 Anki-rendered sides across both
designs, light/dark and 320/1100px); build/script checks pass. No broader repeat testing is needed.

A scoped rollout plan and recovery runbook are ready privately, including exact input/implementation hashes,
fresh profile/identity/expected-old checks and recovery order. No scheduling/flags API writes, real collection
writes, sync, old-package import, additional judging, audio work, commits or pushes. Explicit live approval
is the next user gate after final checks; confirmation of backup availability is not write authorization.

### D54 – Approved live rollout completed (2026-11-09)

After D53 the user explicitly approved all three proposed steps: add both fields, apply approved data and
install latest templates/CSS. Fresh guards rechecked the active profile/model, baseline fields/templates,
all note/card IDs, all collection card modification times/flags and existing-card review rows against the
supplied backup. Recovery snapshots were saved before writing. No old package was imported.

Added Merkhilfe after Merksatz-KI and Stolperfallen after Radikale. Applied all 6599 imports, 2346 trees and
5260 colour operations (13905 net field edits), then installed all four templates and CSS. Initial serial
requests were slow; the serial process was deliberately interrupted after the schema and 1131 import
fields. Its logs and complete phase backups were preserved. A separate resume verified that every note
contained only baseline or already-approved import values and the study state was unchanged, then used
scoped 50-note AnkiConnect multi batches. Every phase was read back and the final target matched exactly.

Live result: 2363 notes/4726 cards/30 fields. All 33668 collection card IDs/modification times, flags and
suspension/burial sets are identical before/after. All 52295 review rows attached to existing cards match;
daily counts for 52550 graded reviews are unchanged too. The backup's 63867 total revlog rows include
11317 ease-zero entries; daily API counts exclude those. No review/scheduling/flag mutation APIs were used.
Eight selected kanji/primitive cards rendered both sides (16 sides); their due/interval/factor/reps/lapses/
queue/type/flags/order match the backup. Exact fields, tags, note/card IDs, field order and templates/CSS
are verified. This is backend/API verification, not a new native visual or review-rating test.

Original backup/approvals and recovery files are retained privately. User preview and Windows upload →
Android download are next; no sync was performed by the agent. Scoped write authorization is consumed.
No new review rounds, audio changes, commits, pushes, PRs or release actions. AGENTS.md/FORK.md and the
private handoff now describe the 30-field live v3 deployment.

### D55 – Mobile font fallback resolved by media sync (2026-11-09)

User reported that handwriting examples used the normal font while media might still be syncing, then
confirmed that sync completed and the examples display correctly. Close the investigation at the user's
request. All three real font files loaded and were actually used in eight Android-emulated/desktop cases
(both designs/cards); this was not a native-device diagnosis. No template/code/media or live-collection
changes were made. Do not restart font diagnostics unless symptoms return. Phase 8 release remains unapproved.

### D56 – Faster word reveal and token-free component audit (2026-11-09)

User requests faster Bedeutung/primitive reveal on flip (roughly 2–3 times faster), plus a reliable
low-token way to find missing composite kanji parents, example 混/mischen containing 昆/Nachkomme.

Local template change: front keyword/pill entrance is 180ms with no 60/100ms delay (previous total
560/600ms); Card 2's answer keyword/pills are 150ms together without 50/100ms delay (previous total
400/450ms). Card 1 keeps its already-visible headings instant on flip. The shared CSS and Card-2 back
anti-flicker rule retain their existing animations, just shorter. Reduced-motion now also disables
primitive-pill and Card-2 answer-title animations, with opacity restored and front-side secrecy retained.
Generic timing/accessibility change; no upstream action taken. LOCAL ONLY: no live-template writes.

Private data tool `fix-kanji-deck/tools/v3/scan_components.py`: stdlib, no model calls, network or Anki
backend. Input is the D54 deployed notesInfo snapshot, covering all 2363 unique notes (2200 kanji +
163 primitives). KanjiVG element groups are compared to existing tree identities/ranges only after
exact SVG path-token mapping (exact reorders allowed, no approximate mapping of changed strokes).
Split groups are combined; partial/variant/count-changed forms and conflicting branch boundaries
are handled separately. Supplementary complete leaf-partition matching also checks primitive notes,
but does not claim independent geometry verification or exhaustive arbitrary-subset detection.

Result in ~2–4s: 40 source-confirmed missing-parent candidates on 35 notes; 207 pattern-only candidates
and 1227 variant/identity/tree-conflict candidates are separate review tiers, NOT confirmed corrections.
2185 kanji map fully to source, 15 partially; no Unicode source for bracketed primitives. The leaf pass
can inspect 2060 complete ranged trees. 混→昆 is independently supported by both passes at strokes 4–11,
wrapping existing 日 and 比 intact. Other examples: 猫→苗, 憩→息, 瀬→頼. No field changes generated;
adding parents may alter mnemonic colour identities, so do not auto-apply even the source-backed tier.

Private authoritative report: `work/v3/component-audit-20261109/report-final.json`; focused queue:
`shortlist-final.json` (40 candidates). Initial `report.json` is superseded because the old KanjiVG DTD's
http namespace was not recognized; a real-source regression now covers it and missing group parsing
fails closed. A further split-instance audit found repeated part numbers: explicit instance numbers now
stay separate and three ambiguous unnumbered groups are skipped, never merged into phantom components.
This supersedes `report-v2.json` (three lower-tier rows removed; all 40 source-backed cases unchanged).
Fourteen scanner tests pass; report script/input hashes verified. The audit does not reopen
or reinterpret the completed user decisions. Existing real-study data and scheduling/flags are untouched.

Animation verification uses a NEW isolated database copy, never modifies the existing test profile,
and renders 16 real Anki sides per before/after version (kanji + primitives, with/without alternate meanings,
both card directions). Full note/card/revlog hashes are unchanged. Browser regression:
`Tests/browser/check_fork_reveal.py`, using 320/1100px, both designs, light/dark, reduced motion,
reused-document flips and slow/manual animation seeking. Its first run hit a test-inspection race:
backwards-fill pills had finished before enumeration while forwards-fill titles remained; inspection
now explicitly restarts only the CSS animations before pausing/seeking. No production workaround.
The next run reached six passing configurations but hit the 120s command timeout. The checker now
checkpoints each configuration and supports --start/--end chunks; the full rerun has no command timeout.
Final browser verification passes: **256 card variants and 128 reused-document flips**, all 16
width/design/theme/motion configurations. Reduced-motion removes the answer fade without leaking
Card 2's front; normal answer title/pills use 150ms with zero delay. Before/after computed timings and
manual animation samples are saved in `reveal_checks.json`; both mobile header midpoints were inspected.
Full isolated note/card/revlog hashes remain identical. No failed/timed-out run is counted as a pass.
All 27 existing Node tests, build --check, script syntax and both repos' diff checks pass.
AGENTS.md, FORK.md and private STATUS/tool README updated. No live writes, commits, pushes or release.

### D57 – Install faster reveal; private missing-parent review page (2026-11-09)

User explicitly asks to install the faster reveal through AnkiConnect and create a small webpage for
the missing parents. User confirms a fresh backup. Read-only preflight checks the real profile/model,
30 fields and exact D54 deployed templates/CSS. The script derives the allowed CSS edits and single
Card-2 answer rule from the deployed snapshot, rejecting any unrelated changes (only final newline
normalization is tolerated). An initial strict newline check stopped before writes. Anki then refused
the template update because an affected editor was open; user saved/closed it, and a guarded resume
rechecked the original live baseline before retrying. Only two successful write calls: Card 2 Back and
model CSS. Exact read-back verifies all four templates and CSS against the repository, schema unchanged.
No note/card/scheduling/flag/review writes or sync. Recovery snapshots, authorization and receipt:
private `work/v3/reveal-rollout-20261109/`. This scoped write approval is now complete.

Private `fix-kanji-deck/tools/v3/parent_review.py` + `.tpl.html` generate a small, offline German page:
host SVG with exact candidate strokes highlighted, canonical component SVG, current/proposed trees,
search and status filters, keyboard navigation, Ergänzen/Behalten/Später, optional notes, local persistence,
JSON download/copy/import with review/snapshot fingerprints. All 40 previews only wrap complete siblings;
all existing node labels, ranges and leaves are preserved. Multiple candidates for one note are previewed
separately; a future apply plan must combine accepted groupings rather than overwrite them independently.
Mnemonic colour implications remain explicit. No proposals are applied or pre-approved by this page.

Page: `work/v3/component-audit-20261109/kanji-eltern-pruefung.html` (about 177KB, self-contained).
Review ID: `e762bc5763c09111e37f58946ed16476bc5cf0576bbfb6eca4a3390ca2851876`.
Manifest records input/page hashes; decisions export as `kanji-eltern-entscheidungen.json`. The page starts
with all 40 choices open. All browser test choices/downloads live in a separate Playwright context/output,
not in the user's review. A read-only live check of 52 relevant host/component notes in batches of eight
found no differences in Kanji/meaning overrides/Radikale/SVGPfade from the page snapshot.

Verification: six grouping/generator tests and **320 browser variants** (all 40 cases at 320/390/728/1100px,
light/dark), actual highlights and inserted parents, overflow, decisions/notes/keyboard/reload, search/filter,
real JSON download, valid import, wrong-review rejection and unavailable-storage export fallback. No
external requests or console errors. Mobile dark/desktop light screenshots inspected. The browser pane
is disconnected and T3's browser remains host-AppArmor-blocked; no security configuration was changed.
Provide the standalone HTML file/link rather than claiming a working inline browser preview. No public
publishing, commits, pushes, PR/release or tree/data writes. User tree review and follow-up sync remain.

### D58 – User parent decisions imported and applied (2026-11-09)

User returned the fingerprinted `kanji-eltern-entscheidungen.json`; exact review/snapshot IDs and all
40 case IDs validate. Decisions: **3 approve / 37 keep**, no open/later entries and no extra notes.
Approved additions: 混→昆, 猫→苗, 型→刑. Preserve the other 37 choices; no new audit/model rounds.
Export SHA256: `c7b11970096bfe155e84f280630e1050812297fbd5178418e1f4f854a254de3a`.
Private `tools/v3/approve_parents.py` validates choices and creates the exact reviewed parent wrappers;
all existing node identities, names, stroke ranges and leaves remain. Multiple nested approved groups
are supported inner-first, while ambiguous/crossing groups fail closed (not needed for these three notes).

Grouping merges top-level colour branches. Mechanical remapping changes only existing annotated span
class tokens: 混/猫 old c3→c2; 型 old c2→c1 and c3→c2, applied simultaneously. All wording, HTML structure,
span boundaries, keyword colours and primitive flags are preserved, with no new annotations or rewrites.
Total: 11 fields on 3 notes = 3 Radikale + 8 colour-only fields, 11 class-token substitutions. The other
existing Phase-5 approvals are not reinterpreted. This is a separate approved 05 follow-up to D54.

Read-only live preflight found all fields/tags on the three selected notes unchanged from the reviewed
snapshot. A NEW isolated database clone passed exact-old apply/verify/idempotence/undo/reapply; undo
restored all fields/tags and all card/review/model hashes. Only the exact 11 planned fields differ after
apply, including across all unrelated notes. Backend rendered 16 sides (3 selected kanji + an unchanged
primitive, both card types/front/back); **128 Chromium variants and 48 explicit parent/colour checks**
pass across both designs, light/dark and 320/1100px. Ten approval/HTML-class-remapping regressions pass,
including identity mismatch, missing/extra/duplicate choices, palette ambiguity and HTML/text preservation.

User then explicitly confirmed **“Backup ready — apply”**, including fresh backup, closed editors and
scope (three trees + eight colour-only fields). After render checks passed, live guards rechecked the
profile/model, exact templates/CSS/schema and all original fields/tags. Only three updateNoteFields
calls were allowed. Exact read-back and idempotence pass; every unlisted field/tag on those notes and
all six card IDs/scheduling/flags/review rows are unchanged. Both directions render through Anki's API.
No template, schema, card, flag or review writes; no sync. Recovery snapshots, original export, immutable
plan/provenance, exact-old undo backup and final receipt are private under
`work/v3/parent-approved-20261109/` (plan/changes_05_parents.json, live_receipt.json).

The live template snapshot remains D57; the latest data baseline is D54 plus this 05 follow-up, not the
unchanged D54 notes snapshot. Scoped permission is complete; no further live writes, commits, pushes,
PR/release or additional audit work are authorized. AGENTS.md and private STATUS/tool README updated.

### D59 – Commit the current template-branch state (2026-11-09)

User confirms the three selected parent changes worked, then explicitly requests a separate commit using
the project convention to bring `t3/reconcile-v3-fork` up to date. This checkpoint collects the pending
Windows/AnkiDroid feedback changes: restored free-drawing comparison, scoped mnemonic/Nanori controls,
mobile title/SVG loading fixes, Minimal-design/icon/swatch polish, root meaning/furigana adjustments,
saved-preference-compatible defaults, audio 1.2.1 scheduling/buffering changes and faster title/pill reveal.
It includes shared sources, all four built templates, CSS, the new browser/Node regressions, FORK.md and
this handoff. Existing device-test evidence remains as recorded in D43–D58; this is not a claim of new
native-platform coverage or a restart of the parked audio investigation.

Fresh checks: build --check, inline-script syntax, all 27 Node tests serially and git diff --check pass.
Documentation no longer describes the checkpointed source changes as uncommitted. The git-ignored
AGENTS.md is updated locally with the final commit reference. Private deck data, review tooling, exports,
receipts and backups stay in the separate repository and are not part of this commit. No new Anki writes,
sync, push, PR, merge or release are requested or performed. The prior local documentation commit is
preserved. The initial combined commit was `4532e8d`; the user then clarified that each logical change
needs its own commit. That unpublished combined checkpoint is superseded by the D60 series below.

### D60 – Split the unpublished checkpoint by logical change (2026-11-09)

User clarifies: one separate commit for each change, not one combined checkpoint. Split only the new
unpublished `4532e8d` checkpoint; preserve its parent `7ddffe2` and all older history. Keep the original
combined checkpoint under a local recovery ref. No force push or other remote operation is authorized.

The replacement series separates: free-drawing comparison/default consistency; mnemonic-source/Nanori
controls; section order; mobile title/pill layout; SVG stroke loading; Minimal-design polish; tree-root
meaning labels; furigana positioning; appearance/handwriting/sound defaults; audio scheduling/buffering;
faster answer reveal; remaining cross-feature regressions; and the migration/documentation checkpoint.
Each functional commit includes its matching generated template changes, so shared sources and built
templates remain consistent throughout. Audio/reveal-specific tests accompany their fixes; the broader
settings/device tests follow the completed features. Every commit uses Conventional Commit style and
the required model co-author trailer.

Build --check, inline-script syntax and serial Node tests pass for every replacement snapshot. Final
runtime/source/CSS/test files are byte-identical to the combined checkpoint; only this handoff changes
to record the corrected history. The git-ignored AGENTS.md records the replacement commit references.
No private tooling-repository changes, Anki writes, sync, push, PR, merge or release are performed.
