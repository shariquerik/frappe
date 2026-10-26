<!-- PROTOTYPE: "Open as record" for each Single the pane reads. -->
<template>
	<template v-if="singles.length === 1">
		<RouterLink v-slot="{ navigate }" :to="routeFor(singles[0].doctype)" custom>
			<Button :variant="variant ?? 'subtle'" icon-left="lucide-external-link" @click="navigate">
				{{ compact ? "Open" : `Open ${singles[0].doctype}` }}
			</Button>
		</RouterLink>
	</template>
	<Dropdown v-else-if="singles.length > 1" :options="options">
		<Button :variant="variant ?? 'subtle'" icon-left="lucide-external-link" label="Open as record" />
	</Dropdown>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Button, Dropdown } from "frappe-ui";
import { routeFor } from "@/router/routeFor";
import { paneBindings, type BindingSpec, type PaneSpec } from "./panes";

const props = defineProps<{
	pane?: PaneSpec;
	only?: BindingSpec;
	compact?: boolean;
	variant?: "subtle" | "ghost" | "outline";
}>();
const router = useRouter();

const singles = computed(() =>
	(props.only ? [props.only] : paneBindings(props.pane!)).filter((spec) => spec.type === "Single")
);
const options = computed(() =>
	singles.value.map((spec) => ({
		label: spec.doctype,
		icon: "lucide-external-link",
		onClick: () => router.push(routeFor(spec.doctype)),
	}))
);
</script>
