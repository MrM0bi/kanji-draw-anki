# About this fork

This is a personal fork of [PawMethod/kanji-draw-anki](https://github.com/PawMethod/kanji-draw-anki). It adapts the
KanjiDraw note type to a German Heisig deck (*„Die Kanji lernen und behalten“*, 4th ed.) with its own field set
and some extra features. Everything else, including the [README](README.md), is upstream's work and documentation.

The fork tries to stay as close to upstream as possible so upstream updates can be merged easily:

- Fork changes are small and additive. Fork-only code is marked with `fork:` comments, uses `kd-`-prefixed CSS
  classes and lives in its own scripts (shared code under `Templates/src/`, built with `Tools/build.py`).
- Upstream code isn't refactored or reformatted.
- Upstream updates come in with `git merge upstream/main`.

> **Status (2026-11-09):** `main` is still based on upstream before v3. This branch (`t3/reconcile-v3-fork`) has
> merged upstream **v3.0.0** and rebuilt the fork changes on top, see
> [`docs/fork/v3-migration.md`](docs/fork/v3-migration.md). The list below describes the v3 version. This
> checkpoint includes the November 8 device-feedback fixes and November 9 faster word reveal. The approved
> data, 30-field model and templates/CSS are installed and verified in the study profile; the earlier mobile
> sync completed. The faster-reveal follow-up is also installed and exactly verified after fresh backup/approval.
> Repository release/merge is a separate step and has not been authorized.

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
| Inline back side | Instead of upstream's info modal, the back shows everything as collapsible sections: Elemente (component tree with zoom/fullscreen), Eselsbrücken, Strichfolge (player), Notiz, Schreibfehler, Wortbeispiele, Lesungen, Externe Links. Each section remembers whether it's open. Strichfolge and Schreibfehler start closed and load on first open. Order and titles come from one list (`KD_SECTIONS` in `Templates/src/back/kd-fork-sections.js`). The header shows JLPT, frequency and the book number. |
| Several mnemonics | "Eselsbrücken" shows a custom Merksatz, the German Merksatz, a `KANJIDRAW` group (upstream's hint and mnemonic) and the book descriptions under a muted `HEISIG` label. Rückseite has independent Merksätze / KanjiDraw / Heisig toggle chips in one row (mouse, touch and keyboard); Merksätze includes the custom and German stories. KanjiDraw starts hidden. |
| Notiz | A free-form note section, hidden when empty. |
| Nanori | A third reading row with a muted `NANORI` label, independently switchable in the back settings for each card type, hidden by default. |
| Primitive meanings | Primitive meanings share a wrapping row with the keyword pill; each pill wraps independently when needed. Phone headers use their available content width with compact padding and reserve only the gear's side, so short pills sit beside each other even at 320px. The `PRIMITIVE` tag follows the top-right primitive pill after resizing or changing fonts/design and stays inside its pill on phones. Secondary text stays smaller than the main meaning. Long labels wrap; keyword fitting runs after the primitive text is separated. |
| Meaning overrides | `Bedeutung-Override` / `PrimitivBedeutung-Override` replace the keyword when filled. |
| Handschriftbeispiele | A setting enabled by default (page "Rückseite") that shows the kanji in three more fonts above the tree. The fonts are collection media files (`_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`, `_kanji_font4_KouzanGyousho.otf`) and are not part of this repo. |
| Primitive notes | No font samples for primitives. "Elemente" is hidden when it only names the primitive itself. |
| Faster reveal | The info area fades in over 0.1 s. Keyword and primitive pills enter together in 0.18 s, without stagger. Card 2 reveals both answer meanings in 0.15 s without delay (previously 0.40/0.45 s including delay). Reduced-motion preferences disable these title/pill animations. The November 9 follow-up is included in this checkpoint, installed and verified after user approval and a fresh backup. |
| Minimal design | A global setting ("Design: Verspielt / Minimal" on "Erscheinungsbild") switches the whole UI to the plain pre-v3 look with the old icons. All v3 features stay. Surfaces stay neutral with every accent; accent colours are selected independently. Classic outline artwork is used for menus, sections and 49 settings choices. The classic artwork retains its original SVG view boxes when switching designs. The Minimal preview follows the text colour in all themes; settings highlights use the selected accent in either card tab. The frequency badge has its classic tinted surface, readable accent text and simple three-line icon. Player controls, Schreibfehler, tree tools, sound settings and Danke follow the same skin; tool buttons have larger touch targets. Danke keeps distinct rating/feedback icons when switching designs. |
| Accent "Schlicht" | A black/white accent colour with a clipped, clean-edged swatch. All swatches/buttons share the same sizing; phone layouts wrap them into four columns. |
| Tree root meaning | The root kanji has the same label pill as its components, using `Bedeutung-Override` when filled, otherwise `Bedeutung-DE`. Primitive root hiding stays in place. |
| Word examples | Furigana sit slightly higher above the kanji. |
| Free-drawing comparison | The back shows your handwriting next to the reference, including grading, stroke numbers and missing/extra-stroke controls. Front and back resolve the same drawing-mode default, including fresh installations without a saved mode. Empty free-mode previews can show the missing strokes beside the reference too. Switch between Nebeneinander / Einzeln in Rückseite; guided drawing and Card 2 retain their normal display. The comparison takes only the height of its two pads, without reserving a full-size kanji square, with an 8px gap above the pads. |
| SVG stroke loading | Both cards read the stroke field from an inert template and create SVG paths explicitly. HTML line breaks or wrappers around strokes cannot end the live SVG after its first path. Stroke order and path data are preserved; note fields are unchanged. |
| Windows audio | Engine 1.2.1 (1.2.2 since the volume change) requests balanced output latency on Windows and skips overdue bars after UI stalls. This generic scheduling fix could also go upstream. On November 8 the user reported Piano seems unaffected and parked further investigation, suspecting their local setup. The cause remains unconfirmed; engine and sound defaults stay unchanged. |
| Long keywords | Long one-word keywords hyphenate or shrink to fit the title pill instead of running into the gear button. |
| Landscape on the back | The back is taller than one screen, so the landscape sits at the bottom of the page instead of the screen. |
| Mnemonic text style | Merksatz and Heisig texts are upright, like the KanjiDraw texts (they were italic, which read as a different typeface). |
| Comparison badges | The "Striche zu viel / zu wenig" badges have the width of the two pads, so each stays under its drawing on wide screens. |
| Component tree | Zoom and fullscreen buttons are 36px in Verspielt (42px on touch screens; Minimal keeps 40/44px). Esc closes the fullscreen tree. Trees with four or more levels get a taller box (+90px per extra level, up to 590px) so their nodes stay readable. Esc and the depth-based height are generic and could go upstream. |
| Music volume | Engine 1.2.2: the music's reverb and echo follow the music level (they bypassed it, so the three steps differed by only about 5 dB), and the levels are lower (0.16 / 0.32 / 0.55 instead of 0.45 / 0.7 / 1). "Leise" is about 8-10 dB quieter; stroke sounds and effects are unchanged. The bypass fix is generic and could go upstream. |
| Pen scrolling | On Anki Desktop a pen swipe (e.g. Windows Ink) scrolls the card or the settings dialog, as in a browser; Qt WebEngine otherwise treats it as a mouse drag. The drawing pad and the tree keep their own pen handling; mouse input and other platforms are unchanged. |

## Defaults (2026-11-08)

Saved selections take precedence over the deck's CSS defaults; this update does not reset existing preferences.

| Settings page | Defaults |
|---|---|
| Zeichnen | Frei; a saved Geführt choice still takes precedence |
| Rückseite | Merksätze on, KanjiDraw off, Heisig on, Nanori off, comparison Nebeneinander, handwriting examples on |
| Erscheinungsbild | Verspielt, System, green accent, random Japan theme |
| Klang & Musik | Overall Leise, LoFi, reaction Dezent, music volume Leise, stroke sounds on, effect sounds on |

Sound defaults live in `Styling.css` as `--default-sound-*`, resolved consistently by the radio controls
and the sound bridge. Music still follows browser gesture/autoplay restrictions.

## License and attribution

Same as upstream, see [LICENSE](LICENSE) and the attribution section in the [README](README.md).
