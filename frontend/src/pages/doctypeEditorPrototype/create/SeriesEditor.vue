<!-- PROTOTYPE (#47434), throwaway: Naming Series editing (G3) in the ruled Settings look. The series
     are the Naming Series field's options; the default is its default. ?series= picks the shape:
     A: the rows themselves. A hovered row offers "Make default" and remove, laid over its right
        end; "Add a series" under the last row opens an input in the series lane, with the hint.
     B: the rows stay read-only; "Edit series" opens a dialog that edits them all, then Done.
     C: one series per line in a text box, as the field's options are typed; the first line is the
        default, and each line's next name sits beside it.
     Nothing is written: the list lives here. -->
<template>
	<div class="flex w-full flex-col" :data-series-variant="variant">
		<!-- C: the options as text, each line's next name in the lane beside it. -->
		<template v-if="variant === 'C'">
			<div class="flex items-start gap-3">
				<Textarea
					v-model="typed"
					class="!w-[296px] shrink-0 resize-none font-mono !text-sm !leading-7"
					:rows="Math.max(lines.length, 2)"
					placeholder="ACC-SINV-.YYYY.-"
					data-series-text
				/>
				<!-- 1px border + 6px padding: each 28px row centres on its text line. -->
				<div class="flex flex-col pt-[7px]" data-series-next>
					<div v-for="(one, at) in lines" :key="at" class="flex h-7 items-center gap-2 whitespace-nowrap">
						<NamePreview v-if="one" :parts="previewName(one, counterOf(one), labelOf)" />
						<Badge v-if="at === 0 && one" label="Default" theme="gray" size="sm" />
					</div>
				</div>
			</div>
			<p class="mt-1.5 text-p-sm text-ink-gray-5">One series per line; the first is the default. A dot ends the text part, and # marks the counter's digits.</p>
		</template>

		<template v-else>
			<div
				v-for="one in list"
				:key="one"
				class="group/series relative -mx-2 flex h-7 items-center gap-3 rounded-4 px-2"
				:class="{ 'hover:bg-surface-gray-1': variant === 'A' }"
				:data-series-row="one"
			>
				<span class="flex w-[296px] shrink-0 items-center gap-2">
					<span class="min-w-0 truncate font-mono text-sm text-ink-gray-8">{{ one }}</span>
					<Badge v-if="one === fallback" label="Default" theme="gray" size="sm" class="shrink-0" />
				</span>
				<NamePreview class="whitespace-nowrap" :parts="previewName(one, counterOf(one), labelOf)" />
				<!-- A: the row's acts, over its right end, only while it is hovered. -->
				<div v-if="variant === 'A'" class="absolute inset-y-0 right-2 hidden items-center gap-1 pl-2 group-hover/series:flex group-hover/series:bg-surface-gray-1" data-series-acts>
					<Button v-if="one !== fallback" size="sm" variant="ghost" label="Make default" @click="fallback = one" />
					<Tooltip text="Remove series">
						<Button size="sm" variant="ghost" icon="lucide-x" label="Remove series" :disabled="list.length < 2" @click="remove(one)" />
					</Tooltip>
				</div>
			</div>

			<template v-if="variant === 'A'">
				<form v-if="adding" class="flex h-7 items-center gap-3" data-series-add @submit.prevent="add">
					<TextInput
						ref="addInput"
						v-model="draft"
						class="-ml-[9px] w-[305px] shrink-0 [&_input]:font-mono"
						placeholder="ACC-SINV-RET-.YYYY.-"
						autocomplete="off"
						@keydown.esc="(adding = false), (draft = '')"
					/>
					<NamePreview v-if="draft.trim()" class="whitespace-nowrap" :parts="previewName(draft.trim(), counterOf(draft.trim()), labelOf)" />
				</form>
				<Button v-else size="sm" variant="ghost" icon-left="lucide-plus" label="Add a series" class="-ml-2 w-fit" data-series-add-button @click="openAdd" />
				<p class="mt-1 text-p-sm text-ink-gray-5">
					{{ adding ? "A dot ends the text part, and # marks the counter's digits. Enter adds it." : "The series are the options of the Naming Series field." }}
				</p>
			</template>

			<template v-else>
				<Button size="sm" variant="subtle" label="Edit series" class="mt-1.5 w-fit" data-series-edit @click="openDialog" />
				<Dialog v-model:open="dialog" title="Naming Series" size="2xl">
					<div class="flex flex-col" data-series-dialog>
						<p class="mb-4 text-p-base text-ink-gray-6">Each series counts on its own. The person who creates a {{ doctype }} picks one.</p>
						<div class="flex h-6 items-center gap-3 text-sm text-ink-gray-5">
							<span class="w-[260px] shrink-0">Series</span>
							<span class="flex-1">Next name</span>
							<span class="w-14 shrink-0 text-center">Default</span>
							<span class="w-7 shrink-0" />
						</div>
						<RadioGroup v-model="rowDefault" aria-label="Default series" class="[&_[role=radiogroup]]:!gap-y-0">
						<div v-for="(row, at) in rows" :key="at" class="flex h-9 items-center gap-3" data-series-dialog-row>
							<TextInput v-model="row.text" class="w-[260px] shrink-0 [&_input]:font-mono" placeholder="ACC-SINV-.YYYY.-" autocomplete="off" />
							<NamePreview class="min-w-0 flex-1 truncate whitespace-nowrap" :parts="row.text.trim() ? previewName(row.text.trim(), counterOf(row.text.trim()), labelOf) : [{ text: '—', gray: true }]" />
							<span class="flex w-14 shrink-0 justify-center">
								<Radio :value="at" :aria-label="`Make ${row.text} the default`" />
							</span>
							<Tooltip text="Remove series">
								<Button variant="ghost" icon="lucide-x" label="Remove series" :disabled="rows.length < 2" @click="dropRow(at)" />
							</Tooltip>
						</div>
						</RadioGroup>
						<Button size="sm" variant="subtle" icon-left="lucide-plus" label="Add a series" class="mt-2 w-fit" @click="rows.push({ text: '' })" />
						<p class="mt-4 text-p-sm text-ink-gray-5">
							A dot ends the text part, and # marks the counter's digits:
							<span class="whitespace-nowrap font-mono">ACC-SINV-.YYYY.-.#####</span> gives <span class="whitespace-nowrap font-mono">ACC-SINV-2026-00001</span>.
						</p>
					</div>
					<template #actions>
						<div class="flex justify-end gap-2">
							<Button label="Cancel" @click="dialog = false" />
							<Button variant="solid" label="Done" @click="applyDialog" />
						</div>
					</template>
				</Dialog>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, ref } from "vue";
