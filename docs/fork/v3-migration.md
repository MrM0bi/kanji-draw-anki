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

### Phase 2b – Option: old minimal design (D25; after Phase 3, before Phase 6 so the user tests both)
- [x] 2b.1 Agree the scope with the user. Proposal:
      - a setting "Design: KanjiDraw (neu) / Minimal" on the "Erscheinungsbild" page, key `kanjiThemeDesign`
        (`kd` / `minimal`), CSS default `--default-theme-design: kd`, applied as `html.kd-design-minimal` by an early
        script (no flicker, like the theme classes)
      - minimal = no landscape scenery, plain background, the pre-v3 flat title (keyword as text, grey primitive
        boxes), plain section cards with the old feather outline icons instead of the pastel badges, plain info tags
      - all v3 features (tree, player, Schreibfehler, colour-coded mnemonics, sound) stay in both designs
      - implementation: fork-only CSS overrides under `html.kd-design-minimal`, and a second icon set in
        `KD_SECTIONS`; no edits to upstream markup
      **User decisions (2026-11-03):** the **whole design** switches (settings modal, buttons, front controls, card
      content); **one global setting**; colours: explore and show the options (v3 themes vs. the old palette).
- [~] 2b.2 Implement (both cards), render-check both designs × light/dark × kanji/primitive. **Prototype done**
      (`2e105c5`): setting, early class, icon swap (`src/front/kd-fork-design*.js`, `KD_SECTIONS` `ICON_MIN`), CSS
      skin (fork block at the end of `Styling.css`). Colours decided (D29): new accent "Schlicht"; minimal +
      Schlicht = neutral palette, minimal + other accents = Japan-Theme colours (`4941859`).
      Not yet restyled in minimal: Strichfolge controls, Schreibfehler page, sound and "Danke" pages, the tree
      toolbar (they keep v3 shapes, outline icons).
- [ ] 2b.3 Tests, `build.py --check`, `FORK.md`

### Phase 3 – Headless verification
- [ ] 3.1 Test collection on the server from the user's `.apkg` (`fix-kanji-deck/tools/setup_test_anki.py`,
      adjust hard-coded paths, e.g. `KANJI_DRAW_ADDON`)
- [ ] 3.2 Render harness: real notes (kanji e.g. 一 右 語 派 籠, primitive e.g. `[spazierstock]`) × Card 1/2 ×
      front/back in headless Chromium. Screenshots, console errors, timings.
- [~] 3.3 Same measurement for pure upstream v3 (baseline for the +50 ms budget)
- [ ] 3.4 Fix what's found. Add a short how-to for the harness to this file.

### Phase 4 – Data migration (scripts in `fix-kanji-deck`, dry run / `--apply` / `--undo`, value check, backup)
- [ ] 4.1 Field-add script (`Stolperfallen` after `Radikale`, `Merkhilfe` after `Merksatz-KI`) via AnkiConnect
      (`modelFieldAdd`/`modelFieldReposition`)
- [ ] 4.2 Import `Stolperfallen`, `Merkhilfe`; overwrite `Merksatz-KI` for kanji (D5)
- [ ] 4.3 Radikale merge: glyph → name table, auto group, review group, primitives `@1-n`
- [ ] 4.4 Review page: Radikale + Bedeutung + SVG + 篭/籠 + 誓/斬 (D7) → **user review**
- [ ] 4.5 Apply the review decisions in the test collection. Verify the tree and stroke colouring render.

### Phase 5 – Colour-coding (D8)
- [ ] 5.1 Agents propose `kd-kw` spans for Merksatz-DE, BuchBeschreibung, BuchPrimitivBeschreibung (batched,
      JSON out), plus name alignment inside the Merksatz-KI spans
- [ ] 5.2 Review page → **user review**. Radikale issues found → back to 4.4.
- [ ] 5.3 Apply in the test collection, render-check

### Phase 6 – Test switch-over (user)
- [ ] 6.1 **User:** `KanjiTest` profile with the `.apkg`. Agent applies Phase 4/5 + templates there via
      AnkiConnect (profile must be open).
- [ ] 6.2 **User:** manual test on Windows Desktop + Android (AnkiDroid). Collect feedback → fixes.

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

- **State (2026-11-03, server):** Phases 0–2 done. All fork features F1–F12 are rebuilt on v3 (`b40e1f8`..`c68666c` after
  merge `edf1045`, see §8). Rendered with real notes (kanji, primitive, both cards, light/dark,
  phone/desktop width): no console errors.
- **Next:** Phase 3 (then Phase 2b, the minimal-design option; scope questions are listed there). 3.1 test collection (headless Anki) is optional for rendering; the render harness (below)
  already covers 3.2 roughly. Then 3.3 upstream baseline timing and the +50 ms budget.
- **3.3 first timing (2026-11-03, inconclusive):** `loadEventEnd` of the rendered back pages, 15 loads each, 412 px,
  headless Chrome. Upstream v3 (modal, upstream field names, v3 values) vs. fork (inline), 学/語 × C1/C2:
  medians up 913/908/759/808 ms vs. fork 883/870/978/794 ms; minimums up 741/711/670/650 vs. fork 751/775/762/666.
  The server had load ~6.7 on 4 cores, so the noise (±100 ms) is larger than the 50 ms budget. Redo on an idle
  machine (or measure in-page script time with `performance.mark`) before deciding. Script: `/tmp/kd-time.py`
  pattern = Playwright, new context per load, median of `performance.getEntriesByType('navigation')[0].loadEventEnd`.
- **Blocked / waiting for user:** nothing. A visual review of the new back by the user would be useful
  (screenshots can be made with the harness).
- **Render harness (private, uses deck content):** `fix-kanji-deck/tools/v3/render_cards.py`. Inputs:
  `/tmp/kd-apkg/mine_samples.json` (user notes via read-only AnkiConnect `notesInfo`), `/tmp/kd-apkg/v3.json`
  (v3 `.apkg` notes via sqlite), the three handwriting fonts copied next to the output pages (`retrieveMediaFile`).
  It simulates the post-migration fields (v3 `Stolperfallen`, `Merkhilfe`, `Merksatz-KI` <- `Eselsbrücke`,
  `Radikale` <- v3 until Phase 4) and drives `/usr/bin/google-chrome` through Playwright:
  `uv run --with playwright python -I render_cards.py <repo> <samples> <v3> <outdir> --only 語 --ls '{"kdSec_strichfolge":"0"}' --js "…" --viewport-shot`.
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
