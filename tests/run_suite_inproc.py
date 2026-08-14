import os
import sys
import threading
import time
import tempfile
import uuid
from pathlib import Path

BASE = r"F:\NSA\Mystic\PDFTOOLS"
os.environ["TMP"] = os.environ["TEMP"] = BASE + r"\tests\tmp_repro"
os.environ["MYSTIC_URL"] = "http://127.0.0.1:8766"
sys.path.insert(0, BASE)
sys.path.insert(0, BASE + r"\tests")

_real_mkdtemp = tempfile.mkdtemp


def _mkdtemp(prefix=None, suffix=None, dir=None):
    base = Path(dir or tempfile.gettempdir())
    name = (prefix or "") + uuid.uuid4().hex[:10] + (suffix or "")
    d = base / name
    d.mkdir(parents=True, exist_ok=True)
    return str(d)


tempfile.mkdtemp = _mkdtemp

import uvicorn
import server

config = uvicorn.Config(server.app, host="127.0.0.1", port=8766, log_level="warning")
srv = uvicorn.Server(config)
threading.Thread(target=srv.run, daemon=True).start()

import requests
for _ in range(60):
    try:
        requests.get("http://127.0.0.1:8766/api/health", timeout=2)
        break
    except Exception:
        time.sleep(0.5)
else:
    raise SystemExit("server never came up")

import test_endpoints
test_endpoints.main()
srv.should_exit = True
