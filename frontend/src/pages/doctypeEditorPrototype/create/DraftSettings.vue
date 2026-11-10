<!-- PROTOTYPE (#45867), a stub: step 6's Settings for a new DocType, showing the defaults the
     first save uses. Nothing here is asked up front and nothing saves. A child table drops naming
     and permissions (its rows take both from the parent); a Single drops naming (one record). -->
<template>
	<Dialog v-model:open="open" :title="`${name} settings`" size="xl">
		<div class="flex flex-col divide-y divide-outline-gray-1">
			<section v-if="kind === 'child'" class="flex gap-3 pb-5">
				<span class="lucide-table-2 mt-0.5 size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				<p class="text-p-base text-ink-gray-7">
					A child table has no naming or permissions of its own. Its rows are named and permitted
					through the record that holds them.
				</p>
			</section>

			<section v-if="kind !== 'child' && kind !== 'single'" class="flex flex-col gap-3 pb-5">
				<h3 class="text-base-medium text-ink-gray-9">Naming</h3>
				<div class="flex items-center justify-between gap-4">
					<div class="flex flex-col gap-0.5">
						<span class="text-base text-ink-gray-8">Automatic</span>
						<span class="text-sm text-ink-gray-5">Each record gets a short random ID, like <span class="font-mono">8f3k2a91c0</span>.</span>
					</div>
					<Button label="Change" disabled />
				</div>
			</section>

			<section v-if="kind !== 'child'" class="flex flex-col gap-3 py-5" :class="kind === 'single' && '!py-0'">
				<h3 class="text-base-medium text-ink-gray-9">Permissions</h3>
				<div class="overflow-hidden rounded-4 ring-1 ring-outline-gray-2">
					<table class="w-full text-base">
						<thead class="bg-surface-gray-1 text-left text-sm text-ink-gray-5">
							<tr>
								<th class="px-3 py-2 font-normal">Role</th>
								<th v-for="right in rights" :key="right" class="w-[60px] px-1 py-2 text-center font-normal">{{ right }}</th>
							</tr>
						</thead>
						<tbody>
							<tr class="border-t border-outline-gray-1">
								<td class="whitespace-nowrap px-3 py-2 text-ink-gray-8">System Manager</td>
								<td v-for="right in rights" :key="right" class="px-1 py-2 text-center">
									<span class="lucide-check inline-block size-4 align-middle text-ink-gray-7" aria-label="Allowed" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p class="text-sm text-ink-gray-5">Full access for System Manager. Add roles once the form works.</p>
			</section>

			<section v-if="kind !== 'single'" class="flex flex-col gap-3 pt-5">
				<h3 class="text-base-medium text-ink-gray-9">{{ kind === "child" ? "Rows" : "Search and list" }}</h3>
				<dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-base">
					<template v-for="row in defaults" :key="row[0]">
						<dt class="text-ink-gray-5">{{ row[0] }}</dt>
						<dd class="text-ink-gray-8">{{ row[1] }}</dd>
					</template>
				</dl>
			</section>
		</div>
		<template #actions>
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm text-ink-gray-5">Prototype: these are the defaults, shown, not editable.</span>
				<Button variant="solid" label="Done" @click="open = false" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button, Dialog } from "frappe-ui";
import type { Kind } from "./newDoctype";

const props = defineProps<{ name: string; kind: Kind; title: string }>();
const open = defineModel<boolean>("open", { required: true });

const rights = computed(() =>
	props.kind === "submittable"
		? ["Read", "Write", "Create", "Delete", "Submit", "Cancel", "Amend"]
		: props.kind === "single"
			? ["Read", "Write"]
			: ["Read", "Write", "Create", "Delete"]
);

const defaults = computed(() => {
	if (props.kind === "child") return [["Shown in the grid", "The first mandatory fields, up to four"], ["Row form", "This layout"]];
	const rows = [["Title", props.title || "The record's ID"], ["Search by", props.title || "ID"]];
	rows.push(["Sort", "Last updated first"]);
	if (props.kind === "submittable") rows.push(["Amended from", "Added on save, for amendments"]);
	return rows;
});
</script>
