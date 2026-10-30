<!-- PROTOTYPE (#45867): the Side Panel drawn with the panel's own `PanelSection` and
     `PanelField`, through the section's existing default slot. The built-ins stay put. -->
<template>
	<div class="mx-auto flex w-full max-w-[880px] overflow-hidden rounded-6 ring-1 ring-outline-gray-2">
		<div class="flex-1 bg-surface-gray-1 p-5">
			<div class="h-3 w-40 rounded-full bg-surface-gray-3" />
			<div class="mt-4 h-2.5 w-64 rounded-full bg-surface-gray-2" />
			<div class="mt-2 h-2.5 w-56 rounded-full bg-surface-gray-2" />
			<p class="mt-8 text-sm text-ink-gray-5">The record's tabs render here. Switch to Details to lay them out.</p>
		</div>
		<aside class="w-[320px] shrink-0 border-l border-outline-gray-2 bg-surface-base py-1">
			<div class="flex items-center gap-2 px-4 py-3 opacity-60" title="Built in: not part of the layout">
				<div class="size-8 rounded-full bg-surface-gray-3" />
				<div>
					<div class="text-base-medium text-ink-gray-8">{{ editor.state.doctype }} name</div>
					<div class="text-sm text-ink-gray-5">Built-in identity</div>
				</div>
			</div>
			<Draggable
				:model-value="sections"
				item-key="name"
				:group="{ name: 'dte-sections' }"
				handle=".dte-handle"
				ghost-class="opacity-40"
				:data-parent-key="firstTab"
				@end="onDrop(editor, $event)"
			>
				<template #item="{ element: section, index }">
					<div :data-container-key="section.name" class="px-1">
						<Chrome
							kind="section"
							:selected="isSelected('section', section.name)"
							@select="editor.state.selection = { kind: 'section', key: section.name }"
						>
							<PanelSection
								:name="section.name"
								:label="section.label || undefined"
								:fields="[]"
								:index="index + 1"
								:header-index="section.label ? index : null"
								:divided="true"
								:open="true"
							>
								<Draggable
									:model-value="section.fields"
									item-key="fieldname"
									:group="{ name: 'dte-fields' }"
									ghost-class="dte-ghost"
									class="flex min-h-10 flex-col gap-2.5"
									:data-column-key="section.column"
									@start="editor.state.dragging = 'field'"
									@end="onDrop(editor, $event)"
								>
									<template #item="{ element: field }">
										<div :data-fieldname="field.fieldname">
											<Chrome
												:selected="isSelected('field', field.fieldname)"
												@select="editor.state.selection = { kind: 'field', fieldname: field.fieldname }"
											>
												<div inert><PanelField :field="field" /></div>
											</Chrome>
										</div>
									</template>
									<template #footer>
										<div v-if="!section.fields.length" class="pointer-events-none flex h-10 items-center justify-center rounded-4 border border-dashed border-outline-gray-2 text-sm text-ink-gray-4">
											Drag fields here
										</div>
									</template>
								</Draggable>
							</PanelSection>
							<template #tools>
								<Button variant="ghost" size="sm" icon="lucide-grip-vertical" class="dte-handle cursor-grab" label="Drag section" />
								<Button variant="ghost" size="sm" icon="lucide-trash-2" label="Delete section" @click="editor.acts.removeContainer(section.name)" />
							</template>
						</Chrome>
					</div>
				</template>
			</Draggable>
			<div class="px-4 py-3">
				<button
					type="button"
					class="flex h-8 w-full items-center justify-center gap-1.5 rounded-4 border border-dashed border-outline-gray-2 text-sm text-ink-gray-5 hover:text-ink-gray-7"
					@click="editor.acts.addSection()"
				>
					<span class="lucide-plus size-4" aria-hidden="true" /> Add section
				</button>
			</div>
			<div class="border-t border-outline-gray-1 px-4 py-3 text-sm text-ink-gray-5 opacity-60">
				Built-in: people, tags, quick actions
			</div>
		</aside>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, provide, ref } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button } from "frappe-ui";
import { useFieldTypes } from "@framework/ui/FormLayout";
import { CommitKey, DocKey, NO_COMMIT, ResolveFieldKey, UpdateKey } from "@framework/ui/FormLayout/types";
import PanelSection from "@/pages/record/panel/PanelSection.vue";
import PanelField from "@/pages/record/panel/PanelField.vue";
import { EditorKey, onDrop } from "../context";
import Chrome from "./Chrome.vue";

const editor = inject(EditorKey)!;
const doc = ref<Record<string, any>>({});

// The panel is one flat list: every tab's sections, each section's columns run together.
const sections = computed(() =>
	editor.schema.value.flatMap((tab) =>
		tab.sections.map((section) => ({
			name: section.name!,
			label: section.label,
			column: section.columns[0]?.name,
			fields: section.columns.flatMap((column) => column.fields),
		}))
	)
);
const firstTab = computed(() => editor.tree.value[0]?.name);

function isSelected(kind: string, key: string) {
	const selected = editor.state.selection as any;
	return selected?.kind === kind && (selected.key ?? selected.fieldname) === key;
}

provide(DocKey, doc);
provide(UpdateKey, () => {});
provide(CommitKey, NO_COMMIT);
provide(ResolveFieldKey, useFieldTypes().resolve);
</script>
