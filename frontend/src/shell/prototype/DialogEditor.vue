<!--
  PROTOTYPE (#47378), variant B: today's customize dialog, grown into two panes. The left lists the
  rail or one sidebar; the right is the chosen row's form. Save is the one commit.
-->
<template>
	<Dialog
		bare
		size="4xl"
		:modelValue="editing"
		@update:modelValue="(open) => !open && discard()"
	>
		<div class="flex h-[640px] flex-col" data-dialog-editor>
			<header
				class="flex items-start justify-between gap-4 border-b border-outline-gray-1 px-6 pb-4 pt-5"
			>
				<div class="min-w-0">
					<h2 class="text-xl font-semibold text-ink-gray-9">Customize navigation</h2>
					<p class="mt-1 text-sm text-ink-gray-5">{{ boot.app_title }}</p>
				</div>
				<div class="flex flex-col items-end gap-1.5" data-level-switch>
					<Tooltip
						text="Only System Managers can change it for everyone"
						:disabled="manager"
					>
						<TabButtons v-model="level" :options="levels" />
					</Tooltip>
					<p class="h-4 text-xs text-ink-gray-5">
						{{ level === "site" ? "Changes apply to everyone on this site" : "" }}
					</p>
				</div>
			</header>

			<div class="grid min-h-0 flex-1 grid-cols-[300px_1fr]">
				<DialogOutline class="border-r border-outline-gray-1" />
				<DialogRowPane />
			</div>

			<footer class="flex items-center gap-2 border-t border-outline-gray-1 px-6 py-4">
				<Button
					v-if="dirty"
					class="-ml-2"
					variant="ghost"
					label="Discard changes"
					data-revert
					@click="revert"
				/>
				<Button class="ml-auto" variant="subtle" label="Cancel" @click="discard" />
				<Button variant="solid" label="Save" :disabled="!dirty" data-save @click="save" />
			</footer>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, watch } from "vue";
import { Button, Dialog, TabButtons, Tooltip } from "frappe-ui";
import type { Boot } from "@/boot";
import { dirty, discard, editing, level, revert, save } from "./navDraft";
import { clear } from "./dialogPane";
import DialogOutline from "./DialogOutline.vue";
import DialogRowPane from "./DialogRowPane.vue";

const boot = inject<Boot>("boot")!;
const manager = computed(() => (boot.session.roles ?? []).includes("System Manager"));
const levels = computed(() => [
	{ label: "Just me", value: "user" },
	{ label: "Everyone", value: "site", disabled: !manager.value },
]);

watch(editing, (open) => open && clear());
</script>
