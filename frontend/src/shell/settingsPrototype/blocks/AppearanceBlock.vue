<!-- PROTOTYPE: a component block with no binding. The theme lives in localStorage and applies
     at once, so it is never dirty and never in a Save. -->
<template>
	<div class="grid grid-cols-3 gap-3 py-3">
		<button
			v-for="scheme in SCHEMES"
			:key="scheme.value"
			type="button"
			class="flex flex-col items-center gap-2 rounded-lg border p-3 text-base text-ink-gray-8 transition hover:bg-surface-gray-1"
			:class="
				colorScheme === scheme.value
					? 'border-outline-gray-5 ring-1 ring-outline-gray-5'
					: 'border-outline-gray-2'
			"
			@click="setColorScheme(scheme.value)"
		>
			<span
				class="flex h-14 w-full items-end justify-start gap-1 rounded-md p-2"
				:class="scheme.preview"
			>
				<span class="h-2 w-8 rounded-sm bg-current opacity-40" />
				<span class="h-2 w-4 rounded-sm bg-current opacity-20" />
			</span>
			<span class="flex items-center gap-1.5">
				<span :class="scheme.icon" class="size-4" />
				{{ scheme.label }}
			</span>
		</button>
	</div>
</template>

<script setup lang="ts">
import { useColorScheme } from "frappe-ui";

const SCHEMES = [
	{ label: "Light", value: "light", icon: "lucide-sun", preview: "bg-white text-gray-900 border border-gray-200" },
	{ label: "Dark", value: "dark", icon: "lucide-moon", preview: "bg-gray-900 text-white" },
	{
		label: "System",
		value: "system",
		icon: "lucide-monitor",
		preview: "bg-gradient-to-r from-white to-gray-900 text-gray-500",
	},
] as const;

const { colorScheme, setColorScheme } = useColorScheme();
</script>
