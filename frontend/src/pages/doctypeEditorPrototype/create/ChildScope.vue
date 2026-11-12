<!-- PROTOTYPE (#47099), throwaway: everything inside edits the child DocType, not the parent: its
     editor, its draft UI, its saved UI and, on a standard child while the parent is customized, its
     own Customize UI (a site change on the child). The parent's panel and editor parts work as is. -->
<template>
	<slot />
</template>

<script setup lang="ts">
import { computed, provide } from "vue";
import { EditorKey } from "../context";
import { ChildScopeKey, type ChildTable } from "./childTables";
import { CustomizeKey } from "./customize";
import { DraftUiKey } from "./draftUi";
import { SavedUiKey } from "./savedDoctype";

const props = defineProps<{ child: ChildTable }>();
provide(ChildScopeKey, props.child);
provide(EditorKey, props.child.editor);
provide(DraftUiKey, props.child.draftUi);
provide(
	SavedUiKey,
	computed(() => props.child.saved)
);
provide(
	CustomizeKey,
	computed(() => (props.child.editor.state.mode === "customize" ? props.child.customize : null))
);
</script>
