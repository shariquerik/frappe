<!-- PROTOTYPE (#45867): the edit frame around one node on the canvas. It draws over the
     record page's render and never pads it, so the canvas keeps the record page's layout. -->
<template>
	<div
		class="relative rounded-3 outline outline-1 transition-[outline-color]"
		:class="[
			GROUP[kind],
			selected
				? 'outline-outline-gray-4 outline-offset-4'
				: 'outline-transparent outline-offset-4 hover:outline-outline-gray-2',
			automatic && 'outline-dashed !outline-outline-gray-3',
		]"
		:data-selected="selected || undefined"
		@click.stop="$emit('select')"
	>
		<slot />
		<div
			v-if="$slots.tools"
			class="absolute z-10 hidden items-center gap-0.5 rounded-3 bg-surface-base px-0.5 shadow-sm ring-1 ring-outline-gray-2"
			:class="[TOOLS[kind], POSITION[kind], selected && '!flex']"
			@click.stop
		>
			<slot name="tools" />
		</div>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{ kind?: "section" | "column" | "field"; selected?: boolean; automatic?: boolean }>(),
	{ kind: "field" }
);

// One hover group per kind, written out whole so Tailwind sees them: a hovered section
// must not raise its columns' tools.
const GROUP = { section: "group/section", column: "group/column", field: "group/field" };
const TOOLS = {
	section: "group-hover/section:flex",
	column: "group-hover/column:flex",
	field: "group-hover/field:flex",
};
// A field's one tool is "+ below", so it sits on the field's bottom edge.
const POSITION = {
	section: "-top-3 right-1",
	column: "-top-3 right-1",
	field: "-bottom-4 left-1/2 -translate-x-1/2",
};
defineEmits<{ select: [] }>();
</script>
