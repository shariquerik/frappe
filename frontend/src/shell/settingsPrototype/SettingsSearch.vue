<!-- PROTOTYPE: the search box above the pane list, and its results in place of the list. -->
<template>
	<div class="-mb-2 px-0.5">
		<TextInput
			v-model="query"
			variant="outline"
			placeholder="Search settings"
			@focus="warmIndex()"
			@keydown.down.prevent="move(1)"
			@keydown.up.prevent="move(-1)"
			@keydown.enter.prevent="hits[active] && emit('pick', hits[active])"
		>
			<template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
			<template v-if="query" #suffix>
				<button
					type="button"
					aria-label="Clear search"
					class="grid size-4 place-items-center rounded-1 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					@click="query = ''"
				>
					<span class="lucide-x size-3.5" />
				</button>
			</template>
		</TextInput>
	</div>
	<div v-if="query.trim()" class="flex flex-col gap-3">
		<div v-if="!hits.length" class="px-2 text-base text-ink-gray-5">
			No settings match “{{ query.trim() }}”.
		</div>
		<div v-if="own.length" class="flex flex-col gap-0.5">
			<ItemListRow
				v-for="(hit, index) in own"
				:key="key(hit)"
				as="button"
				type="button"
				class="w-full text-left"
				:active="active === index"
				@mouseenter="active = index"
				@click="emit('pick', hit)"
			>
				<template #prefix>
					<span :class="hit.pane.icon" class="size-4 shrink-0 text-ink-gray-6" />
				</template>
				<HitLabel :hit="hit" />
			</ItemListRow>
		</div>
		<div v-if="foreign.length">
			<div class="flex h-7 items-center px-2 text-base text-ink-gray-5">In other apps</div>
			<div class="flex flex-col gap-0.5">
				<ItemListRow
					v-for="(hit, index) in foreign"
					:key="key(hit)"
					as="button"
					type="button"
					class="w-full text-left"
					:active="active === own.length + index"
					@mouseenter="active = own.length + index"
					@click="emit('pick', hit)"
				>
					<template #prefix>
						<span :class="hit.pane.icon" class="size-4 shrink-0 text-ink-gray-6" />
					</template>
					<HitLabel :hit="hit" show-app />
				</ItemListRow>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch, type PropType } from "vue";
import { ItemListRow, TextInput } from "frappe-ui";
import { GROUPS, type PaneGroup } from "./panes";
import { search, warmIndex, type SearchHit } from "./search";

const LIMIT = 30;

const props = defineProps<{ groups: PaneGroup[] }>();
const emit = defineEmits<{ pick: [hit: SearchHit] }>();
const query = defineModel<string>({ default: "" });

const shown = computed(() => new Set(props.groups.map((group) => group.prefix)));
const own = computed(() => search(query.value, props.groups).slice(0, LIMIT));
const foreign = computed(() =>
	search(
		query.value,
		GROUPS.filter((group) => !shown.value.has(group.prefix))
	).slice(0, LIMIT)
);
const hits = computed(() => [...own.value, ...foreign.value]);

const active = ref(0);
watch(query, () => (active.value = 0));

function move(by: number) {
	if (!hits.value.length) return;
	active.value = (active.value + by + hits.value.length) % hits.value.length;
}

function key(hit: SearchHit) {
	return [hit.prefix, hit.pane.key, hit.block?.key, hit.fieldname].join("/");
}

const HitLabel = defineComponent({
	props: {
		hit: { type: Object as PropType<SearchHit>, required: true },
		showApp: Boolean,
	},
	setup(labelProps) {
		return () =>
			h("span", { class: "flex min-w-0 flex-col" }, [
				h("span", { class: "truncate text-ink-gray-8" }, labelProps.hit.title),
				h(
					"span",
					{ class: "truncate text-sm text-ink-gray-5" },
					labelProps.showApp
						? `${labelProps.hit.appLabel} › ${labelProps.hit.path}`
						: labelProps.hit.path
				),
			]);
	},
});
</script>
