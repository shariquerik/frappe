<!--
  PROTOTYPE: three variants of the frame on frappe-ui's `DesktopShell`, on the existing routes,
  switchable with `?variant=`. `AppShell` still decides what is current and which panel is open.
  A: icon rail, drawer editor, panel collapses to nothing. B: today's labelled rail, frappe-ui
  panel only. C: icon rail, dialog editor, panel collapses to icons.
-->
<template>
	<DesktopShell
		:scroll="false"
		class="desk-shell relative h-screen w-screen bg-surface-base text-ink-gray-9"
	>
		<template #rail>
			<AppRail
				v-if="variant === 'B'"
				:items="rail"
				:context="railContext"
				:current="current.railKey"
				:sections="railSections"
				:arrangeable="!!boot.app"
				:share-link="shareLink"
				@arrange="arrange.write('rail')"
			/>
			<RailColumn
				v-else
				:items="rail"
				:context="railContext"
				:current="current.railKey"
				:arrangeable="!!boot.app"
				:share-link="shareLink"
				@arrange="arrange.write('rail')"
			/>
		</template>

		<template #sidebar>
			<SidebarPanel
				v-if="panel"
				:key="panel.address"
				:address="panel.address"
				:items="panel.items"
				:context="panel.context"
				:title="panel.title"
				:current="current.rowKey"
				:sections="sections[panel.address]"
				:collapse="variant === 'C' ? 'icons' : 'zero'"
				arrangeable
				@arrange="arrange.write('sidebar', panel.address)"
			/>
		</template>

		<div class="flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1">
			<RouterView />
		</div>

		<!-- The overlay slot: one hash, one overlay, above any page. `#arrange/...` is its first tenant. -->
		<Dialog
			v-if="variant === 'C'"
			:modelValue="!!arranging"
			bare
			size="sm"
			@update:modelValue="arrange.close()"
		>
			<ArrangementEditor
				v-if="arranging"
				:key="arranging.address"
				class="h-[70vh] w-full border-0"
				:container="arranging.container"
				:address="arranging.address"
				:title="arranging.title"
				@saved="emit('saved', $event)"
				@close="arrange.close()"
			/>
		</Dialog>
		<ArrangementEditor
			v-else-if="arranging"
			:key="arranging.address"
			class="absolute inset-y-0 right-0 z-20 shadow-2xl"
			:container="arranging.container"
			:address="arranging.address"
			:title="arranging.title"
			@saved="emit('saved', $event)"
			@close="arrange.close()"
		/>

		<ToastProvider />
		<PrototypeSwitcher :state="current" />
	</DesktopShell>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { RouterView } from "vue-router";
import { DesktopShell, Dialog, ToastProvider } from "frappe-ui";
import type { Boot, Navigation, NavigationItem } from "@/boot";
import type { Container } from "@/arrangement";
import type { CurrentNavigation } from "@/navigation/current";
import type { SectionMemory } from "@/navigation/sectionMemory";
import type { ItemContext } from "@/navigation/types";
import AppRail from "./AppRail.vue";
import ArrangementEditor from "./ArrangementEditor.vue";
import PrototypeSwitcher from "./PrototypeSwitcher.vue";
import RailColumn from "./RailColumn.vue";
import SidebarPanel from "./SidebarPanel.vue";
import { useHashDialog } from "./useHashDialog";
import type { Variant } from "./shellVariant";

defineProps<{
	variant: Variant;
	rail: NavigationItem[];
	/** Variant B's labelled rail keeps rail sections, so it needs their memory. */
	railSections?: SectionMemory;
	railContext: ItemContext;
	current: CurrentNavigation;
	sections: Record<string, SectionMemory>;
	panel: {
		address: string;
		items: NavigationItem[];
		context: ItemContext;
		title?: string;
	} | null;
	shareLink?: string;
}>();
const emit = defineEmits<{ saved: [Navigation] }>();

const boot = inject<Boot>("boot")!;

const arrange = useHashDialog("arrange");

// `#arrange/rail` or `#arrange/sidebar/<address>`; anything else under the root is nothing.
const arranging = computed<{ container: Container; address: string; title: string } | null>(
	() => {
		const [what, address] = arrange.segments.value;
		if (what === "rail" && boot.app)
			return { container: "Rail", address: boot.app, title: "Arrange this rail" };
		if (what === "sidebar" && address)
			return { container: "Sidebar", address, title: "Arrange this sidebar" };
		return null;
	}
);
</script>

<style scoped>
/* The borders as CRM's frontend2 draws them: on the panel's left edge and the content's. */
.desk-shell :deep([data-slot="desktop-shell-content"]) {
	@apply border-l border-outline-gray-1 bg-surface-base;
}
</style>
