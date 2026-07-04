<script setup lang="ts">
// The About-this-workspace dialog (ADR-0039 rule 1 — About is a real dialog, not a noop). A small
// frappe-ui Dialog driven by `state.aboutOpen`; content is read live — the framework version + site
// from the cached boot, the installed apps from the registry seam (the same set the launcher shows).
// frappe-ui's Dialog carries the dark-mode tokens, so no theming here (like CloseConfirmDialog).
import { computed, onMounted, ref } from "vue";
import { Dialog } from "frappe-ui";
import { useOS } from "@/desktop";
import { useRegistry } from "@/registry";
import { getBoot } from "@/data/boot";

const os = useOS();

// Open whenever the flag is set; closing the dialog by any means (backdrop/Escape/×) clears it.
const open = computed({
	get: () => os.state.aboutOpen,
	set: (v) => { if (!v) os.closeAbout(); },
});

// The installed OS apps (id + display name + logo) from the merged registry — About lists exactly
// what the person can open, no separate fetch.
const apps = computed(() => useRegistry().apps());

// Framework version + site name come from the cached boot (synchronous after first paint; read
// defensively so an older server that omits them just leaves those lines out).
const version = ref("");
const sitename = ref("");
onMounted(async () => {
	const boot = await getBoot();
	version.value = boot.version ?? "";
	sitename.value = boot.sitename ?? "";
});

const frappeLogo = os.DATA.APP.frappe.logo;
</script>

<template>
	<Dialog v-model="open" :options="{ title: 'About this workspace', size: 'sm' }">
		<template #body-content>
			<div class="flex flex-col items-center gap-1.5 py-2 text-center">
				<img :src="frappeLogo" alt="Frappe" class="h-12 w-12 object-contain" />
				<div class="text-base font-semibold text-ink-gray-9">Frappe OS</div>
				<div v-if="version" class="text-sm text-ink-gray-6">Version {{ version }}</div>
				<div v-if="sitename" class="text-sm text-ink-gray-5">{{ sitename }}</div>
			</div>
			<div class="mt-4 border-t border-outline-gray-2 pt-3">
				<div class="mb-2 text-sm font-medium text-ink-gray-7">Installed apps</div>
				<ul class="flex flex-col gap-1.5">
					<li
						v-for="app in apps"
						:key="app.id"
						class="flex items-center gap-2 text-sm text-ink-gray-7"
					>
						<img
							v-if="app.logo"
							:src="app.logo"
							alt=""
							class="h-4 w-4 flex-shrink-0 rounded-[3px] object-contain"
						/>
						<span>{{ app.name }}</span>
					</li>
				</ul>
			</div>
		</template>
	</Dialog>
</template>
