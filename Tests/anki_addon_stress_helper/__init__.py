"""
KanjiDraw Stress Test Helper Addon
===================================
Exposes a local HTTP server at port 8767 so the external stress test script
can execute arbitrary JavaScript in Anki's card WebView.

Endpoints:
  POST /eval        — fire-and-forget: runs JS via mw.web.eval(), returns immediately
  POST /eval_sync   — runs JS, waits up to 3s for a return value via localStorage polling
  DELETE /shutdown  — gracefully shut down the server

Body for POST: {"js": "<javascript code>"}
Response:      {"result": <value_or_null>, "error": <string_or_null>}

Installation: copy this folder into Anki's addons21 directory and restart Anki.
"""
import json, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from aqt import mw
from aqt.qt import QTimer

PORT = 8767
_server = None


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass  # silence access log

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            self._send(400, {"error": "bad json"})
            return

        js_code = body.get("js", "")
        if not js_code:
            self._send(400, {"error": "no js"})
            return

        if self.path == "/eval":
            # Schedule execution on the Qt main thread and return immediately
            QTimer.singleShot(0, lambda: mw.web.eval(js_code) if mw.web else None)
            self._send(200, {"result": None, "error": None})

        elif self.path == "/eval_sync":
            import uuid
            key = "__kdptest_" + uuid.uuid4().hex[:12] + "__"

            # Wrap user code: store return value or exception in localStorage
            wrapped = (
                "(function(){try{"
                "var __r=(function(){" + js_code + "})();"
                "localStorage.setItem('" + key + "',JSON.stringify({r:__r===undefined?null:__r}));"
                "}catch(e){"
                "localStorage.setItem('" + key + "',JSON.stringify({e:String(e)}));"
                "}})()"
            )

            # 1. Clear any stale result, then run the wrapped code
            QTimer.singleShot(0, lambda: mw.web.eval("localStorage.removeItem('" + key + "')") if mw.web else None)
            time.sleep(0.08)
            QTimer.singleShot(0, lambda: mw.web.eval(wrapped) if mw.web else None)

            # 2. Poll localStorage via Qt's async runJavaScript until result appears
            store = {"result": None, "error": "timeout"}
            deadline = time.time() + 3.0
            while time.time() < deadline:
                time.sleep(0.06)
                ev = threading.Event()
                poll = [None]

                def _poll(ev=ev, poll=poll):
                    try:
                        mw.web.page().runJavaScript(
                            "localStorage.getItem('" + key + "')",
                            lambda v: (poll.__setitem__(0, v), ev.set())
                        )
                    except Exception:
                        ev.set()

                QTimer.singleShot(0, _poll)
                ev.wait(1.0)

                if poll[0] is not None:
                    try:
                        p = json.loads(poll[0])
                        store = {"result": p.get("r"), "error": p.get("e")}
                    except Exception:
                        store = {"result": poll[0], "error": None}
                    # Clean up the temporary localStorage key
                    QTimer.singleShot(0, lambda: mw.web.eval("localStorage.removeItem('" + key + "')") if mw.web else None)
                    break

            self._send(200, store)
        else:
            self._send(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path == "/shutdown":
            self._send(200, {"result": "ok"})
            threading.Thread(target=_server.shutdown, daemon=True).start()


def _start_server():
    global _server
    _server = HTTPServer(("127.0.0.1", PORT), _Handler)
    _server.serve_forever()


threading.Thread(target=_start_server, daemon=True).start()
