<!-- PROTOTYPE (#47385): the menu button at the start of the page header, on the navigation's side. -->
<template>
	<div
		class="absolute top-[10px] z-30"
		:class="side === 'left' ? 'left-2' : 'right-2'"
		data-proto-nav-open
	>
		<Button
			variant="ghost"
			icon="lucide-menu"
			:label="__('Open navigation')"
			@click="navOpen = true"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button } from "frappe-ui";
import { __ } from "@/i18n";
import { side } from "./navLayout";
import { navOpen } from "./navNarrow";
</script>
