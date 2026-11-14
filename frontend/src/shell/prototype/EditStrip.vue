<!-- PROTOTYPE (#47378), variant A: the strip that says the rail and sidebar are being edited. -->
<template>
	<div class="!flex-none border-b border-outline-gray-2 bg-surface-gray-1" data-edit-strip>
		<div class="flex h-11 items-center gap-4 pl-4 pr-2">
			<span class="flex items-center gap-2 text-sm font-medium text-ink-gray-8">
				<span class="lucide-pencil size-4 text-ink-gray-6" />
				Editing navigation
			</span>
			<LevelSwitch />
			<p v-if="refusal" class="truncate rounded-4 bg-surface-amber-2 px-2 py-1 text-xs text-ink-gray-8" data-refusal>
				{{ refusal }}
			</p>
			<div class="ml-auto flex gap-1">
				<Button label="Discard" @click="discard" />
				<Button variant="solid" label="Save" @click="save" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";
import LevelSwitch from "./LevelSwitch.vue";
import { discard, refusal, save } from "./navDraft";
</script>
