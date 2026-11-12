<!-- PROTOTYPE (#47100), throwaway: a Link field's "Filters" (`link_filters`): which records its
     picker offers. The same row and builder as the conditions, against the TARGET DocType's
     fields, flat AND (the stored list has no OR). A value may be fixed or a field of this record
     (`eval:doc.company`). Desk v2 does not read `link_filters` yet; the Preview applies them. -->
<template>
	<ConditionPanelRow
		label="Filters"
		kind="filters"
		:value="value"
		empty-text=""
		:empty-note="`Every ${doctype} is offered. Add a filter to offer fewer.`"
		:subject="subject"
		:row-key="`${rowKey}.link_filters`"
		:doctype="doctype"
		:target-fields="targetFields"
		:record="record"
		:mark="mark"
		@update="$emit('update', $event)"
	/>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ConditionField } from "@framework/ui/ConditionBuilder";
import { getFilterableFields } from "@framework/ui/Filter";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import ConditionPanelRow from "./ConditionPanelRow.vue";

const props = defineProps<{ doctype: string; value: string; subject: string; rowKey: string; record: ConditionField[]; mark?: Record<string, unknown> }>();
defineEmits<{ update: [value: string] }>();

const { meta } = useDoctypeMeta(() => props.doctype);
const targetFields = computed<ConditionField[]>(() => (meta.value?.fields ? getFilterableFields(meta.value.fields, props.doctype) : []));
</script>
