<!-- PROTOTYPE (#45867), throwaway: step 1 of the new-DocType flow, "Name it". It asks only
     what is expensive to change later: the name, the module and the kind. Nothing is created
     here; "Continue" opens the draft page. -->
<template>
	<Dialog v-model:open="dialogOpen" title="New DocType" size="md">
		<form class="flex flex-col gap-5" @submit.prevent="start">
			<div class="flex flex-col gap-1.5">
				<FormControl v-model="typed" label="Name" placeholder="Support Ticket" autocomplete="off" autofocus />
				<p class="text-sm text-ink-gray-5">
					<template v-if="error"><span class="text-ink-red-7">{{ error }}</span></template>
					<template v-else-if="name">
						Saved as <span class="text-ink-gray-8">{{ name }}</span><template v-if="kind === 'child'">, with no address of its own.</template>
						<template v-else>, at <span class="font-mono text-ink-gray-7">{{ address }}</span></template>
					</template>
					<template v-else>Hard to change later: a rename moves its table and every link to it.</template>
				</p>
			</div>

			<div class="flex flex-col gap-1.5">
				<Combobox v-model="module" label="Module" :options="modules" placeholder="Choose a module" />
				<p class="text-sm text-ink-gray-5">
					{{ module && module === remembered ? "The last one you used. " : "" }}Where its files go.
				</p>
			</div>

			<div class="flex flex-col gap-1.5">
				<FormControl v-model="kind" type="select" label="Kind" :options="KINDS.map(({ value, label }) => ({ value, label }))" />
				<p class="text-sm text-ink-gray-5">{{ KINDS.find((one) => one.value === kind)?.description }}</p>
			</div>
		</form>
		<template #actions>
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm text-ink-gray-5">Nothing is created until you save.</span>
				<Button variant="solid" label="Continue" :disabled="!ready" @click="start" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Button, Combobox, Dialog, FormControl } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { deriveName, dialogOpen, draft, draftGeneration, KINDS, lastModule, slugOf, type Kind } from "./newDoctype";

const router = useRouter();
const addresses = inject<Addresses>("addresses")!;
const doctypes = addresses.doctypeNames();
const modules = addresses.moduleNames();

const typed = ref("");
const remembered = ref(lastModule());
const module = ref(remembered.value);
const kind = ref<Kind>("regular");

// The dialog opens fresh each time, with the module last saved under.
watch(dialogOpen, (open) => {
	if (!open) return;
	typed.value = "";
	kind.value = "regular";
	remembered.value = lastModule();
	module.value = remembered.value;
});

const name = computed(() => deriveName(typed.value));
const address = computed(() => `/apps/desk/${slugOf(name.value)}`);
const error = computed(() => {
	if (!name.value) return "";
	if (!/^[A-Za-z]/.test(name.value)) return "A name starts with a letter.";
	if (name.value.length > 61) return "A name has at most 61 characters.";
	const clash = doctypes.find((one) => one.toLowerCase() === name.value.toLowerCase());
	return clash ? `${clash} already exists.` : "";
});
const ready = computed(() => Boolean(name.value && module.value && !error.value));

function start() {
	if (!ready.value) return;
	draft.value = { name: name.value, module: String(module.value), kind: kind.value };
	draftGeneration.value++;
	dialogOpen.value = false;
	void router.push("/doctype/new");
}
</script>
