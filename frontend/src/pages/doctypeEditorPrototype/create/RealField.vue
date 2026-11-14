<!-- PROTOTYPE (#47434), throwaway: a canvas field drawn by the record page's own control, inert
     (map ruling 2). The marks ("· Title field", the rule mark, Customize's) go inside the control's
     label, after its last word, so they wrap with it (ruling 9). The grip shows on hover, laid over
     the top-right corner; it takes no space. A Table field keeps the prototype's grid. -->
<template>
	<div
		data-editor-select
		class="editor-field group/field relative -m-2 cursor-grab rounded-6 p-2 transition-shadow active:cursor-grabbing"
		:class="selected ? 'ring-1 ring-outline-gray-5' : 'hover:ring-1 hover:ring-outline-gray-2'"
		data-real-field
	>
		<template v-if="TABLE.has(field.fieldtype) && childUi">
			<div class="mb-1.5 flex items-center gap-1 text-sm text-ink-gray-6">
				<span class="truncate">{{ field.label || field.fieldname }}</span>
				<ConditionMark :rules="rules" />
			</div>
			<CanvasGrid :field="field" />
		</template>
		<div v-else ref="box" class="pointer-events-none" :class="{ 'opacity-50': customizing && field.hidden }" tabindex="-1" inert>
			<FormLayoutField :field="node" />
		</div>
		<Teleport v-if="labelEl" :to="labelEl">
			<!-- Baseline-aligned to the label: the zero-width first child gives the box the text's baseline. -->
			<span v-if="hasMarks" class="ml-1 inline-flex items-center gap-1" data-inline-marks>
				<span class="-mr-1 w-0">&#8203;</span>
				<span v-if="isTitle" class="text-ink-gray-4">· Title field</span>
				<ConditionMark :rules="rules" />
				<CustomizeMarks :field="field" />
			</span>
		</Teleport>
		<span
			class="absolute right-1 top-1 grid size-5 place-items-center rounded-3 bg-surface-base text-ink-gray-4 opacity-0 transition-opacity group-hover/field:opacity-100"
			:class="{ '!opacity-100': selected }"
			aria-hidden="true"
			data-field-grip
		>
			<span class="lucide-grip-vertical size-4" />
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, provide, ref, shallowRef, watch } from "vue";
import { mapField, useFieldTypes } from "@framework/ui/FormLayout";
// Not exported by this ui/ yet; through the node_modules link, so its injection keys are the same module.
import FormLayoutField from "../../../../node_modules/@framework/ui/src/components/FormLayout/FormLayoutField.vue";
import { CommitKey, DocKey, NO_COMMIT, ResolveFieldKey, UpdateKey } from "@framework/ui/FormLayout/types";
import type { EditorField } from "../editor";
import CanvasGrid from "./CanvasGrid.vue";
import ConditionMark from "./ConditionMark.vue";
import CustomizeMarks from "./CustomizeMarks.vue";
import { ChildScopeKey, ChildUiKey } from "./childTables";
import { CustomizeKey } from "./customize";
import { DraftUiKey } from "./draftUi";

const TABLE = new Set(["Table", "Table MultiSelect"]);
const props = defineProps<{ field: EditorField; selected?: boolean }>();

// The record page's form context, holding nothing (the build's provideInertForm).
provide(DocKey, ref({}));
provide(UpdateKey, () => undefined);
provide(CommitKey, NO_COMMIT);
provide(ResolveFieldKey, useFieldTypes().resolve);

const ui = inject(DraftUiKey)!;
const childUi = inject(ChildScopeKey, null) ? null : inject(ChildUiKey, null);
const customizeKey = inject(CustomizeKey, null);
const customizing = computed(() => Boolean(customizeKey?.value));
const node = computed(() => mapField({ ...(props.field as any), hidden: 0 }, {}));
const rules = computed(() => [
	{ label: "Visible if", value: props.field.depends_on },
	{ label: "Mandatory if", value: props.field.mandatory_depends_on },
	{ label: "Read-only if", value: props.field.read_only_depends_on },
]);
const isTitle = computed(() => ui.titleField.value === props.field.fieldname);
const hasMarks = computed(() => isTitle.value || rules.value.some((one) => one.value) || customizing.value);

// The control's own <label>: the marks are teleported into it, after the text and the "*".
const box = ref<HTMLElement>();
const labelEl = shallowRef<HTMLElement | null>(null);
async function findLabel() {
	await nextTick();
	labelEl.value = box.value?.querySelector<HTMLElement>("label[data-slot='label'], label") ?? null;
}
onMounted(findLabel);
watch(() => [props.field.fieldtype, props.field.label], findLabel);
</script>
