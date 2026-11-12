<!-- PROTOTYPE (#47097 round 2), throwaway: the header crumbs with the open layout as the last
     crumb: `DocType / Contact / Details ▾` (a manager: `Contact / Customize / Details ▾`). The
     leading crumbs copy frappe-ui Breadcrumbs' markup: its last crumb is plain text, and here the
     last one is the layout menu's trigger. -->
<template>
	<nav class="flex min-w-0 items-center whitespace-nowrap leading-tighter" aria-label="Breadcrumbs">
		<template v-for="crumb in crumbs" :key="crumb.label">
			<component
				:is="crumb.route ? RouterLink : 'button'"
				v-bind="crumb.route ? { to: crumb.route } : { type: 'button' }"
				class="flex shrink-0 items-center rounded-4 px-0.5 py-1 text-lg-medium leading-tighter text-ink-gray-5 hover:text-ink-gray-7"
				@click="crumb.onClick?.()"
			>
				{{ crumb.label }}
			</component>
			<span class="mx-0.5 text-base text-ink-gray-4" aria-hidden="true">/</span>
		</template>
		<LayoutMenu :disabled="!ready" @picked="$emit('picked')" />
	</nav>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from "vue-router";
import LayoutMenu from "./LayoutMenu.vue";

defineProps<{ crumbs: { label: string; route?: RouteLocationRaw; onClick?: () => void }[]; ready: boolean }>();
defineEmits<{ picked: [] }>();
</script>
