<!-- PROTOTYPE (#45851): Rename, Save as new, Delete and Publish, each a stub on the in-memory store. -->
<template>
	<Dialog v-model="open" :title="title" size="sm" :actions="actions">
		<template #default>
			<div v-if="asking === 'rename' || asking === 'save_as_new'" class="flex flex-col gap-2">
				<FormControl
					v-model="label"
					type="text"
					:label="'Name'"
					autofocus
					@keydown.enter="confirm"
				/>
				<p class="text-sm text-ink-gray-5">{{ hint }}</p>
			</div>
			<p v-else class="text-base text-ink-gray-6">{{ hint }}</p>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog, FormControl } from "frappe-ui";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { protoState, useViewActs, viewOf } from "./store";

const state = protoState();
const acts = useViewActs(useRouter(), useRoute());
const label = ref("");

const open = computed({
	get: () => !!state.dialog,
	set: (value) => {
		if (!value) state.dialog = null;
	},
});
const asking = computed(() => state.dialog?.kind);
const view = computed(() => (state.dialog ? viewOf(state.dialog.key) : undefined));

watch(
	() => state.dialog,
	(dialog) => {
		if (!dialog) return;
		label.value = dialog.kind === "save_as_new" ? `${view.value?.label ?? ""} copy` : view.value?.label ?? "";
	}
);

const title = computed(
	() =>
		({
			rename: "Rename view",
			save_as_new: "Save as new view",
			delete: view.value?.overridesApp ? `Restore the app's "${view.value?.label}"?` : `Delete "${view.value?.label}"?`,
			publish: `Publish "${view.value?.label}"?`,
		})[asking.value ?? "rename"]
);

const hint = computed(
	() =>
		({
			rename: "Only the name changes. Links, stars and sidebar rows keep working.",
			save_as_new: "Saved to My views with the current filters and sort.",
			delete: view.value?.overridesApp
				? "The site's copy goes, and everyone sees the app's view again."
				: "Sidebar rows that open it show “View deleted”.",
			publish: "Everyone on the site sees it under Site views. Only a site administrator can change it then.",
		})[asking.value ?? "rename"]
);

const actions = computed(() => [
	{
		label: { rename: "Rename", save_as_new: "Save", delete: view.value?.overridesApp ? "Restore" : "Delete", publish: "Publish" }[
			asking.value ?? "rename"
		],
		variant: "solid",
		theme: asking.value === "delete" && !view.value?.overridesApp ? "red" : "gray",
		onClick: confirm,
	},
]);

function confirm() {
	const dialog = state.dialog;
	if (!dialog) return;
	if (dialog.kind === "rename") acts.rename(dialog.key, label.value);
	if (dialog.kind === "save_as_new") acts.saveAsNew(label.value.trim() || "Untitled view");
	if (dialog.kind === "delete") acts.remove(dialog.key);
	if (dialog.kind === "publish") acts.publish(dialog.key);
	state.dialog = null;
}
</script>
