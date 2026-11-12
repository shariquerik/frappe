<!-- PROTOTYPE (#47098), throwaway: Permissions, a grid of roles by rights. Read, Write, Create and
     Delete (Submit, Cancel, Amend on a submittable DocType; Read and Write on a Single), then a
     "More" count opening the rest. A right ticks what it needs; unticking a need unticks what needs
     it. A level > 0 rule wears a "Level 1" badge and cannot create or submit. Customize edits the
     site's own rules (Custom DocPerm): the first edit copies the app's, which they then replace;
     Design, on a DocType the site overrides, says so and links to Customize. -->
<template>
	<div ref="root" v-show="shown" class="flex flex-col gap-3 pt-1" data-settings-permissions>
		<div v-if="ui.customizing" class="flex min-h-7 items-center gap-3">
			<Badge :label="ui.siteRules ? 'Site permissions' : 'App permissions'" theme="gray" data-perm-source />
			<p class="min-w-0 flex-1 text-p-sm text-ink-gray-5">
				<template v-if="ui.perms.copied">Your change copied {{ ui.app }}'s {{ ui.perms.app.length }} rules here. This site's rules now replace the app's for {{ ui.doctype }}.</template>
				<template v-else-if="ui.siteRules">This site's rules replace {{ ui.app }}'s for {{ ui.doctype }}.</template>
				<template v-else>{{ ui.app }}'s rules. Your first change copies them, and the site's copy replaces them.</template>
			</p>
			<Button v-if="ui.siteRules" label="Reset to app permissions" icon-left="lucide-rotate-ccw" @click="ui.resetPerms()" />
		</div>
		<p v-else-if="ui.perms.siteAtLoad" class="text-p-sm text-ink-gray-6" data-site-override>
			This site uses its own permissions for {{ ui.doctype }}.
			<button v-if="canCustomize" type="button" class="text-ink-gray-8 underline decoration-outline-gray-3 underline-offset-2 hover:decoration-ink-gray-5" @click="$emit('customize')">Edit them in Customize.</button>
			<template v-else>Edit them in Customize.</template>
		</p>

		<div class="overflow-hidden rounded-6 ring-1 ring-outline-gray-2">
			<table class="w-full table-fixed text-base">
				<thead class="bg-surface-gray-1 text-sm text-ink-gray-5">
					<tr>
						<th class="px-3 py-2 text-left font-normal">Role</th>
						<th v-for="right in ui.columns" :key="right" class="w-[52px] px-1 py-2 text-center font-normal">{{ RIGHT_LABELS[right] }}</th>
						<th class="w-[56px] px-1 py-2 text-center font-normal">More</th>
						<th class="w-[40px]" aria-label="Actions" />
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in ui.rows" :key="row.id" class="border-t border-outline-gray-1" :data-perm-role="row.role">
						<td class="px-3 py-1.5">
							<div class="flex min-w-0 items-center gap-2">
								<span class="truncate text-ink-gray-8">{{ row.role }}</span>
								<Badge v-if="row.permlevel" :label="`Level ${row.permlevel}`" theme="gray" size="sm" class="shrink-0" />
								<Tooltip v-if="row.if_owner" text="Only the records this role's people created.">
									<Badge label="Only if creator" theme="gray" size="sm" class="shrink-0" />
								</Tooltip>
							</div>
						</td>
						<td v-for="right in ui.columns" :key="right" class="px-1 py-1.5">
							<div class="flex justify-center">
								<Tooltip :text="ui.refuse(row, right)" :disabled="!ui.refuse(row, right)">
									<span class="inline-flex">
										<Checkbox
											:model-value="Boolean(row[right])"
											:disabled="Boolean(ui.refuse(row, right))"
											:aria-label="`${row.role}: ${RIGHT_LABELS[right]}`"
											@update:model-value="ui.toggle(row, right, Boolean($event))"
										/>
									</span>
								</Tooltip>
							</div>
						</td>
						<td class="px-1 py-1.5 text-center">
							<!-- A level > 0 rule only reads and writes its fields: no more rights to give. -->
							<span v-if="row.permlevel" class="text-ink-gray-4" aria-label="No more rights at this level">—</span>
							<Popover v-else side="bottom" align="end">
								<template #trigger>
									<Button variant="ghost" size="sm" :label="moreLabel(row)" :aria-label="`More rights for ${row.role}`" data-perm-more />
								</template>
								<div class="flex w-[200px] flex-col p-1" data-perm-more-popover>
									<p class="px-1.5 pb-1 pt-1 text-sm text-ink-gray-5">{{ row.role }}{{ row.permlevel ? `, level ${row.permlevel}` : "" }}</p>
									<Checkbox
										v-for="right in ui.more"
										:key="right"
										padded
										:title="HELP[right]"
										:label="RIGHT_LABELS[right]"
										:description="ui.refuse(row, right) || undefined"
										:disabled="Boolean(ui.refuse(row, right))"
										:model-value="Boolean(row[right])"
										@update:model-value="ui.toggle(row, right, Boolean($event))"
									/>
								</div>
							</Popover>
						</td>
						<td class="py-1.5 pr-1.5 text-right">
							<Dropdown :options="rowMenu(row)" side="bottom" align="end">
								<Button variant="ghost" size="sm" icon="lucide-ellipsis" :label="`Actions for ${row.role}`" />
							</Dropdown>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div>
			<Combobox :key="ui.rows.length" class="w-[200px]" variant="subtle" :model-value="''" :options="roleOptions" placeholder="Add a role" @update:model-value="$event && ui.addRole(String($event))">
				<template #prefix><span class="lucide-plus size-4 text-ink-gray-5" aria-hidden="true" /></template>
			</Combobox>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Badge, Button, Checkbox, Combobox, Dropdown, Popover, Tooltip } from "frappe-ui";
import { RIGHT_LABELS, RIGHTS, SettingsKey, useSearchable, type PermRow, type Right } from "./settings";

defineProps<{ canCustomize?: boolean }>();
defineEmits<{ customize: [] }>();
const ui = inject(SettingsKey)!;

const HELP: Partial<Record<Right, string>> = {
	select: "Pick it in a Link field, without opening it.",
	report: "Open the report view.",
	export: "Download records as a spreadsheet.",
	import: "Bring records in from a spreadsheet.",
	print: "Print and make PDFs.",
	email: "Send a record by email.",
	share: "Share a record with another person.",
	if_owner: "Only the records they created.",
};

// The grid is one searchable block: the section, its rights and the roles in it.
const root = ref<HTMLElement | null>(null);
const shown = useSearchable(() => ["permissions permission rules role roles rights access level custom docperm", ...RIGHTS.map((one) => RIGHT_LABELS[one]), ...ui.rows.map((one) => one.role)].join(" "), () => "Roles and rights", () => root.value);
const moreLabel = (row: PermRow) => {
	const on = ui.more.filter((right) => row[right]).length;
	return on ? `+${on}` : "None";
};
const rowMenu = (row: PermRow) => [
	{
		label: "Remove",
		icon: "lucide-trash-2",
		disabled: ui.rows.length === 1,
		description: ui.rows.length === 1 ? "A DocType needs at least one rule." : undefined,
		onClick: () => ui.removeRow(row),
	},
];
// A role takes one level-0 rule; levels above 0 are added on the role's own rule.
const roleOptions = computed(() => {
	const taken = new Set(ui.rows.filter((one) => !one.permlevel).map((one) => one.role));
	return ui.loaded.roles.filter((one) => !taken.has(one));
});
</script>
