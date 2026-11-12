<!-- PROTOTYPE (#47100), throwaway: the Fetch from list, in two steps, in the look of frappe-ui's
     Combobox list: first a Link field of this DocType ("Customer", its target in gray), then a field
     of the DocType it links to ("Customer › Customer Name"). `link` starts at the second step (a Link
     field's "Fetch a field…", ?fetch=B). -->
<template>
	<div class="flex w-[320px] flex-col" data-fetch-menu @keydown.esc.stop="$emit('close')">
		<div class="flex items-center gap-1 border-b border-outline-gray-1 p-1.5">
			<Button v-if="step && !fixed" variant="ghost" icon="lucide-chevron-left" label="Back to Link fields" data-fetch-back @click="back" />
			<TextInput
				ref="searchInput"
				v-model="query"
				class="min-w-0 flex-1"
				variant="ghost"
				:placeholder="step ? `Search ${step.options}'s fields` : 'Search Link fields'"
				autocomplete="off"
				@keydown.enter.prevent="pickFirst"
			>
				<template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</TextInput>
		</div>
		<p v-if="step" class="truncate px-3.5 pb-1 pt-2 text-sm text-ink-gray-5">Fields of {{ step.options }}</p>
		<p v-else class="px-3.5 pb-1 pt-2 text-sm text-ink-gray-5">Link fields of this form</p>
		<div ref="list" class="max-h-[300px] overflow-y-auto p-1.5 pt-0">
			<template v-if="!step">
				<Tooltip v-for="one in shownLinks" :key="one.fieldname" :text="`${one.label || one.fieldname} · ${one.options}`" :disabled="`${one.label || one.fieldname}${one.options}`.length < 30">
					<button
						type="button"
						class="flex h-7 w-full min-w-0 items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-3"
						:data-fetch-link="one.fieldname"
						@click="open(one)"
					>
						<span class="lucide-link size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
						<!-- The label wins: the gray target has no width of its own, only what the label leaves. -->
						<span class="min-w-0 truncate">{{ one.label || one.fieldname }}</span>
						<span class="min-w-0 flex-1 basis-0 truncate pl-2 text-right text-sm text-ink-gray-5">{{ one.options }}</span>
						<span class="lucide-chevron-right size-4 shrink-0 text-ink-gray-4" aria-hidden="true" />
					</button>
				</Tooltip>
				<p v-if="!shownLinks.length" class="px-2 py-1.5 text-base text-ink-gray-5">{{ links.length ? "No Link field matches" : "This form has no Link field yet" }}</p>
			</template>
			<template v-else>
				<p v-if="loading" class="px-2 py-1.5 text-base text-ink-gray-5">Loading {{ step.options }}…</p>
				<button
					v-for="one in shownSources"
					:key="one.fieldname"
					type="button"
					class="flex h-7 w-full min-w-0 items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-8 hover:bg-surface-gray-3"
					:data-fetch-source="one.fieldname"
					:data-chosen="isSelected(one) || null"
					@click="$emit('pick', step, one)"
				>
					<span :class="[typeIcon(one), 'size-4 shrink-0 text-ink-gray-5']" aria-hidden="true" />
					<span class="min-w-0 truncate">{{ one.label || one.fieldname }}</span>
					<span v-if="isSelected(one)" class="lucide-check ml-auto size-4 shrink-0 text-ink-gray-7" aria-label="Chosen" />
				</button>
				<p v-if="!loading && !shownSources.length" class="px-2 py-1.5 text-base text-ink-gray-5">No field matches</p>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { Button, TextInput, Tooltip } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import type { EditorField } from "../editor";
import { typeIcon } from "./typeMenu";

const props = defineProps<{
	links: EditorField[];
	/** The current `fetch_from` ("customer.customer_name"), to open on its link and mark its field. */
	value?: string;
	/** Start (and stay) on this Link field's target. */
	link?: EditorField;
}>();
defineEmits<{ pick: [link: EditorField, source: EditorField]; close: [] }>();

const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Image", "Fold", "Table", "Table MultiSelect"]);
const fixed = Boolean(props.link);
const [linkName, sourceName] = (props.value ?? "").split(".");
const step = ref<EditorField | null>(props.link ?? props.links.find((one) => one.fieldname === linkName) ?? null);
const query = ref("");
const searchInput = ref<{ inputElement?: HTMLInputElement | null } | null>(null);
const focus = () => nextTick(() => searchInput.value?.inputElement?.focus());
onMounted(focus);

const { meta, loading } = useDoctypeMeta(() => step.value?.options ?? "");
const sources = computed(() => ((meta.value?.fields ?? []) as EditorField[]).filter((one) => !NO_VALUE.has(one.fieldtype)));
const match = (one: EditorField) => `${one.label ?? ""} ${one.fieldname} ${one.options ?? ""}`.toLowerCase().includes(query.value.trim().toLowerCase());
const shownLinks = computed(() => props.links.filter(match));
const shownSources = computed(() => sources.value.filter(match));
// The chosen field shows in the list's middle once its DocType's fields arrive.
const list = ref<HTMLElement | null>(null);
watch(
	() => sources.value.length,
	async () => {
		await nextTick();
		(list.value?.querySelector("[data-chosen]") as HTMLElement | null)?.scrollIntoView({ block: "center" });
	},
	{ immediate: true }
);
const isSelected = (one: EditorField) => step.value?.fieldname === linkName && one.fieldname === sourceName;

function open(one: EditorField) {
	step.value = one;
	query.value = "";
	focus();
}
function back() {
	step.value = null;
	query.value = "";
	focus();
}
function pickFirst() {
	if (!step.value) return shownLinks.value[0] && open(shownLinks.value[0]);
	const first = shownSources.value[0];
	if (first) (document.querySelector(`[data-fetch-source='${first.fieldname}']`) as HTMLElement | null)?.click();
}
</script>
