<!-- PROTOTYPE (#45867): the properties panel. A field shows DocField properties only, the
     same on every layout (#45863 ruling 1); a container shows its own presentation (ruling 2). -->
<template>
	<div class="flex min-h-0 flex-col">
		<div v-if="!selection" class="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
			<span class="lucide-mouse-pointer-2 size-5 text-ink-gray-4" aria-hidden="true" />
			<p class="text-base text-ink-gray-6">Select a field, section, column or tab</p>
			<p class="text-sm text-ink-gray-5">Its properties show here.</p>
		</div>

		<template v-else-if="field">
			<header class="flex items-start gap-2 px-4 pb-3 pt-4">
				<span class="mt-0.5 size-4 shrink-0 text-ink-gray-5" :class="iconOf(field.fieldtype)" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<div class="truncate text-base-medium text-ink-gray-9">{{ field.label || field.fieldname }}</div>
					<div class="truncate font-mono text-sm text-ink-gray-5">{{ field.fieldname }}</div>
				</div>
				<Badge v-if="customize" :label="field.custom ? 'Custom field' : 'Standard field'" theme="gray" />
				<Button v-if="closable" class="-mr-1.5 -mt-1" variant="ghost" icon="lucide-x" label="Close" @click="editor.state.selection = null" />
			</header>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
				<div v-if="warning" class="flex gap-2 rounded-4 bg-surface-amber-1 p-2.5 text-sm text-ink-amber-4">
					<span class="lucide-triangle-alert mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					<span>Mandatory, but it sits in “{{ warning }}”, which has a condition. When the condition hides it, the save still asks for it.</span>
				</div>
				<p v-if="customize && !field.custom" class="text-sm text-ink-gray-5">
					Changes save as property setters on this site. The fieldname and type stay as the app ships them.
				</p>

				<FormControl :model-value="field.label" label="Label" @update:model-value="set('label', $event)" />
				<FormControl :model-value="field.fieldname" label="Fieldname" :disabled="!editor.can('rename-field', field.fieldname)" class="[&_input]:font-mono" />
				<FormControl type="select" :model-value="field.fieldtype" label="Type" :options="typeOptions" :disabled="!editor.can('change-type', field.fieldname)" @update:model-value="set('fieldtype', $event)" />
				<FormControl v-if="hasOptions" :type="field.fieldtype === 'Select' ? 'textarea' : 'text'" :model-value="field.options" :label="optionsLabel" @update:model-value="set('options', $event)" />
				<FormControl :model-value="field.default" label="Default" @update:model-value="set('default', $event)" />
				<FormControl type="textarea" :model-value="field.description" label="Description" :rows="2" @update:model-value="set('description', $event)" />

				<div class="flex flex-col items-start gap-2.5">
					<FormControl type="checkbox" :model-value="Boolean(field.reqd)" label="Mandatory" @update:model-value="set('reqd', $event ? 1 : 0)" />
					<FormControl type="checkbox" :model-value="Boolean(field.read_only)" label="Read only" @update:model-value="set('read_only', $event ? 1 : 0)" />
					<FormControl type="checkbox" :model-value="Boolean(field.hidden)" label="Hidden on every layout" @update:model-value="set('hidden', $event ? 1 : 0)" />
				</div>

				<details class="group/conds" :open="hasConditions">
					<summary class="flex cursor-pointer list-none items-center gap-1 text-sm-medium text-ink-gray-6">
						<span class="lucide-chevron-right size-3.5 transition-transform group-open/conds:rotate-90" aria-hidden="true" /> Conditions
					</summary>
					<div class="mt-3 space-y-4">
						<FormControl :model-value="field.depends_on" label="Show when" placeholder="eval:doc.status == 'Open'" class="[&_input]:font-mono" @update:model-value="set('depends_on', $event)" />
						<FormControl :model-value="field.mandatory_depends_on" label="Mandatory when" class="[&_input]:font-mono" @update:model-value="set('mandatory_depends_on', $event)" />
						<FormControl :model-value="field.read_only_depends_on" label="Read only when" class="[&_input]:font-mono" @update:model-value="set('read_only_depends_on', $event)" />
					</div>
				</details>

				<details class="group/more">
					<summary class="flex cursor-pointer list-none items-center gap-1 text-sm-medium text-ink-gray-6">
						<span class="lucide-chevron-right size-3.5 transition-transform group-open/more:rotate-90" aria-hidden="true" /> More
					</summary>
					<div class="mt-3 space-y-4">
						<FormControl type="number" :model-value="field.permlevel ?? 0" label="Permission level" @update:model-value="set('permlevel', Number($event))" />
						<div>
							<FormControl type="checkbox" :model-value="Boolean((field as any).allow_in_quick_entry)" label="Allow in quick entry" @update:model-value="set('allow_in_quick_entry', $event ? 1 : 0)" />
							<p class="mt-1 pl-6 text-sm text-ink-gray-5">Used only when no Quick Entry layout exists.</p>
						</div>
					</div>
				</details>
			</div>
			<footer class="flex gap-2 border-t border-outline-gray-1 px-4 py-3">
				<Button v-if="placedHere" label="Remove from layout" @click="editor.acts.moveField(field.fieldname, MORE_FIELDS, 0)" />
				<Button v-if="canOmit" label="Omit" @click="editor.acts.omit(field.fieldname)" />
				<Button v-if="omittedHere" label="Restore" @click="editor.acts.restore(field.fieldname)" />
				<Button
					v-if="editor.can('delete-field', field.fieldname)"
					class="ml-auto"
					theme="red"
					variant="subtle"
					icon="lucide-trash-2"
					label="Delete field"
					:tooltip="'Delete field'"
					@click="editor.acts.deleteField(field.fieldname)"
				/>
			</footer>
		</template>

		<template v-else-if="automatic">
			<header class="px-4 pb-3 pt-4">
				<div class="text-base-medium text-ink-gray-9">{{ automaticLabel }}</div>
				<div class="text-sm text-ink-gray-5">Automatic section</div>
			</header>
			<p class="px-4 text-p-sm text-ink-gray-6">
				It holds every field this layout neither places nor omits, in DocType order. It is drawn at
				render time and never saved. Drag a field out of it to place it.
			</p>
		</template>

		<template v-else-if="container">
			<header class="flex items-center gap-2 px-4 pb-3 pt-4">
				<span class="size-4 text-ink-gray-5" :class="kindIcon" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<div class="truncate text-base-medium text-ink-gray-9">{{ container.node.label || `Unnamed ${container.kind}` }}</div>
					<div class="text-sm capitalize text-ink-gray-5">{{ container.kind }} · {{ layoutLabel }} layout</div>
				</div>
				<Button v-if="closable" class="-mr-1.5" variant="ghost" icon="lucide-x" label="Close" @click="editor.state.selection = null" />
			</header>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
				<p v-if="forkPending" class="flex gap-2 rounded-4 bg-surface-gray-2 p-2.5 text-sm text-ink-gray-7">
					<span class="lucide-git-fork mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					<span>This layout still comes from the app. Your first change here saves a copy of it for this site.</span>
				</p>
				<FormControl :model-value="container.node.label" label="Label" @update:model-value="setC('label', $event)" />
				<FormControl v-if="container.kind !== 'tab'" type="checkbox" :model-value="Boolean(container.node.hideLabel)" label="Hide label" @update:model-value="setC('hideLabel', $event)" />
				<template v-if="container.kind === 'section'">
					<FormControl type="textarea" :rows="2" :model-value="container.node.description" label="Description" @update:model-value="setC('description', $event)" />
					<div class="flex flex-col items-start gap-2.5">
						<FormControl type="checkbox" :model-value="Boolean(container.node.hideBorder)" label="Hide border" @update:model-value="setC('hideBorder', $event)" />
						<FormControl type="checkbox" :model-value="Boolean(container.node.collapsible)" label="Collapsible" @update:model-value="setC('collapsible', $event)" />
						<FormControl v-if="container.node.collapsible" type="checkbox" :model-value="container.node.opened !== false" label="Open at first" @update:model-value="setC('opened', $event)" />
					</div>
				</template>
				<FormControl :model-value="container.node.dependsOn" label="Show when" placeholder="eval:doc.status == 'Open'" class="[&_input]:font-mono" @update:model-value="setC('dependsOn', $event)" />
				<p v-if="container.node.dependsOn" class="text-sm text-ink-gray-5">
					Hides its fields when false. A mandatory field inside stays mandatory.
				</p>
			</div>
			<footer class="flex gap-2 border-t border-outline-gray-1 px-4 py-3">
				<Button v-if="container.kind === 'tab'" icon="lucide-arrow-left" label="Move left" :tooltip="'Move left'" @click="editor.acts.moveTab(container.node.name, -1)" />
				<Button v-if="container.kind === 'tab'" icon="lucide-arrow-right" label="Move right" :tooltip="'Move right'" @click="editor.acts.moveTab(container.node.name, 1)" />
				<Button v-if="container.kind === 'section'" label="Add column" icon-left="lucide-columns-2" @click="editor.acts.addColumn(container.node.name)" />
				<Button theme="red" variant="subtle" :label="`Delete ${container.kind}`" @click="editor.acts.removeContainer(container.node.name)" />
			</footer>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { Badge, Button, FormControl } from "frappe-ui";
import { EditorKey } from "./context";
import { isMandatory, LAYOUTS, MORE_FIELDS } from "./editor";
import { FIELDTYPES, iconOf } from "./fieldtypes";
import { conditionalHome } from "./warnings";

defineProps<{ closable?: boolean }>();
const editor = inject(EditorKey)!;
const selection = computed(() => editor.state.selection);
const customize = computed(() => editor.state.mode === "customize");

const field = computed(() =>
	selection.value?.kind === "field" ? editor.field(selection.value.fieldname) : undefined
);
const automatic = computed(
	() => selection.value && "key" in selection.value && selection.value.key === MORE_FIELDS
);
const automaticLabel = computed(() => (editor.state.layout === "quick-entry" ? "Mandatory fields" : "More fields"));
const container = computed(() =>
	selection.value && "key" in selection.value ? (editor.find(selection.value.key) as any) : null
);
const layoutLabel = computed(() => LAYOUTS.find((one) => one.key === editor.state.layout)?.label);
const kindIcon = computed(
	() => ({ tab: "lucide-panel-top", section: "lucide-rows-3", column: "lucide-columns-2" })[container.value?.kind as string]
);
const forkPending = computed(
	() => customize.value && editor.state.source[editor.state.layout] === "fallback"
);

const typeOptions = FIELDTYPES.flatMap((group) => group.types);
const hasOptions = computed(() =>
	["Select", "Link", "Table", "Table MultiSelect", "Dynamic Link", "Autocomplete", "Currency"].includes(field.value?.fieldtype ?? "")
);
const optionsLabel = computed(() =>
	({ Select: "Options, one per line", Link: "Links to", Table: "Child table", "Table MultiSelect": "Child table", "Dynamic Link": "Type field", Currency: "Currency field" } as Record<string, string>)[field.value?.fieldtype ?? ""] ?? "Options"
);
const hasConditions = computed(() => Boolean(field.value?.depends_on || field.value?.mandatory_depends_on || field.value?.read_only_depends_on));

const placedHere = computed(() => field.value && editor.placed.value.has(field.value.fieldname));
const omittedHere = computed(() => field.value && editor.omitted.value.has(field.value.fieldname));
const canOmit = computed(() => field.value && editor.hasMoreFields.value && !omittedHere.value && !isMandatory(field.value));
const warning = computed(() => (field.value?.reqd ? conditionalHome(editor, field.value.fieldname) : ""));

const set = (prop: string, value: unknown) => editor.acts.setField(field.value!.fieldname, prop, value);
const setC = (prop: string, value: unknown) => editor.acts.setContainer(container.value.node.name, prop, value);
</script>
