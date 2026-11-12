<!-- PROTOTYPE (#47056): the bar's actions. A: three buttons, a More menu and a red Delete. B: one
     grouped Actions menu. Workflow transitions are buttons in both. -->
<template>
	<div class="flex items-center gap-1">
		<Button
			v-for="action in workflow"
			:key="action.name"
			:label="action.label"
			:icon-left="action.icon"
			variant="subtle"
			:disabled="overCap(action)"
			@click="choose(action)"
		/>
		<div v-if="workflow.length" class="mx-1 h-4 w-px bg-outline-gray-2" />
		<template v-if="tweaks.bulk === 'A'">
			<Button
				v-for="action in buttons"
				:key="action.name"
				:label="action.label"
				variant="ghost"
				:disabled="overCap(action)"
				@click="choose(action)"
			/>
			<Dropdown v-model:open="menuOpen" :options="menu(rest)" :side="side" align="start">
				<Button variant="ghost" label="More" icon-right="lucide-chevron-down" />
			</Dropdown>
			<Tooltip v-if="remove" :text="overCap(remove) ? `Over the ${capOf(remove)} cap` : 'Delete'">
				<Button
					variant="ghost"
					theme="red"
					icon="lucide-trash-2"
					label="Delete"
					:disabled="overCap(remove)"
					@click="choose(remove)"
				/>
			</Tooltip>
		</template>
		<Dropdown v-else v-model:open="menuOpen" :options="menu(others)" :side="side" align="start">
			<Button variant="subtle" icon-right="lucide-chevron-down">
				Actions
				<KeyboardShortcut combo="." bg class="ms-1" />
			</Button>
		</Dropdown>
	</div>
</template>

<script setup lang="ts">
import { Button, Dropdown, KeyboardShortcut, Tooltip } from "frappe-ui";
import { computed, ref, watch } from "vue";
import { GROUP_LABELS, type ActionGroup, type BulkActionSpec } from "./actions";
import { actions, capOf, choose, menuKey, overCap } from "./store";
import { tweaks } from "./tweaks";

defineProps<{ side: "top" | "bottom" }>();

const BUTTONS = ["edit", "assign", "add-tags"];
const ORDER: ActionGroup[] = ["app", "edit", "collaborate", "output", "danger"];

const menuOpen = ref(false);
watch(menuKey, () => (menuOpen.value = true));

const workflow = computed(() => actions.value.filter((a) => a.group === "workflow"));
const others = computed(() => actions.value.filter((a) => a.group !== "workflow"));
const buttons = computed(() => others.value.filter((a) => BUTTONS.includes(a.name)));
const remove = computed(() => others.value.find((a) => a.name === "delete"));
const rest = computed(() =>
	others.value.filter((a) => !BUTTONS.includes(a.name) && a.name !== "delete")
);

function menu(list: BulkActionSpec[]) {
	return ORDER.map((group) => ({
		group: GROUP_LABELS[group],
		theme: group === "danger" ? ("red" as const) : undefined,
		options: list
			.filter((a) => a.group === group)
			.map((a) => ({
				label: a.label,
				icon: a.icon,
				theme: a.danger ? ("red" as const) : undefined,
				disabled: overCap(a),
				description: overCap(a) ? `Over the ${capOf(a)} cap` : undefined,
				onClick: () => choose(a),
			})),
	})).filter((group) => group.options.length);
}
</script>
