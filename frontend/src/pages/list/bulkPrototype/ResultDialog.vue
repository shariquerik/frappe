<!-- PROTOTYPE (#47056): a run's result. The counts, then the records per outcome, each failure with
     its reason; "Retry failed" posts the failed names again. -->
<template>
	<Dialog
		:modelValue="!!run"
		size="2xl"
		:title="run ? `${run.action.label} · ${run.total} records` : ''"
		@update:modelValue="(open: boolean) => !open && (shownResult = null)"
	>
		<template v-if="run" #default>
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between gap-3">
					<RunCounts :run="run" />
					<span class="truncate text-sm text-ink-gray-5">{{ run.scope }}</span>
				</div>
				<Progress v-if="run.state === 'running'" :value="percent" size="sm" />
				<TabButtons v-model="tab" :options="tabs" />
				<div class="-mx-2 flex max-h-80 flex-col overflow-y-auto">
					<ItemListRow v-for="outcome in shown" :key="outcome.name" size="md" class="shrink-0 !items-start">
						<template #prefix>
							<Icon :name="iconOf(outcome.status)" class="mt-0.5 size-4 shrink-0 text-ink-gray-5" />
						</template>
						<template #label>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<div class="flex min-w-0 items-baseline gap-2">
									<RouterLink
										:to="`/apps/desk/todo/${outcome.name}`"
										class="truncate text-ink-gray-8 hover:underline"
									>
										{{ outcome.title }}
									</RouterLink>
									<span class="ms-auto shrink-0 font-mono text-sm text-ink-gray-5">
										{{ outcome.name }}
									</span>
								</div>
								<span v-if="outcome.error" class="text-sm text-ink-gray-6">
									{{ outcome.error }}
								</span>
								<span v-else-if="outcome.status === 'queued'" class="text-sm text-ink-gray-6">
									In the Submission Queue; the outcome lands here when it runs
								</span>
							</div>
						</template>
					</ItemListRow>
					<div v-if="!shown.length" class="py-6 text-center text-base text-ink-gray-5">
						Nothing here
					</div>
				</div>
			</div>
		</template>
		<template v-if="run" #actions>
			<div class="flex items-center gap-2">
				<Button v-if="fileLabel && done" :label="fileLabel" icon-left="lucide-download" />
				<div class="ms-auto flex items-center gap-2">
					<Button v-if="failed" label="Select failed" @click="selectFailed(run)" />
					<Button
						v-if="failed"
						variant="solid"
						label="Retry failed"
						:disabled="run.state === 'running'"
						@click="retry"
					/>
					<Button v-else variant="solid" label="Done" @click="dismiss(run)" />
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog, Icon, ItemListRow, Progress, TabButtons } from "frappe-ui";
import { computed, ref, watch } from "vue";
import RunCounts from "./RunCounts.vue";
import { dismiss, retryFailed, runs, selectFailed, shownResult, type Outcome } from "./store";

const run = computed(() => runs.find((r) => r.id === shownResult.value) ?? null);
const tab = ref<Outcome["status"]>("failed");

const by = (status: Outcome["status"]) =>
	run.value?.outcomes.filter((o) => o.status === status) ?? [];
const done = computed(() => by("done").length);
const failed = computed(() => by("failed").length);
const queued = computed(() => by("queued").length);
const percent = computed(() =>
	run.value ? Math.round((run.value.processed / run.value.total) * 100) : 0
);

const tabs = computed(() => [
	{ value: "failed", label: `Failed ${failed.value}` },
	...(queued.value || run.value?.action.name === "submit"
		? [{ value: "queued", label: `Queued ${queued.value}` }]
		: []),
	{ value: "done", label: `Done ${done.value}` },
]);

const shown = computed(() => by(tab.value));

const fileLabel = computed(() =>
	run.value?.action.name === "print"
		? "Download PDF"
		: run.value?.action.name === "export"
			? "Download file"
			: ""
);

watch(shownResult, () => {
	tab.value = failed.value ? "failed" : queued.value ? "queued" : "done";
});

function iconOf(status: Outcome["status"]) {
	return status === "failed"
		? "lucide-circle-x"
		: status === "queued"
			? "lucide-clock"
			: "lucide-circle-check";
}

function retry() {
	const current = run.value!;
	dismiss(current);
	retryFailed(current);
}
</script>
