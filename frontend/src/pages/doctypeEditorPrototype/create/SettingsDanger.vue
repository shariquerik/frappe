<!-- PROTOTYPE (#47098), throwaway: the Danger zone (Design mode, a saved DocType). One row per act,
     a divider between rows, each with a red subtle button opening its dialog (Change kind its own;
     the rest SettingsDialogs, shared with the header's ⋯ menu); a refused act is disabled with the
     reason. Make it standard shows only on a custom DocType. Module shows only here, in the Move row. -->
<template>
	<div class="flex flex-col divide-y divide-outline-gray-1">
		<SettingsKind />
		<SettingsRow v-for="one in acts" :key="one.act" :label="one.label" :help="one.help" :keywords="one.keywords" action class="!py-3">
			<Tooltip :text="actRefusal(ui, one.act)" :disabled="!actRefusal(ui, one.act)">
				<span class="inline-flex">
					<Button variant="subtle" theme="red" :label="one.button" :disabled="Boolean(actRefusal(ui, one.act))" :data-danger="one.act" @click="ui.act = one.act" />
				</span>
			</Tooltip>
		</SettingsRow>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Button, Tooltip } from "frappe-ui";
import SettingsKind from "./SettingsKind.vue";
import SettingsRow from "./SettingsRow.vue";
import { actRefusal, SettingsKey, type Act } from "./settings";

const ui = inject(SettingsKey)!;
const records = computed(() => (ui.records ?? 0).toLocaleString());
const ALL_ACTS = computed<{ act: Act; label: string; help: string; button: string; keywords: string }[]>(() => [
	{
		act: "rename",
		label: "Rename DocType",
		help: ui.custom ? "Renames its table and every Link and Table field that points to it." : "Renames its table, every field that points to it, its folder and its controller.",
		button: "Rename…",
		keywords: "name",
	},
	{
		act: "move",
		label: "Move to another module",
		help: `In the ${ui.module} module.`,
		button: "Move…",
		keywords: "module app folder",
	},
	{ act: "standard", label: "Make it standard", help: "Writes its files into a module's app, so the app ships it.", button: "Make standard…", keywords: "custom module app developer" },
	{ act: "delete", label: "Delete DocType", help: `Deletes ${ui.doctype} and its ${records.value} record${ui.records === 1 ? "" : "s"}.`, button: "Delete…", keywords: "remove drop" },
]);
// A standard DocType has no "Make it standard" row: there is nothing to do.
const acts = computed(() => ALL_ACTS.value.filter((one) => one.act !== "standard" || ui.custom));
</script>
