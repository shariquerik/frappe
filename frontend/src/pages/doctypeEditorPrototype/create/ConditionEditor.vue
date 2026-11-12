<!-- PROTOTYPE (#47100), throwaway: the one builder behind "Visible if", "Mandatory if", "Read-only
     if", a section's "Starts open if" and a Link's "Filters". Rules is ui's ConditionBuilder (AND/OR
     groups for a condition; a flat AND list against the target DocType for link filters). Code is
     the escape: the JavaScript after `eval:` (or the link_filters JSON), switching back to Rules only
     when the parser reads it. An expression the parser cannot read opens in Code, untouched, with a
     note. Every edit applies at once, as the rest of the panel does. -->
<template>
	<div class="flex min-w-0 flex-col" data-condition-editor :data-kind="kind">
		<!-- A popover names what it edits; a dialog has its own title and the inline one sits under its row. -->
		<div v-if="surface === 'popover'" class="flex items-center gap-2 px-4 pb-1 pt-3">
			<span class="min-w-0 shrink-0 truncate text-base font-medium text-ink-gray-8">{{ title }}</span>
			<span v-if="subject" class="min-w-0 truncate text-base text-ink-gray-5">{{ subject }}</span>
			<ModeSwitch class="ml-auto" />
		</div>

		<div :class="{ 'px-4 py-3': surface === 'popover' }">
			<template v-if="mode === 'rules'">
				<ConditionBuilder
					:model-value="tree"
					:fields="fields"
					:max-depth="kind === 'filters' ? 0 : 3"
					bordered="all"
					class="condition-editor-builder"
					:labels="labels"
					@update:model-value="onTree"
				>
					<!-- No card in the card: the note in gray, then the same "Add" the filled builder shows. -->
					<template #empty>
						<span class="flex flex-col items-start gap-3 text-left">
							<span class="text-p-base text-ink-gray-5">{{ emptyNote }}</span>
							<span class="inline-flex h-7 items-center gap-1.5 rounded-4 bg-surface-gray-2 px-2 text-base text-ink-gray-8 hover:bg-surface-gray-3">
								<span class="lucide-plus size-4" aria-hidden="true" />
								{{ kind === "filters" ? "Add filter" : "Add condition" }}
							</span>
						</span>
					</template>
					<template #condition-value="cell">
						<ConditionValue v-bind="cell" :record="record" :same="kind === 'condition'" />
					</template>
					<!-- link_filters has no OR: every row is "and", as text. -->
					<template v-if="kind === 'filters'" #condition-conjunction>
						<span class="text-p-base text-ink-gray-6">and</span>
					</template>
					<!-- With no groups the builder's menu shrinks to a red trash; a gray × keeps the accents gray. -->
					<template v-if="kind === 'filters'" #condition-actions="{ remove }">
						<Tooltip text="Remove filter">
							<Button variant="ghost" icon="lucide-x" label="Remove filter" @click="remove" />
						</Tooltip>
					</template>
				</ConditionBuilder>
			</template>
			<template v-else>
				<Textarea
					variant="outline"
					:rows="kind === 'filters' ? 5 : 3"
					class="font-mono"
					:model-value="code"
					:placeholder="kind === 'filters' ? '[[&quot;Customer&quot;, &quot;disabled&quot;, &quot;=&quot;, 0]]' : 'doc.status === &quot;Paid&quot;'"
					data-condition-code
					@update:model-value="onCode"
				/>
				<p class="mt-2 flex items-start gap-1.5 text-p-sm text-ink-gray-5">
					<span class="lucide-info mt-px size-3.5 shrink-0" aria-hidden="true" />
					<span v-if="!readable && code.trim()">The rules can't show {{ kind === "filters" ? "these filters" : "this condition" }}. {{ kind === "filters" ? "They stay" : "It stays" }} as code, as written.</span>
					<span v-else-if="kind === 'filters'">A JSON list of <code class="font-mono">[DocType, field, operator, value]</code>. A value <code class="font-mono">eval:doc.company</code> reads this record.</span>
					<span v-else-if="onRow">JavaScript. <code class="font-mono">doc</code> is the row; <code class="font-mono">parent</code> is the record that holds it.</span>
					<span v-else>JavaScript. <code class="font-mono">doc</code> is the record.</span>
				</p>
			</template>
		</div>

		<div class="flex items-center gap-2" :class="surface === 'popover' ? 'border-t border-outline-gray-1 px-4 py-2.5' : surface === 'dialog' ? 'pt-6' : 'pt-3'">
			<ModeSwitch v-if="surface !== 'popover'" />
			<Button class="ml-auto" variant="ghost" :label="kind === 'filters' ? 'Clear filters' : 'Clear condition'" :disabled="!modelValue" @click="clear" />
			<Button :variant="surface === 'dialog' ? 'solid' : 'subtle'" label="Done" @click="$emit('done')" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue";
