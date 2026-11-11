<!-- One panel row: the label in a fixed column, the value in the flexible one. -->
<template>
	<!-- PROTOTYPE (#46965): rows align to the top, and the label sits on the first 28px line. -->
	<div class="grid grid-cols-[130px_1fr] items-start gap-2">
		<span class="h-7 truncate text-base leading-7 text-ink-gray-5" :title="field.label">
			{{ field.label }}
		</span>

		<div
			v-if="editing"
			ref="cell"
			class="field proto-cell min-w-0"
			:data-proto="protoFocus"
			:data-ring="protoRing"
			:data-fieldname="field.fieldname"
			@input="grow"
			@focusout="onFocusout"
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
			class="group flex min-h-7 min-w-0 flex-wrap items-center gap-x-1.5 rounded-4 px-2"
			:class="interactive ? 'cursor-pointer hover:bg-surface-gray-2' : ''"
			:data-fieldname="field.fieldname"
			@click="open"
		>
			<span
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
					<span class="truncate">{{ display || placeholder }}</span>
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
				class="lucide-arrow-up-right ml-auto size-3.5 shrink-0 text-ink-gray-5 opacity-0 hover:text-ink-gray-7 focus-visible:opacity-100 group-hover:opacity-100"
				@open="record.open"
			/>
			<DataOpenLink
				v-else-if="address && (address.kind === 'web' || (interactive && !composerEmail))"
				:address="address"
				class="ml-auto grid shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
			/>
			<span v-if="phone || email" class="-my-1 flex shrink-0 items-center" @click.stop>
				<FieldActionButtons
					:field="field"
					:value="doc[field.fieldname]"
					:record="actionRecord"
				/>
			</span>
			<span v-if="message" class="w-full truncate text-sm text-ink-red-4" :title="message">
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
import { protoFocus, protoRing } from "./protoFocus";

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
const error = computed(() => errors?.value[fieldErrorKey(props.field.fieldname)]);
const message = computed(() => [error.value ?? []].flat().join(" "));

function edit(fieldname: string, value: any) {
	update(fieldname, value);
	commit.pending(fieldname, value);
}

// A commit both closes the inline editor and fires the field's handler.
function onCommit(value: any) {
	editing.value = false;
	commit.commit(props.field.fieldname, value);
}

const editing = ref(false);
const cell = ref<HTMLElement | null>(null);
let opening: any;

// Every keystroke already wrote the draft, so a cancel has to put the opening value back.
function cancel() {
	update(props.field.fieldname, opening);
	editing.value = false;
}

// A field that Details does not draw has nowhere to open, so its row edits in place.
const summary = computed(
	() =>
		isSummaryField(props.field.fieldtype) &&
		(context?.onDetails(props.field.fieldname) ?? true)
);
const interactive = computed(() => summary.value || !props.field.readOnly);
const resolved = computed(() => resolveField(props.field.fieldtype));

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
	if (next.closest('[role="dialog"],[role="listbox"],[role="menu"]')) return;
	editing.value = false;
}

watch(editing, async (on, _previous, onCleanup) => {
	if (!on) return;
	let stop = () => {};
	onCleanup(() => stop());
	await nextTick();
	grow();
	if (cell.value) stop = focusField(cell.value);
});
</script>

<style scoped>
/* PROTOTYPE (#46965): every control draws the rest row's box (28px, text at +8, 8px radius,
   the full value column); only the fill and the ring change. The editing cell only exists
   while the row is focused, so the focused look applies without a :focus selector. */
.proto-cell
	:deep(
		:is(
				input[data-slot="control"],
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
.proto-cell[data-ring="3"] {
	--proto-ring: var(--outline-gray-3);
}
.proto-cell[data-ring="4"] {
	--proto-ring: var(--outline-gray-4);
}
.proto-cell[data-proto="a"] {
	--proto-fill: var(--surface-gray-2);
}
.proto-cell[data-proto="b"] {
	--proto-fill: var(--surface-base);
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
}
/* Date draws its chevron in the text colour; Select's is gray-4. One chevron for both. */
.proto-cell :deep([data-slot="chevron"]) {
	color: var(--ink-gray-4);
}
/* The Link control's own input sits inside its trigger box. */
.proto-cell :deep(input[data-slot="input"]) {
	line-height: 28px;
}
</style>
