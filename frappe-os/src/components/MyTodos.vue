<script setup lang="ts">
// First-party applet contribution (ADR-0002/0009): "My open ToDos". It reaches Frappe
// OS ONLY through the injected OS API seam (ADR-0003) — never the store, api.ts or records
// store directly — proving the applet-consumer half of the architecture end to end:
// read (data.getList) → present (group by due date + priority) → spawn a builtin window
// (windows.open(formSurface)) → write (data.saveDoc) → feedback (ui.notify).
import { computed, inject, onMounted, ref } from "vue";
import { Badge, Button } from "frappe-ui";
import { OS_KEY } from "@/os-api";
import { formSurface } from "@/surface";
import type { FrappeDoc } from "@/types";

const os = inject(OS_KEY);

const rows = ref<FrappeDoc[]>([]);
const loading = ref(true);
const busy = ref<Record<string, boolean>>({});

const FIELDS = ["name", "description", "date", "priority", "status", "reference_type", "reference_name"];

async function load() {
  if (!os) return;
  loading.value = true;
  try {
    rows.value = await os.data.getList("ToDo", {
      filters: { owner: os.session.user || "", status: "Open" },
      fields: FIELDS,
      order_by: "date asc",
      limit: 100,
    });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// Today as a local YYYY-MM-DD so date-only comparisons stay string-lexicographic.
const today = computed(() => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});

// The reason this is an applet, not the generic list: ToDos grouped by due date into
// Overdue / Today / Upcoming. Undated items fall into Upcoming (nothing is overdue with no
// date). The justification for D2 — a presentation the generic renderer can't express.
const groups = computed(() => {
  const t = today.value;
  const buckets: Record<string, FrappeDoc[]> = { overdue: [], today: [], upcoming: [] };
  for (const r of rows.value) {
    const due = (r.date || "").slice(0, 10);
    if (due && due < t) buckets.overdue.push(r);
    else if (due === t) buckets.today.push(r);
    else buckets.upcoming.push(r);
  }
  return [
    { key: "overdue", label: "Overdue", items: buckets.overdue },
    { key: "today", label: "Today", items: buckets.today },
    { key: "upcoming", label: "Upcoming", items: buckets.upcoming },
  ].filter((g) => g.items.length);
});

const PRIORITY_THEME: Record<string, string> = { High: "red", Medium: "orange", Low: "gray" };

// ToDo descriptions are stored as HTML; show the plain text for a one-line title.
function asText(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function openTodo(name: string) {
  os?.windows.open(formSurface("ToDo", name));
}

async function markDone(name: string) {
  if (!os || busy.value[name]) return;
  busy.value = { ...busy.value, [name]: true };
  try {
    await os.data.saveDoc("ToDo", name, { status: "Closed" });
    rows.value = rows.value.filter((r) => r.name !== name);
    os.ui.notify("Marked done");
  } catch (e) {
    os.ui.notify("Could not mark done");
  } finally {
    busy.value = { ...busy.value, [name]: false };
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-base px-[30px] pb-[34px] pt-[26px]">
    <div class="mb-[3px] text-[12px] text-ink-gray-5">Frappe · live</div>
    <div class="mb-[22px] text-[23px] font-semibold tracking-[-0.01em] text-ink-gray-9">My open ToDos</div>

    <div v-if="loading" class="text-[13px] text-ink-gray-5">Loading…</div>
    <div v-else-if="!rows.length" class="text-[13px] text-ink-gray-5">Nothing open — you're all caught up.</div>

    <div v-for="grp in groups" :key="grp.key" class="mb-6">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-gray-5">{{ grp.label }}</span>
        <span class="text-[11px] tabular-nums text-ink-gray-4">{{ grp.items.length }}</span>
      </div>
      <div class="overflow-hidden rounded-[11px] border border-outline-gray-2 bg-surface-base">
        <div
          v-for="r in grp.items"
          :key="r.name"
          class="flex cursor-pointer items-center gap-3 border-b border-outline-gray-1 px-4 py-2.5 last:border-b-0"
          @click="openTodo(r.name)"
        >
          <Badge v-if="r.priority" size="sm" :theme="PRIORITY_THEME[r.priority] || 'gray'" :label="r.priority" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink-gray-8">
              {{ asText(r.description) || r.name }}
            </span>
            <span v-if="r.reference_name" class="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-ink-gray-5">
              {{ r.reference_type }} · {{ r.reference_name }}
            </span>
          </div>
          <span v-if="r.date" class="w-20 flex-shrink-0 text-right text-[11px] tabular-nums text-ink-gray-4">
            {{ (r.date || "").slice(0, 10) }}
          </span>
          <Button
            size="sm"
            variant="subtle"
            :loading="busy[r.name]"
            label="Mark done"
            @click.stop="markDone(r.name)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
