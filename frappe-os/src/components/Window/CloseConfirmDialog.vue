<script setup lang="ts">
// The unsaved-changes close guard (ADR-0029): a single desktop-level dialog driven by
// `state.closeConfirm` — the window id `requestCloseWin` parks there when a dirty ephemeral draft
// would be lost. Discard closes the window (dropping the draft); Cancel keeps it. Backdrop/Escape
// dismiss counts as Cancel. frappe-ui's Dialog carries dark-mode tokens, so no theming here.
import { computed } from "vue";
import { Button, Dialog } from "frappe-ui";
import { useOS } from "@/desktop";

const os = useOS();

// Open whenever a window is parked for confirmation; closing the dialog by any means cancels.
const open = computed({
	get: () => !!os.state.closeConfirm,
	set: (v) => {
		if (!v) os.cancelCloseWin();
	},
});
</script>

<template>
	<Dialog v-model="open" :options="{ title: 'Discard unsaved changes?', size: 'sm' }">
		<template #body-content>
			<p class="text-p-base text-ink-gray-7">
				This window has changes you haven’t saved. If you close it, those changes will be lost.
			</p>
		</template>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="os.cancelCloseWin()" />
				<Button
					label="Discard & Close"
					variant="solid"
					theme="red"
					@click="os.confirmCloseWin()"
				/>
			</div>
		</template>
	</Dialog>
</template>
