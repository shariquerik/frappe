<!-- PROTOTYPE (throwaway): the settings dialog at `#settings/<prefix>/<pane>`. Saves are stubbed. -->
<template>
	<SettingsDialog v-model:open="open" v-model:tab="tab" size="5xl" :keyboard-shortcut="false">
		<SettingsSidebar>
			<SettingsSearch v-model="query" :groups="navGroups" @pick="pick" />
			<SettingsNavGroup
				v-for="group in navGroups"
				v-show="!query.trim()"
				:key="group.prefix"
				:label="group.label || undefined"
			>
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
			<template v-for="group in panelGroups" :key="group.prefix">
				<SettingsPanel
					v-for="pane in group.panes"
					:key="pane.key"
					class="min-w-0"
					:value="`${group.prefix}/${pane.key}`"
				>
					<PaneHost
						:pane="pane"
						:prefix="group.prefix"
						:session-user="boot.session.user.name"
					/>
				</SettingsPanel>
			</template>
		</SettingsContent>
	</SettingsDialog>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref, watch } from "vue";
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
import { getFieldComponent } from "@framework/ui/components/FormLayout";
import { ResolveFieldKey } from "@framework/ui/components/FormLayout/types";
import type { Boot } from "@/boot";
import { useHashDialog } from "../useHashDialog";
import { findPane, groupsFor, hasGroup } from "./panes";
import PaneHost from "./PaneHost.vue";
import SettingsSearch from "./SettingsSearch.vue";
import { searchTarget, type SearchHit } from "./search";

const boot = inject<Boot>("boot")!;
const hash = useHashDialog("settings");
provide(RecordLinkKey, null);
provide(ResolveFieldKey, getFieldComponent);
const route = useRoute();

const currentPrefix = computed(() => {
	const prefix = boot.shell_base.split("/").pop() ?? "";
	return hasGroup(prefix) ? prefix : "desk";
});

// PROTOTYPE comparison for an address into another app's pane: `?foreign=show` (default) lists
// that app's group too, `hide` opens the pane unlisted, `switch` opens as if from that app.
const foreignMode = computed(() => String(route.query.foreign ?? "show"));
const context = ref(currentPrefix.value);
watch(
	() => [hash.open.value, hash.segments.value[0]] as const,
	([isOpen, prefix]) => {
		if (!isOpen) context.value = currentPrefix.value;
		else if (foreignMode.value === "switch" && prefix && prefix !== "desk" && hasGroup(prefix))
			context.value = prefix;
	},
	{ immediate: true }
);
const navGroups = computed(() => {
	if (foreignMode.value === "hide") return groupsFor(currentPrefix.value);
	if (foreignMode.value === "switch") return groupsFor(context.value);
	return groupsFor(currentPrefix.value, hash.segments.value[0]);
});
const panelGroups = computed(() =>
	groupsFor(
		foreignMode.value === "switch" ? context.value : currentPrefix.value,
		hash.segments.value[0]
	)
);
const query = ref("");

function pick(hit: SearchHit) {
	searchTarget.value = {
		prefix: hit.prefix,
		pane: hit.pane.key,
		block: hit.block?.key,
		fieldname: hit.fieldname,
	};
	hash.write(hit.prefix, hit.pane.key);
}

const open = computed({
	get: () => hash.open.value,
	set: (value) => (value ? hash.write() : hash.close()),
});

const tab = computed({
	get: () => hash.segments.value.slice(0, 2).join("/"),
	set: (value) => value && hash.write(...String(value).split("/")),
});

// A short or unknown address opens the current app's first pane and is rewritten to it.
watch(
	() => [hash.open.value, hash.segments.value.join("/")],
	() => {
		if (!hash.open.value) return;
		const [prefix, pane] = hash.segments.value;
		if (prefix && pane && findPane(prefix, pane)) return;
		const first = navGroups.value.find((group) => group.prefix === currentPrefix.value)!;
		hash.write(first.prefix, first.panes[0].key);
	},
	{ immediate: true }
);
</script>
