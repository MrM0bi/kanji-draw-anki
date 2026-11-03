# About this fork

This is a personal fork of [PawMethod/kanji-draw-anki](https://github.com/PawMethod/kanji-draw-anki). It adapts the
KanjiDraw note type to a German Heisig deck (*„Die Kanji lernen und behalten“*, 4th ed.) with its own field set
and some extra features. Everything else, including the [README](README.md), is upstream's work and documentation.

The fork tries to stay as close to upstream as possible so upstream updates can be merged easily:

- Fork changes are small and additive. Fork-only code is marked with `fork:` comments, uses `kd-`-prefixed CSS
  classes and lives in its own scripts (shared code under `Templates/src/`, built with `Tools/build.py`).
- Upstream code isn't refactored or reformatted.
- Upstream updates come in with `git merge upstream/main`.

> **Status (2026-11-03):** `main` is still based on upstream before v3. This branch (`t3/reconcile-v3-fork`) has
> merged upstream **v3.0.0** and rebuilt the fork changes on top, see
> [`docs/fork/v3-migration.md`](docs/fork/v3-migration.md). The list below describes the v3 version.

## Fields

The templates use this fork's field names instead of upstream's:

| Upstream | This fork |
|---|---|
| `Bedeutung` | `Bedeutung-DE`, optionally overridden by `Bedeutung-Override` |
| `JLPT` | `JLPT-Level` |
| `Nummer` | `Kanjinummer-BuchDE-Edition-4` (from v3 on) |
| `Eselsbrücke` | `Merksatz-KI` (from v3 on) |

Upstream's `Merkhilfe` and `Stolperfallen` keep their names. Additional fields used by the templates:
`PrimitivBedeutung-DE`, `PrimitivBedeutung-Override`, `Merksatz-DE`, `Merksatz-Custom`, `BuchBeschreibung`,
`BuchPrimitivBeschreibung`, `Nanori`, `Notiz`.

The deck also contains **primitive notes**. Their `Kanji` field holds a bracketed name such as `[Spazierstock]`
instead of a glyph. The templates detect them by the leading `[`.

## Changes

| Change | Description |
|---|---|
| Inline back side | Instead of upstream's info modal, the back shows everything as collapsible sections: Elemente (component tree with zoom/fullscreen), Strichfolge (player), Eselsbrücken, Notiz, Schreibfehler, Wortbeispiele, Lesungen, Externe Links. Each section remembers whether it's open. Strichfolge and Schreibfehler start closed and load on first open. Order and titles come from one list (`KD_SECTIONS` in `Templates/src/back/kd-fork-sections.js`). The header shows JLPT, frequency and the book number. |
| Several mnemonics | "Eselsbrücken" shows a custom Merksatz, the German Merksatz, a `KANJIDRAW` group (upstream's hint and mnemonic) and the book descriptions under a muted `HEISIG` label. |
| Notiz | A free-form note section, hidden when empty. |
| Nanori | A third reading row with a muted `NANORI` label. |
| Primitive meanings | Primitive meanings are shown as separate pills next to the keyword pill, with a small `PRIMITIVE` tag. |
| Meaning overrides | `Bedeutung-Override` / `PrimitivBedeutung-Override` replace the keyword when filled. |
| Handschriftbeispiele | An optional setting (page "Rückseite") that shows the kanji in three more fonts above the tree. The fonts are collection media files (`_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`, `_kanji_font4_KouzanGyousho.otf`) and are not part of this repo. |
| Primitive notes | No font samples for primitives. "Elemente" is hidden when it only names the primitive itself. |
| Faster reveal | The info area fades in over 0.1 s. |
| Minimal design | A global setting ("Design: Verspielt / Minimal" on "Erscheinungsbild") switches the whole UI to the plain pre-v3 look with the old icons. All v3 features stay. With the accent "Schlicht" it is black/white; with other accents it keeps the Japan-Theme colours. |
| Accent "Schlicht" | A black/white accent colour. |
| Long keywords | Long one-word keywords hyphenate or shrink to fit the title pill instead of running into the gear button. |
| Landscape on the back | The back is taller than one screen, so the landscape sits at the bottom of the page instead of the screen. |

## License and attribution

Same as upstream, see [LICENSE](LICENSE) and the attribution section in the [README](README.md).
