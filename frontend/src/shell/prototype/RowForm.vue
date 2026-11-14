<!--
  PROTOTYPE (#47378): what one row asks for, per the addable types (#47376). Shared by the three
  variants as a field set; where it opens is what each variant is about.
-->
<template>
	<div class="flex flex-col gap-3" data-row-form>
		<!-- Step one when adding: the type list. -->
		<template v-if="!type">
			<div class="grid grid-cols-2 gap-1">
				<button
					v-for="kind in ADDABLE"
					:key="kind.type"
					type="button"
					class="flex items-start gap-2 rounded-4 p-2 text-left hover:bg-surface-gray-2"
					:data-add-type="kind.type"
					@click="type = kind.type"
				>
					<span
						:class="[`lucide-${kind.icon}`, 'mt-0.5 size-4 shrink-0 text-ink-gray-6']"
					/>
					<span class="min-w-0">
						<span class="block text-sm font-medium text-ink-gray-8">{{
							kind.type
						}}</span>
						<span class="block text-xs text-ink-gray-5">{{ kind.hint }}</span>
					</span>
				</button>
			</div>
			<p class="text-xs text-ink-gray-5">
				Module, Module Contents and Sidebar are added by apps only.
			</p>
		</template>

		<template v-else>
			<div v-if="!quiet" class="flex items-center gap-2">
				<button
					v-if="!row"
					type="button"
					class="lucide-arrow-left size-4 text-ink-gray-5"
					aria-label="Back"
					@click="type = null"
				/>
				<span :class="[`lucide-${kindOf(type).icon}`, 'size-4 text-ink-gray-6']" />
				<span class="text-sm font-medium text-ink-gray-8">{{
					row ? `Edit ${type}` : `New ${type}`
				}}</span>
				<Badge v-if="row" :label="ORIGIN_LABEL[row.origin]" size="sm" />
			</div>
			<template v-if="quiet && row && !mine && type !== 'Sidebar'">
				<FormControl
					:modelValue="targetText"
					:label="targetLabel"
					variant="outline"
					disabled
					class="[&_input]:text-ink-gray-7"
				/>
			</template>
			<p v-if="row && !mine && !quiet" class="text-xs text-ink-gray-5">
				Inherited from {{ ORIGIN_LABEL[row.origin] }}: you can rename it, change its icon,
				hide or move it, but not its type or target.
			</p>

			<p v-if="type === 'Sidebar'" class="text-xs text-ink-gray-5">
				Opens its own sidebar; edit that sidebar's rows to change where it leads.
			</p>
			<template v-if="mine && type !== 'Sidebar'">
				<Combobox
					v-if="needsDoctype"
					v-model="doctype"
					:options="doctypes"
					placeholder="Choose a DocType"
					label="DocType"
					side="bottom"
					align="start"
				/>
				<Select
					v-if="type === 'View'"
					v-model="view"
					:options="viewOptions"
					label="View"
					placeholder="Saved view or view type"
				/>
				<TextInput
					v-if="type === 'Record'"
					v-model="record"
					label="Record name"
					placeholder="e.g. CRM-DEAL-0001"
				/>
				<Select
					v-if="type === 'Page'"
					v-model="page"
					:options="pageOptions"
					label="Page"
					placeholder="Choose a page"
				/>
				<template v-if="type === 'Link'">
					<TextInput
						v-model="url"
						label="URL"
						placeholder="/apps/crm/deals or https://…"
					/>
					<p
						:class="['text-xs', link.ok ? 'text-ink-gray-5' : 'text-ink-red-4']"
						data-link-kind
					>
						{{ link.note }}
					</p>
				</template>
				<template v-if="type === 'Act'">
					<Combobox
						v-model="act"
						:options="actOptions"
						label="Act"
						placeholder="Choose an act"
						side="bottom"
						align="start"
					/>
					<template v-if="chosenAct?.argument">
						<TabButtons
							v-model="actMode"
							:options="[
								{ label: 'Ask on click', value: 'ask' },
								{ label: 'Preset value', value: 'preset' },
							]"
						/>
						<Select
							v-if="actMode === 'preset'"
							v-model="preset"
							:options="presetOptions"
							:label="chosenAct.argument.label"
							placeholder="Choose a value"
						/>
						<p class="text-xs text-ink-gray-5">
							{{
								actMode === "ask"
									? "A click opens the palette's argument step."
									: "A click runs it at once with this value. Only values that save as JSON can be preset."
							}}
						</p>
					</template>
				</template>
				<template v-if="type === 'Section'">
					<Checkbox v-model="collapsible" label="Can collapse" />
					<Checkbox
						v-model="keepClosed"
						label="Starts closed"
						:disabled="!collapsible"
					/>
				</template>
			</template>

			<TextInput v-model="label" label="Label" :placeholder="defaultLabel || 'Label'" />
			<TextInput
				v-if="type !== 'Section'"
				v-model="icon"
				label="Icon"
				placeholder="lucide name, e.g. star"
			/>

			<slot name="placement" />

			<div v-if="quiet && !row" class="flex justify-end">
				<Button
					variant="subtle"
					label="Add row"
					:disabled="!ready"
					data-row-submit
					@click="submit"
				/>
			</div>
			<div v-else-if="!quiet" class="flex justify-end gap-2">
				<Button label="Cancel" @click="emit('done')" />
				<Button
					variant="solid"
					:label="row ? 'Apply' : 'Add'"
					:disabled="!ready"
					data-row-submit
					@click="submit"
				/>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import {
	Badge,
	Button,
	Checkbox,
	Combobox,
	FormControl,
	Select,
	TabButtons,
	TextInput,
} from "frappe-ui";
import { runMethod } from "@framework/ui/api";
import { acts, type ActOption } from "@/acts/dispatcher";
import type { Addresses } from "@/addresses";
import { pages } from "@/contributions/registry";
import { type Container, type DraftRow, ORIGIN_LABEL, own } from "./navDraft";
import { add, refuse, update } from "./navEdits";
import { ADDABLE, classify, jsonable, kindOf } from "./navRowKinds";

