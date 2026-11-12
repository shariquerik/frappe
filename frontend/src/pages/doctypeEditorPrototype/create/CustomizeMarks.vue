<!-- PROTOTYPE (#47096), throwaway: what a field on the canvas shows in Customize mode, in its label
     row. A field the site added says "Custom"; a standard one the site changed gets a dot (its
     tooltip names what changed); a hidden one an eye. Variant B's lock is in EditorField. -->
<template>
	<template v-if="ui">
		<Tooltip v-if="field.hidden" text="Hidden on the form">
			<span class="lucide-eye-off size-3.5 shrink-0 text-ink-gray-5" aria-label="Hidden" />
		</Tooltip>
		<Badge v-if="ui.isCustom(field.fieldname)" label="Custom" theme="gray" size="sm" class="shrink-0" />
		<Tooltip v-else-if="changed.length" :text="`Changed on this site: ${changed.join(', ')}`">
			<span class="grid size-3.5 shrink-0 place-items-center" aria-label="Changed on this site">
				<span class="size-1.5 rounded-full bg-surface-gray-7" />
			</span>
		</Tooltip>
	</template>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Badge, Tooltip } from "frappe-ui";
import type { EditorField } from "../editor";
import { CustomizeKey } from "./customize";

const LABELS: Record<string, string> = {
	reqd: "Required", hidden: "Hidden", read_only: "Read only", print_hide: "Hide in print", report_hide: "Hide in reports",
	in_list_view: "In list view", in_standard_filter: "List filter", depends_on: "Visible if", mandatory_depends_on: "Mandatory if",
	read_only_depends_on: "Read-only if", allow_on_submit: "Edit after submit", fieldtype: "Type", fetch_from: "Fetch from",
};

const props = defineProps<{ field: EditorField }>();
const key = inject(CustomizeKey, null);
const ui = computed(() => key?.value ?? null);
const changed = computed(() => (ui.value?.changed(props.field.fieldname) ?? []).map((one) => LABELS[one] ?? one.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())));
</script>
