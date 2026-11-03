# About this fork

This is a personal fork of [PawMethod/kanji-draw-anki](https://github.com/PawMethod/kanji-draw-anki). It adapts the
KanjiDraw note type to a German Heisig deck (*„Die Kanji lernen und behalten“*, 4th ed.) with its own field set
and some extra features. Everything else, including the [README](README.md), is upstream's work and documentation.

The fork tries to stay as close to upstream as possible so upstream updates can be merged easily:

- Fork changes are small and additive. Fork-only code is marked with `fork:` comments, uses `kd-`-prefixed CSS
  classes and lives in its own scripts (shared code under `Templates/src/`, built with `Tools/build.py`).
- Upstream code isn't refactored or reformatted.
- Upstream updates come in with `git merge upstream/main`.

> **Status (2026-11-03):** `main` is still based on upstream before v3. The upgrade to upstream **v3.0.0** is in
> progress on branch `t3/reconcile-v3-fork`, see [`docs/fork/v3-migration.md`](docs/fork/v3-migration.md) there.
> The list below describes `main`.

## Fields

The templates use this fork's field names instead of upstream's:

| Upstream | This fork |
|---|---|
| `Bedeutung` | `Bedeutung-DE`, optionally overridden by `Bedeutung-Override` |
| `JLPT` | `JLPT-Level` |
| `Nummer` | `Kanjinummer-BuchDE-Edition-4` (from v3 on) |
| `Eselsbrücke` | `Merksatz-KI` (from v3 on) |

Additional fields used by the templates: `PrimitivBedeutung-DE`, `PrimitivBedeutung-Override`, `Merksatz-DE`,
`Merksatz-Custom`, `BuchBeschreibung`, `BuchPrimitivBeschreibung`, `Nanori`, `Notiz`,
`Kanjinummer-BuchEN-Edition-6` (before v3).

The deck also contains **primitive notes**. Their `Kanji` field holds a bracketed name such as `[Spazierstock]`
instead of a glyph. The templates detect them by the leading `[`.

## Changes

| Change | Description |
|---|---|
| Inline back side | Instead of the 📖 info modal, the back shows the info directly as collapsible sections. Each section remembers whether it's open. |
| Several mnemonics | The "Eselsbrücken" section shows a custom Merksatz, the German Merksatz, and the book descriptions under a muted `HEISIG` label. |
| Notiz | A free-form note section, hidden when empty. |
| Nanori | A third reading row with a muted `NANORI` label. |
| Primitive meanings | Primitive meanings are shown as chips next to the keyword on the front. |
| Meaning overrides | `Bedeutung-Override` / `PrimitivBedeutung-Override` replace the keyword when filled. |
| Handschriftbeispiele | An optional setting that shows the kanji in three more fonts. The fonts are collection media files (`_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`, `_kanji_font4_KouzanGyousho.otf`) and are not part of this repo. |
| Primitive notes | No font samples or tree root row for primitives. "Elemente" is hidden when it only names the primitive itself. |
| Faster reveal | The answer reveal animation was shortened (0.35 s → 0.1 s). |

## License and attribution

Same as upstream, see [LICENSE](LICENSE) and the attribution section in the [README](README.md).
