"""Generates public/content.js and prefill-options.xlsx from prefill_source.py"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from prefill_source import PERSONAS, THEMES, P
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pre = {p["id"]: {t["id"]: {"d": P[p["id"]][t["id"]][0], "c": P[p["id"]][t["id"]][1], "h": P[p["id"]][t["id"]][2]} for t in THEMES} for p in PERSONAS}
open(os.path.join(root, "public/content.js"), "w").write("window.CONTENT = " + json.dumps({"personas": PERSONAS, "themes": THEMES, "pre": pre}, ensure_ascii=False, indent=1) + ";\n")
wb = Workbook(); ws = wb.active; ws.title = "Prefill"
hdr = ["persona_id", "persona", "theme_id", "theme", "type", "text"]
ws.append(hdr)
for c in ws[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0B46C0")
tn = {"d": "data", "c": "challenge", "h": "coping"}
for p in PERSONAS:
    for t in THEMES:
        for k in "dch":
            for x in pre[p["id"]][t["id"]][k]:
                ws.append([p["id"], p["name"], t["id"], t["name"], tn[k], x])
for col, w in zip("ABCDEF", [11, 28, 10, 20, 11, 90]): ws.column_dimensions[col].width = w
ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions
for r in ws.iter_rows(min_row=2):
    r[5].alignment = Alignment(wrap_text=True, vertical="top")
n = wb.create_sheet("Read me")
for line in ["Edit the 'text' column in sheet Prefill. Add or delete rows freely (keep persona_id, theme_id and type).",
             "type must be: data, challenge or coping. Ids: personas pm fo gov adv fund res ena; themes nr ppl inst.",
             "Then run: python3 tools/xlsx_to_content.py prefill-options.xlsx  (regenerates public/content.js) and redeploy."]:
    n.append([line])
n.column_dimensions["A"].width = 120
wb.save(os.path.join(root, "prefill-options.xlsx"))
print("built")
