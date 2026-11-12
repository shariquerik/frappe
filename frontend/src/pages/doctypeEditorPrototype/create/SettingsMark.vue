<!-- PROTOTYPE (#47098), throwaway: a setting's Customize mark, in a 20px slot that is always there
     (after a row's label) so nothing re-wraps when one appears: a lock (the site may not change
     it) or a dot (the site changed it) that turns into a reset arrow while its row is hovered, as
     #47096's panel rows. -->
<template>
	<span class="grid size-5 shrink-0 place-items-center">
		<Tooltip v-if="lock" :text="lock">
			<span class="lucide-lock size-3.5 text-ink-gray-4" aria-label="Locked" data-settings-lock />
		</Tooltip>
		<template v-else-if="changed">
			<span class="grid size-5 place-items-center group-hover/row:hidden" aria-label="Changed on this site" data-settings-changed>
				<span class="size-1.5 rounded-full bg-surface-gray-7" />
			</span>
			<Tooltip :text="resetText">
				<button
					type="button"
					class="hidden size-5 place-items-center rounded-3 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-8 group-hover/row:grid"
					:aria-label="resetText"
					@click="$emit('reset')"
				>
					<span class="lucide-rotate-ccw size-3.5" aria-hidden="true" />
				</button>
			</Tooltip>
		</template>
	</span>
</template>

<script setup lang="ts">
import { Tooltip } from "frappe-ui";

withDefaults(defineProps<{ lock?: string; changed?: boolean; resetText?: string }>(), { lock: "", resetText: "Reset" });
defineEmits<{ reset: [] }>();
</script>
