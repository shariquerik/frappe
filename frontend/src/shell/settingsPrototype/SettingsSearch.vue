<!-- PROTOTYPE: the search box above the pane list, and its results in place of the list. -->
<template>
	<div class="mb-2 px-0.5">
		<TextInput
			ref="input"
			v-model="query"
			type="search"
			placeholder="Search settings"
			@focus="warmIndex()"
			@keydown.enter.prevent="hits[0] && emit('pick', hits[0])"
		>
			<template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
		</TextInput>
	</div>
	<div v-if="query.trim()" class="flex flex-col gap-3">
		<div v-if="!own.length && !foreign.length" class="px-2 text-base text-ink-gray-5">
			No settings match “{{ query.trim() }}”.
		</div>
		<ResultList :hits="own" @pick="(hit) => emit('pick', hit)" />
		<div v-if="foreign.length">
			<div class="flex h-7 items-center px-2 text-base text-ink-gray-5">In other apps</div>
			<ResultList :hits="foreign" show-app @pick="(hit) => emit('pick', hit)" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, type PropType } from "vue";
import { TextInput } from "frappe-ui";
import { GROUPS, type PaneGroup } from "./panes";
import { search, warmIndex, type SearchHit } from "./search";

const props = defineProps<{ groups: PaneGroup[] }>();
const emit = defineEmits<{ pick: [hit: SearchHit] }>();
const query = defineModel<string>({ default: "" });

const shown = computed(() => new Set(props.groups.map((group) => group.prefix)));
const own = computed(() => search(query.value, props.groups));
const foreign = computed(() =>
	search(
		query.value,
		GROUPS.filter((group) => !shown.value.has(group.prefix))
	)
);
const hits = computed(() => [...own.value, ...foreign.value]);

const ResultList = defineComponent({
	props: {
		hits: { type: Array as PropType<SearchHit[]>, required: true },
		showApp: Boolean,
	},
	emits: ["pick"],
	setup(listProps, { emit: emitPick }) {
		return () =>
			h(
				"div",
				{ class: "flex flex-col gap-0.5" },
				listProps.hits.slice(0, 30).map((hit) =>
					h(
						"button",
						{
							type: "button",
							class:
								"flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-surface-gray-2 focus-visible:focus-ring",
							onClick: () => emitPick("pick", hit),
						},
						[
							h("span", { class: "truncate text-base text-ink-gray-8" }, hit.title),
							h(
								"span",
								{ class: "truncate text-sm text-ink-gray-5" },
								listProps.showApp ? `${hit.appLabel} › ${hit.path}` : hit.path
							),
						]
					)
				)
			);
	},
});
</script>
