<!--
  One view of a doctype in the frame: the crumbs, the star and Create, the quick filter and the
  controls in one row under them, then the view's type's renderer in the rows area.
-->
<template>
	<PageFrame :scroll="false" :state="metaError ? failedState(metaError, reloadMeta) : null">
		<template #aboveHeader>
			<FrameBands :bands="frame.before" :page="list.page" />
		</template>

		<!-- No slot when a script emptied or hid the row: the frame then draws no row at all. -->
		<template v-if="frame.header && !isEmptyHeader(header)" #header>
			<RecordHeader
				:class="{ invisible: !list.engine.ready.value }"
				:projection="header"
				:page="list.page"
				:favourited="favourited"
				@run="runHeaderItem"
			/>
		</template>

		<FrameBands :bands="frame.between" :page="list.page" />

		<BodyColumns
			v-if="frame.body"
			kind="list"
			:items="bodyItems"
			:page="list.page"
			:user="boot.session.user.name"
		>
			<template #list>
				<!-- The column's scroller is a block: this gives the rows area a height to fill. -->
				<div class="flex h-full min-h-0 flex-col">
					<!-- PROTOTYPE #45851 variant B: the view tabs. -->
					<TabsStrip v-if="variant === 'B'" :gutter="pageGutter" />
					<div
						:class="[pageGutter, { invisible: !list.engine.ready.value }]"
						class="flex shrink-0 items-start justify-between gap-2 pt-3.5"
					>
						<!-- PROTOTYPE #45851 variant D: the view as the row's first control. -->
						<ControlsSwitcher v-if="variant === 'D'" />
						<div class="flex min-w-0 flex-1 flex-col">
							<QuickFilter
								v-if="shown.has('quick_filter')"
								v-model:filters="filters"
								v-model:fields="quickFilterFields"
								v-model:customizing="customizing"
								:doctype="doctype"
							/>
						</div>
						<div v-if="!customizing" class="flex shrink-0 items-center gap-2">
							<ModifiedCluster v-if="variant === 'D'" />
							<template v-for="item in rowControls" :key="item.name">
								<Filter
									v-if="item.name === 'filter'"
									v-model="filters"
									:doctype="doctype"
								/>
								<template v-else-if="item.name === 'sort'">
									<SortBy v-if="seeded" v-model="sort" :doctype="doctype" />
									<!-- Sized to the default sort: a direction button joined to its field's label. -->
									<Skeleton
										v-else
										class="h-7 w-36 shrink-0 rounded-4"
										data-sort-skeleton
									/>
								</template>
								<div
									v-else-if="item.name === 'columns'"
									:ref="setControls"
									class="contents"
								/>
								<Button
									v-else-if="scriptAct(item.name)"
									:icon-left="scriptAct(item.name)!.icon"
									:label="scriptAct(item.name)!.label"
									:data-act="scriptAct(item.name)!.name"
									@click="listActs.perform(scriptAct(item.name)!)"
								/>
							</template>
							<Dropdown
								v-if="menuOptions.length"
								:options="menuOptions"
								side="bottom"
								align="end"
							>
								<div class="flex shrink-0">
									<Button icon="lucide-ellipsis" label="More" data-view />
								</div>
							</Dropdown>
						</div>
					</div>

					<div class="relative flex min-h-0 flex-1 flex-col pt-2">
						<component
							:is="rendererFor(view.type)"
							v-if="list.engine.ready.value"
							:view="view"
							:host="host"
						/>
						<!-- PROTOTYPE #45851 variants E, F (floating) and G (footer). -->
						<FloatingViews
							v-if="variant === 'E' || variant === 'F'"
							:mode="variant === 'E' ? 'all' : 'pill'"
						/>
						<FooterViews v-if="variant === 'G'" />
						<SaveBar v-if="variant === 'L' || variant === 'K'" />
					</div>
				</div>
			</template>
		</BodyColumns>

		<FrameBands :bands="frame.after" :page="list.page" />
		<PageDialogs v-if="list.engine.dialogs.value.length" :controller="list.engine" />
		<!-- PROTOTYPE #45851: stub dialogs and the floating variant bar. -->
		<template v-if="variant">
			<ViewDialogs />
			<PrototypeBar />
		</template>
	</PageFrame>
