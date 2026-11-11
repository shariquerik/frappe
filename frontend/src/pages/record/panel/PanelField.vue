<!-- One panel row: the label in a fixed column, the value in the flexible one. -->
<template>
	<!-- PROTOTYPE (#46965): rows align to the top, and the label sits on the first 28px line. -->
	<div class="grid grid-cols-[130px_1fr] items-start gap-2">
		<span class="h-7 truncate text-base leading-7 text-ink-gray-5" :title="field.label">
			{{ field.label }}
		</span>

		<!-- PROTOTYPE (#46977): one wrapper per value column, so the error message and the
		     row's buttons sit beside the box in every state. -->
		<div
			class="proto-row group relative flex min-w-0 flex-col"
			:data-fieldname="field.fieldname"
			:data-proto="protoFocus"
			:data-ring="protoRing"
			:data-error="error ? '' : undefined"
		>
			<!-- PROTOTYPE (#46965): a Check or a Rating draws its control in every state, so a
			     click toggles or sets it and saves at once; there is no edit state to swap to. -->
			<div
				v-if="oneClick"
				class="proto-oneclick flex h-7 min-w-0 items-center rounded-4 px-2"
				:class="field.readOnly ? '' : 'cursor-pointer hover:bg-surface-gray-2'"
				@click="toggleCheck"
			>
				<component
					:is="resolved"
					:field="controlField"
					:modelValue="doc[field.fieldname]"
					:error="error"
					@update:modelValue="(value: any) => update(field.fieldname, value)"
					@change="(value: any) => commit.commit(field.fieldname, value)"
					@click.stop
				/>
			</div>

			<div
				v-else-if="editing"
				ref="cell"
				class="field proto-cell min-w-0"
				:data-type="field.fieldtype"
				:data-pad="overlay ? 'end' : undefined"
				@input="grow"
				@focusout="onFocusout"
				@keydown.enter="onEnter"
				@keydown.escape="cancel"
			>
				<!-- `ui.props` binds first so it cannot clobber `field` or `modelValue`; Vue merges
				     duplicate listeners, so `ui.on.change` and the close-on-commit both fire. -->
				<component
					:is="field.ui?.component ?? resolved"
					v-bind="{ ...field.ui?.props, ...scriptPage }"
					:field="controlField"
					:modelValue="doc[field.fieldname]"
					:error="error"
					@update:modelValue="(value: any) => edit(field.fieldname, value)"
					@change="(value: any) => onCommit(value)"
					v-on="field.ui?.on ?? {}"
				/>
			</div>

			<div
				v-else
				ref="rest"
				class="proto-rest flex min-h-7 min-w-0 flex-wrap items-center gap-x-1.5 rounded-4 px-2 outline-none"
				:class="[
					interactive ? 'cursor-pointer hover:bg-surface-gray-2' : '',
					overlay ? 'pe-8' : '',
				]"
				:style="chips ? { paddingInlineEnd: '30px' } : undefined"
				:tabindex="interactive ? 0 : undefined"
				@click="open"
				@focus="onRestFocus"
				@keydown="onRestKey"
			>
				<!-- PROTOTYPE (#46977): Table MultiSelect draws the editor's chips at rest, × kept
				     as space, so the chips wrap the same way in both states. -->
				<span v-if="chips" class="proto-chips flex min-w-0 flex-1 flex-wrap gap-1 py-1">
					<span v-for="chip in chipList" :key="chip" class="proto-chip">
						{{ chip }}<span class="lucide-x proto-chip-x invisible" aria-hidden="true" />
					</span>
					<span v-if="!chipList.length" class="text-base leading-5 text-ink-gray-4">{{
						placeholder
					}}</span>
				</span>
				<!-- PROTOTYPE (#46977): a multi-line value wraps at rest up to the editor's 6-line
				     cap, with the editor's own metrics, so opening it does not change the height. -->
				<span
					v-else-if="multiline"
					class="proto-multi min-w-0 flex-1 py-1 text-base leading-5"
					:class="error ? 'text-ink-red-4' : display ? 'text-ink-gray-8' : 'text-ink-gray-4'"
					>{{ doc[field.fieldname] || placeholder }}</span
				>
				<span
					v-else
					class="flex min-w-0 flex-1 items-center text-base leading-7"
					:class="error ? 'text-ink-red-4' : display ? 'text-ink-gray-8' : 'text-ink-gray-4'"
				>
					<!-- An editable row's click opens its editor, so its address waits on the arrow. -->
					<a
						v-if="address?.kind === 'mail' && !interactive"
						:href="address.href"
						data-slot="mail-link"
						class="truncate underline-offset-2 hover:underline"
						@click.stop
						>{{ display }}</a
					>
					<template v-else>
						<ColorSwatch :field="field" :value="doc[field.fieldname]" class="me-1.5" />
						<LinkMark
							class="me-1.5"
							:source="field.linkMark"
							:value="mark"
							:text="display"
						/>
						<!-- PROTOTYPE (#46977): the browser masks a Password the way its input does. -->
						<span
							v-if="field.fieldtype === 'Password' && doc[field.fieldname]"
							class="proto-secret truncate"
							>{{ doc[field.fieldname] }}</span
						>
						<span v-else class="truncate">{{ display || placeholder }}</span>
					</template>
				</span>
				<span
					v-if="summary"
					class="lucide-arrow-up-right ml-auto size-3.5 shrink-0 text-ink-gray-5"
					aria-hidden="true"
				/>
				<RecordAnchor
					v-else-if="record.href.value"
					:href="record.href.value"
					:aria-label="openLabel"
					:title="openLabel"
					class="proto-btn ml-auto grid size-4 shrink-0 place-items-center rounded-1 text-ink-gray-5 opacity-0 hover:text-ink-gray-7 focus-visible:opacity-100 group-hover:opacity-100"
					@open="record.open"
					><span class="lucide-arrow-up-right size-3.5" aria-hidden="true"
				/></RecordAnchor>
				<DataOpenLink
					v-else-if="address && (address.kind === 'web' || (interactive && !composerEmail))"
					:address="address"
					class="proto-btn ml-auto grid shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
				/>
				<span v-if="phone && !overlay" class="proto-btn -my-1 flex shrink-0 items-center" @click.stop>
					<FieldActionButtons
						:field="field"
						:value="doc[field.fieldname]"
						:record="actionRecord"
					/>
				</span>
			</div>

			<!-- PROTOTYPE (#46977): an email row's buttons live outside the box, so they stay in
			     the DOM, and in the tab order, while the row edits. -->
			<span
				v-if="overlay"
				class="proto-btn absolute end-2 top-0 flex h-7 items-center"
				@click.stop
			>
				<FieldActionButtons :field="field" :value="doc[field.fieldname]" :record="actionRecord" />
			</span>
			<!-- PROTOTYPE (#46977): the message wraps to two lines under the box. -->
			<span v-if="message" class="line-clamp-2 px-2 text-sm text-ink-red-4" :title="message">
				{{ message }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from "vue";
import {
	CommitKey,
	ControlPageKey,
	DocKey,
	LinkTitlesKey,
	NO_COMMIT,
	ResolveFieldKey,
	UpdateKey,
} from "@framework/ui/FormLayout/types";
import { FieldErrorsKey, fieldErrorKey } from "@framework/ui/fields/types";
import type { FieldNode } from "@framework/ui/FormLayout/types";
import { RecordAnchor } from "@framework/ui/Link";
import {
	ColorSwatch,
	DataOpenLink,
	FieldActionButtons,
	FieldActionsKey,
	LinkMark,
	dataHref,
	focusField,
	isEmailField,
	isPhoneField,
	useLinkMark,
	useRecordLink,
} from "@framework/ui/fields";
import { isSummaryField, useFieldDisplay } from "@framework/ui/FormLayout";
import { __ } from "@/i18n";
import { PanelContextKey } from "./context";
import { protoError, protoFocus, protoRing } from "./protoFocus";

const props = defineProps<{ field: FieldNode }>();
const emit = defineEmits<{ expand: [field: FieldNode] }>();

const doc = inject(DocKey)!;
const update = inject(UpdateKey)!;
const commit = inject(CommitKey, NO_COMMIT);
const resolveField = inject(ResolveFieldKey)!;
const context = inject(PanelContextKey, null);
const page = inject(ControlPageKey, null);
// Only a script's own control gets `page`; the stock ones would carry it as a stray attribute.
const scriptPage = computed(() =>
	props.field.ui?.component && page?.value ? { page: page.value } : {}
);
const titles = inject(LinkTitlesKey, null);
const displayField = useFieldDisplay();
const mark = useLinkMark(
	() => props.field,
	() => doc.value[props.field.fieldname]
);
const errors = inject(FieldErrorsKey, null);
// PROTOTYPE (#46977): `?err=<fieldname>` marks one row, so the error look can be tried live.
const error = computed(
	() =>
		errors?.value[fieldErrorKey(props.field.fieldname)] ??
		(protoError === props.field.fieldname ? PROTO_ERROR : undefined)
);
const PROTO_ERROR =
	"Enter a valid email address. The part after @ must be a domain that receives mail.";
const message = computed(() => [error.value ?? []].flat().join(" "));

function edit(fieldname: string, value: any) {
	// PROTOTYPE (#46977): a closed editor's late change (its blur on unmount) must not undo a cancel.
	if (!editing.value) return;
	update(fieldname, value);
	commit.pending(fieldname, value);
}

// A commit both closes the inline editor and fires the field's handler.
function onCommit(value: any) {
	if (!editing.value) return;
	close();
	commit.commit(props.field.fieldname, value);
}

const editing = ref(false);
const cell = ref<HTMLElement | null>(null);
const rest = ref<HTMLElement | null>(null);
let opening: any;

// Every keystroke already wrote the draft, so a cancel has to put the opening value back.
function cancel() {
	update(props.field.fieldname, opening);
	keepFocus = true;
	close();
}

// PROTOTYPE (#46977): after Enter or Esc, focus stays on the row's closed box. That focus
// comes from the row's own editor, so it does not open the editor again.
let keepFocus = false;
let returning = false;
async function close() {
	const back = keepFocus;
	keepFocus = false;
	editing.value = false;
	if (!back) return;
	await nextTick();
	returning = true;
	rest.value?.focus();
	returning = false;
}

// A one-line control commits on Enter; a picker's Enter picks, then its change commits.
const ENTER_COMMITS = ["Data", "Password", "Int", "Float", "Currency", "Percent", "Phone", "Duration"];
function onEnter(event: KeyboardEvent) {
	if (multiline.value || event.isComposing) return;
	keepFocus = true;
	if (ENTER_COMMITS.includes(props.field.fieldtype)) onCommit(doc.value[props.field.fieldname]);
}

// Focus from Tab opens the row at once; Enter or a typed key reopens a row focus came back to.
function onRestFocus() {
	if (!returning && !summary.value) open();
}
function onRestKey(event: KeyboardEvent) {
	if (event.target !== rest.value) return;
	if (event.key === "Enter" || (event.key.length === 1 && !event.metaKey && !event.ctrlKey)) open();
}

// A field that Details does not draw has nowhere to open, so its row edits in place.
const summary = computed(
	() =>
		isSummaryField(props.field.fieldtype) &&
		(context?.onDetails(props.field.fieldname) ?? true)
);
const interactive = computed(() => summary.value || !props.field.readOnly);
const resolved = computed(() => resolveField(props.field.fieldtype));
const multiline = computed(() => ["Small Text", "Text", "Long Text"].includes(props.field.fieldtype));
const chips = computed(() => props.field.fieldtype === "Table MultiSelect");
const chipList = computed(() => (display.value ? String(display.value).split(", ") : []));
const oneClick = computed(
	() => ["Check", "Rating"].includes(props.field.fieldtype) && !props.field.ui?.component
);

// A press anywhere in a Check row toggles it, not only a press on the box.
function toggleCheck() {
	if (props.field.fieldtype !== "Check" || props.field.readOnly) return;
	const next = doc.value[props.field.fieldname] ? 0 : 1;
	update(props.field.fieldname, next);
	commit.commit(props.field.fieldname, next);
}

const placeholder = computed(() =>
	interactive.value && !summary.value ? `Add ${props.field.label}...` : ""
);

// The label already occupies its own column, so the control must not render a second one.
// PROTOTYPE (#46965): the row's placeholder in every state, and no description under the row.
const controlField = computed(() => ({
	...props.field,
	label: undefined,
	description: undefined,
	placeholder: placeholder.value,
}));

// PROTOTYPE (#46965): a multi-line field opens one line tall and grows with its text,
// up to the max-height in the style block, then scrolls.
const MAX_TEXT_HEIGHT = 128;
function grow(event?: Event) {
	const area = (event?.target ?? cell.value?.querySelector("textarea")) as HTMLElement | null;
	if (!(area instanceof HTMLTextAreaElement)) return;
	area.rows = 1;
	area.style.height = "0px";
	area.style.height = `${Math.min(area.scrollHeight, MAX_TEXT_HEIGHT)}px`;
}

const display = computed(() =>
	displayField(props.field, doc.value[props.field.fieldname], { doc: doc.value })
);

const phone = computed(() => isPhoneField(props.field));
const email = computed(() => isEmailField(props.field));
const overlay = computed(() => email.value && !!doc.value[props.field.fieldname]);
const actionRecord = computed(() =>
	context
		? { doctype: context.doctype, name: context.docname, surface: "record" as const }
		: undefined
);
const address = computed(() => dataHref(props.field, doc.value[props.field.fieldname]));
// The shell's email button already writes to this address, so the row drops its mailto arrow.
const fieldActions = inject(FieldActionsKey, null);
const composerEmail = computed(
	() =>
		email.value &&
		!!fieldActions
			?.for(props.field, doc.value[props.field.fieldname], actionRecord.value)
			.some((action) => action.act === "shell.email")
);

const record = useRecordLink(linkedDoctype, () => doc.value[props.field.fieldname] || null);
const openLabel = computed(() => {
	const title = titles?.value[`${linkedDoctype()}::${doc.value[props.field.fieldname]}`];
	return __("Open {0}", [title ?? display.value]);
});

function linkedDoctype(): string {
	const { fieldtype, options } = props.field;
	if (fieldtype === "Link") return options ?? "";
	if (fieldtype === "Dynamic Link" && options) return doc.value[options] ?? "";
	return "";
}

function open() {
	if (summary.value) return emit("expand", props.field);
	if (props.field.readOnly) return;
	opening = doc.value[props.field.fieldname];
	editing.value = true;
}

// A picker's popover is portalled out of the cell, so focus landing outside the
// document body's flow is not the user leaving the field.
function onFocusout(event: FocusEvent) {
	const next = event.relatedTarget as HTMLElement | null;
	if (!next) return;
	if (cell.value?.contains(next)) return;
	if (next.closest(POPOVER)) return;
	keepFocus = false;
	editing.value = false;
}

watch(editing, async (on, _previous, onCleanup) => {
	if (!on) return;
	let stop = () => {};
	onCleanup(() => stop());
	await nextTick();
	grow();
	const stopFocus = cell.value ? focusField(cell.value) : () => {};
	// PROTOTYPE (#46977): the caret goes to the end, but the text stays where the rest row
	// showed it; typing scrolls to the caret.
	const area = cell.value?.querySelector("textarea");
	if (area) area.scrollTop = 0;
	const input = cell.value?.querySelector("input");
	if (input) input.scrollLeft = 0;
	// PROTOTYPE (#46965): a press on a blank part of the page moves focus to nothing, so
	// `focusout` has no `relatedTarget` and cannot tell it from a press in a popover.
	document.addEventListener("pointerdown", onPointerdownOutside, true);
	stop = () => {
		stopFocus();
		document.removeEventListener("pointerdown", onPointerdownOutside, true);
	};
});

const POPOVER = '[role="dialog"],[role="listbox"],[role="menu"],[data-reka-popper-content-wrapper]';

function onPointerdownOutside(event: PointerEvent) {
	const target = event.target as HTMLElement | null;
	if (!target || cell.value?.contains(target) || target.closest(POPOVER)) return;
	keepFocus = false;
	editing.value = false;
}
</script>

<style scoped>
/* PROTOTYPE (#46965): every control draws the rest row's box (28px, text at +8, 8px radius,
   the full value column); only the fill and the ring change. The editing cell only exists
   while the row is focused, so the focused look applies without a :focus selector. */
.proto-cell
	:deep(
		:is(
				input[data-slot="control"]:not([type="checkbox"]),
				textarea[data-slot="control"],
				[data-slot="trigger"][class*="min-h-7"]
			)
	) {
	width: 100%;
	height: 28px;
	min-height: 28px;
	padding-top: 0;
	padding-bottom: 0;
	padding-inline-start: 8px;
	border: 0 !important;
	border-radius: 8px;
	outline: none !important;
	color: var(--ink-gray-8);
	transition: none;
	box-shadow: inset 0 0 0 1px var(--proto-ring) !important;
	background: var(--proto-fill) !important;
}
.proto-row[data-ring="3"] {
	--proto-ring: var(--outline-gray-3);
}
.proto-row[data-ring="4"] {
	--proto-ring: var(--outline-gray-4);
}
.proto-row[data-proto="a"] {
	--proto-fill: var(--surface-gray-2);
}
.proto-row[data-proto="b"] {
	--proto-fill: var(--surface-base);
}
/* PROTOTYPE (#46977): an errored row rings red on focus, and its value is red in every state. */
.proto-row[data-error] {
	--proto-ring: var(--outline-red-3);
}
.proto-row[data-error] .proto-cell :deep(:is(input, textarea)) {
	color: var(--ink-red-4) !important;
}
/* PROTOTYPE (#46977): focus back on the closed row, or on one of its buttons, shows the
   focused look with the editor closed. */
.proto-rest[tabindex]:focus,
.proto-rest[tabindex]:focus-within,
.proto-row:has(> .proto-btn :focus-visible) > .proto-rest[tabindex] {
	background: var(--proto-fill);
	box-shadow: inset 0 0 0 1px var(--proto-ring);
}
.proto-row :deep(:is(a, button):focus-visible) {
	opacity: 1;
	outline: none;
	border-radius: 4px;
	box-shadow: 0 0 0 2px var(--outline-gray-4);
}
.proto-row[data-pad="end"] :deep(input[data-slot="control"]),
.proto-cell[data-pad="end"] :deep(input[data-slot="control"]) {
	padding-inline-end: 32px !important;
}
/* PROTOTYPE (#46977): the rest text wraps with the textarea's metrics and stops at 6 lines. */
.proto-multi {
	white-space: pre-wrap;
	overflow-wrap: break-word;
	letter-spacing: 0.02em;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 6;
	overflow: hidden;
}
.proto-secret {
	-webkit-text-security: disc;
}
/* PROTOTYPE (#46977): the row draws the message; the control draws none. */
.proto-cell :deep([data-slot="error"]) {
	display: none;
}
/* Chrome draws a password input's dots 1px higher than the same dots in text. */
.proto-cell[data-type="Password"] :deep(input[data-slot="control"]) {
	padding-top: 2px !important;
}
/* PROTOTYPE (#46977): Table MultiSelect chips: 20 high, so one line of chips is a 28 row. */
.proto-chip,
.proto-cell[data-type="Table MultiSelect"] :deep(button[data-state] .flex-wrap > span) {
	display: inline-flex;
	height: 20px;
	max-width: 100%;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
	border: 1px solid var(--outline-gray-1);
	border-radius: 6px;
	background: var(--surface-base);
	padding: 0 6px;
	font-size: 13px;
	line-height: 1;
	letter-spacing: 0.01em;
	font-weight: 420;
	color: var(--ink-gray-7);
}
.proto-chip-x {
	width: 12px;
	height: 12px;
	margin: 0 0 0 2px;
}
.proto-cell[data-type="Table MultiSelect"] :deep(button[data-state] .flex-wrap > span > span) {
	padding: 0 !important;
	margin: 0 0 0 2px !important;
}
.proto-cell[data-type="Table MultiSelect"] :deep(button[data-state]) {
	min-height: 28px;
	padding: 4px 8px !important;
	border: 0 !important;
	border-radius: 8px;
	box-shadow: inset 0 0 0 1px var(--proto-ring) !important;
	background: var(--proto-fill) !important;
	transition: none;
}
.proto-cell[data-type="Table MultiSelect"] :deep(button[data-state] .flex-wrap) {
	gap: 4px;
}
.proto-cell :deep(textarea[data-slot="control"]) {
	max-height: 128px;
	padding-top: 4px !important;
	padding-bottom: 4px !important;
	font-size: 14px;
	letter-spacing: 0.02em;
	line-height: 20px;
	resize: none;
	overflow-y: auto;
	scrollbar-width: none;
}
/* Date draws its chevron in the text colour; Select's is gray-4. One chevron for both. */
.proto-cell :deep([data-slot="chevron"]) {
	color: var(--ink-gray-4);
}
/* The Link control's own input sits inside its trigger box. */
.proto-cell :deep(input[data-slot="input"]) {
	line-height: 28px;
}
/* A focused Check or Rating takes the row's focused look; the control keeps its own size. */
.proto-oneclick:focus-within {
	background: var(--proto-fill);
	box-shadow: inset 0 0 0 1px var(--proto-ring);
}
.proto-oneclick :deep(:focus-visible) {
	outline: none;
	box-shadow: none;
}
</style>
