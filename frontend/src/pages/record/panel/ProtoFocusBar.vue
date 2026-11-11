<!-- PROTOTYPE (#46965), throwaway: switch the focused-row look. Hidden with `?bar=0`. -->
<template>
	<Teleport v-if="shown" to="body">
		<div
			class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-4 bg-surface-gray-8 px-3 py-2 text-sm text-ink-white shadow-xl"
		>
			<span class="text-ink-gray-4">Focus</span>
			<button
				v-for="v in variants"
				:key="v.id"
				class="rounded-2 px-2 py-1"
				:class="protoFocus === v.id ? 'bg-surface-gray-6' : ''"
				@click="setProto('focus', v.id)"
			>
				{{ v.label }}
			</button>
			<span class="text-ink-gray-4">Ring</span>
			<button
				v-for="r in ['3', '4']"
				:key="r"
				class="rounded-2 px-2 py-1"
				:class="protoRing === r ? 'bg-surface-gray-6' : ''"
				@click="setProto('ring', r)"
			>
				gray-{{ r }}
			</button>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { protoFocus, protoRing, setProto } from "./protoFocus";

const shown = new URLSearchParams(location.search).get("bar") !== "0";
const variants = [
	{ id: "a", label: "a · gray fill + inset ring" },
	{ id: "b", label: "b · white fill + ring" },
] as const;
</script>
