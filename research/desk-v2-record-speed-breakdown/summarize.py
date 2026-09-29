# Groups record-js.json by source package or folder. Run: python3 summarize.py [record-js.json]
import json, re, sys
from collections import defaultdict

def group(source):
    m = re.search(r"node_modules/((?:@[^/]+/)?[^/]+)/(.*)", source)
    if m and m.group(1) == "@framework/ui":
        return "ui/src/" + m.group(2).split("/")[1] if m.group(2).startswith("src/") else "ui"
    if m:
        pkg = m.group(1)
        if pkg == "frappe-ui":
            parts = m.group(2).split("/")
            sub = parts[1] if parts[0] == "src" and len(parts) > 2 else parts[0]
            return f"frappe-ui/{sub}"
        return pkg
    m = re.match(r"(frontend/src/[^/]+|ui/src/[^/]+|frappe/[^/]+)", source)
    if m:
        return m.group(1)
    return source.split("?")[0] if source.startswith("(") else "other: " + source

def main(path="record-js.json"):
    r = json.load(open(path))
    home = set(r["pages"]["home"])
    lst = set(r["pages"]["list"])
    by_group = defaultdict(float)
    by_group_record_only = defaultdict(float)
    by_chunk_group = defaultdict(lambda: defaultdict(float))
    for f in r["pages"]["record"]:
        for src, v in r["chunks"][f]["sources"].items():
            g = group(src)
            by_group[g] += v["gzipShare"]
            by_chunk_group[f][g] += v["gzipShare"]
            if f not in home:
                by_group_record_only[g] += v["gzipShare"]
    return r, by_group, by_group_record_only, by_chunk_group

if __name__ == "__main__":
    r, by_group, extra, by_chunk = main(*sys.argv[1:])
    print("== record page, all files, by source (gzip KB share)")
    for g, v in sorted(by_group.items(), key=lambda x: -x[1]):
        if v >= 1: print(f"{v/1024:7.1f}  {g}")
    print("== files not on home, by source")
    for g, v in sorted(extra.items(), key=lambda x: -x[1]):
        if v >= 512: print(f"{v/1024:7.1f}  {g}")
    for f in sorted(by_chunk, key=lambda f: -r["chunks"][f]["gzip"])[:12]:
        print(f"== {f} {r['chunks'][f]['gzip']/1024:.1f}")
        for g, v in sorted(by_chunk[f].items(), key=lambda x: -x[1])[:10]:
            if v >= 300: print(f"   {v/1024:7.1f}  {g}")
