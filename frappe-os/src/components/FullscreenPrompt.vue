<script setup lang="ts">
// Shown when the app is put into native fullscreen (the green window button) while Chrome's
// PWA bar is still showing. A maximize click can't call the Fullscreen API, but this dialog's
// button IS a user gesture — so clicking it goes truly chromeless. Driven by
// `fullscreenPromptOpen`; frappe-ui's Dialog carries the dark-mode tokens, so no theming here.
import { computed } from "vue";
import { Button, Dialog } from "frappe-ui";
import { useOS } from "@/desktop";

const os = useOS();

// Dismissing by any means (backdrop / Escape / "Not now") just closes the offer.
const open = computed({
	get: () => os.fullscreenPromptOpen.value,
	set: (v) => {
		if (!v) os.dismissFullscreenPrompt();
	},
});

function goFullscreen() {
	os.toggleFullscreen();
	os.dismissFullscreenPrompt();
}
</script>

<template>
	<Dialog v-model="open" :options="{ title: 'Enter full screen?', size: 'sm' }">
		<template #body-content>
			<p class="text-p-base text-ink-gray-7">
				Hide the browser bar for an edge-to-edge desktop. Press Esc anytime to bring it back.
			</p>
		</template>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button label="Not now" @click="os.dismissFullscreenPrompt()" />
				<Button label="Enter full screen" variant="solid" @click="goFullscreen()" />
			</div>
		</template>
	</Dialog>
</template>
