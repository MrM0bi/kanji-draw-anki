# Highlighter – Eselsbrücken markieren

Ein optionales Anki-Desktop-Add-on (ab Anki 23.10). Es fügt dem Karteneditor (Hinzufügen, Bearbeiten, Kartenverwaltung)
Knöpfe hinzu, mit denen man die farbigen Markierungen in den Merksätzen setzt, umfärbt und entfernt. Die Karten brauchen
das Add-on nicht; es erspart nur das Tippen der Spans.

**Download:** [`dist/kanji_draw_highlighter.ankiaddon`](dist/kanji_draw_highlighter.ankiaddon) (auf GitHub: Datei öffnen →
*Download raw file*), dann Extras → Erweiterungen → *Aus Datei installieren…* und Anki neu starten.

## Knöpfe

| Knopf | Kürzel | Setzt |
|---|---|---|
| **K** | Alt+0 | `<span class="kd-kw kd-k">` – das Schlüsselwort (Akzentfarbe) |
| **1** … **6** | Alt+1 … Alt+6 | `<span class="kd-kw kd-c1">` … `kd-c6` – Teil 1 … 6 des Baums (blau, violett, orange, grün, rot, lila) |
| Radiergummi | Alt+Entf | entfernt die Markierung |

Die Knöpfe erscheinen nur bei KanjiDraw-Notizen (Notiztyp mit dem Feld `SVGPfade`). Die Kürzel lassen sich unter
Extras → Erweiterungen → *Konfiguration* ändern oder abschalten.

## Verhalten

Gleich im normalen Editor und im HTML-Editor (Strg+Umschalt+X):

- **Text ausgewählt:** wird markiert. Leerzeichen am Rand der Auswahl bleiben draußen. Markierungen innerhalb der
  Auswahl werden durch die neue ersetzt.
- **Nur Cursor:** In einer Markierung wird sie umgefärbt, sonst wird das Wort am Cursor markiert.
- **Teil einer Markierung ausgewählt:** Die Markierung wird an der Auswahl geteilt, z. B. aus „großer Hund“ (1) wird
  „großer“ (1) + „Hund“ (2).
- **Auswahl schneidet ein anderes Element** (z. B. nur halb in `<b>…</b>`): Die Auswahl wird so erweitert, dass das
  HTML gültig bleibt.
- **Radiergummi:** entfernt die Markierung am Cursor oder alle, die die Auswahl berührt. Der Text bleibt.
- Andere Klassen und Attribute einer Markierung bleiben beim Umfärben erhalten. Spans ohne `kd-kw` werden nie
  angefasst.

Im normalen Editor zeigt das Add-on die Markierungen in den Farben der Karte (hell und dunkel), damit man sieht, was
markiert ist.

**Rückgängig:** Im HTML-Editor ist jeder Klick ein Schritt für Strg+Z. Im normalen Editor greift Strg+Z dafür nicht;
dort die Markierung mit dem Radiergummi wieder entfernen.

**MathJax:** Enthält ein Feld MathJax, markiert das Add-on nur im HTML-Editor.

## Dateien

| Datei | Inhalt |
|---|---|
| [manifest.json](manifest.json) | Paketname, Version, Mindestversion |
| [config.json](config.json), [config.md](config.md) | Tastenkürzel und ihre Beschreibung im Konfigurationsdialog |
| [__init__.py](__init__.py) | Knöpfe und Kürzel (Hook `editor_did_init_buttons`), Ein-/Ausblenden pro Notiz (`editor_did_load_note`), Meldungen als Tooltip |
| [editor.js](editor.js) | die eigentliche Arbeit, siehe unten |
| [dist/kanji_draw_highlighter.ankiaddon](dist/kanji_draw_highlighter.ankiaddon) | das fertige Paket |

`editor.js` hat einen Kern ohne DOM, der auf dem HTML des Feldes als Text mit einer Auswahl `[a, b)` arbeitet
(`apply`, `erase`). Im HTML-Editor kommen Text und Auswahl direkt aus CodeMirror; die Änderung geht als ein
`replaceRange` zurück. Im normalen Editor kopiert das Add-on das Feld mit zwei Markierungszeichen an der Auswahl,
ändert das HTML, schreibt es zurück und stellt die Auswahl über die Markierungszeichen wieder her. Ankis
DOM-Spiegel (MutationObserver) übernimmt die Änderung ins Feld.

## Paket bauen und testen

```sh
python3 Tools/build_addons.py         # baut dieses und das Migrations-Paket
cd Tests/js && node --test test_highlighter.js
```

[`Tests/js/test_highlighter.js`](../Tests/js/test_highlighter.js) prüft den Kern (Markieren, Umfärben, Teilen,
Erweitern, Entfernen). Der Test des Migrations-Add-ons schlägt fehl, wenn eines der Pakete nicht zu den Quellen passt.
