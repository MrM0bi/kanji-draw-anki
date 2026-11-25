#!/usr/bin/env python3
"""Build the fork's add-on packages (<folder>/dist/<package>.ankiaddon) from their source folders.

Sorted entries and fixed timestamps keep rebuilds stable. ``--check`` compares the committed packages' contents with
the sources (contents, not bytes: deflate output may differ between zlib versions):

    python3 Tools/build_addons.py           # build all
    python3 Tools/build_addons.py --check   # fail if a committed package is out of date
"""

from __future__ import annotations

import io
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# source folder -> (package file, files that go into it). README.md is for GitHub; Anki does not use it.
ADDONS = {
    "Migration": (
        "kanji_draw_migration.ankiaddon",
        ("__init__.py", "core.py", "dialog.py", "manifest.json", "upstream_v3_hashes.json"),
    ),
    "Highlighter": (
        "kanji_draw_highlighter.ankiaddon",
        ("__init__.py", "config.json", "config.md", "editor.js", "manifest.json"),
    ),
    "StrokeUndo": ("kanji_draw_stroke_undo.ankiaddon", ("__init__.py", "manifest.json")),
}


def build(folder: str) -> bytes:
    src = os.path.join(ROOT, folder)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(ADDONS[folder][1]):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(os.path.join(src, name), "rb") as f:
                z.writestr(info, f.read())
    return buf.getvalue()


def contents(data: bytes) -> dict:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {name: z.read(name) for name in z.namelist()}


def main() -> int:
    check = "--check" in sys.argv[1:]
    failed = False
    for folder, (package, _) in ADDONS.items():
        out = os.path.join(ROOT, folder, "dist", package)
        rel = os.path.relpath(out, ROOT)
        data = build(folder)
        if check:
            try:
                with open(out, "rb") as f:
                    current = contents(f.read())
            except (OSError, zipfile.BadZipFile):
                current = None
            if current != contents(data):
                print(f"{rel} is out of date: run python3 Tools/build_addons.py")
                failed = True
            else:
                print(f"{rel} is up to date")
            continue
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(data)
        print(f"wrote {rel} ({len(data):,} bytes)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