import { Badge, Button, Dialog, Radio, RadioGroup, Textarea, TextInput, Tooltip } from "frappe-ui";
import { previewName } from "./settings";

const props = defineProps<{ variant: string; series: string[]; fallback: string; counter: number; doctype: string; labelOf: (fieldname: string) => string }>();

const list = ref([...props.series]);
// Each series counts on its own (tabSeries). The prototype has no counters: the default series
// follows the record count, the others are fresh, as a new series is.
const counterOf = (one: string) => (one === (props.fallback || props.series[0]) ? props.counter : 1);
const fallback = ref(props.fallback || props.series[0] || "");

function remove(one: string) {
	list.value = list.value.filter((other) => other !== one);
	if (fallback.value === one) fallback.value = list.value[0];
}

// A: one new series at a time.
const adding = ref(false);
const draft = ref("");
const addInput = ref<{ inputElement: HTMLInputElement | null } | null>(null);
async function openAdd() {
	adding.value = true;
	await nextTick();
	addInput.value?.inputElement?.focus();
}
function add() {
	const one = draft.value.trim();
	if (one && !list.value.includes(one)) list.value.push(one);
	draft.value = "";
}

// B: the dialog edits a copy; Done hands it back.
const dialog = ref(false);
const rows = ref<{ text: string }[]>([]);
const rowDefault = ref(0);
function openDialog() {
	rows.value = list.value.map((text) => ({ text }));
	rowDefault.value = Math.max(0, list.value.indexOf(fallback.value));
	dialog.value = true;
}
function dropRow(at: number) {
	rows.value.splice(at, 1);
	if (rowDefault.value >= rows.value.length) rowDefault.value = rows.value.length - 1;
}
function applyDialog() {
	const kept = rows.value.map((row) => row.text.trim());
	list.value = kept.filter(Boolean);
	fallback.value = kept[rowDefault.value] || list.value[0];
	dialog.value = false;
}

// C: the text box is the list; its first line is the default.
const typed = ref([fallback.value, ...list.value.filter((one) => one !== fallback.value)].join("\n"));
const lines = computed(() => typed.value.split("\n").map((one) => one.trim()));

/** A name preview: the made-up parts (a field's value) in a lighter gray. */
const NamePreview = defineComponent({
	props: { parts: { type: Array as () => { text: string; gray?: boolean }[], required: true } },
	setup: (props) => () =>
		h("span", { class: "font-mono text-sm text-ink-gray-8", "data-next-name": "" }, props.parts.map((one) => h("span", { class: one.gray ? "text-ink-gray-4" : "" }, one.text))),
});
</script>
