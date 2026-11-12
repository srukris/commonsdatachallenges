"""Reads an edited prefill-options.xlsx and rewrites public/content.js (personas and themes are kept)."""
import json, sys, os, re
from openpyxl import load_workbook
sys.path.insert(0, os.path.dirname(__file__))
from prefill_source import PERSONAS, THEMES
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "prefill-options.xlsx")
tmap = {"data": "d", "challenge": "c", "coping": "h"}
pre = {p["id"]: {t["id"]: {"d": [], "c": [], "h": []} for t in THEMES} for p in PERSONAS}
ws = load_workbook(src)["Prefill"]
bad = 0
for row in ws.iter_rows(min_row=2, values_only=True):
    pid, _, tid, _, typ, text = (list(row) + [None] * 6)[:6]
    if not text: continue
    typ = str(typ or "").strip().lower()
    if pid not in pre or tid not in pre[pid] or typ not in tmap:
        bad += 1; print("skipped row:", row); continue
    pre[pid][tid][tmap[typ]].append(re.sub(r"\s+", " ", str(text)).strip()[:300])
open(os.path.join(root, "public/content.js"), "w").write("window.CONTENT = " + json.dumps({"personas": PERSONAS, "themes": THEMES, "pre": pre}, ensure_ascii=False, indent=1) + ";\n")
print("written; skipped", bad)
