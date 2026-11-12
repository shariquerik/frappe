import { computed } from "vue";
import type { Ref } from "vue";
import type { ListRowData } from "./types";

export type SelectAllState = "none" | "some" | "all";

/** The checkbox column's logic: one row toggles, the header toggles every shown row. */
export function useRowSelection(
  selection: Ref<string[]>,
  rows: Ref<ListRowData[]>,
  rowKey: Ref<string>
) {
  const allKeys = computed(() =>
    rows.value.map((row) => String(row[rowKey.value]))
  );

  const selected = computed(() => new Set(selection.value));

  const selectAllState = computed<SelectAllState>(() => {
    const selected = allKeys.value.filter((key) =>
      isSelected(key)
    ).length;
    if (!selected) return "none";
    return selected === allKeys.value.length ? "all" : "some";
  });

  function isSelected(value: string) {
    return selected.value.has(value);
  }

  // PROTOTYPE (#47056): the last toggled row anchors a shift-click range.
  let anchor: string | null = null;

  function toggle(value: string) {
    anchor = value;
    selection.value = isSelected(value)
      ? selection.value.filter((key) => key !== value)
      : [...selection.value, value];
  }

  /** PROTOTYPE (#47056): sets every row from the anchor to `value` as the anchor now is. */
  function toggleRange(value: string) {
    const keys = allKeys.value;
    const from = anchor === null ? -1 : keys.indexOf(anchor);
    const to = keys.indexOf(value);
    if (from < 0 || to < 0) return toggle(value);
    const range = keys.slice(Math.min(from, to), Math.max(from, to) + 1);
    const select = isSelected(anchor!);
    const rest = selection.value.filter((key) => !range.includes(key));
    selection.value = select ? [...rest, ...range] : rest;
  }

  // Selected rows outside the shown set stay selected; only the shown rows clear.
  function toggleSelectAll() {
    if (selectAllState.value === "all") {
      const shown = new Set(allKeys.value);
      selection.value = selection.value.filter((key) => !shown.has(key));
    } else {
      selection.value = [...new Set([...selection.value, ...allKeys.value])];
    }
  }

  return { selectAllState, isSelected, toggle, toggleRange, toggleSelectAll };
}
