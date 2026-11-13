<!-- The bar that takes the column labels' place while rows are selected: the count, the actions, and a clear button. -->
<template>
	<!-- PROTOTYPE (#47260): `island` draws the bar as a floating surface; otherwise the header-row bar with even gaps. -->
	<div
		class="flex items-center text-base"
		:data-theme="island && bulkVariant === 'C' ? 'dark' : undefined"
		:class="
			!island
				? 'h-7 w-full'
				: [
						'h-11 rounded-6 bg-surface-base py-2 pe-2 ps-4',
						{
							B: 'shadow-2xl ring-1 ring-outline-gray-1',
							C: 'shadow-2xl',
							D: 'shadow-2xl ring-1 ring-outline-gray-3',
							E: '!bg-surface-gray-3 shadow-xl ring-1 ring-outline-gray-3',
							F: 'glass shadow-2xl ring-1 ring-outline-gray-2',
							H: 'deep !rounded-full !ps-5 ring-1 ring-outline-gray-3',
							I: 'shadow-2xl !ps-1.5 ring-1 ring-outline-gray-3',
							J: 'shadow-2xl !ps-2 ring-1 ring-outline-gray-3',
							K: 'deep !ps-3 ring-1 ring-outline-gray-3',
						}[bulkVariant],
				  ]
		"
		role="toolbar"
		:aria-label="__('Bulk actions')"
	>
		<!-- PROTOTYPE (#47260): variant K's checkbox; unticking it clears the selection. -->
		<Checkbox
			v-if="tight"
			class="me-2"
			:modelValue="true"
			:aria-label="__('Clear selection')"
			@update:modelValue="$emit('clear')"
		/>
		<span
			v-if="island && bulkVariant === 'J' && !scope.all.value"
			class="flex items-center gap-2 whitespace-nowrap text-ink-gray-9"
			aria-live="polite"
		>
			<span
				class="flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-gray-7 px-1.5 text-sm font-medium text-ink-white"
			>
				{{ scope.count.value }}
			</span>
			{{ __("selected") }}
		</span>
		<span
			v-else
			class="whitespace-nowrap text-ink-gray-9"
			:class="{ 'rounded-4 bg-surface-gray-3 px-2.5 py-1.5': island && bulkVariant === 'I' }"
			aria-live="polite"
		>
			{{ countText }}
		</span>
		<Button
			v-if="scope.canSelectAll.value"
			class="ms-1"
			variant="ghost"
			:label="__('Select all {0}', [scope.totalText.value])"
			@click="scope.selectAll()"
		/>
		<template v-if="overCap">
			<span
				class="ms-3 flex items-center gap-1 whitespace-nowrap text-sm text-ink-gray-5"
				role="status"
			>
				<Icon name="lucide-circle-alert" class="size-3.5" />
				{{ __("Over the {0} cap", [cap]) }}
			</span>
		</template>
		<template v-if="shown">
			<div :class="[divider, scope.canSelectAll.value ? 'mx-1' : 'me-1 ms-3']" />
			<div class="flex items-center" :class="tight ? 'gap-0' : 'gap-0.5'">
				<Button
					v-for="entry in layout.transitions"
					:key="entry.name"
					variant="subtle"
					:label="barLabel(entry.label)"
					:icon-left="entry.icon"
					:disabled="entry.disabled"
					@click="entry.onClick"
				/>
				<div v-if="layout.transitions.length" :class="[divider, 'mx-1']" />
				<Button
					v-for="entry in layout.buttons"
					:key="entry.name"
					variant="ghost"
					:class="{ '!px-1.5': tight }"
					:label="barLabel(entry.label)"
					:icon-left="entry.icon"
					:disabled="entry.disabled"
					@click="entry.onClick"
				/>
				<!-- PROTOTYPE (#47260): the owner's bulk Favourite; flips to Unfavourite when every selected row is starred. -->
				<Button
					variant="ghost"
					:class="{ '!px-1.5': tight }"
					:label="favourite.label"
					:icon-left="favourite.icon"
					:disabled="scope.all.value"
					@click="toggleFavourites"
				/>
				<Dropdown
					v-if="layout.menu.length"
					v-model:open="menuOpen"
					:options="layout.menu"
					:side="bulkVariant === 'A' ? 'bottom' : 'top'"
					align="start"
				>
					<!-- The Dropdown trigger needs a plain element: Tooltip drops the trigger's props. -->
					<div class="flex shrink-0">
						<Tooltip>
							<template v-if="!menuOpen" #content>
								<span
									class="flex items-center gap-2 [&_[data-slot=key]]:text-ink-gray-4"
								>
									{{ __("More actions") }} <KeyboardShortcut combo="Period" />
								</span>
							</template>
							<Button
								variant="ghost"
								:class="{ '!px-1.5': tight }"
								:label="__('More')"
								icon-right="lucide-chevron-down"
							/>
						</Tooltip>
					</div>
				</Dropdown>
				<div v-if="layout.trash && !tight" :class="[divider, 'mx-1']" />
				<Tooltip v-if="layout.trash" :text="layout.trash.label">
					<Button
						variant="ghost"
						theme="red"
						:icon="layout.trash.icon"
						:label="layout.trash.label"
						:disabled="layout.trash.disabled"
						@click="layout.trash.onClick"
					/>
				</Tooltip>
			</div>
		</template>
		<!-- Tooltip drops the class it is given, so this pushes the clear button to the end. -->
		<div v-if="island" :class="[divider, 'mx-1']" />
		<div class="flex shrink-0" :class="{ 'ms-auto': !island }">
			<Tooltip>
				<template #content>
					<span class="flex items-center gap-2 [&_[data-slot=key]]:text-ink-gray-4">
						{{ __("Clear selection") }} <KeyboardShortcut combo="Escape" />
					</span>
				</template>
				<Button
					variant="ghost"
					icon="lucide-x"
					:label="__('Clear selection')"
					@click="$emit('clear')"
				/>
			</Tooltip>
		</div>
	</div>
	<BulkStatusDialog
		v-if="dialogOpened"
		v-model="confirming"
		:doctype="doctype"
		:action="status.asked.value"
		:finished="status.finished"
		:select="status.select"
	/>
</template>

<script setup lang="ts">
import { Button, Checkbox, Dropdown, Icon, KeyboardShortcut, Tooltip, toast } from "frappe-ui";
import { computed, defineAsyncComponent, inject, ref, watch } from "vue";
import { addFavourite, removeFavourite } from "@framework/ui/api";
import type { Boot } from "@/boot";
import { isStarred } from "@/list/favouriteStars";
import { bulkVariant } from "./bulkPrototype/variant";
import { __ } from "@/i18n";
import type { BulkScope } from "@/list/useBulkScope";
import type { BulkLayout } from "./bulkLayout";
import type { BulkStatus } from "./bulkStatus";

const props = defineProps<{
	scope: BulkScope;
	doctype: string;
	cap: number;
	layout: BulkLayout;
	locked: boolean;
	status: BulkStatus;
	island?: boolean;
}>();
// Even 12px gaps: a ghost button carries 8px of its own padding, so a divider keeps 4px to a button, 12px to text.
const divider = "h-4 shrink-0 border-s border-outline-gray-2";
// The "…" belongs to menu items that open a dialog; a bar button drops it (Q54).
const barLabel = (label: string) => label.replace(/…$/, "");
const menuOpen = defineModel<boolean>("menuOpen", { default: false });
defineEmits<{ clear: [] }>();

const countText = computed(() =>
	props.scope.all.value
		? __("All {0} selected", [props.scope.totalText.value])
		: __("{0} selected", [props.scope.count.value])
);
const BulkStatusDialog = defineAsyncComponent({
	loader: () => import("./BulkStatusDialog.vue"),
	onError: (_error, _retry, fail) => {
		dialogOpened.value = false;
		toast.error(__("The dialog did not load. Reload the page and try again."));
		fail();
	},
});
const dialogOpened = ref(false);
const confirming = ref(false);
watch(props.status.asked, (action) => {
	if (!action) return;
	dialogOpened.value = true;
	confirming.value = true;
});

const user = inject<Boot>("boot")!.session.user.name;
const tight = computed(() => props.island && bulkVariant.value === "K");
const selectedNames = () => {
	const selected = props.scope.selected() as { names?: string[] };
	return selected.names ?? [];
};
const allStarred = computed(() => {
	const names = selectedNames();
	return names.length > 0 && names.every((name) => isStarred(props.doctype, name, user));
});
const favourite = computed(() =>
	allStarred.value
		? { label: __("Unfavourite"), icon: "lucide-star-off" }
		: { label: __("Favourite"), icon: "lucide-star" }
);
// A sketch of the action only: one request per record, then a reload so the stars redraw.
async function toggleFavourites() {
	const names = selectedNames();
	const remove = allStarred.value;
	await Promise.all(names.map((name) => (remove ? removeFavourite : addFavourite)(props.doctype, name)));
	toast.success(remove ? __("Removed {0} from favourites", [names.length]) : __("Added {0} to favourites", [names.length]));
	location.reload();
}

const overCap = computed(() => !props.locked && props.scope.count.value > props.cap);
const shown = computed(
	() =>
		props.layout.transitions.length ||
		props.layout.buttons.length ||
		props.layout.menu.length ||
		props.layout.trash
);
</script>

<style scoped>
/* PROTOTYPE (#47260): variant F. */
.glass {
	background: color-mix(in srgb, var(--surface-base) 72%, transparent) !important;
	backdrop-filter: blur(12px) saturate(1.4);
}
/* PROTOTYPE (#47260): variant H. */
.deep {
	box-shadow:
		0 1px 2px rgb(0 0 0 / 0.06),
		0 8px 24px rgb(0 0 0 / 0.12),
		0 24px 48px rgb(0 0 0 / 0.1);
}
</style>
