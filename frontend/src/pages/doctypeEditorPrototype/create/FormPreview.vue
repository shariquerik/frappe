<!-- PROTOTYPE (#45867): the Preview tab. The record page's own FormLayout draws the draft as a
     record will look, inert; no layout-edit parts, so it is the plain page. -->
<template>
	<div class="mx-auto w-full max-w-[880px] rounded-6 border border-outline-gray-2 bg-surface-elevation-2 px-8 py-6">
		<div inert>
			<FormLayout v-model:doc="doc" v-model:tab="tab" :layout="schema" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { provide, ref } from "vue";
import { FormLayout } from "@framework/ui/FormLayout";
import { CommitKey, LayoutEditKey, NO_COMMIT } from "@framework/ui/FormLayout/types";

defineProps<{ schema: any }>();

// The draft page provides nothing to FormLayout; this keeps the preview plain on its own.
provide(LayoutEditKey, null as any);
provide(CommitKey, NO_COMMIT);
const doc = ref<Record<string, any>>({});
const tab = ref("");
</script>