const VIEW_TYPES = ["List", "Cards"];

const props = defineProps<{
	container: Container;
	row?: DraftRow;
	parentKey?: string | null;
	initialType?: string;
	/** A new row's starting fields: "Add this page". */
	prefill?: Partial<DraftRow>;
	/** The dialog's form: no header, an existing row applies as you type, no solid button. */
	quiet?: boolean;
}>();
const emit = defineEmits<{ done: [] }>();

const addresses = inject<Addresses>("addresses")!;
const router = useRouter();

const r = props.row;
const p = (r ?? props.prefill ?? {}) as Partial<DraftRow>;
const type = ref<string | null>(r?.item_type ?? props.initialType ?? null);
const mine = computed(() => !r || own(r));
const label = ref(p.label ?? "");
const icon = ref(p.icon ?? "");
const doctype = ref<string | null>(
	type.value === "DocType" ? p.link_to ?? null : p.link_doctype ?? null
);
const view = ref<string | null>(
	type.value === "View"
		? p.payload?.view_type
			? `type:${p.payload.view_type}`
			: p.link_to ?? null
		: null
);
const record = ref(type.value === "Record" ? p.link_to ?? "" : "");
const page = ref(type.value === "Page" ? p.link_to ?? "" : "");
const url = ref(p.url ?? "");
const act = ref<string | null>(r?.item_type === "Act" ? r.link_to ?? null : null);
const actMode = ref<"ask" | "preset">(r?.payload?.value !== undefined ? "preset" : "ask");
const preset = ref<string>(r?.payload?.value !== undefined ? JSON.stringify(r.payload.value) : "");
const collapsible = ref(!!r?.collapsible || !r);
const keepClosed = ref(!!r?.keep_closed);

const needsDoctype = computed(() => ["DocType", "View", "Record"].includes(type.value ?? ""));
const doctypes = computed(() =>
	addresses
		.doctypes()
		.sort()
		.map((name) => ({ label: name, value: name }))
);

const savedViews = shallowRef<{ key: string; label: string; type: string }[]>([]);
watch(
	doctype,
	async (name) => {
		savedViews.value = [];
		if (type.value !== "View" || !name) return;
		const { data } = await runMethod<
			Record<string, { key: string; label: string; type: string }[]>
		>("frappe.desk.doctype.doctype_view.api.list_views", { doctype: name }, { http: "GET" });
		savedViews.value = data[name] ?? [];
	},
	{ immediate: true }
);
const viewOptions = computed(() => [
	...savedViews.value.map((v) => ({ label: `${v.label} (saved ${v.type})`, value: v.key })),
	...VIEW_TYPES.map((t) => ({ label: `${t} (view type)`, value: `type:${t}` })),
	{ label: "Kanban (once built)", value: "type:Kanban", disabled: true },
]);

const pageOptions = computed(() =>
	pages
		.filter((p) => router.hasRoute(`page:${p.app}:${p.slug}`))
		.map((p) => ({ label: p.title ?? p.slug, value: p.slug }))
);

const link = computed(() => classify(url.value));

