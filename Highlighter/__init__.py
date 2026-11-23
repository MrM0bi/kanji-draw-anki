"""KanjiDraw: Eselsbrücken markieren – editor buttons for the coloured highlights in the mnemonic texts.

Adds eight buttons to the editor toolbar (Add, Edit, Browse) of KanjiDraw notes: keyword, components 1–6 and
"remove". They set, recolour or remove <span class="kd-kw kd-k|kd-c1…kd-c6"> in the rich-text editor and the HTML
editor. The work happens in editor.js; this file adds the buttons and shortcuts and shows the result messages.
"""

from __future__ import annotations

import json
import os

from aqt import gui_hooks, mw
from aqt.editor import Editor
from aqt.utils import tooltip

_DIR = os.path.dirname(os.path.abspath(__file__))
_MARKER_FIELD = "SVGPfade"  # same test as the persistence add-on: the note type has this field

with open(os.path.join(_DIR, "editor.js"), encoding="utf-8") as _f:
    _JS = _f.read()

_CHIP = (
    "display:inline-block;min-width:1.25em;padding:0 .3em;border-radius:5px;"
    "font-weight:800;line-height:1.5;text-align:center;color:{fg};background:{bg};"
)
_ERASER = (
    '<svg width="16" height="16" viewBox="2 2.2 20 20" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto">'
    '<path d="M7 21h10"/><path d="M3.6 13.4 13 4a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L12 19H7.8l-4.2-4.2a1 1 0 0 1 '
    '0-1.4z"/><path d="m9 8 7 7"/></svg>'
)

# code, label, tooltip, chip colours (text, background)
_BUTTONS = [
    ("k", "K", "Schlüsselwort", ("#3c752a", "#d5edca")),
    ("c1", "1", "Teil 1, blau", ("#13719e", "#c3e6f6")),
    ("c2", "2", "Teil 2, violett", ("#9b33b3", "#f3d6f9")),
    ("c3", "3", "Teil 3, orange", ("#9a5a06", "#fbe4c5")),
    ("c4", "4", "Teil 4, grün", ("#1c7f53", "#c9eddd")),
    ("c5", "5", "Teil 5, rot", ("#b8372f", "#f9d3d1")),
    ("c6", "6", "Teil 6, lila", ("#5546c8", "#dedafb")),
]


def _config() -> dict:
    return mw.addonManager.getConfig(__name__) or {}


def _is_kanji_draw(editor: Editor) -> bool:
    note = editor.note
    return note is not None and _MARKER_FIELD in note.keys()


def _run(editor: Editor, op: str, code: str = "") -> None:
    if not _is_kanji_draw(editor):
        return

    def done(msg) -> None:
        if msg:
            tooltip(str(msg), parent=editor.widget)

    editor.web.evalWithCallback(f"{_JS}\nkdHl.run({json.dumps(op)}, {json.dumps(code)});", done)


def _on_init_buttons(buttons: list[str], editor: Editor) -> None:
    keys = _config().get("shortcuts", {})
    for code, label, tip, (fg, bg) in _BUTTONS:
        key = keys.get(code) or None
        buttons.append(
            editor.addButton(
                icon=None,
                cmd=f"kdhl_{code}",
                func=lambda ed, c=code: _run(ed, "apply", c),
                tip=f"Markieren: {tip}" + (f" ({key})" if key else ""),
                label=f'<span style="{_CHIP.format(fg=fg, bg=bg)}">{label}</span>',
                id=f"kdhl-{code}",
                keys=key,
            )
        )
    key = keys.get("erase") or None
    buttons.append(
        editor.addButton(
            icon=None,
            cmd="kdhl_erase",
            func=lambda ed: _run(ed, "erase"),
            tip="Markierung entfernen" + (f" ({key})" if key else ""),
            label=_ERASER,
            id="kdhl-erase",
            keys=key,
        )
    )


def _on_load_note(editor: Editor) -> None:
    editor.web.eval(f"{_JS}\nkdHl.setup({json.dumps(_is_kanji_draw(editor))});")


gui_hooks.editor_did_init_buttons.append(_on_init_buttons)
gui_hooks.editor_did_load_note.append(_on_load_note)
