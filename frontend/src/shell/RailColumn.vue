<!--
  The rail on frappe-ui's `Rail`: an icon column. The app logo is the first cell and opens the
  app menu; a rail heading has no icon form, so its children draw flat and the heading vanishes.
-->
<template>
	<Rail>
		<div class="mb-3 flex shrink-0 items-center justify-center">
			<!-- A raw button: `Dropdown` cannot reach a trigger through `RailItem`'s `Tooltip`. -->
			<Tooltip :text="appTitle" side="right">
				<Dropdown :options="menu" side="right" align="start">
					<template #default>
						<button
							type="button"
							data-key="app-menu"
							class="flex size-7 items-center justify-center rounded-[7px] bg-surface-gray-3 text-sm font-medium text-ink-gray-8 transition hover:bg-surface-gray-4 focus-visible:ring-0 focus-visible:focus-ring"
							:aria-label="`${appTitle} menu`"
						>
							<img v-if="logo" :src="logo" alt="" class="size-7 rounded-[7px]" />
							<span v-else>{{ appTitle.charAt(0).toUpperCase() }}</span>
						</button>
					</template>
				</Dropdown>
			</Tooltip>
		</div>

		<div class="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto">
			<template v-for="cell in cells" :key="cell.key">
				<RailItem
					v-if="'to' in cell"
					:to="cell.to"
					:label="cell.label"
					:active="cell.key === current"
				>
					<Icon v-if="cell.icon" :name="cell.icon" />
					<span v-else class="text-sm font-medium">{{ cell.label.charAt(0) }}</span>
				</RailItem>

				<!-- Off this prefix: a full document load. `RailItem` has no anchor form, so a button. -->
				<RailItem
					v-else
					:label="cell.label"
					:active="cell.key === current"
					@click="leave(cell.href)"
				>
					<Icon v-if="cell.icon" :name="cell.icon" />
					<span v-else class="text-sm font-medium">{{ cell.label.charAt(0) }}</span>
				</RailItem>
			</template>
		</div>
	</Rail>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { Dropdown, Rail, RailItem, Tooltip, toast } from "frappe-ui";
import type { Boot, NavigationItem } from "@/boot";
import Icon from "@/icons/Icon.vue";
import { labelOf, renderingOf } from "@/navigation/registry";
import type { ItemNode } from "@/navigation/tree";
import { useItemTree } from "@/navigation/useItemTree";
import type { ItemContext } from "@/navigation/types";

type Cell = { key: string; label: string; icon?: string } & (
	| { to: RouteLocationRaw }
	| { href: string }
);

const props = defineProps<{
	items: NavigationItem[];
	context: ItemContext;
	current?: string;
	arrangeable?: boolean;
	shareLink?: string;
}>();
const emit = defineEmits<{ arrange: [] }>();

const boot = inject<Boot>("boot")!;

const appTitle = computed(() => boot.app ?? "Apps");
// The logo rides on boot only for the index; on an app's own prefix there is none yet.
const logo = computed(() => boot.apps?.find((app) => app.app === boot.app)?.logo);

const tree = useItemTree(() => props.items, "the rail");

// Depth-first and flat: a heading contributes its children and nothing else. Rows fetched
// on demand have nowhere to expand into in an icon column, so they are not drawn.
const cells = computed(() => {
	const out: Cell[] = [];
	const walk = (nodes: ItemNode[]) => {
		for (const node of nodes) {
			const item = node.item;
			const rendering = renderingOf(item, props.context);
			const label = labelOf(item, props.context);

			if (rendering && "to" in rendering) out.push({ key: item.key, label, icon: item.icon, to: rendering.to });
			else if (rendering && "href" in rendering)
				out.push({ key: item.key, label, icon: item.icon, href: rendering.href });

			walk(node.children);
		}
	};
	walk(tree.value);
	return out;
});

const menu = computed(() => [
	{ label: "All apps", icon: "lucide-layout-grid", onClick: () => leave("/apps") },
	...(props.arrangeable
		? [{ label: "Customize sidebar", icon: "lucide-settings-2", onClick: () => emit("arrange") }]
		: []),
	...(props.shareLink ? [{ label: "Copy link", icon: "lucide-link", onClick: copyLink }] : []),
]);

function leave(href: string) {
	window.location.assign(href);
}

// The menu closes on the click, so the confirmation is a toast rather than a swapped label.
async function copyLink() {
	if (!props.shareLink) return;
	try {
		await navigator.clipboard.writeText(props.shareLink);
	} catch {
		toast.error("Could not copy the link");
		return;
	}
	toast.success("Link copied");
}
</script>