const actOptions = computed(() =>
	acts
		.available()
		.filter((a) => a.name.startsWith("shell."))
		.map((a) => ({ label: a.label ?? a.name, value: a.name, description: a.name }))
);
const chosenAct = computed(() => (act.value ? acts.find(act.value) : undefined));
const presetChoices = shallowRef<ActOption[]>([]);
watch(
	[chosenAct, actMode],
	async ([chosen, mode]) => {
		presetChoices.value =
			chosen?.argument && mode === "preset" ? await chosen.argument.options("") : [];
	},
	{ immediate: true }
);
const presetOptions = computed(() =>
	presetChoices.value.map((o) => ({
		label: jsonable(o.value) ? o.label : `${o.label} (can't be preset)`,
		value: jsonable(o.value) ? JSON.stringify(o.value) : "",
		disabled: !jsonable(o.value),
	}))
);

const defaultLabel = computed(() => {
	if (type.value === "View") {
		const saved = savedViews.value.find((v) => v.key === view.value);
		return saved?.label ?? (view.value ? `${doctype.value} ${view.value.slice(5)}` : "");
	}
	if (type.value === "Act") {
		const option = presetChoices.value.find((o) => JSON.stringify(o.value) === preset.value);
		return [chosenAct.value?.label, actMode.value === "preset" ? option?.label : undefined]
			.filter(Boolean)
			.join(": ");
	}
	return doctype.value ?? "";
});

const ready = computed(() => {
	if (!mine.value || type.value === "Sidebar") return true;
	switch (type.value) {
		case "DocType":
			return !!doctype.value;
		case "View":
			return !!doctype.value && !!view.value;
		case "Record":
			return !!doctype.value && !!record.value;
		case "Page":
			return !!page.value;
		case "Link":
			return link.value.ok;
		case "Act":
			return (
				!!act.value &&
				(actMode.value === "ask" || !chosenAct.value?.argument || !!preset.value)
			);
		case "Section":
			return !!label.value;
	}
	return false;
});

// The dialog has one commit, its Save: a row it edits takes each change as it is typed.
if (props.quiet && r)
	watch(
		[
			label,
			icon,
			doctype,
			view,
			record,
			page,
			url,
			act,
			actMode,
			preset,
			collapsible,
			keepClosed,
		],
		() => {
			if (ready.value && (type.value !== "Link" || link.value.ok))
				update(props.container, r.key, fields());
		}
	);

/** What an inherited row points at, shown read-only. */
const targetLabel = computed(() =>
	type.value === "Link"
		? "URL"
		: type.value === "Act"
		? "Act"
		: type.value === "Section"
		? "Type"
		: type.value ?? ""
);
const targetText = computed(() => {
	if (!r) return "";
	if (r.item_type === "Link") return r.url ?? "";
	if (r.item_type === "Section") return "Section";
	return [r.link_doctype !== "DocType" ? r.link_doctype : undefined, r.link_to]
		.filter(Boolean)
		.join(" · ");
});

function fields(): Partial<DraftRow> {
	return {
		...(type.value === "Sidebar" ? {} : target()),
		label: label.value || defaultLabel.value || undefined,
		icon: icon.value || undefined,
	};
}

function submit() {
	if (type.value === "Link" && !link.value.ok) return refuse(link.value.note);
	const done = r
		? update(props.container, r.key, fields())
		: add(props.container, fields(), props.parentKey);
	if (done) emit("done");
}

/** The row's type and target fields, per type. */
function target(): Partial<DraftRow> {
	const t = type.value!;
	switch (t) {
		case "DocType":
			return { item_type: t, link_to: doctype.value!, link_doctype: "DocType" };
		case "View": {
			const bare = view.value!.startsWith("type:") ? view.value!.slice(5) : undefined;
			return bare
				? {
						item_type: t,
						link_doctype: doctype.value!,
						link_to: undefined,
						payload: { view_type: bare },
				  }
				: {
						item_type: t,
						link_doctype: doctype.value!,
						link_to: view.value!,
						icon: icon.value || "layout-grid",
				  };
		}
		case "Record":
			return { item_type: t, link_doctype: doctype.value!, link_to: record.value };
		case "Page":
			return { item_type: t, link_to: page.value };
		case "Link":
			return { item_type: t, url: url.value };
		case "Act":
			return {
				item_type: t,
				link_to: act.value!,
				payload:
					actMode.value === "preset" && preset.value
						? { value: JSON.parse(preset.value) }
						: undefined,
			};
		default:
			return {
				item_type: t,
				collapsible: collapsible.value ? 1 : undefined,
				keep_closed: collapsible.value && keepClosed.value ? 1 : undefined,
			};
	}
}
</script>
