<!-- PROTOTYPE (#45851): the modified state (ruling 9). Discard and Save as new always; Save only where the
     reader can save (ruling 10). Not solid while Create is the page's one solid button; `primary` (I and J, where
     Create gives way) makes the last button solid. -->
<template>
	<div v-if="modified" class="flex shrink-0 items-center gap-2" data-proto-modified>
		<Button variant="ghost" label="Discard" @click="acts.discard()" />
		<Button
			:variant="saveable ? 'ghost' : primary ? 'solid' : 'subtle'"
			label="Save as new"
			@click="ask('save_as_new', key)"
		/>
		<Tooltip v-if="saveable" :text="saveHint">
			<Button :variant="primary ? 'solid' : 'subtle'" label="Save" @click="acts.save()" />
		</Tooltip>
	</div>
</template>

<script setup lang="ts">
import { Button, Tooltip } from "frappe-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ask } from "./menus";
import { can, currentKey, isModified, protoState, useViewActs, viewOf } from "./store";

defineProps<{ primary?: boolean }>();

const route = useRoute();
const acts = useViewActs(useRouter(), route);
const state = protoState();

const key = computed(() => currentKey(route));
const view = computed(() => viewOf(key.value));
const modified = computed(() => state.loaded && isModified(route));
const saveable = computed(() => !!view.value && can.save(view.value));
const saveHint = computed(() => {
	const layer = view.value?.layer;
	if (layer === null) return "Saves your own settings of this view";
	if (layer === "app") return "Saves a site copy that overrides the app's view";
	if (layer === "site") return "Saves the view for everyone";
	return "Saves your view";
});
</script>
