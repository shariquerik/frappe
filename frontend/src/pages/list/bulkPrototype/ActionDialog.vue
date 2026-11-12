<!-- PROTOTYPE (#47056): the input or confirmation an action asks for before it runs. A dangerous
     action names its scope and confirms in red. -->
<template>
	<Dialog
		:modelValue="!!action"
		size="sm"
		:title="title"
		:actions="buttons"
		@update:modelValue="(open: boolean) => !open && (asking = null)"
	>
		<template v-if="action" #default>
			<div class="flex flex-col gap-3">
				<p class="text-p-base text-ink-gray-6">
					{{ action.confirm || `Runs on ${scopeText()}.` }}
				</p>
				<template v-for="field in values" :key="field.label">
					<FormControl
						v-if="field.type === 'select'"
						v-model="field.value"
						type="select"
						:label="field.label"
						:options="field.options"
					/>
					<FormControl
						v-else-if="field.type === 'textarea'"
						v-model="field.value"
						type="textarea"
						:label="field.label"
					/>
					<FormControl
						v-else-if="field.type === 'check'"
						v-model="field.value"
						type="checkbox"
						:label="field.label"
					/>
					<FormControl v-else v-model="field.value" :label="field.label" />
				</template>
				<Button
					v-if="action.name === 'edit'"
					class="self-start"
					variant="ghost"
					icon-left="lucide-plus"
					label="Add field"
				/>
				<p v-if="action.cap" class="text-sm text-ink-gray-5">
					Up to {{ action.cap }} records at a time (Print Settings).
				</p>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog, FormControl } from "frappe-ui";
import { computed, ref, watch } from "vue";
import type { FieldSpec } from "./actions";
import { asking, count, scopeText, start, THRESHOLD } from "./store";

const action = computed(() => asking.value);
const values = ref<FieldSpec[]>([]);

watch(asking, (next) => {
	values.value = (next?.fields ?? []).map((field) => ({ ...field }));
});

const title = computed(() => {
	const current = action.value;
	if (!current) return "";
	const n = count.value;
	return current.danger
		? `${current.label} ${n.toLocaleString()} record${n === 1 ? "" : "s"}?`
		: `${current.label} · ${n.toLocaleString()} record${n === 1 ? "" : "s"}`;
});

const buttons = computed(() => {
	const current = action.value;
	if (!current) return [];
	return [
		{
			label: current.danger ? current.label : count.value > THRESHOLD ? "Run in background" : "Apply",
			variant: "solid" as const,
			theme: current.danger ? ("red" as const) : ("gray" as const),
			onClick: () => {
				asking.value = null;
				void start(current);
			},
		},
	];
});
</script>
