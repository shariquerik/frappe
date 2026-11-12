<!-- PROTOTYPE (#47056): the switcher for the choices under review. Not part of the design. -->
<template>
	<div class="fixed bottom-4 end-4 z-30 flex flex-col items-end gap-2">
		<div
			v-if="open"
			class="flex w-80 flex-col gap-3 rounded-5 border border-dashed border-outline-gray-4 bg-surface-base p-3 text-base shadow-xl"
		>
			<div v-for="axis in AXES" :key="axis.key" class="flex flex-col gap-1.5">
				<span class="text-sm text-ink-gray-5">{{ axis.label }}</span>
				<TabButtons
					:modelValue="tweaks[axis.key]"
					:options="axis.options"
					@update:modelValue="(value: string) => ((tweaks as any)[axis.key] = value)"
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<span class="text-sm text-ink-gray-5">Fake doctype</span>
				<FormControl v-model="tweaks.workflow" type="checkbox" label="Has a workflow" />
				<FormControl v-model="tweaks.submittable" type="checkbox" label="Is submittable" />
				<FormControl v-model="tweaks.queued" type="checkbox" label="Submit is queued" />
				<FormControl v-model="tweaks.big" type="checkbox" label="Filter matches 1,240 (over the cap)" />
			</div>
			<p class="text-sm text-ink-gray-5">
				Shift-click a checkbox for a range · <b>x</b> selects the row under the pointer ·
				<b>.</b> opens the actions · <b>Esc</b> clears
			</p>
		</div>
		<Button
			variant="outline"
			:label="`Prototype ${tweaks.bulk}`"
			:icon-left="open ? 'lucide-chevron-down' : 'lucide-sliders-horizontal'"
			@click="open = !open"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button, FormControl, TabButtons } from "frappe-ui";
import { ref } from "vue";
import { tweaks } from "./tweaks";

const open = ref(false);

const AXES = [
	{
		key: "bulk",
		label: "Actions",
		options: [
			{ value: "A", label: "A: buttons + More" },
			{ value: "B", label: "B: one menu" },
		],
	},
	{
		key: "barAt",
		label: "Bar",
		options: [
			{ value: "bottom", label: "Floating" },
			{ value: "top", label: "Controls row" },
		],
	},
	{
		key: "selectAll",
		label: "Select all matching",
		options: [
			{ value: "strip", label: "Strip over rows" },
			{ value: "bar", label: "In the bar" },
		],
	},
	{
		key: "runs",
		label: "Background run",
		options: [
			{ value: "bar", label: "In the bar" },
			{ value: "tray", label: "Corner tray" },
		],
	},
] as const;
</script>
