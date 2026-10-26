<!-- PROTOTYPE: opens the pane's bindings (a fresh read per open) and draws the pane. -->
<template>
	<Pane :pane="pane" :prefix="prefix" :state="state" />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useEventListener } from "@vueuse/core";
import type { PaneSpec } from "./panes";
import { openPane } from "./bindings";
import Pane from "./Pane.vue";

const props = defineProps<{
	pane: PaneSpec;
	prefix: string;
	sessionUser: string;
}>();

const state = openPane(props.pane, props.sessionUser);

useEventListener(window, "keydown", (event: KeyboardEvent) => {
	if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
	if (!state.hasButtonBlocks) return;
	event.preventDefault();
	state.saveButtons();
});

// Closing blurs the focused field first, so a typed value in an auto block is committed.
onBeforeUnmount(() => (document.activeElement as HTMLElement | null)?.blur?.());
</script>
