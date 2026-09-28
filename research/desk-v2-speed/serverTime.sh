#!/usr/bin/env bash
# Times the boot, meta, record read and activity requests one after another, with no browser.
# Usage: RUNS=10 ./serverTime.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://crm.localhost:8019}"
RECORD="${RECORD:-CRM-LEAD-2026-00002}"
RUNS="${RUNS:-10}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

curl -s -c "$JAR" -X POST "$BASE_URL/api/method/login" -d usr=Administrator -d pwd=admin >/dev/null
VERSION=$(curl -s -b "$JAR" "$BASE_URL/api/v2/method/frappe.shell.boot.get_boot?path=/apps/crm" |
	python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["metadata_version"])')
INCLUDE="permissions,assignments,shares,tags,favourites,follows,users,link_titles"

declare -a NAMES=(boot addresses meta record activity v1_getdoc)
declare -a URLS=(
	"/api/v2/method/frappe.shell.boot.get_boot?path=%2Fapps%2Fcrm%2Fcrm-lead%2F$RECORD"
	"/api/v2/method/frappe.shell.doctypes.get_addresses?v=$VERSION"
	"/api/v2/doctype/CRM%20Lead/meta?include=children"
	"/api/v2/document/CRM%20Lead/$RECORD?include=$INCLUDE"
	"/api/v2/document/CRM%20Lead/$RECORD/activity"
	"/api/method/frappe.desk.form.load.getdoc?doctype=CRM%20Lead&name=$RECORD"
)

for index in "${!NAMES[@]}"; do
	for _ in $(seq "$RUNS"); do
		curl -s -b "$JAR" -o /dev/null -w '%{time_pretransfer} %{time_starttransfer} %{size_download}\n' \
			"$BASE_URL${URLS[$index]}"
	done | awk '{ printf "%.1f %d\n", ($2 - $1) * 1000, $3 }' | sort -n | awk -v name="${NAMES[$index]}" '
		{ ms[NR] = $1; bytes = $2 }
		END {
			median = NR % 2 ? ms[(NR + 1) / 2] : (ms[NR / 2] + ms[NR / 2 + 1]) / 2
			printf "%-10s median %.1f ms  min %.1f  max %.1f  bytes %d  runs %d\n", name, median, ms[1], ms[NR], bytes, NR
		}'
done
