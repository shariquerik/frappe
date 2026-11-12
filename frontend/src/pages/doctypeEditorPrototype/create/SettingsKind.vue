<!-- PROTOTYPE (#47098), throwaway: the Danger zone's "Change kind" row and its dialog: a
     dialog of the five kinds, the current one checked, the refused ones disabled with the reason, and
     what the picked one does said under the list. Customize has no Danger zone, so no row. -->
<template>
	<SettingsRow
		label="Change kind"
		:help="`${ui.doctype} is ${/^[AEIOU]/.test(current.label) ? 'an' : 'a'} ${current.label} DocType. Changing it adds or removes fields and rights.`"
		keywords="kind regular submittable tree child table single istable issingle is_tree"
		action
		class="!py-3"
	>
		<Button variant="subtle" theme="red" label="Change kind…" data-danger="kind" @click="open" />
	</SettingsRow>
	<Dialog v-model:open="shown" :title="`Change ${ui.doctype}'s kind`" size="md">
		<RadioGroup v-model="picked" padded class="-mx-1.5">
			<Radio
				v-for="one in KINDS"
				:key="one.value"
				:value="one.value"
				:label="one.label"
				:description="kindRefusal(ui, one.value) || one.description"
				:disabled="Boolean(kindRefusal(ui, one.value))"
			/>
		</RadioGroup>
		<p v-if="consequence" class="mt-3 text-p-sm text-ink-gray-6">{{ consequence }}</p>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="shown = false" />
				<Button variant="solid" label="Change kind" :disabled="picked === ui.kind" @click="apply" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Button, Dialog, Radio, RadioGroup } from "frappe-ui";
import SettingsRow from "./SettingsRow.vue";
import { kindConsequence, kindRefusal, KINDS, SettingsKey, type SettingsKind } from "./settings";

const ui = inject(SettingsKey)!;
const current = computed(() => KINDS.find((one) => one.value === ui.kind)!);
const shown = ref(false);
const picked = ref<SettingsKind>(ui.kind);
const consequence = computed(() => kindConsequence(ui, picked.value));
function apply() {
	ui.setKind(picked.value);
	shown.value = false;
}

function open() {
	picked.value = ui.kind;
	shown.value = true;
}
</script>
