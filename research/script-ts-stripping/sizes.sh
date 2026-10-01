#!/bin/sh
# Bytes on disk each stripper would add if installed on its own (with all its
# dependencies), measured by a clean npm install per tool into a scratch dir.
# Usage: sh sizes.sh <scratch-dir>   (prints "tool<TAB>kB<TAB>packages")
set -e
SCRATCH=${1:-/tmp/ts-strip-sizes}
for spec in \
  "amaro amaro" \
  "ts-blank-space ts-blank-space" \
  "sucrase sucrase" \
  "babel @babel/core @babel/plugin-transform-typescript" \
  "oxc-transform oxc-transform" \
  "esbuild esbuild"; do
  set -- $spec
  name=$1; shift
  dir="$SCRATCH/$name"
  rm -rf "$dir"; mkdir -p "$dir"
  (cd "$dir" && npm init -y >/dev/null && npm i --silent --no-audit --no-fund "$@" >/dev/null)
  kb=$(du -sk "$dir/node_modules" | cut -f1)
  count=$(node "$(dirname "$0")/count-packages.mjs" "$dir/node_modules")
  printf "%s\t%s\t%s\n" "$name" "$kb" "$count"
done
