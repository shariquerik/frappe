<!-- PROTOTYPE (#45867): the acts run so far, newest first. Each edit is one named act
     (charter ruling 8), so a script could replay this list with no mouse. -->
<template>
	<div class="fixed bottom-16 left-4 z-40 w-80 rounded-5 bg-surface-gray-9 p-3 text-xs text-ink-white shadow-xl">
		<div class="mb-2 flex items-center justify-between">
			<span class="font-medium">Acts run · prototype</span>
			<span class="text-ink-gray-4">{{ editor.state.log.length }}</span>
		</div>
		<p v-if="!editor.state.log.length" class="text-ink-gray-4">Nothing yet. Drag a field or edit a property.</p>
		<ol class="space-y-1">
			<li v-for="(entry, index) in editor.state.log.slice(0, 7)" :key="index" class="font-mono leading-4">
				<span class="text-ink-white">{{ entry.act }}</span>
				<span class="text-ink-gray-4"> {{ entry.args }}</span>
				<span v-if="entry.note" class="text-ink-gray-5"> — {{ entry.note }}</span>
			</li>
		</ol>
	</div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { EditorKey } from "./context";

const editor = inject(EditorKey)!;
</script>
