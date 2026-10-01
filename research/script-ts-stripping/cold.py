"""Time one compile the way the Frappe server would run it: Python starts a
fresh `node` process per compile. Prints the median and spread per variant.

Usage: python3 cold.py [runs]
"""

import json
import pathlib
import statistics
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).parent
VARIANTS = [
	"js",
	"node-builtin",
	"babel-parser-blank",
	"oxc-rolldown",
	"sucrase",
	"amaro-npm",
	"esbuild",
	"ts-blank-space",
	"babel",
	"typescript",
]
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 30


def once(variant):
	start = time.perf_counter()
	subprocess.run(
		["node", "--disable-warning=ExperimentalWarning", "pipeline.mjs", variant],
		cwd=HERE,
		check=True,
	)
	return (time.perf_counter() - start) * 1000


def main():
	for variant in VARIANTS:  # warm the OS file cache once
		once(variant)
	times = {variant: [] for variant in VARIANTS}
	for _ in range(RUNS):  # interleave so drift hits every variant alike
		for variant in VARIANTS:
			times[variant].append(once(variant))
	base = statistics.median(times["js"])
	result = {}
	for variant, values in times.items():
		values.sort()
		result[variant] = {
			"median_ms": round(statistics.median(values), 1),
			"p10_ms": round(values[len(values) // 10], 1),
			"p90_ms": round(values[len(values) * 9 // 10], 1),
			"added_vs_js_ms": round(statistics.median(values) - base, 1),
		}
	print(json.dumps({"runs": RUNS, "variants": result}, indent=2))


main()
