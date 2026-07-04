<script setup lang="ts">
// The Customizations view (ADR-0014 item 3, ADR-0015; CONTEXT.md → "Customizations view"): the
// one human-facing surface that surfaces, rather than buries, the overrides and removals apps
// impose on this site — the OS analogue of Frappe's Property Setter / Customize Form listing.
// Read-only this slice. A first-party applet that dogfoods the same seam as MyTodos (ADR-0003):
// it reaches Frappe OS ONLY through the injected OS API and renders the cooked catalog the OS
// hands it — groups carrying appKind, rows carrying the baked-in `unexpected` flag (issue 05).
// The applet does no projection of its own; the computation lives OS-side in os.registry.
import { computed, inject } from "vue";
import { Badge } from "frappe-ui";
import { OS_KEY } from "@/data/os-api";

const os = inject(OS_KEY);

const groups = computed(() => os?.registry.customizations() ?? []);

// A removal reads red, an override neutral — the resolver's vocabulary, surfaced as a Badge theme.
function reasonTheme(reason: string): string {
  return reason === "removal" ? "red" : "gray";
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-auto bg-surface-base px-[30px] pb-[34px] pt-[26px]"
    data-applet="customizations"
  >
    <div class="mb-[3px] text-[12px] text-ink-gray-5">Frappe OS · structural catalog</div>
    <div class="mb-[6px] text-[23px] font-semibold tracking-[-0.01em] text-ink-gray-9">Customizations</div>
    <div class="mb-[22px] max-w-[640px] text-[12.5px] leading-[1.5] text-ink-gray-5">
      The overrides and removals apps impose on this site, grouped by app. This describes the
      contest and the conditions each change applies under — not a replay of one window's result.
    </div>

    <div v-if="!groups.length" class="text-[13px] text-ink-gray-5">
      No app has overridden or removed any OS chrome on this site.
    </div>

    <div v-for="group in groups" :key="group.appId" class="mb-6" :data-app="group.appId">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-[13px] font-semibold text-ink-gray-9">{{ group.appId }}</span>
        <Badge
          size="sm"
          theme="gray"
          :label="group.appKind"
          :data-app-kind="group.appKind"
        />
        <span class="text-[11px] tabular-nums text-ink-gray-4">{{ group.rows.length }}</span>
      </div>

      <div class="overflow-hidden rounded-[11px] border border-outline-gray-2 bg-surface-base">
        <div
          v-for="row in group.rows"
          :key="`${row.region}/${row.command}/${row.reason}`"
          class="flex items-center gap-3 border-b border-outline-gray-1 px-4 py-2.5 last:border-b-0"
          :data-row-command="row.command"
          :data-row-reason="row.reason"
        >
          <Badge size="sm" :theme="reasonTheme(row.reason)" :label="row.reason" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink-gray-8">
              {{ row.command }}
            </span>
            <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-ink-gray-5">
              {{ row.region }} · {{ row.whenScope }} · {{ row.layer }} layer
            </span>
          </div>
          <!-- ADR-0015 §5: a feature app removing chrome is the surprising case — the OS baked the
               `unexpected` flag in from the same predicate as removals.ts's console warning. -->
          <Badge
            v-if="row.unexpected"
            size="sm"
            theme="orange"
            label="unexpected — review this"
            data-review-this
          />
        </div>
      </div>
    </div>
  </div>
</template>
