<!-- PROTOTYPE (#47378): "Just me / Everyone", and "Show hidden". Everyone is for System Managers only. -->
<template>
	<div class="flex items-center gap-3" data-level-switch>
		<TabButtons v-model="level" :options="buttons" />
		<Tooltip v-if="!manager" text="Only System Managers can edit for everyone">
			<span class="lucide-lock size-3.5 text-ink-gray-5" />
		</Tooltip>
		<Switch v-model="showHidden" label="Show hidden" size="sm" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Switch, TabButtons, Tooltip } from "frappe-ui";
import type { Boot } from "@/boot";
import { level, showHidden } from "./navDraft";

const boot = inject<Boot>("boot")!;
const manager = computed(() => (boot.session.roles ?? []).includes("System Manager"));
const buttons = computed(() => [
	{ label: "Just me", value: "user" },
	{ label: "Everyone", value: "site", disabled: !manager.value },
]);
</script>
