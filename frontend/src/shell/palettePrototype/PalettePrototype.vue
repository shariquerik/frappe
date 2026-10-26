<!--
  PROTOTYPE (#45263): the command palette's look, on frappe-ui/experimental's `CommandPalette*`.
  Hard-coded rows from `sampleRows.ts`; picking a row only toasts. Throw away once the look is approved.
-->
<template>
	<CommandPalette
		v-model:open="open"
		v-model:query="query"
		:filterable="false"
		title="Search and run"
		@select="select"
		@update:open="(isOpen) => !isOpen && (step = null)"
	>
		<template #default="{ active }">
			<CommandPaletteInput
				:placeholder="placeholder"
				@keydown="(event: KeyboardEvent) => onKeydown(event, active as SampleRow)"
			>
				<template #prefix>
					<span
						v-if="!step"
						class="lucide-search size-4 shrink-0 text-ink-gray-6"
						aria-hidden="true"
					/>
					<span
						v-else
						data-slot="palette-step-chip"
						class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-4 bg-surface-gray-3 pl-2 pr-1 text-sm text-ink-gray-8"
					>
						<span :class="[stepIcon, 'size-3.5 text-ink-gray-6']" aria-hidden="true" />
						{{ stepLabel }}
						<button
							type="button"
							class="flex size-4 items-center justify-center rounded-2 text-ink-gray-5 hover:bg-surface-gray-4 hover:text-ink-gray-8"
							tabindex="-1"
							aria-label="Back"
							@click="back"
						>
							<span class="lucide-x size-3" aria-hidden="true" />
						</button>
					</span>
				</template>
			</CommandPaletteInput>

			<CommandPaletteList>
				<template v-if="step?.kind === 'argument'">
					<CommandPaletteGroup label="Users">
						<CommandPaletteItem
							v-for="row in argumentRows"
							:key="row.id"
							:value="row"
							:disabled="ALREADY_ASSIGNED.has(row.id)"
							class="gap-2.5"
						>
							<template #prefix>
								<Avatar :label="row.avatar" size="sm" class="shrink-0" />
							</template>
							{{ row.label }}
							<span class="pl-1.5 font-normal text-ink-gray-5">{{
								row.description
							}}</span>
							<template v-if="ALREADY_ASSIGNED.has(row.id)" #suffix>
								<span class="flex text-sm leading-none text-ink-gray-5"
									>Assigned</span
								>
							</template>
						</CommandPaletteItem>
					</CommandPaletteGroup>
				</template>

				<template v-else>
					<CommandPaletteGroup
						v-for="group in groups"
						:key="group.label"
						:label="group.label"
					>
						<PaletteRow v-for="row in group.rows" :key="row.id" :row="row" />
					</CommandPaletteGroup>
				</template>
			</CommandPaletteList>

			<!-- Pinned below the scrolling list, above the footer: it never scrolls away. A second
			     list, because frappe-ui's palette has no pinned slot and an item needs a listbox. -->
			<CommandPaletteList
				v-if="pinned.length"
				data-slot="palette-pinned"
				class="shrink-0 border-t border-outline-gray-1 py-2 dark:border-outline-gray-2"
			>
				<CommandPaletteGroup class="!my-0">
					<template v-for="row in pinned" :key="row.id">
						<CommandPaletteItem
							v-if="row === ASK_FLOW"
							:value="ASK_FLOW"
							class="gap-2.5"
						>
							<template #prefix>
								<span
									class="lucide-sparkles size-4 shrink-0 text-ink-gray-6"
									aria-hidden="true"
								/>
							</template>
							<span class="font-normal text-ink-gray-6">Ask Flow:</span>
							{{ query.trim() }}
							<template #suffix>
								<span class="flex text-sm leading-none text-ink-gray-5"
									>New chat in Flow</span
								>
							</template>
						</CommandPaletteItem>
						<PaletteRow v-else :row="row" />
					</template>
				</CommandPaletteGroup>
			</CommandPaletteList>

			<CommandPaletteEmpty v-slot="{ query: text }">
				{{
					step?.kind === "scope" && !text.trim()
						? `Type to search ${step.doctype}`
						: `No results for “${text}”`
				}}
			</CommandPaletteEmpty>

			<CommandPaletteFooter>
				<span class="flex items-center gap-1.5">
					<KeyboardShortcut combo="ArrowUp" bg class="[&_kbd]:leading-none" />
					<KeyboardShortcut combo="ArrowDown" bg class="[&_kbd]:leading-none" /> to move
				</span>
				<span class="flex items-center gap-1.5">
					<KeyboardShortcut combo="Enter" bg class="[&_kbd]:leading-none" /> to
					{{ step?.kind === "argument" ? "assign" : "run" }}
				</span>
				<span
					v-if="!step && (active as SampleRow | undefined)?.doctype"
					class="flex items-center gap-1.5"
				>
					<KeyboardShortcut combo="Tab" bg class="[&_kbd]:leading-none" /> to search in
					{{ (active as SampleRow).doctype }}
				</span>
				<span class="ml-auto flex items-center gap-1.5">
					<KeyboardShortcut combo="Escape" bg class="[&_kbd]:leading-none" />
					{{ step ? "back" : "to close" }}
				</span>
			</CommandPaletteFooter>
		</template>
	</CommandPalette>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { Avatar, KeyboardShortcut, toast } from "frappe-ui";
import {
	CommandPalette,
	CommandPaletteEmpty,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteList,
	type CommandPaletteSelectEvent,
} from "frappe-ui/experimental";
import {
	ALREADY_ASSIGNED,
	CURRENT_DOCTYPE,
	create,
	desk,
	goTo,
	matching,
	recent,
	records,
	scopedRecords,
	thisPage,
	thisPageTyped,
	users,
	type SampleRow,
} from "./sampleRows";
import PaletteRow from "./PaletteRow.vue";
import { findPlacement, open, pinned as pinnedState, query, searching, step } from "./state";

const ASK_FLOW: SampleRow = { id: "ask-flow", icon: "lucide-sparkles", label: "Ask Flow" };

const placeholder = computed(() => {
	if (step.value?.kind === "argument") return "Search users";
	if (step.value?.kind === "scope") return `Search ${step.value.doctype}`;
	return "Search or run an action";
});

const stepLabel = computed(() => {
	const current = step.value;
	if (!current) return "";
	return current.kind === "scope" ? `in ${current.doctype}` : current.act;
});
const stepIcon = computed(() =>
	step.value?.kind === "argument" ? step.value.icon : "lucide-list"
);

function find(text: string, doctype: string): SampleRow {
	return { id: "find", icon: "lucide-search", label: `Find “${text}” in ${doctype}` };
}

const SEARCHING: SampleRow = { id: "searching", icon: "", label: "Searching…" };

/** The pinned "Find" row, or none: on a list or record page, once something is typed. */
const findRow = computed(() => {
	const text = query.value.trim();
	if (!text || step.value?.kind === "argument") return null;
	return find(text, step.value?.kind === "scope" ? step.value.doctype : CURRENT_DOCTYPE);
});

/** Records from the server, with the Find row first (B) or last (A) unless it is pinned (C). */
function withFind(results: SampleRow[]): SampleRow[] {
	const row = findRow.value;
	if (!row || findPlacement === "C") return results;
	return findPlacement === "B" ? [row, ...results] : [...results, row];
}

// The ruled order: Recent and This page on an empty query; then This page, Desk, Go to, Create,
// Records. An empty group is dropped, heading and all.
const groups = computed(() => {
	const text = query.value.trim();
	const results = searching.value ? [SEARCHING] : text.length >= 2 ? null : [];
	if (step.value?.kind === "scope") {
		return [
			{ label: "Records", rows: withFind(results ?? matching(scopedRecords, text, 10)) },
		];
	}
	if (!text) {
		return [
			{ label: "Recent", rows: recent.slice(0, 5) },
			{ label: "This page", rows: thisPage },
		];
	}
	const found = [
		{ label: "This page", rows: matching(thisPageTyped, text) },
		{ label: "Desk", rows: matching(desk, text) },
		{ label: "Go to", rows: matching(goTo, text, 8) },
		{ label: "Create", rows: matching(create, text, 5) },
		{ label: "Records", rows: withFind(results ?? matching(records, text, 10)) },
	];
	return found.filter((group) => group.rows.length);
});

// Below the scrolling list: Ask Flow always, and Find too in variant C.
const pinned = computed<SampleRow[]>(() => {
	if (!findRow.value) return [];
	return findPlacement === "C" ? [findRow.value, ASK_FLOW] : [ASK_FLOW];
});

const argumentRows = computed(() => matching(users, query.value));

// A stand-in for the 200 ms debounce and the server's reply. A pinned review state holds still.
let reply: ReturnType<typeof setTimeout> | undefined;
watch(query, (text) => {
	if (pinnedState) return;
	clearTimeout(reply);
	searching.value = text.trim().length >= 2;
	if (searching.value) reply = setTimeout(() => (searching.value = false), 700);
});

function select(value: unknown, event: CommandPaletteSelectEvent) {
	const row = value as SampleRow;
	if (row.argument) {
		event.preventDefault();
		step.value = { kind: "argument", act: "Assign to", icon: row.icon };
		query.value = "";
		return;
	}
	if (step.value?.kind === "argument") {
		toast.success(`Prototype: would assign to ${row.label}`);
		return;
	}
	toast.info(`Prototype: would run “${row.label}”`);
}

function onKeydown(event: KeyboardEvent, active: SampleRow | undefined) {
	if (event.key === "Tab" && !step.value && active?.doctype) {
		// Stopped too, or the dialog's focus trap still moves the focus out of the field.
		event.preventDefault();
		event.stopPropagation();
		step.value = { kind: "scope", doctype: active.doctype };
		query.value = "";
		return;
	}
	const leaving =
		event.key === "Escape" || (event.key === "Backspace" && !query.value && !!step.value);
	if (leaving && step.value) {
		// One step back; the second Esc reaches the dialog and closes it.
		event.preventDefault();
		event.stopPropagation();
		back();
	}
}

function back() {
	step.value = null;
	query.value = "";
}
</script>
