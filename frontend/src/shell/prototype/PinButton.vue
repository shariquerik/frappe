<!-- PROTOTYPE (#47374): locks a dock or peek open in flow, and unlocks it again. -->
<template>
	<div class="flex shrink-0 items-center justify-center">
		<Tooltip :text="pinned ? __('Unpin: hide until the edge') : __('Pin open')" :side="awaySide">
			<button
				type="button"
				class="grid size-7 place-items-center rounded-4 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-8"
				:aria-pressed="pinned"
				data-proto-pin
				@click="pinned = !pinned"
			>
				<span :class="pinned ? 'lucide-pin-off' : 'lucide-pin'" class="size-4" />
			</button>
		</Tooltip>
	</div>
</template>

<script setup lang="ts">
import { Tooltip } from "frappe-ui";
import { __ } from "@/i18n";
import { awaySide, pinned } from "./navLayout";
</script>
