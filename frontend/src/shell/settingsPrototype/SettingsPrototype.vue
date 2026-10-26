<!-- PROTOTYPE (throwaway): the settings dialog at `#settings/<prefix>/<pane>`, with the pane drawn
     by one of three variants picked by `?variant=`. Saves are stubbed. -->
<template>
	<SettingsDialog v-model:open="open" v-model:tab="tab" size="5xl" :keyboard-shortcut="false">
		<SettingsSidebar>
			<SettingsNavGroup v-for="group in groups" :key="group.prefix" :label="group.label">
				<SettingsNavItem
					v-for="pane in group.panes"
					:key="pane.key"
					:value="`${group.prefix}/${pane.key}`"
				>
					<template #prefix>
						<Avatar
							v-if="group.prefix === 'desk' && pane.key === 'profile'"
							size="xs"
							:label="boot.session.user.full_name"
							:image="boot.session.user.user_image"
						/>
						<span v-else :class="pane.icon" class="size-4 text-ink-gray-6" />
					</template>
					{{ pane.label }}
				</SettingsNavItem>
			</SettingsNavGroup>
		</SettingsSidebar>
		<SettingsContent class="relative">
			<template v-for="group in groups" :key="group.prefix">
				<SettingsPanel
					v-for="pane in group.panes"
					:key="pane.key"
					:value="`${group.prefix}/${pane.key}`"
				>
					<PaneHost
						:pane="pane"
						:prefix="group.prefix"
						:variant="variant"
						:session-user="boot.session.user.name"
					/>
				</SettingsPanel>
			</template>
			<PrototypeSwitcher :variants="VARIANTS" />
		</SettingsContent>
	</SettingsDialog>
</template>

<script setup lang="ts">
import { computed, inject, provide, watch } from "vue";
import { useRoute } from "vue-router";
import {
	Avatar,
	SettingsContent,
	SettingsDialog,
	SettingsNavGroup,
	SettingsNavItem,
	SettingsPanel,
	SettingsSidebar,
} from "frappe-ui";
import { RecordLinkKey } from "@framework/ui/components/Fields/types";
import type { Boot } from "@/boot";
import { useHashDialog } from "../useHashDialog";
import { findPane, groupsFor } from "./panes";
import PaneHost from "./PaneHost.vue";
import PrototypeSwitcher from "./PrototypeSwitcher.vue";

const VARIANTS = [
	{ key: "A", name: "Headings, Save bar at the foot" },
	{ key: "B", name: "Cards, Save in the header" },
	{ key: "C", name: "Marks per row, tabs, floating Save" },
];

const boot = inject<Boot>("boot")!;
const route = useRoute();
const hash = useHashDialog("settings");
provide(RecordLinkKey, null);

const currentPrefix = computed(() => {
	const prefix = boot.shell_base.split("/").pop() ?? "";
	return groupsFor(prefix)[0].prefix === prefix ? prefix : "desk";
});
const groups = computed(() => groupsFor(currentPrefix.value));
const variant = computed(() => String(route.query.variant ?? "A"));

const open = computed({
	get: () => hash.open.value,
	set: (value) => (value ? hash.write() : hash.close()),
});

const tab = computed({
	get: () => hash.segments.value.slice(0, 2).join("/"),
	set: (value) => value && hash.write(...String(value).split("/")),
});

// A short or unknown address opens the current prefix's first pane and is rewritten to it.
watch(
	() => [hash.open.value, hash.segments.value.join("/")],
	() => {
		if (!hash.open.value) return;
		const [prefix, pane] = hash.segments.value;
		if (prefix && pane && findPane(prefix, pane)) return;
		const first = groups.value[0];
		hash.write(first.prefix, first.panes[0].key);
	},
	{ immediate: true }
);
</script>