import { Button, TabButtons, Textarea, Tooltip } from "frappe-ui";
import { ConditionBuilder } from "@framework/ui/ConditionBuilder";
import type { ConditionField } from "@framework/ui/ConditionBuilder";
import ConditionValue from "./ConditionValue.vue";
import { codeOf, emitCondition, emitLinkFilters, emptyTree, parseCondition, parseLinkFilters, type ConditionScope, type Tree } from "./conditions";

type Mode = "rules" | "code";

const props = defineProps<{
	kind: "condition" | "filters";
	modelValue: string;
	title: string;
	/** What the rule is on ("Customer name"), beside the title in a popover. */
	subject?: string;
	/** "Always visible. Add a condition to…", on the empty Add button. */
	emptyNote: string;
	surface: "popover" | "dialog" | "inline";
	/** A condition: this DocType's fields (and the parent's on a row), plus the record's own. */
	scope?: ConditionScope;
	/** Link filters: the target DocType and its fields. */
	doctype?: string;
	targetFields?: ConditionField[];
	/** The fields a value may name: "a field of this record". */
	record: ConditionField[];
	onRow?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; done: [] }>();

const fields = computed(() => (props.kind === "filters" ? props.targetFields ?? [] : props.scope!.fields));
const labels = computed(() => ({
	addCondition: props.kind === "filters" ? "Add filter" : "Add condition",
	empty: props.emptyNote,
}));

const parse = (raw: string) => (props.kind === "filters" ? parseLinkFilters(raw, props.doctype!, fields.value) : parseCondition(raw, props.scope!));
const write = (tree: Tree) => (props.kind === "filters" ? emitLinkFilters(tree, props.doctype!, fields.value) : emitCondition(tree, props.scope!));
const codeText = (raw: string) => (props.kind === "filters" ? prettyJson(raw) : codeOf(raw));

const first = parse(props.modelValue);
const tree = ref<Tree>(first.ok ? first.tree : emptyTree());
const mode = ref<Mode>(first.ok ? "rules" : "code");
const code = ref(codeText(props.modelValue));
const readable = computed(() => parse(props.modelValue).ok);
const modes = computed(() => [
	{ label: "Rules", value: "rules", disabled: !readable.value },
	{ label: "Code", value: "code" },
]);

/** Rules | Code; Rules is off while the code is something the builder cannot show. */
const ModeSwitch = defineComponent({
	setup: () => () =>
		h("div", { class: "shrink-0" }, [
			h(Tooltip, { text: "The rules cannot show this code. Edit it until they can, or clear it.", disabled: readable.value }, () =>
				h("div", [h(TabButtons, { options: modes.value, modelValue: mode.value, "data-condition-mode": "", "onUpdate:modelValue": (next: unknown) => switchTo(next as Mode) })])
			),
		]),
});

function onTree(next: Tree | null) {
	tree.value = next ?? emptyTree();
	const value = write(tree.value);
	if (value !== props.modelValue) emit("update:modelValue", value);
}

function onCode(text: string) {
	code.value = text;
	const body = text.trim();
	const value = props.kind === "filters" ? compactJson(body) : body ? `eval:${body}` : "";
	if (value !== props.modelValue) emit("update:modelValue", value);
}

function switchTo(next: Mode) {
	if (next === "rules") {
		const parsed = parse(props.modelValue);
		if (!parsed.ok) return;
		tree.value = parsed.tree;
	} else code.value = codeText(props.modelValue);
	mode.value = next;
}

function clear() {
	tree.value = emptyTree();
	code.value = "";
	mode.value = "rules";
	emit("update:modelValue", "");
}

function prettyJson(raw: string) {
	try {
		const rows = JSON.parse(raw || "[]");
		return rows.length ? `[\n${rows.map((row: unknown) => `  ${JSON.stringify(row).replace(/,/g, ", ")}`).join(",\n")}\n]` : "";
	} catch {
		return raw;
	}
}
function compactJson(text: string) {
	try {
		const rows = JSON.parse(text || "[]");
		return Array.isArray(rows) && rows.length ? JSON.stringify(rows) : "";
	} catch {
		return text;
	}
}
</script>

<style>
/* The surface is the card; the builder's root card would be a card in a card. Nested groups keep theirs. */
.condition-editor-builder > div.rounded-6,
.condition-editor-builder [data-slot="condition-empty"] {
	border-width: 0;
	padding: 0;
}
.condition-editor-builder [data-slot="condition-empty"] {
	justify-content: flex-start;
}
</style>
