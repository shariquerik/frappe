<!-- PROTOTYPE (#45867), a stub: the DocType's naming, flags and permissions, behind the
     header's "Settings". Only enough to show where they live; the values are read, not saved. -->
<template>
	<Dialog v-model:open="open" :title="`${meta?.name} settings`" size="2xl">
		<div class="flex min-h-[380px] gap-6">
			<nav class="flex w-[148px] shrink-0 flex-col gap-0.5">
				<button
					v-for="one in TABS"
					:key="one.key"
					type="button"
					class="flex h-8 items-center gap-2 rounded-3 px-2 text-base"
					:class="tab === one.key ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-6 hover:bg-surface-gray-2'"
					@click="tab = one.key"
				>
					<span class="size-4 shrink-0" :class="one.icon" aria-hidden="true" /> {{ one.label }}
				</button>
			</nav>
			<div class="min-w-0 flex-1">
				<div v-if="tab === 'naming'" class="flex flex-col gap-4">
					<FormControl type="select" label="Naming rule" :model-value="meta?.naming_rule || 'Random'" :options="NAMING" />
					<FormControl label="Auto name" :model-value="meta?.autoname" placeholder="naming_series:" class="[&_input]:font-mono" />
					<FormControl type="select" label="Title field" :model-value="meta?.title_field" :options="fieldOptions" />
					<FormControl label="Search fields" :model-value="meta?.search_fields" />
					<div class="flex gap-3">
						<FormControl type="select" label="Sort by" class="flex-1" :model-value="meta?.sort_field || 'creation'" :options="['creation', 'modified', ...fieldnames]" />
						<FormControl type="select" label="Order" class="w-[120px]" :model-value="meta?.sort_order || 'DESC'" :options="['DESC', 'ASC']" />
					</div>
				</div>
				<div v-else-if="tab === 'flags'" class="flex flex-col items-start gap-3">
					<FormControl v-for="flag in FLAGS" :key="flag.key" type="checkbox" :label="flag.label" :model-value="Boolean(meta?.[flag.key])" :disabled="mode === 'customize' && flag.locked" />
					<p v-if="mode === 'customize'" class="text-sm text-ink-gray-5">Customize can change only the flags a site may change.</p>
				</div>
				<div v-else class="overflow-hidden rounded-4 ring-1 ring-outline-gray-2">
					<table class="w-full text-base">
						<thead class="bg-surface-gray-1 text-left text-sm text-ink-gray-5">
							<tr>
								<th class="px-3 py-2 font-normal">Role</th>
								<th v-for="right in RIGHTS" :key="right" class="w-[60px] px-1 py-2 text-center font-normal">{{ right }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="perm in perms" :key="perm.role + perm.permlevel" class="border-t border-outline-gray-1">
								<td class="whitespace-nowrap px-3 py-2 text-ink-gray-8">{{ perm.role }}<span v-if="perm.permlevel" class="text-ink-gray-5"> · level {{ perm.permlevel }}</span></td>
								<td v-for="right in RIGHTS" :key="right" class="px-1 py-2 text-center">
									<span v-if="perm[right.toLowerCase()]" class="lucide-check inline-block size-4 text-ink-gray-7" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<template #actions>
			<div class="flex justify-end">
				<Button variant="solid" label="Done" @click="open = false" />
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, Dialog, FormControl } from "frappe-ui";

const props = defineProps<{ meta: any; mode: "design" | "customize" }>();
const open = defineModel<boolean>("open", { required: true });

const TABS = [
	{ key: "naming", label: "Naming", icon: "lucide-tag" },
	{ key: "flags", label: "Flags", icon: "lucide-flag" },
	{ key: "permissions", label: "Permissions", icon: "lucide-shield" },
];
const NAMING = ["Set by user", "Autoincrement", "By fieldname", 'By "Naming Series" field', "Expression", "Random", "By script"];
const FLAGS = [
	{ key: "istable", label: "Is child table", locked: true },
	{ key: "issingle", label: "Single", locked: true },
	{ key: "is_submittable", label: "Submittable", locked: true },
	{ key: "is_tree", label: "Tree", locked: true },
	{ key: "track_changes", label: "Track changes" },
	{ key: "quick_entry", label: "Quick entry" },
];
const RIGHTS = ["Read", "Write", "Create", "Delete", "Submit"];
const tab = ref("naming");

const fieldnames = computed<string[]>(() => (props.meta?.fields ?? []).map((field: any) => field.fieldname));
const fieldOptions = computed(() => ["", ...fieldnames.value]);
const perms = computed<any[]>(() => props.meta?.permissions ?? []);
</script>
