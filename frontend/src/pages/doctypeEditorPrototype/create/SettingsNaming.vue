<!-- PROTOTYPE (#47098), throwaway: Naming, one radio row per rule; the chosen rule opens its own
     control under it (a field, a pattern with its tokens, the series), with the next name it gives.
     "Set by the app's code" shows only when it is the rule. Refused rules are disabled with the
     reason. `only` draws one setting (variant C's panel): "naming" or "rename". -->
<template>
	<SettingsRow v-if="!only || only === 'naming'" label="Naming rule" help="How each new record gets its ID." prop="naming" wide keywords="autoname naming series pattern format expression random hash autoincrement number prompt field script">
		<RadioGroup :model-value="ui.rule" padded class="-mx-1.5 flex flex-col gap-0.5" @update:model-value="pick($event as Rule)">
			<template v-for="one in rules" :key="one.value">
				<Radio :value="one.value" :label="one.label" :description="(!byScript && ruleRefusal(ui, one.value)) || HELP[one.value]" :disabled="Boolean(ruleRefusal(ui, one.value))" />
				<div v-if="one.value === ui.rule && hasControl" class="flex flex-col gap-2 pb-2 pl-[28px] pr-1.5" data-naming-control>
					<template v-if="ui.rule === 'field'">
						<Combobox class="w-[280px]" :model-value="field" :options="fieldOptions" placeholder="Choose a field" @update:model-value="pickField(String($event ?? ''))" />
						<p class="text-p-sm text-ink-gray-5">Makes {{ labelOf(field) || "the field" }} unique: two records cannot share a value.</p>
					</template>
					<template v-else-if="ui.rule === 'format'">
						<TextInput ref="patternInput" class="w-[280px] [&_input]:font-mono" :model-value="pattern" placeholder="ST-{YYYY}-{#####}" @update:model-value="typePattern" />
						<div class="flex flex-wrap items-center gap-1.5">
							<Button v-for="token in TOKENS" :key="token" size="sm" variant="subtle" class="font-mono" :label="token" @click="insert(token)" />
						</div>
					</template>
					<div v-else-if="ui.rule === 'naming_series'" class="flex w-full flex-col">
						<div v-for="(one, at) in series" :key="one" class="flex h-7 items-center gap-3">
							<span class="flex w-[296px] shrink-0 items-center gap-2">
								<span class="min-w-0 truncate font-mono text-sm text-ink-gray-8">{{ one }}</span>
								<Badge v-if="at === 0" label="Default" theme="gray" size="sm" class="shrink-0" />
							</span>
							<NamePreview class="whitespace-nowrap" :parts="previewName(one, counter, labelOf)" />
						</div>
						<p class="mt-1 text-p-sm text-ink-gray-5">The series are the options of the Naming Series field.</p>
					</div>
					<p v-if="ui.rule !== 'naming_series'" class="text-p-sm text-ink-gray-5">
						Next name: <NamePreview :parts="next" />
					</p>
				</div>
			</template>
		</RadioGroup>
		<p v-if="byScript" class="mt-2 text-p-sm text-ink-gray-5">{{ ruleRefusal(ui, "hash") }}</p>
	</SettingsRow>
	<SettingsRow v-if="!only || only === 'rename'" label="Allow rename" help="People who can write a record can rename it." prop="allow_rename" keywords="naming name">
		<Switch :model-value="Boolean(ui.value('allow_rename'))" @update:model-value="ui.set('allow_rename', $event ? 1 : 0)" />
	</SettingsRow>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, inject, nextTick, ref } from "vue";
import { Badge, Button, Combobox, Radio, RadioGroup, Switch, TextInput } from "frappe-ui";
import SettingsRow from "./SettingsRow.vue";
import { previewName, ruleRefusal, RULES, SettingsKey, TOKENS, type Rule } from "./settings";

defineProps<{ only?: string }>();
const ui = inject(SettingsKey)!;
const slug = ui.doctype.toLowerCase().replace(/[ -]+/g, "_");
const HELP: Record<Rule, string> = {
	hash: "Like 8f3k2a91c0.",
	autoincrement: "1, 2, 3, and on.",
	field: "The value of one field, like a store's name.",
	format: "Text, dates and a counter, like ST-2026-00042.",
	naming_series: "The person picks a series; each series counts on its own.",
	prompt: "The person who creates a record types its name.",
	script: `${slug}.py names each record. Change it there.`,
};
const NAMEABLE = new Set(["Data", "Link", "Select", "Int", "Dynamic Link", "Read Only"]);

// "Set by the app's code" is offered only while it is the rule.
const rules = computed(() => RULES.filter((one) => one.value !== "script" || ui.loaded.rule === "script" || ui.rule === "script"));
// The app's code names the records: one note for the whole list, not one per rule.
const byScript = computed(() => ui.loaded.rule === "script" && !ui.draft);
const hasControl = computed(() => ["autoincrement", "field", "format", "naming_series"].includes(ui.rule));
const counter = computed(() => (ui.records ?? 0) + 1);
const labelOf = (fieldname: string) => ui.fields.find((one) => one.fieldname === fieldname)?.label || fieldname;
const fieldOptions = computed(() => ui.fields.filter((one) => NAMEABLE.has(one.fieldtype)).map((one) => ({ label: one.label || one.fieldname, value: one.fieldname })));
const series = computed(() => String(ui.fields.find((one) => one.fieldname === "naming_series")?.options ?? "").split("\n").filter(Boolean));

// What each rule last held, so switching away and back keeps it.
const autoname = String(ui.value("autoname") ?? "");
const field = ref(autoname.startsWith("field:") ? autoname.slice(6) : String(ui.value("title_field") || fieldOptions.value[0]?.value || ""));
const pattern = ref(autoname.startsWith("format:") ? autoname.slice(7) : ui.rule === "format" ? autoname : "");
const AUTONAME: Record<Rule, () => string> = {
	hash: () => "hash",
	autoincrement: () => "autoincrement",
	field: () => `field:${field.value}`,
	format: () => (pattern.value.includes(".") && !pattern.value.includes("{") ? pattern.value : `format:${pattern.value}`),
	naming_series: () => "naming_series:",
	prompt: () => "prompt",
	script: () => autoname,
};

const patternInput = ref<{ inputElement: HTMLInputElement | null } | null>(null);
async function pick(rule: Rule) {
	ui.setRule(rule, AUTONAME[rule]());
	if (rule !== "format") return;
	await nextTick();
	patternInput.value?.inputElement?.focus();
}
function pickField(fieldname: string) {
	field.value = fieldname;
	ui.setRule("field", AUTONAME.field());
}
function typePattern(text: string) {
	pattern.value = text;
	ui.setRule("format", AUTONAME.format());
}
function insert(token: string) {
	typePattern(pattern.value + token);
	patternInput.value?.inputElement?.focus();
}

const next = computed(() => {
	if (ui.rule === "autoincrement") return [{ text: String(counter.value) }];
	if (ui.rule === "field") return [{ text: `<${labelOf(field.value) || "Field"}>`, gray: true }];
	return pattern.value ? previewName(AUTONAME.format(), counter.value, labelOf) : [{ text: "Type a pattern", gray: true }];
});

/** A name preview: the made-up parts (a field's value) in a lighter gray. */
const NamePreview = defineComponent({
	props: { parts: { type: Array as () => { text: string; gray?: boolean }[], required: true } },
	setup: (props) => () =>
		h("span", { class: "font-mono text-sm text-ink-gray-8", "data-next-name": "" }, props.parts.map((one) => h("span", { class: one.gray ? "text-ink-gray-4" : "" }, one.text))),
});
</script>
