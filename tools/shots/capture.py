#!/usr/bin/env python3
"""Renders README screenshots with headless Chrome via tools/shots/seed.html.
Usage: python3 tools/shots/capture.py [base_url]   (default http://127.0.0.1:4322)"""
import subprocess, sys, os, shutil, tempfile
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4322"
OUT = os.path.join(os.path.dirname(__file__), "raw"); os.makedirs(OUT, exist_ok=True)

SHOTS = {
  "timeline": "view=day&mode=scale",
  "tasks":    "view=list",
  "dark":     "view=day&mode=list&theme=dark",
  "notes":    "view=notes",
  "drag0":    "view=day&mode=scale&step=0",
  "drag1":    "view=day&mode=scale&step=1",
  "drag2":    "view=day&mode=scale&step=2",
  "drag3":    "view=day&mode=scale&step=3",
  "drag4":    "view=day&mode=scale&step=4",
  "dragdone": "view=day&mode=scale&step=done",
}
def shot(name, query):
    prof = tempfile.mkdtemp(prefix="planly-shot-")
    png = os.path.join(OUT, name + ".png")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--lang=en-US",
           "--force-device-scale-factor=2", "--window-size=390,844", "--virtual-time-budget=5000",
           "--timeout=8000", f"--user-data-dir={prof}", f"--screenshot={png}",
           f"{BASE}/tools/shots/seed.html?{query}"]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=40)
    except subprocess.TimeoutExpired:
        pass
    shutil.rmtree(prof, ignore_errors=True)
    ok = os.path.exists(png) and os.path.getsize(png) > 10000
    print(("ok   " if ok else "FAIL ") + name)
only = sys.argv[2:] 
for k, v in SHOTS.items():
    if not only or k in only: shot(k, v)
