<!-- PROTOTYPE (#47056): everything bulk a list or cards view draws over its rows: the floating bar,
     the run tray, the dialogs, the tweak panel, and the `.` and Esc keys. -->
<template>
	<Transition
		enter-active-class="duration-200 ease-out"
		enter-from-class="translate-y-2 opacity-0"
		leave-active-class="duration-200 ease-in"
		leave-to-class="translate-y-2 opacity-0"
	>
		<div
			v-if="tweaks.barAt === 'bottom' && (count || barRun)"
			class="absolute inset-x-0 bottom-16 z-10 mx-auto w-max"
		>
			<BulkBar :floating="true" />
		</div>
	</Transition>
	<RunTray v-if="tweaks.runs === 'tray'" />
	<ResultDialog />
	<ActionDialog />
	<TweakPanel />
</template>

<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { computed } from "vue";
import ActionDialog from "./ActionDialog.vue";
import BulkBar from "./BulkBar.vue";
import ResultDialog from "./ResultDialog.vue";
import RunTray from "./RunTray.vue";
import TweakPanel from "./TweakPanel.vue";
import { isTyping } from "./keys";
import { asking, clearSelection, count, menuKey, runs, shownResult } from "./store";
import { tweaks } from "./tweaks";

const barRun = computed(() => (tweaks.runs === "bar" ? runs.find((run) => run.background) : undefined));

useEventListener(document, "keydown", (event: KeyboardEvent) => {
	if (isTyping(event) || !count.value || asking.value || shownResult.value) return;
	if (event.key === ".") {
		event.preventDefault();
		menuKey.value++;
	} else if (event.key === "Escape") clearSelection();
});

</script>
