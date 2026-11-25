# StrokeUndo – Strg+Z für Striche

Ein kleines Anki-Desktop-Add-on (ab Anki 23.10) für KanjiDraw-Karten. In Anki ist Strg+Z der Menüeintrag
*Bearbeiten → Rückgängig* (zurück zur letzten Karte); die Karte selbst bekommt die Taste nie zu sehen.

**Download:** [`dist/kanji_draw_stroke_undo.ankiaddon`](dist/kanji_draw_stroke_undo.ankiaddon) (auf GitHub: Datei
öffnen → *Download raw file*), in Anki per *Extras → Add-ons → Aus Datei installieren*, danach Anki neu starten.

## Verhalten

| Situation | Strg+Z |
|---|---|
| Vorderseite einer KanjiDraw-Karte, freies Zeichnen, mindestens ein Strich im Feld | nimmt den letzten Strich zurück (wie der Rückgängig-Knopf) |
| Leeres Zeichenfeld, geführtes Zeichnen, Rückseite | Ankis Rückgängig |
| Andere Notiztypen, Browser, Stapelübersicht | Ankis Rückgängig, unverändert |

Das Add-on verbindet den Menüeintrag *Rückgängig* neu: Es fragt zuerst die Karte (`window._kdUndoStroke()`, siehe
`Templates/src/front/kd-fork-erase.js`) und ruft nur dann Ankis Rückgängig auf, wenn die Karte nichts zurückzunehmen
hat. Hat ein anderes Add-on den Eintrag schon umgebogen, lässt es ihn in Ruhe. KanjiDraw-Notiztypen erkennt es am
Feld `SVGPfade`, wie das Persistence-Add-on.

Ohne das Add-on erreicht Strg+Z die Karte nur, wenn Anki gerade nichts rückgängig machen kann (der Menüeintrag ist
dann ausgegraut).

## Entwicklung

- Nach Änderungen an `__init__.py` oder `manifest.json`: `python3 Tools/build_addons.py` (ein Test
  schlägt bei veraltetem Paket fehl).
- Tests: `python3 -I -m unittest discover -s Tests/stroke_undo -v` (nur Standardbibliothek, `aqt` ist ersetzt).
