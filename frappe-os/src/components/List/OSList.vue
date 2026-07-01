<script setup lang="ts">
// The list view: a self-fetching collection screen, wired to the live records store. Owns
// the list chrome (toolbar with count/presence/New, saved-view chips, footer) and composes
// the table over OSListView. Display config (label/icon/columns/saved views) comes from the
// curated `meta` prop; the rows, count and create-permission are live. Symmetric with
// Form/OSForm — both are full view components DoctypeView resolves and renders.
import { computed, inject, ref, shallowRef, watch, watchEffect } from "vue";
import { Button, ListFooter } from "frappe-ui";
import { useListView } from "@framework/ui/ListView";
import { Filter } from "@framework/ui/Filter";
import { SortBy } from "@framework/ui/SortBy";
import { QuickFilter } from "@framework/ui/QuickFilter";
import { ColumnSettings } from "@framework/ui/ColumnSettings";
import OSListView from "./OSListView.vue";
import { listFetchFields } from "./list-columns";
import { useOS } from "@/desktop";
import { TOOLBAR_SLOT, WINDOW_FOCUSED } from "@/components/Window/toolbar";
// defineProps type from the concrete module (barrel's `export *` breaks the SFC macro
// resolver — see DoctypeView.vue).
import type { ViewProps } from "@/config/types";

const props = withDefaults(defineProps<ViewProps>(), {
	presence: () => [],
});

const os = useOS();
const doctype = computed(() => props.doctype);

// The shared list-view state (filter / sort / columns / quick-filter), bound to the
// controls in later slices (ADR-0025). `useListView` takes doctype BY VALUE, so this
// component is remounted on doctype change via `:key` in DoctypeView — no reset watcher.
// Columns are Meta-derived here (`view.columns.wire`); the host keeps fetching.
const view = useListView(props.doctype);

// The "New" button needs create permission, which rides on the live field schema.
const fieldMeta = computed(() => os.fieldMetaFor(doctype.value));
watch(
	doctype,
	(dt) => {
		if (dt) os.loadFieldMeta(dt);
	},
	{ immediate: true },
);
const canCreate = computed(() => !!fieldMeta.value.data?.can_create);
// The live Record-indicator spec + title field (ADR-0028) that theme the list's status cell
// and mark the primary column — from the same field-meta fetch `can_create` rides.
const indicatorSpec = computed(() => fieldMeta.value.data?.indicator ?? null);
const titleField = computed(() => fieldMeta.value.data?.title_field ?? "name");

// Fetch projections drive the OS-store reads (ADR-0025): the controls own filter/sort
// state, the host owns fetching. Empty filters normalize to `undefined` so the unfiltered
// read shares the nav-rail's count cache key; no sort falls back to the prior default order.
const wireFilters = computed(() => {
	const wire = view.filters.wire.value;
	return wire && wire.length ? wire : undefined;
});
const orderBy = computed(() => view.sort.orderBy.value || "modified desc");
const pageLength = ref(20);

// The lean fetch (ADR-0028, #04b): name + the visible wire columns + the fields the indicator
// resolver reads, derived from the spec the client already holds — no `['*']`, no dark tiers.
// Toggling a column on re-fetches (its field is now needed); `modified` rides in as a column.
const fetchFields = computed(() => listFetchFields(view.columns.wire.value, indicatorSpec.value));

// Live rows + filter-aware count (keyed by the SAME wire filters it is loaded with, so the
// footer's "X of Y" reflects the active filters rather than the unfiltered total).
const listState = computed(() => os.listFor(doctype.value));
const records = computed(() => listState.value.data || []);
const countState = computed(() => os.countFor(doctype.value, wireFilters.value));
const total = computed(() =>
	countState.value.data == null ? records.value.length : countState.value.data,
);
// More rows exist than are loaded → the footer offers Load More (ADR-0025 paging).
const hasMore = computed(() => records.value.length < total.value);

// Refetch from page 1 whenever the doctype, filters, sort, or page length change; the wire
// projections are the tracked deps. loadMore appends the next page without retriggering.
watchEffect(() => {
	const dt = doctype.value;
	if (!dt) return;
	os.loadList(dt, {
		fields: fetchFields.value,
		filters: wireFilters.value,
		order_by: orderBy.value,
		limit: pageLength.value,
	});
	os.loadCount(dt, wireFilters.value);
});
function loadMore() {
	os.loadMore(doctype.value, {
		fields: fetchFields.value,
		filters: wireFilters.value,
		order_by: orderBy.value,
		limit: pageLength.value,
	});
}

