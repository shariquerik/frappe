<!-- PROTOTYPE (#45851) variant D: the view is a control in the controls row, first, beside the filters it holds.
     Its menu lists the views by layer; the view's acts join the row's existing ⋯ menu. -->
<template>
	<Dropdown :options="options" side="bottom" align="start">
		<div class="flex shrink-0" data-proto-controls>
			<Button
				variant="subtle"
				:icon-left="view ? iconOf(view.type) : 'lucide-list'"
				icon-right="lucide-chevron-down"
				:label="view?.label ?? key"
			/>
		</div>
	</Dropdown>
</template>

<script setup lang="ts">
import { Button, Dropdown } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { viewGroups } from "./menus";
import { currentKey, iconOf, protoState, useViewActs, viewOf } from "./store";

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();
const key = computed(() => currentKey(route));
const view = computed(() => (state.loaded ? viewOf(key.value) : undefined));
const options = computed(() => viewGroups(acts, key.value).map((group) => ({ ...group, hideLabel: false })));
</script>
