<!-- PROTOTYPE: one field as a settings row. A Check is a toggle row; a long field stacks its
     control under the title; everything else puts the control on the right. -->
<template>
	<div v-if="shown" :data-fieldname="field.fieldname" class="border-b border-outline-gray-1 last:border-b-0">
		<template v-if="stacked">
			<div class="py-3.5">
				<div class="text-base-medium text-ink-gray-8">{{ field.label }}</div>
				<div v-if="field.description" class="mt-1 text-base text-ink-gray-6">
					{{ field.description }}
				</div>
				<div v-if="isTable" class="mt-2 flex items-center gap-2 text-base text-ink-gray-6">
					{{ rows }} {{ rows === 1 ? "row" : "rows" }} ·
					<RouterLink :to="recordRoute" class="text-ink-gray-8 underline">
						Edit in the record
					</RouterLink>
				</div>
				<component
					:is="control"
					v-else
					class="mt-2"
					:field="bare"
					:modelValue="binding.doc[field.fieldname]"
					@update:modelValue="(value: any) => (binding.doc[field.fieldname] = value)"
					@change="onChange"
				/>
			</div>
		</template>
		<SettingsRow v-else :title="field.label ?? field.fieldname" :description="field.description">
			<div class="flex items-center gap-2">
				<StatusMark v-if="rowMarks" :status="markStatus" />
				<Switch
					v-if="field.fieldtype === 'Check'"
					:model-value="!!binding.doc[field.fieldname]"
					:disabled="field.readOnly"
					@update:model-value="toggle"
				/>
				<component
					:is="control"
					v-else
					class="w-56"
					:field="bare"
					:modelValue="binding.doc[field.fieldname]"
					@update:modelValue="(value: any) => (binding.doc[field.fieldname] = value)"
					@change="onChange"
				/>
			</div>
		</SettingsRow>
		<div v-if="error" class="-mt-2 pb-3 text-sm text-ink-red-4">{{ error }}</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { SettingsRow, Switch } from "frappe-ui";
import { getFieldComponent } from "@framework/ui/components/FormLayout";
import { evaluateDependsOn } from "@framework/ui/components/FormLayout/dependsOn";
import type { FieldMeta } from "@framework/ui/components/FormLayout/types";
import { routeFor } from "@/router/routeFor";
import type { BindingState, BlockStatus } from "./bindings";
import StatusMark from "./StatusMark.vue";

const props = defineProps<{
	field: FieldMeta;
	binding: BindingState;
	/** Variant C: each row shows its own Saving / Saved mark. */
	rowMarks?: boolean;
	blockStatus?: BlockStatus;
	dirty?: boolean;
}>();
const emit = defineEmits<{ commit: [] }>();

const LONG = new Set([
	"Text",
	"Small Text",
	"Long Text",
	"Text Editor",
	"Code",
	"JSON",
	"Markdown Editor",
	"HTML Editor",
	"Table",
	"Table MultiSelect",
	"Attach",
	"Attach Image",
	"Signature",
]);

const stacked = computed(() => LONG.has(props.field.fieldtype));
const isTable = computed(() => props.field.fieldtype === "Table");
const rows = computed(() => (props.binding.doc[props.field.fieldname] ?? []).length);
const shown = computed(() => evaluateDependsOn(props.field.dependsOn, props.binding.doc));
const control = computed(() => getFieldComponent(props.field.fieldtype));
const bare = computed(() => ({ ...props.field, label: "", description: "" }));
const error = computed(() => props.binding.fieldErrors[props.field.fieldname]);
const recordRoute = computed(() =>
	routeFor(props.binding.doctype, props.binding.single ? null : props.binding.name)
);

// The row's own mark follows the block's save while this row was part of it.
const lastCommitted = ref(false);
const markStatus = computed<BlockStatus>(() => {
	if (error.value) return "error";
	if (!lastCommitted.value) return "idle";
	return props.blockStatus ?? "idle";
});
watch(
	() => props.blockStatus,
	(status) => {
		if (status === "idle") lastCommitted.value = false;
	}
);

function toggle(value: boolean) {
	props.binding.doc[props.field.fieldname] = value ? 1 : 0;
	onChange();
}

function onChange() {
	lastCommitted.value = true;
	emit("commit");
}
</script>
