<!-- PROTOTYPE (#47099), throwaway: a Table field's "Child table": child DocTypes only (istable),
     the parent's module first, drafts made here on top. Its footer makes a new one
     ("+ New child table…"). A Table field just added opens it, so choosing the type leads here. -->
<template>
	<!-- The Combobox trigger is inline-flex and sizes to its input; here it fills the panel row. -->
	<div class="w-full min-w-0 [&_[data-slot=trigger]]:!flex [&_[data-slot=trigger]]:w-full">
		<Combobox
			v-model:open="open"
			variant="ghost"
			side="bottom"
			align="end"
			:model-value="field.options"
			:options="groups"
			placeholder="Choose a child table"
			data-child-picker
			@update:model-value="pick"
		>
			<template #footer>
				<div class="border-t border-outline-gray-1 p-1">
					<button
						type="button"
						class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-3"
						data-new-child
						@click="newChild"
					>
						<span class="lucide-plus size-4 shrink-0 text-ink-gray-6" aria-hidden="true" />
						New child table…
					</button>
				</div>
			</template>
		</Combobox>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from "vue";
import { Combobox } from "frappe-ui";
import { EditorKey } from "../context";
import type { EditorField } from "../editor";
import { ChildUiKey } from "./childTables";

const props = defineProps<{ field: EditorField }>();
const editor = inject(EditorKey)!;
const child = inject(ChildUiKey)!;
const open = ref(false);

const groups = computed(() => {
	const module = child.parentModule;
	const option = (one: { name: string; module: string; custom: boolean }) => ({
		label: one.name,
		value: one.name,
		// The group names the parent's module, so only "Other modules" repeat theirs.
		description: child.get(one.name)?.isNew
			? "New, not saved"
			: [one.module === module ? "" : one.module, one.custom ? "Custom" : ""].filter(Boolean).join(" · ") || undefined,
	});
	const mine = child.options.filter((one) => one.module === module || child.get(one.name)?.isNew);
	const rest = child.options.filter((one) => !mine.includes(one));
	return [
		{ group: `${module || "This module"}`, options: mine.map(option) },
		{ group: "Other modules", options: rest.map(option) },
	].filter((group) => group.options.length);
});

function pick(value: unknown) {
	const name = String(value ?? "");
	editor.acts.setField(props.field.fieldname, "options", name);
	if (name) void child.ensure(name);
}

function newChild() {
	open.value = false;
	child.newFor = props.field.fieldname;
}

// A Table field just added has no child yet: the picker opens, with "New child table…" at its foot.
onMounted(() => {
	if (props.field.added && !props.field.options) setTimeout(() => (open.value = true), 350);
});
</script>