// A column-header drag emits `{ key, width }`; write it back into the shared column state
// so ColumnSettings and the table stay in sync (ADR-0006 / ADR-0025, two-way resize).
function onColumnWidthUpdated(e: { key: string; width: string }) {
	view.columns.setWidth(e.key, e.width);
}

function onColumnWidthReset(e: { key: string }) {
	view.columns.resetWidth(e.key);
}

// The window chrome's action zone: "New" teleports up next to the breadcrumb, so the list's
// title/count/presence no longer need a toolbar bar of their own (count rides the breadcrumb,
// presence rides the chrome). Filter/Sort drop down into the saved-view row below.
const toolbarSlot = inject(TOOLBAR_SLOT, shallowRef<HTMLElement | null>(null));

// "New" is solid while its window is focused, subtle when the window sits in the background
// (WINDOW_FOCUSED, provided by OSWindow). Unprovided (chromeless mount) → defaults to solid.
const windowFocused = inject(WINDOW_FOCUSED, null);
const newButtonVariant = computed(() => ((windowFocused?.value ?? true) ? "solid" : "subtle"));
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- "New" rides the window chrome's action zone (next to the breadcrumb); inline fallback
         only for a chromeless window. -->
		<Teleport :to="toolbarSlot" :disabled="!toolbarSlot">
			<Button
				v-if="canCreate"
				icon-left="lucide-plus"
				:variant="newButtonVariant"
				size="sm"
				label="New"
				@click="onNew?.(doctype)"
			/>
		</Teleport>
		<!-- List-view controls toolbar (ADR-0025), all bound to one `useListView`. The bookmark
         + "All" saved-view chip are gone — there is no saved-views feature yet. -->
		<div class="flex flex-shrink-0 items-start gap-1.5 px-[14px] py-[7px]">
			<!-- QuickFilter strip (left) — a projection over the SAME filter list the advanced
           Filter edits (shared array), so the two stay in sync. Its Customize toggle picks
           which fields are surfaced (defaults to the doctype's in_standard_filter fields). -->
			<QuickFilter
				v-model:filters="view.filters.conditions.value"
				v-model:fields="view.quickFilter.fields.value"
				v-model:customizing="view.quickFilter.customizing.value"
				:doctype="doctype"
				class="min-w-0 flex-1"
			/>
			<!-- The advanced controls hide while choosing which quick filters to surface. -->
			<template v-if="!view.quickFilter.customizing.value">
				<Filter v-model="view.filters.conditions.value" :doctype="doctype" />
				<SortBy v-model="view.sort.by.value" :doctype="doctype" />
				<ColumnSettings
					v-model="view.columns.shown.value"
					:doctype="doctype"
					:can-reset="view.columns.isCustomized.value"
					@reset="view.columns.reset()"
				/>
			</template>
		</div>
		<!-- table -->
		<OSListView
			:doctype="doctype"
			:columns="view.columns.wire.value"
			:rows="records"
			:meta="meta"
			:spec="indicatorSpec"
			:title-field="titleField"
			:loading="listState.loading"
			:error="listState.error"
			:on-open="onOpen"
			:on-open-inline="onOpenInline"
			:on-open-new-window="onOpenNewWindow"
			@column-width-updated="onColumnWidthUpdated"
			@column-width-reset="onColumnWidthReset"
		/>
		<!-- footer: frappe-ui's presentation-only ListFooter, backed by OS-store paging.
         v-model is the page length (a change refetches page 1). We own the right side via
         the slot: ListFooter's built-in load-more is gated by an internal computed that does
         not re-evaluate against our reactive count in this composition, so we render the
         "Load More + X of Y" from OSList's own state, which IS reactive (the left page-length
         tabs still come from ListFooter). -->
		<ListFooter
			v-model="pageLength"
			class="flex-shrink-0 border-t border-outline-gray-1 px-[14px] py-[7px]"
		>
			<template #right>
				<div class="flex items-center">
					<Button v-if="hasMore" label="Load More" @click="loadMore" />
					<div v-if="hasMore" class="mx-3 h-[80%] border-l" />
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ records.length }}</div>
						<div>of</div>
						<div>{{ total }}</div>
					</div>
				</div>
			</template>
		</ListFooter>
	</div>
</template>
