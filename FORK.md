# About this fork

This is a personal fork of [PawMethod/kanji-draw-anki](https://github.com/PawMethod/kanji-draw-anki). It adapts the
KanjiDraw note type to a German Heisig deck (*„Die Kanji lernen und behalten“*, 4th ed.) with its own field set
and some extra features. Everything else, including the [README](README.md), is upstream's work and documentation.

> **Status (2026-11-11).** Branch `t3/reconcile-v3-fork` is upstream **v3.0.0** (`b853acf`) plus the changes
> below. These templates are installed in the study profile. `main` is still based on upstream before v3; merging
> this branch into it hasn't happened yet. The upgrade history is in
> [`docs/fork/v3-migration.md`](docs/fork/v3-migration.md).

**Contents:** [How the fork is organised](#how-the-fork-is-organised) · [Fields](#fields) ·
[Changes](#changes) · [Settings and defaults](#settings-and-defaults) · [Fork files](#fork-files) ·
[Upstream candidates](#upstream-candidates) · [Merging upstream](#merging-upstream)

## How the fork is organised

The fork stays as close to upstream as possible so upstream updates merge easily:

- Fork changes are small and additive. Upstream code isn't refactored, reformatted or renamed.
- Fork-only code is marked with a `fork:` comment, uses `kd-`-prefixed CSS classes, and lives in its own files
  where possible (`Templates/src/**/kd-fork-*`).
- Code shared between the cards lives in `Templates/src/` and is copied into the four templates by
  `python3 Tools/build.py` (between `[KD-SRC …]` markers). Edit the sources, then build.
- Card 1 and Card 2 get the same change in the same way.

## Fields

The templates use this fork's field names instead of upstream's:

| Upstream field | Fork field |
|---|---|
| `Bedeutung` | `Bedeutung-DE`, replaced by `Bedeutung-Override` when that is filled |
| `JLPT` | `JLPT-Level` |
| `Nummer` | `Kanjinummer-BuchDE-Edition-4` |
| `Eselsbrücke` | `Merksatz-KI` |

These upstream fields keep their names: `Kanji`, `SVGPfade`, `Radikale`, `Stolperfallen`, `Merkhilfe`,
`Wortbeispiel`, `Onyomi`, `Kunyomi`, `Häufigkeit`.

Fields only the fork uses:

| Field | Shown as |
|---|---|
| `PrimitivBedeutung-DE` | Primitive-meaning pills next to the keyword (comma-separated) |
| `PrimitivBedeutung-Override` | Replaces `PrimitivBedeutung-DE` when filled |
| `Merksatz-Custom`, `Merksatz-DE` | Story boxes in "Eselsbrücken" (source "Merksätze") |
| `BuchBeschreibung`, `BuchPrimitivBeschreibung` | Story boxes under `HEISIG` (source "Heisig") |
| `Nanori` | Third row in "Lesungen" |
| `Notiz` | Section "Notiz" |

**Primitive notes:** the deck also has notes for primitives. Their `Kanji` field holds a bracketed name such as
`[Spazierstock]` instead of a glyph. The templates detect them by the leading `[`.

**Deck data is not in this repo.** The deck's `Radikale` uses upstream's v3 tree format
(`吾[Ich]@8-14{五[fünf]@8-11, …}`), and its mnemonic fields carry upstream's colour spans
(`<span class="kd-kw kd-c1">`). Both were migrated with separate private tooling.

## Changes

Each entry: what it does, then where the code is. *Upstream candidate* marks generic fixes that could go upstream.

### Back side

- **Inline sections instead of the info modal.** The back shows everything as collapsible sections in this order:
  Elemente, Eselsbrücken, Strichfolge, Notiz, Schreibfehler, Wortbeispiele, Lesungen, Externe Links. Each section
  remembers whether it is open. Strichfolge and Schreibfehler start closed and load on first open. The header
  shows JLPT, frequency and the book number. Dragging vertically over the tree scrolls the page.
  *Code:* `src/back/kd-fork-sections.js` (`KD_SECTIONS` sets order, titles, icons and default state),
  `#kd-info-inline` / `.kd-section` in both back templates, one fork line in `src/back/primitive-tree.js`
  (`treeModalEl`).
- **Several mnemonic sources.** "Eselsbrücken" groups the texts by source:
  - Merksätze: `Merksatz-Custom` and `Merksatz-DE`
  - KanjiDraw: upstream's `Merkhilfe` hint and `Merksatz-KI`
  - Heisig: the book texts, under a muted `HEISIG` label

  Each source can be switched on or off per card type (toggle chips on the "Rückseite" settings page). The
  section hides when all three are off. All story texts are upright. Empty groups are removed.
  *Code:* `.kd-story-group-*` in the back templates, `src/front/kd-fork-back-settings.html`,
  `src/front/kd-fork-source-settings.js`.
- **Notiz.** A free-form note section, hidden when the field is empty or holds only line breaks.
  *Code:* `.kd-note-box`, section key `notiz`.
- **Nanori.** A third reading row with a muted outlined `NANORI` label. Can be switched on or off per card type;
  off by default. *Code:* `.kd-nanori-label`, `.kd-nanori-row`.
- **Handschriftbeispiele.** The kanji in three more fonts above the tree (on by default; "Rückseite"). The fonts
  are collection media files (`_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`,
  `_kanji_font4_KouzanGyousho.otf`) and are not part of this repo. *Code:* `.kanji-font-examples`.
- **Primitive notes.** No font samples; the tree's root row is hidden, and "Elemente" is hidden when `Radikale`
  only names the primitive itself. *Code:* `.custom-tree-box.is-primitive`.
- **Landscape at the bottom.** The back is taller than one screen, so the landscape sits at the bottom of the page
  instead of the screen.
- **Faster reveal.** The info area fades in over 0.1 s.
- **Settings take effect at once.** Changing a back option redraws the visible back without flipping the card.

### Front and title

- **Meaning overrides.** `Bedeutung-Override` / `PrimitivBedeutung-Override` replace the keyword and the primitive
  meanings when filled. *Code:* Anki conditionals in both fronts' `.card-title`, marked `<!-- fork: … -->`.
- **Primitive-meaning pills.** Each meaning in `PrimitivBedeutung-DE` gets its own pill in the keyword's row, with
  a `PRIMITIVE` tag on the top-right pill. Pills wrap one by one. On phones, short pills share a row even at
  320 px. *Code:* `src/front/kd-fork-primitive-chips.js` (`.kd-title-row`, `.primitive-group` with
  `display: contents`, `.primitive-box`, `.primitive-label`; a ResizeObserver repositions the tag).
- **Long keywords.** Long one-word keywords hyphenate (German) or shrink to fit instead of running into the gear
  button. Only the keyword is fitted, after the primitive meanings are moved out.
- **Faster pill reveal.** Keyword and primitive pills enter together in 0.18 s without stagger. Card 2 reveals
  both answers in 0.15 s without delay. With reduced motion these animations are off.

### Drawing and comparison

- **Free drawing by default.** New installations start in "Frei"; a saved "Geführt" choice still wins. Front and
  back resolve the same default.
- **Side-by-side comparison** (Card 1, restored from before v3). After free drawing, the back shows your
  handwriting next to the reference, with grading, stroke numbers and the grid. The "Striche zu viel / zu wenig"
  badges sit under the matching drawing at any window width. The comparison takes only the height of its two
  pads (8 px gap above). Even an empty free drawing shows the missing strokes.
  Switch with "Nebeneinander / Einzeln" on "Rückseite"; guided drawing and Card 2 are unchanged.
  *Code:* `src/back/kd-fork-comparison.js`, `src/back/kd-fork-comparison-grid.js`, `.side-by-side-*`,
  `.sbs-badge-row`.
- **SVG stroke loading.** Both fronts read `SVGPfade` from an inert `<template id="kd-stroke-source">` and build
  the SVG paths in script, so HTML line breaks or wrappers in the field can't cut the kanji off after its first
  stroke. Field contents are unchanged. *Code:* `src/front/kd-fork-svg-paths.js`. *Upstream candidate.*

### Component tree (Elemente)

- **Root meaning.** The root kanji gets the same label pill as its components, with the effective meaning
  (override, else `Bedeutung-DE`). *Code:* `.kd-tree-root-keyword`; fork lines in `src/back/primitive-tree.js`.
- **Height by depth.** Trees with four or more levels get a taller box (+90 px per level beyond three, up to
  590 px) so their nodes stay readable. *Code:* `boxH` in `src/back/primitive-tree.js`. *Upstream candidate.*
- **Esc closes fullscreen.** *Code:* one document `keydown` listener (`window._kdTreeEscBound`) in
  `src/back/primitive-tree.js`. *Upstream candidate.*
- **Larger tool buttons.** Zoom and fullscreen buttons are 36 px in Verspielt (42 px on touch screens). Minimal
  uses 40 / 44 px.

### Appearance

- **Design switch.** A global setting ("Design: Verspielt / Minimal" on "Erscheinungsbild"):
  - **Verspielt** is upstream's v3 look.
  - **Minimal** is the plain pre-v3 look with the classic outline icons. It applies to every surface:
    settings, sections, player, Schreibfehler, tree tools, sound settings and Danke.

  All v3 features stay in both designs. Minimal keeps neutral surfaces with any accent colour, and its
  tool buttons are larger. *Code:* `src/front/kd-fork-design-early.js` (sets `html.kd-design-minimal` before
  the first paint), `src/front/kd-fork-design.js` (icon swap, `kdSetDesign`), the `html.kd-design-minimal` block
  in `Styling.css`.
- **Accent "Schlicht".** A black/white accent colour (7 accents in total). All swatches have the same size; on
  phones they wrap into four columns. *Code:* `plain` in `_accentColors`, `html.kd-accent-plain`, `.kd-swatch-plain`.
- **Word examples.** Furigana sit slightly higher above the kanji.

### Sound (engine 1.2.2)

- **Quieter music.** The music's reverb and echo now follow the music level; before, they bypassed it, so the three
  steps differed by only about 5 dB. The levels are also lower: 0.16 / 0.32 / 0.55 instead of 0.45 / 0.7 / 1.
  Stroke sounds and effects are unchanged. *Code:* `MLEVEL`, `MSEND_REF` in `src/audio/02-tables.js`,
  `G.musicVerb` / `G.musicEcho` in `src/audio/05-graph.js`. *Upstream candidate* (the bypass).
- **Windows playback.** Windows requests `latencyHint: 'balanced'`, and bars that a UI stall made overdue are
  skipped instead of being scheduled in the past. *Code:* `src/audio/05-graph.js`, `src/audio/15-control.js`.
  *Upstream candidate.*
- **Sound defaults from CSS.** The sound controls and the engine read their defaults from `--default-sound-*`
  (see [Settings and defaults](#settings-and-defaults)). *Code:* `src/front/sound-bridge.js`.

### Input

- **Pen scrolling on Anki Desktop.** Qt WebEngine treats a Windows Ink pen drag like a mouse drag, so it selected
  text instead of scrolling. A pen swipe now scrolls the card or the settings dialog, with a short glide. It
  respects `touch-action` like a browser, so the drawing pad and the tree keep their own pen handling. Mouse
  input and other platforms are unchanged. *Code:* `src/front/kd-fork-pen-scroll.js`, `html.kd-pen-panning`.

## Settings and defaults

Settings use upstream's persistence chain (`window._ks` → cookie `_k` → localStorage → add-on). Saved choices
always win over the CSS defaults; deck defaults are the `--default-*` variables at the top of `Styling.css`.
"Per card" keys are stored with a `c1_` / `c2_` prefix (Card 1 / Card 2).

| Setting (page) | Storage key | CSS default | Default | Scope |
|---|---|---|---|---|
| Design (Erscheinungsbild) | `kanjiThemeDesign` | `--default-theme-design` | `kd` (Verspielt); `minimal` | global |
| Accent (Erscheinungsbild) | `kanjiThemeAccent` (upstream) | `--default-theme-accent` | `green`; new value `plain` = Schlicht | global |
| Japan theme (Erscheinungsbild) | `kanjiThemePrimary` (upstream) | `--default-theme-primary` | `random` (upstream: `sage`) | global |
| Drawing mode (Zeichnen) | `kanjiOptDrawMode` (upstream) | `--default-opt-draw-mode` | `free` (upstream: `guided`) | per card |
| Merksätze source (Rückseite) | `kanjiOptMerksaetze` | `--default-opt-merksaetze` | `on` | per card |
| KanjiDraw source (Rückseite) | `kanjiOptKanjiDraw` | `--default-opt-kanji-draw` | `off` | per card |
| Heisig source (Rückseite) | `kanjiOptHeisig` | `--default-opt-heisig` | `on` | per card |
| Nanori (Rückseite) | `kanjiOptNanori` | `--default-opt-nanori` | `off` | per card |
| Handschriftbeispiele (Rückseite) | `kanjiOptHandwriting` | `--default-opt-handwriting` | `on` | per card |
| Comparison (Rückseite) | `kanjiOptSideBySide` | `--default-opt-side-by-side` | `on` (Nebeneinander) | Card 1 |
| Section open/closed | `kdSec_<key>` | `collapsed` in `KD_SECTIONS` | Strichfolge, Schreibfehler closed | global |
| Volume (Klang & Musik) | `kanjiSoundLevel` | `--default-sound-level` | `low` (upstream: `off`) | global |
| Music style | `kanjiSoundMusic` | `--default-sound-music` | `lofi` (upstream: `off`) | global |
| Music volume | `kanjiSoundMusicLevel` | `--default-sound-music-level` | `low` (upstream: `mid`) | global |
| Reaction | `kanjiSoundImmersion` | `--default-sound-immersion` | `low` | global |
| Stroke / effect sounds | `kanjiSoundStroke`, `kanjiSoundFx` | `--default-sound-stroke`, `--default-sound-fx` | `on` | global |

Music still needs a first tap where the browser blocks autoplay.

## Fork files

New files (everything else is a marked edit of an upstream file):

| File | Purpose |
|---|---|
| `src/back/kd-fork-sections.js` | Inline back sections, `KD_SECTIONS`, lazy Strichfolge/Schreibfehler, Notiz/empty-group handling |
| `src/back/kd-fork-comparison.js`, `kd-fork-comparison-grid.js` | Side-by-side comparison and its grid |
| `src/front/kd-fork-primitive-chips.js` | Primitive-meaning pills, `PRIMITIVE` tag, keyword fitting |
| `src/front/kd-fork-design-early.js`, `kd-fork-design.js` | Design switch (Verspielt / Minimal), icon swap |
| `src/front/kd-fork-back-settings.html`, `kd-fork-source-settings.js` | "Rückseite" settings: source chips, Nanori |
| `src/front/kd-fork-svg-paths.js` | Inert stroke source → SVG paths |
| `src/front/kd-fork-pen-scroll.js` | Pen scrolling on Anki Desktop |
| `Tests/js/test_fork_settings.js`, `test_audio_scheduling.js` | Node tests: settings/defaults resolution, audio scheduling |
| `Tests/browser/check_fork_*.py` | Playwright checks against Anki-rendered cards (back options, mobile title, strokes, reveal timing); see [Tests/browser/README.md](Tests/browser/README.md) |
| `docs/fork/v3-migration.md` | Plan, decisions and history of the v3 upgrade |
| `FORK.md` | This file |

Paths under `src/` are relative to `Templates/`. `.gitignore` additionally ignores the local agent instruction files
`AGENTS.md` / `CLAUDE.md`.

## Upstream candidates

Generic fixes that don't depend on this deck and could be offered upstream (no PRs have been opened):

- SVG stroke loading from an inert template (`kd-fork-svg-paths.js`)
- Music reverb/echo following the music level
- Windows audio latency and overdue-bar skipping
- Esc to close the fullscreen tree; tree height by nesting depth
- Faster answer reveal and reduced-motion handling of the title/pill animations
- Comparison badges sized to the pads

## Merging upstream

1. `git fetch upstream && git merge upstream/main` on the work branch.
2. Conflicts are mostly in the four generated templates: resolve the sources in `Templates/src/` first, then run
   `python3 Tools/build.py` and `python3 Tools/build.py --check`.
3. Find fork code with `git grep -n "fork:"` and the `kd-` prefixes; the files in [Fork files](#fork-files) are
   fork-only.
4. Run `python3 Tools/check_scripts.py` and the Node tests
   (`cd Tests/js && node --test --test-concurrency=1 test_*.js`).
5. Render real cards (a kanji and a primitive note, both card types, front and back) before installing.

## License and attribution

Same as upstream, see [LICENSE](LICENSE) and the attribution section in the [README](README.md).
