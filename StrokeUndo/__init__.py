"""KanjiDraw: Strg+Z für Striche – Ctrl+Z undoes the last drawn stroke on KanjiDraw cards.

Anki's Ctrl+Z is the menu entry Edit → Undo, so the card never sees the key. This add-on reconnects that entry:
on the question side of a KanjiDraw card it first asks the card to undo its last free-mode stroke
(``window._kdUndoStroke()``, see Templates/src/front/kd-fork-erase.js). Only if the card has nothing to undo
(empty drawing box, guided mode, a card from an older template) does Anki's normal undo run. Everywhere else
(answer side, other note types, browser, deck list) Ctrl+Z behaves exactly as before.
"""

from __future__ import annotations

import logging

from aqt import gui_hooks, mw

_log = logging.getLogger(__name__)

# KanjiDraw note types are identified by this field (as in the Kanji Draw Persistence add-on).
_MARKER_FIELD = "SVGPfade"
_JS = "(function(){try{return !!(window._kdUndoStroke&&window._kdUndoStroke());}catch(e){return false;}})()"


def _is_kanji_draw_card(card) -> bool:
    try:
        return any(f.get("name") == _MARKER_FIELD for f in card.note_type()["flds"])
    except Exception:
        return False


def on_undo(main=None) -> None:
    """Replacement slot for Edit → Undo."""
    main = main or mw
    reviewer = getattr(main, "reviewer", None)
    card = getattr(reviewer, "card", None)
    if (
        main.state == "review"
        and card is not None
        and getattr(reviewer, "state", None) == "question"
        and _is_kanji_draw_card(card)
    ):

        def done(undone) -> None:
            if undone is not True:
                main.undo()

        reviewer.web.evalWithCallback(_JS, done)
        return
    main.undo()


def _install() -> None:
    action = mw.form.actionUndo
    try:
        action.triggered.disconnect(mw.undo)
    except (TypeError, RuntimeError) as e:
        # Someone else rewired Undo: leave it alone rather than undoing twice per key press.
        _log.warning("KanjiDraw stroke undo not installed: %s", e)
        return
    action.triggered.connect(lambda _checked=False: on_undo())


gui_hooks.main_window_did_init.append(_install)
