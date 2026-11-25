"""Tests for the StrokeUndo add-on (Ctrl+Z undoes the last stroke on KanjiDraw cards). Stdlib only: aqt is stubbed.

    python3 -I -m unittest discover -s Tests/stroke_undo -v
"""

import importlib.util
import os
import subprocess
import sys
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Signal:
    def __init__(self):
        self.slots = []

    def connect(self, f):
        self.slots.append(f)

    def disconnect(self, f):
        if f not in self.slots:
            raise TypeError("not connected")
        self.slots.remove(f)

    def emit(self):
        for f in list(self.slots):
            f(False)


class Web:
    def __init__(self, result):
        self.result, self.calls = result, []

    def evalWithCallback(self, js, cb):
        self.calls.append(js)
        cb(self.result)


class Card:
    def __init__(self, fields):
        self.fields = fields

    def note_type(self):
        return {"flds": [{"name": n} for n in self.fields]}


class Main:
    def __init__(self):
        self.undos = 0
        self.state = "review"
        self.reviewer = types.SimpleNamespace(card=Card(["Kanji", "SVGPfade"]), state="question", web=Web(True))
        self.form = types.SimpleNamespace(actionUndo=types.SimpleNamespace(triggered=Signal()))
        self.form.actionUndo.triggered.connect(self.undo)

    def undo(self, *_):
        self.undos += 1


def load(main):
    hooks = types.SimpleNamespace(main_window_did_init=[])
    sys.modules["aqt"] = types.SimpleNamespace(gui_hooks=hooks, mw=main)
    spec = importlib.util.spec_from_file_location("stroke_undo_under_test", os.path.join(ROOT, "StrokeUndo", "__init__.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for f in hooks.main_window_did_init:
        f()
    return mod


class StrokeUndoTest(unittest.TestCase):
    def setUp(self):
        self.main = Main()
        self.mod = load(self.main)
        self.web = self.main.reviewer.web

    def tearDown(self):
        sys.modules.pop("aqt", None)

    def press(self):
        self.main.form.actionUndo.triggered.emit()

    def test_rewires_undo_once(self):
        self.assertEqual(len(self.main.form.actionUndo.triggered.slots), 1)
        self.assertNotIn(self.main.undo, self.main.form.actionUndo.triggered.slots)

    def test_stroke_undone_on_question(self):
        self.press()
        self.assertEqual((len(self.web.calls), self.main.undos), (1, 0))

    def test_falls_back_when_card_has_nothing_to_undo(self):
        for result in (False, None, "x"):
            self.web.result = result
            self.press()
        self.assertEqual(self.main.undos, 3)

    def test_anki_undo_elsewhere(self):
        cases = [("answer", "review", ["SVGPfade"]), ("question", "overview", ["SVGPfade"]),
                 ("question", "review", ["Front", "Back"])]
        for rstate, mstate, fields in cases:
            self.main.reviewer.state, self.main.state = rstate, mstate
            self.main.reviewer.card = Card(fields)
            self.press()
        self.assertEqual((len(self.web.calls), self.main.undos), (0, 3))
        self.main.state, self.main.reviewer.state, self.main.reviewer.card = "review", "question", None
        self.press()
        self.assertEqual(self.main.undos, 4)

    def test_leaves_rewired_undo_alone(self):
        main = Main()
        main.form.actionUndo.triggered.slots = [lambda *_: None]
        load(main)
        self.assertEqual(len(main.form.actionUndo.triggered.slots), 1)

    def test_package_up_to_date(self):
        out = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "Tools", "build_addons.py"), "--check"],
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)


if __name__ == "__main__":
    unittest.main()
