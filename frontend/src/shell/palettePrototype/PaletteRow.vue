<!-- PROTOTYPE (#45263): one palette row: icon, label, gray description, the act's key on the right. -->
<template>
	<CommandPaletteItem :value="row" :disabled="row.id === 'searching'" class="gap-2.5">
		<template #prefix>
			<LoadingIndicator
				v-if="row.id === 'searching'"
				class="size-4 shrink-0 text-ink-gray-5"
			/>
			<span
				v-else
				:class="[row.icon, 'size-4 shrink-0 text-ink-gray-6']"
				aria-hidden="true"
			/>
		</template>
		{{ row.label }}
		<span v-if="row.description" class="pl-1.5 font-normal text-ink-gray-5">{{
			row.description
		}}</span>
		<template v-if="row.combo" #suffix>
			<!-- `flex` and `leading-none`, or its key boxes sit on a text line and make the row 2px taller. -->
			<KeyboardShortcut :combo="row.combo" class="!flex leading-none" />
		</template>
	</CommandPaletteItem>
</template>

<script setup lang="ts">
import { KeyboardShortcut, LoadingIndicator } from "frappe-ui";
import { CommandPaletteItem } from "frappe-ui/experimental";
import type { SampleRow } from "./sampleRows";

defineProps<{ row: SampleRow }>();
</script>