</template>

<script setup lang="ts">
import { Button, Dropdown, Skeleton, toast } from "frappe-ui";
import { withAct } from "@/acts/menuAct";
import { Filter } from "@framework/ui/Filter";
import { QuickFilter } from "@framework/ui/QuickFilter";
import { SortBy } from "@framework/ui/SortBy";
import { useDocPermissions } from "@framework/ui/useDocPermissions";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import { computed, defineAsyncComponent, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { acts } from "@/acts/dispatcher";
import type { Addresses } from "@/addresses";
import { isEmptyHeader, projectFrame } from "@/pageEngine";
import type { HeaderItem } from "@/pageEngine/types";
import type { Boot } from "@/boot";
import { __ } from "@/i18n";
import { isModular, routeFor, routeForModule } from "@/router/routeFor";
import { editorEntries, editorRoute } from "@/pages/doctypeEditor/entries/editorEntries";
import { openCreate } from "@/shell/create";
import type { ListPage } from "@/list/useListPage";
import { createListPage } from "@/listPage/createListPage";
import { useListPermissions } from "@/listPage/listPermissions";
import { isFavourite, useListSettings } from "@/list/useListSettings";
import BodyColumns from "@/pages/record/body/BodyColumns.vue";
import FrameBands from "@/pages/record/FrameBands.vue";
import RecordHeader from "@/pages/record/RecordHeader.vue";
import { recordDialogWrite } from "@/shell/recordDialog";
import PageFrame, { pageGutter } from "@/shell/PageFrame.vue";
import { failedState } from "@/shell/pageState";
import { LIST_PAGE_TIER } from "@/recordPage/clientScriptTypes";
import { useLiveClientScripts } from "@/pages/record/liveClientScripts";
import { createdMessage } from "./createdMessage";
import { clearDefaultView, setDefaultView } from "./defaultView";
import { allowsHeaderItem, useListActs } from "./listActs";
import { listHeaderItems, projectListHeader } from "./listHeader";
import { rendererFor, type RendererHost } from "./renderer";
import { useRoute } from "vue-router";
import { markRaw } from "vue";
import ControlsSwitcher from "./viewSwitcherPrototype/ControlsSwitcher.vue";
import HeaderSwitcher from "./viewSwitcherPrototype/HeaderSwitcher.vue";
import ModifiedCluster from "./viewSwitcherPrototype/ModifiedCluster.vue";
import PrototypeBar from "./viewSwitcherPrototype/PrototypeBar.vue";
import FloatingViews from "./viewSwitcherPrototype/FloatingViews.vue";
import FooterViews from "./viewSwitcherPrototype/FooterViews.vue";
import ViewsPanel from "./viewSwitcherPrototype/ViewsPanel.vue";
import HeaderViewButton from "./viewSwitcherPrototype/HeaderViewButton.vue";
import HeaderViews from "./viewSwitcherPrototype/HeaderViews.vue";
import SaveBar from "./viewSwitcherPrototype/SaveBar.vue";
import TabsStrip from "./viewSwitcherPrototype/TabsStrip.vue";
import ViewDialogs from "./viewSwitcherPrototype/ViewDialogs.vue";
import { viewActGroups } from "./viewSwitcherPrototype/menus";
import { currentKey, isModified, loadViews, protoState, useViewActs, variantOf } from "./viewSwitcherPrototype/store";

// A script's `page.dialog.form` needs a host; the stack loads only when one is open.
const PageDialogs = defineAsyncComponent(() => import("@/pages/record/dialogs/PageDialogs.vue"));

const props = defineProps<{ page: ListPage; label?: string }>();

const router = useRouter();
const boot = inject<Boot>("boot")!;
const addresses = inject<Addresses>("addresses")!;
const { view, quickFilterFields, customizing, metaError, reloadMeta, createValues } = props.page;
const { doctype, filters, sort, seeded } = view;

// PROTOTYPE #45851: `?variant=A|B|C|D` picks where the view switcher draws.
const route = useRoute();
const variant = computed(() => variantOf(route));
const protoActs = useViewActs(router, route);
watch(variant, (value) => value && void loadViews(boot, doctype), { immediate: true });

const { meta } = useDoctypeMeta(doctype);
const created: (() => void)[] = [];
let creating = false;

async function create() {
	if (creating) return;
	creating = true;
	const doc = await openCreate(doctype, { values: createValues.value }).finally(
		() => (creating = false)
	);
	if (!doc) return;
	for (const callback of created) callback();
	toast.success(createdMessage(doctype, meta.value, doc), {
		action: {
			label: __("Open"),
			onClick: () => router.push(routeFor(doctype, doc.name)),
		},
	});
}

// A record dialog over the list changed a row: the rows reload as after a Create.
watch(recordDialogWrite, (write) => {
	if (write?.doctype === doctype) for (const callback of created) callback();
});

// The plain List view is the doctype's own star; any other view is starred by its key.
const starKey = view.key === "list" ? null : view.key;
const settings = useListSettings(doctype);
const favourited = computed(() => isFavourite(settings.favourites.value, starKey));

const permissions = useListPermissions(doctype);
const fieldPermissions = useDocPermissions(doctype);
const list = createListPage({
	view,
	router,
	meta: () => meta.value,
	permissions,
	scripted: boot.list_script_doctypes?.includes(doctype) ?? true,
	callSelected: (...run) =>
		import("./callSelected").then((module) => module.callSelected(...run)),
});
list.lists.controls.provideBuiltins(() => [
	{ name: "quick_filter", label: __("Quick Filter") },
	{ name: "filter", label: __("Filter") },
	{ name: "sort", label: __("Sort") },
	{ name: "columns", label: __("Columns") },
	{ name: "customize_quick_filter", label: __("Customize Quick Filter") },
]);
onMounted(list.paint);
onUnmounted(list.leave);
// A list holds no unsaved edits, so a changed List Page Client Script re-runs at once.
useLiveClientScripts({
	doctype: ref(doctype),
	tier: LIST_PAGE_TIER,
	dirty: () => false,
	ready: () => list.engine.ready.value,
	replaying: () => list.engine.isReplaying.value,
	refresh: () => list.engine.refresh(),
});

const listActs = useListActs(
	{
		list,
		permissions,
		create,
		customizeQuickFilter: () => (customizing.value = true),
		customizing: () => customizing.value,
		readable: (fieldname) => {
			const field = meta.value?.fields?.find((one) => one.fieldname === fieldname);
			return !field || fieldPermissions.fieldAccess(field) !== "none";
		},
		editorEntries: () =>
			editorEntries(doctype, {
				roles: boot.session.roles ?? [],
				developerMode: boot.developer_mode,
				meta: meta.value,
			}),
		openEditor: (entry) => router.push(editorRoute(doctype, entry.mode)),
		starsLoaded: () => settings.favourites.value !== null,
		favourited: () => favourited.value,
		toggleFavourite: () => settings.toggleFavourite(starKey),
		openView: (key) => router.push(routeFor(doctype, null, { view: key })),
		setDefaultView: (key, scope) => setDefaultView(boot, doctype, key, scope),
		clearDefaultView: (scope) => clearDefaultView(boot, doctype, scope),
	},
	view.type
);

const controls = ref<HTMLElement | null>(null);
// A function ref: a plain `ref` inside the `v-for` would collect an array.
const setControls = (element: unknown) => void (controls.value = element as HTMLElement | null);
const host: RendererHost = {
	controls,
	lists: list.lists,
	acts: listActs.renderer,
	onCreate: (callback) => created.push(callback),
};

const quickFilterAct = computed(() => listActs.drawn("customize_quick_filter"));

list.engine.header.provideBuiltins(() =>
	protoHeader(
		listHeaderItems({
			doctype,
			module: moduleCrumb,
			view: () => (variant.value ? null : viewCrumb()),
			starsLoaded: () => settings.favourites.value !== null,
			favourited: () => favourited.value,
			toggleFavourite: () => settings.toggleFavourite(starKey),
			create,
		})
	)
);

/** PROTOTYPE #45851: A and C draw the crumbs, the view control, the star and the modified state themselves. */
function protoHeader(items: HeaderItem[]): HeaderItem[] {
	// I and J: the view in the header's right side; modified, it takes the right side whole (Create gives way).
	if (variant.value === "I" || variant.value === "J") {
		const modified = protoState().loaded && isModified(route);
		const kept = modified ? items.filter((item) => item.zone === "left") : items;
		const ours = {
			name: "proto_view_button",
			zone: "right",
			component: markRaw(variant.value === "I" ? HeaderViewButton : HeaderViews),
		};
		return [ours as HeaderItem, ...kept];
	}
	if (!["A", "C", "K", "L"].includes(variant.value ?? "")) return items;
	const crumbs = items
		.filter((item) => item.display === "crumb")
		.map((item) => ({ label: item.label!, href: item.href ?? router.resolve(routeFor(doctype)).path }));
	const kept = items.filter((item) => item.display !== "crumb" && item.name !== "favourite");
	return [
		{
			name: "proto_view",
			zone: "left",
			component: markRaw(HeaderSwitcher),
			props: {
				crumbs,
				// C lists the views in the sidebar; with no sidebar (a non-modular prefix) it falls back to A.
				mode:
					(variant.value === "C" && isModular(boot)) || (variant.value === "K" && protoState().inSidebar)
						? "acts"
						: "all",
				favourited: favourited.value,
				toggleFavourite: () => settings.toggleFavourite(starKey),
			},
		} as HeaderItem,
		...kept,
	];
}

function moduleCrumb() {
	const label = meta.value?.module;
	if (!label) return null;
	const slug = isModular(boot) ? addresses.addressOf(doctype)?.[1] : undefined;
	return { label, href: slug ? router.resolve(routeForModule(slug)).path : undefined };
}

function viewCrumb() {
	if (!props.label) return null;
	return { label: props.label, href: router.resolve(routeFor(doctype)).path };
}

const header = computed(() =>
	projectListHeader(list.engine.header.resolve(), allowsHeaderItem(list, permissions))
);
const frame = computed(() => projectFrame(list.engine.frame.resolve()));
const bodyItems = computed(() => {
	const items = list.engine.body.visible();
	// PROTOTYPE #45851 variant H: a Views column at the body's left.
	if (variant.value !== "H") return items;
	const panel = {
		name: "proto_views",
		component: markRaw(ViewsPanel),
		width: 232,
		minWidth: 180,
		maxWidth: 320,
		collapsible: true,
		gutter: false,
	};
	return [panel, ...items];
});

function runHeaderItem(item: HeaderItem) {
	if (item.run) void acts.perform(`header.${item.name}`);
}

const controlItems = computed(() => list.lists.controls.visible());
const shown = computed(() => new Set(controlItems.value.map((item) => item.name)));
const rowControls = computed(() =>
	controlItems.value.filter(
		(item) => !["quick_filter", "customize_quick_filter"].includes(item.name)
	)
);
const scriptAct = (name: string) => listActs.drawn(name);

const menuOptions = computed(() => {
	const act = quickFilterAct.value;
	const quickFilter =
		act && shown.value.has("customize_quick_filter") && shown.value.has("quick_filter")
			? [act]
			: [];
	const editor = ["customize_form", "edit_doctype"].map(listActs.drawn);
	const own = [...quickFilter, ...editor]
		.filter((each): each is NonNullable<typeof each> => Boolean(each))
		.map((each) =>
			withAct(
				{ label: each.label, icon: each.icon, onClick: () => listActs.perform(each) },
				each.name
			)
		);
	// PROTOTYPE #45851 variant D: this view's acts head the row's existing ⋯ menu.
	if (variant.value !== "D" || !protoState().loaded) return own;
	const groups = viewActGroups(protoActs, currentKey(route)).map((group, index) => ({
		...group,
		group: index ? group.group : "This view",
		hideLabel: index > 0,
	}));
	return own.length ? [...groups, { group: "List", hideLabel: true, options: own }] : groups;
});
</script>
