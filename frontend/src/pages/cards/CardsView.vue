<!-- The Cards type's renderer: a grid of cards, the List's footer, and the card settings among the controls. -->
<template>
	<Teleport v-if="host.controls.value" :to="host.controls.value">
		<CardSettings
			:meta="meta"
			:title="fields.title"
			:body="fields.body"
			:update="view.update"
		/>
	</Teleport>
	<PageState v-if="error" v-bind="failedState(error, reload)" />
	<!-- PROTOTYPE (#47056): the select-all strip over the cards. -->
	<SelectAllStrip v-if="!error" class="mx-[var(--page-gutter)] mb-1" />
	<div v-if="!error" class="min-h-0 flex-1 overflow-y-auto py-2" :class="pageGutter">
		<div v-if="loading" :style="gridStyle" class="grid">
			<Skeleton v-for="n in 8" :key="n" class="h-56 rounded-5" />
		</div>
		<PageState v-else-if="!rows.length" :name="filters.length ? 'filtered' : 'empty'" />
		<div v-else :style="gridStyle" class="grid">
			<CardItem
				v-for="row in rows"
				:key="row.name"
				:row="row"
				:meta="meta"
				:titleField="fields.title"
				:bodyField="fields.body"
				:bodyIsHtml="fields.bodyIsHtml"
				:link="cardLink(row)"
				:titleClass="titleClassOf(row)"
				:menu="menuFor(row)"
				:person="people[String(row.owner)]"
				:selected="selection.includes(row.name)"
				:selecting="selection.length > 0"
				@toggle="(shift: boolean) => (shift ? toggleRange(row.name) : toggle(row.name))"
				@mouseenter="hovered = row.name"
				@mouseleave="hovered = null"
			/>
		</div>
	</div>
	<ListFooter
		v-model:pageSize="pageSize"
		:class="pageGutter"
		:rowCount="rowCount"
		:totalCount="totalCount"
		:totalCapped="totalCapped"
		:totalUnknown="totalUnknown"
		:hasCounts="hasCounts"
		:hasNextPage="hasNextPage"
		@load-more="next"
		@page-size="show"
		@count="countExact"
	/>

	<BulkLayer />
	<DeleteDialog v-model="confirmingDelete" :count="1" :run="() => deleteOne(target)" />
</template>

<script setup lang="ts">
import { ListFooter } from "@framework/ui/experimental/List";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import { Skeleton } from "frappe-ui";
import { computed, ref } from "vue";
import { __ } from "@/i18n";
import type { ListRow } from "@/list/useListRows";
import type { View } from "@/list/view";
import DeleteDialog from "@/pages/list/DeleteDialog.vue";
import type { RendererHost } from "@/pages/list/renderer";
import { rowActionEntries, rowMenuOptions } from "@/pages/list/rowActions";
import { pageGutter } from "@/shell/PageFrame.vue";
import { failedState } from "@/shell/pageState";
import PageState from "@/shell/PageState.vue";
import BulkLayer from "@/pages/list/bulkPrototype/BulkLayer.vue";
import { isTyping } from "@/pages/list/bulkPrototype/keys";
import SelectAllStrip from "@/pages/list/bulkPrototype/SelectAllStrip.vue";
import { bindHost } from "@/pages/list/bulkPrototype/store";
import { filtersDict } from "@/list/useListView";
import { useEventListener } from "@vueuse/core";
import CardItem from "./CardItem.vue";
import CardSettings from "./CardSettings.vue";
import { useCardsView } from "./useCardsView";

const props = defineProps<{ view: View; host: RendererHost }>();
const { filters } = props.view;

const {
	fields,
	rowActions,
	people,
	pageSize,
	rows,
	loading,
	error,
	rowCount,
	totalCount,
	totalCapped,
	totalUnknown,
	hasCounts,
	hasNextPage,
	next,
	show,
	countExact,
	reload,
	cardLink,
	titleClassOf,
	deleteOne,
} = useCardsView(props.view);

props.host.onCreate(reload);

// PROTOTYPE (#47056): Cards get the list's selection: a checkbox per card, shift-click, `x`.
const selection = ref<string[]>([]);
const hovered = ref<string | null>(null);
let anchor: string | null = null;

bindHost({
	doctype: props.view.doctype,
	selection,
	rows,
	total: totalCount,
	filters: () => filtersDict(filters.value),
	filterLabel: () => (filters.value.length ? "this filter" : props.view.doctype + "s"),
});

function toggle(name: string) {
	anchor = name;
	selection.value = selection.value.includes(name)
		? selection.value.filter((key) => key !== name)
		: [...selection.value, name];
}

function toggleRange(name: string) {
	const names = rows.value.map((row) => row.name);
	const from = anchor ? names.indexOf(anchor) : -1;
	const to = names.indexOf(name);
	if (from < 0 || to < 0) return toggle(name);
	const range = names.slice(Math.min(from, to), Math.max(from, to) + 1);
	const rest = selection.value.filter((key) => !range.includes(key));
	selection.value = selection.value.includes(anchor!) ? [...rest, ...range] : rest;
}

useEventListener(document, "keydown", (event: KeyboardEvent) => {
	if (event.key.toLowerCase() !== "x" || !hovered.value || isTyping(event)) return;
	event.preventDefault();
	if (event.shiftKey) toggleRange(hovered.value);
	else toggle(hovered.value);
});

const { meta } = useDoctypeMeta(props.view.doctype);
const confirmingDelete = ref(false);
const target = ref("");

// At least 240px a card and at most four a row, with the page's gap between them.
const gridStyle = {
	gap: "var(--page-gutter)",
	gridTemplateColumns:
		"repeat(auto-fill, minmax(max(240px, calc((100% - 3 * var(--page-gutter)) / 4)), 1fr))",
};

const listActs = props.host.acts(
	() => [deleteEntry(), ...rowActionEntries(rowActions)],
	() => ({ selection: [], reload })
);

function deleteEntry() {
	return {
		item: {
			name: "delete",
			label: __("Delete"),
			icon: "lucide-trash-2",
			right: "delete",
			run: (_context: unknown, row: ListRow) => {
				target.value = row.name;
				confirmingDelete.value = true;
			},
		},
		hidden: false,
	};
}

function menuFor(row: ListRow) {
	const options = rowMenuOptions(row, rowActions, listActs);
	const del = listActs.drawn("delete");
	return del
		? [
				...options,
				{ label: del.label!, icon: del.icon, onClick: () => listActs.perform(del, row) },
		  ]
		: options;
}
</script>
