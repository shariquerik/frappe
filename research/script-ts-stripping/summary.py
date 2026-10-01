"""Print out/syntax.json as a compact table. Usage: python3 summary.py"""

import json
import pathlib

data = json.loads((pathlib.Path(__file__).parent / "out/syntax.json").read_text())
tools = list(next(iter(data.values())).keys())
print("snippet".ljust(40), " ".join(t[:8].ljust(8) for t in tools))
for label, row in data.items():
	cells = ("ERR" if row[t].startswith("error") else row[t] for t in tools)
	print(label[:40].ljust(40), " ".join(c.ljust(8) for c in cells))
