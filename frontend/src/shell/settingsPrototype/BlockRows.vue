<!-- PROTOTYPE: a block's content, generated or component. A doctype's tabs are a tab strip. -->
<template>
	<div ref="root" :data-block="block.key" class="relative isolate">
	<span data-flash aria-hidden="true" :class="FLASH" />
	<div v-if="block.component">
		<component :is="block.component" :bindings="componentBindings" />
	</div>
	<template v-else-if="binding">
		<div v-if="binding.loading" class="space-y-3 py-3">
			<div v-for="n in 3" :key="n" class="h-7 animate-pulse rounded-1 bg-surface-gray-2" />
		</div>
		<div v-else-if="binding.error" class="py-3 text-base text-ink-red-4">
			Could not read {{ binding.doctype }}: {{ binding.error }}
		</div>
		<template v-else>
			<div
				v-if="binding.isNew"
				class="mb-1 rounded-1 bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-6"
			>
				No {{ binding.doctype }} for you yet. The first change creates it.
			</div>
			<div v-if="groups.length > 1" class="mb-2 mt-1 w-0 min-w-full overflow-x-auto">
				<TabButtons
					v-model="activeGroup"
					:options="groups.map((group) => ({ label: group.label ?? 'General', value: group.name }))"
				/>
			</div>
			<template v-for="group in shownGroups" :key="group.name">
				<template v-for="section in group.sections" :key="section.name">
					<h5 v-if="section.label" class="mt-5 text-base font-medium text-ink-gray-6">
						{{ section.label }}
					</h5>
					<FieldRow
						v-for="field in section.fields"
						:key="field.fieldname"
						:field="field"
						:binding="binding"
						:block-status="pane.blocks[block.key].status"
						@commit="pane.commit(block, [field.fieldname])"
					/>
				</template>
			</template>
		</template>
	</template>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { TabButtons } from "frappe-ui";
import type { BlockSpec } from "./panes";
import type { PaneState } from "./bindings";
import { rowGroups } from "./rows";
import FieldRow from "./FieldRow.vue";
import { FLASH, flash, searchTarget } from "./search";

const props = defineProps<{
	block: BlockSpec;
	pane: PaneState;
	prefix: string;
	paneKey: string;
}>();
const root = ref<HTMLElement | null>(null);

const binding = computed(() => props.pane.bindingOf(props.block));
const groups = computed(() =>
	binding.value ? rowGroups(binding.value.meta, props.block.fields, binding.value.childMetas) : []
);
const activeGroup = ref("");
const shownGroups = computed(() => {
	if (groups.value.length < 2) return groups.value;
	const name = activeGroup.value || groups.value[0].name;
	return groups.value.filter((group) => group.name === name);
});

// A component gets one handle per named binding: the shared draft and `commit()`.
const componentBindings = computed(() =>
	Object.fromEntries(
		Object.entries(props.pane.namedBindings(props.block)).map(([key, state]) => [
			key,
			{
				state,
				status: props.pane.blocks[props.block.key],
				commit: (fieldnames: string[]) => props.pane.commit(props.block, fieldnames),
			},
		])
	)
);

// A search result for this block: show its tab, then scroll to it and flash it once it has loaded.
watch(
	() => [searchTarget.value, binding.value?.loading] as const,
	async ([target, loading]) => {
		if (!target || loading) return;
		if (target.prefix !== props.prefix || target.pane !== props.paneKey) return;
		if (target.block !== props.block.key) return;
		const group = groups.value.find((candidate) =>
			candidate.sections.some((section) =>
				section.fields.some((field) => field.fieldname === target.fieldname)
			)
		);
		if (group) activeGroup.value = group.name;
		searchTarget.value = null;
		await nextTick();
		const element = target.fieldname
			? root.value?.querySelector<HTMLElement>(`[data-fieldname="${target.fieldname}"]`)
			: root.value;
		const viewport = element?.closest<HTMLElement>("[data-reka-scroll-area-viewport]");
		if (element && viewport) {
			const offset = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
			viewport.scrollTo({
				top: viewport.scrollTop + offset - viewport.clientHeight / 3,
				behavior: "smooth",
			});
		}
		flash(element);
	},
	{ immediate: true }
);
</script>
