<!-- PROTOTYPE (#47100), throwaway: the value cell of a condition row (ConditionBuilder's
     #condition-value). It is the builder's own control for the field's type, or "a field of this
     record": `eval:doc.company` in a link filter, `doc.uom !== doc.stock_uom` in a condition.
     The button at its end switches between the two, where comparing with a field makes sense. -->
<template>
	<div class="flex min-w-0 items-center gap-1">
		<div class="min-w-0 flex-1">
			<Combobox
				v-if="isRef"
				class="w-full"
				:options="refOptions"
				:model-value="refName"
				placeholder="Pick a field"
				@update:model-value="update(`${REF}${$event}`)"
			>
				<template #prefix>
					<span class="lucide-variable size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				</template>
			</Combobox>
			<TextInput v-else-if="readonly" class="w-full" readonly :model-value="Array.isArray(modelValue) ? modelValue.join(', ') : String(modelValue ?? '')" />
			<component :is="VALUE_CONTROLS[control.control]" v-else v-bind="control.props" class="w-full" :model-value="controlValue" @update:model-value="update" />
		</div>
		<Tooltip v-if="canRef" :text="isRef ? 'Use a fixed value' : `Use a field of this record`">
			<Button
				variant="ghost"
				icon="lucide-variable"
				:label="isRef ? 'Use a fixed value' : 'Use a field of this record'"
				:class="isRef && '!bg-surface-gray-3 !text-ink-gray-8'"
				data-value-ref
				@click="toggle"
			/>
		</Tooltip>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button, Combobox, TextInput, Tooltip } from "frappe-ui";
import type { ConditionField, ConditionOperator, ConditionValue } from "@framework/ui/ConditionBuilder";
// PROTOTYPE: the slot replaces the whole cell, so keeping the builder's own control means reaching in.
// The build would export these from @framework/ui/Filter, or the builder would take a value-cell suffix slot.
// eslint-disable-next-line no-restricted-syntax
import { valueControl } from "@framework/ui/components/Filter/valueControl";
// eslint-disable-next-line no-restricted-syntax
import { VALUE_CONTROLS } from "@framework/ui/components/Filter/valueControlComponents";
import { DOCSTATUS, RECORD_NEW, REF } from "./conditions";

const props = defineProps<{
	field: ConditionField | undefined;
	operator: ConditionOperator;
	modelValue: ConditionValue;
	readonly: boolean;
	update: (value: ConditionValue) => void;
	/** This record's fields, for "a field of this record". */
	record: ConditionField[];
	/** A condition's field is one of `record`, so it cannot be compared with itself; a filter's is the target's. */
	same?: boolean;
}>();

const COMPARES = new Set(["equals", "not equals", "<", ">", "<=", ">="]);
const isRef = computed(() => typeof props.modelValue === "string" && props.modelValue.startsWith(REF));
const canRef = computed(() => !props.readonly && props.field && props.field.fieldtype !== "Check" && props.field.fieldname !== DOCSTATUS && COMPARES.has(props.operator));
const refName = computed(() => (isRef.value ? String(props.modelValue).slice(REF.length) : ""));
// A Link compares with a Link to the same DocType first; then the rest of the record.
const refOptions = computed(() => {
	const same = (one: ConditionField) => one.fieldtype === props.field?.fieldtype && one.options === props.field?.options;
	const usable = props.record.filter((one) => one.fieldname !== RECORD_NEW && one.fieldname !== DOCSTATUS && !one.label.endsWith("(has rows)") && !(props.same && one.fieldname === props.field?.fieldname));
	const option = (one: ConditionField) => ({ label: one.label, value: one.fieldname.startsWith("parent.") ? one.fieldname : `doc.${one.fieldname}` });
	const first = usable.filter(same).map(option);
	const rest = usable.filter((one) => !same(one)).map(option);
	return [...(first.length ? [{ group: "Same kind", options: first }] : []), { group: first.length ? "Other fields" : "Fields of this record", options: rest }];
});

const control = computed(() => valueControl({ fieldname: props.field?.fieldname ?? "", operator: props.operator, value: props.modelValue as any, field: props.field }));
// The multi-value controls take arrays; the tree may hold a comma string.
const controlValue = computed(() => {
	if (!["multiSelect", "multiLink"].includes(control.value.control)) return props.modelValue;
	if (Array.isArray(props.modelValue)) return props.modelValue;
	return String(props.modelValue ?? "").split(",").map((one) => one.trim()).filter(Boolean);
});

function toggle() {
	if (isRef.value) return props.update("");
	const first = refOptions.value[0]?.options[0];
	props.update(first ? `${REF}${first.value}` : REF);
}
</script>
