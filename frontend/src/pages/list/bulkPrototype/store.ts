// PROTOTYPE (#47056), throwaway: the bulk state a list or cards view shares with the bar, the
// select-all strip, the runs and the result panel. Every run is faked in the browser: a record
// takes ~90 ms, some fail by name, and Submit on a queued doctype answers "queued" first.
import { listDocuments } from "@framework/ui/api";
import { toast } from "frappe-ui";
import { computed, reactive, ref, shallowRef, watch, type Ref } from "vue";
import { allActions, hash, type BulkActionSpec } from "./actions";
import { tweaks } from "./tweaks";

export const CAP = 500;
export const THRESHOLD = 20;
const BIG_TOTAL = 1240;

export interface BulkRow {
	name: string;
	[key: string]: unknown;
}

export interface BulkHost {
	doctype: string;
	selection: Ref<string[]>;
	rows: Ref<BulkRow[]>;
	total: Ref<number | null>;
	filters: () => Record<string, unknown>;
	filterLabel: () => string;
}

export interface Outcome {
	name: string;
	title: string;
	status: "done" | "failed" | "queued";
	error?: string;
}

export interface Run {
	id: number;
	action: BulkActionSpec;
	scope: string;
	total: number;
	processed: number;
	outcomes: Outcome[];
	state: "running" | "finished" | "stopped";
	background: boolean;
	retryOf?: number;
}

export const host = shallowRef<BulkHost | null>(null);
/** The selection reaches past the page: every record the filter matches. */
export const allMatching = ref(false);
export const runs = reactive<Run[]>([]);
export const shownResult = ref<number | null>(null);
/** The action whose dialog is open. */
export const asking = shallowRef<BulkActionSpec | null>(null);
/** Bumped by the `.` key: the bar opens its menu. */
export const menuKey = ref(0);

export const actions = computed(() => allActions());

export const pageCount = computed(() => host.value?.selection.value.length ?? 0);

export const matchingTotal = computed(() =>
	tweaks.big ? BIG_TOTAL : host.value?.total.value ?? host.value?.rows.value.length ?? 0
);

export const count = computed(() => (allMatching.value ? matchingTotal.value : pageCount.value));

/** Every shown row is selected and the filter matches more than are shown. */
export const canSelectAllMatching = computed(() => {
	const current = host.value;
	if (!current || allMatching.value) return false;
	const shown = current.rows.value.length;
	return shown > 0 && pageCount.value === shown && matchingTotal.value > shown;
});

export function capOf(action: BulkActionSpec) {
	return action.cap ?? CAP;
}

export function overCap(action: BulkActionSpec) {
	return !action.local && count.value > capOf(action);
}

export function bindHost(next: BulkHost) {
	host.value = next;
	allMatching.value = false;
	// Any change to the selection drops "all matching": it was the whole page, now it is not.
	watch(next.selection, (names) => {
		if (names.length !== next.rows.value.length) allMatching.value = false;
	});
}

export function clearSelection() {
	allMatching.value = false;
	if (host.value) host.value.selection.value = [];
}

export function selectAllMatching() {
	allMatching.value = true;
}

export function choose(action: BulkActionSpec) {
	if (overCap(action)) return;
	if (action.local) return copyRows();
	if (action.fields || action.confirm) asking.value = action;
	else void start(action);
}

export function scopeText() {
	const current = host.value;
	if (!current) return "";
	return allMatching.value
		? `all ${matchingTotal.value.toLocaleString()} matching ${current.filterLabel()}`
		: `${pageCount.value} selected`;
}

async function targets(): Promise<{ name: string; title: string }[]> {
	const current = host.value!;
	if (!allMatching.value) {
		const byName = new Map(current.rows.value.map((row) => [row.name, row]));
		return current.selection.value.map((name) => ({
			name,
			title: titleOf(byName.get(name) ?? { name }),
		}));
	}
	const answer = await listDocuments<BulkRow>(current.doctype, {
		filters: current.filters(),
		fields: ["name", "description"],
		limit: CAP,
	} as never);
	return answer.data.map((row) => ({ name: row.name, title: titleOf(row) }));
}

export function titleOf(row: BulkRow) {
	const text = String(row.description ?? row.title ?? row.subject ?? row.name);
	return text.replace(/<[^>]*>/g, "").trim() || row.name;
}

let nextId = 1;

export async function start(action: BulkActionSpec, retry?: Run) {
	const list = retry
		? retry.outcomes.filter((o) => o.status === "failed").map(({ name, title }) => ({ name, title }))
		: await targets();
	const run = reactive<Run>({
		id: nextId++,
		action,
		scope: retry ? `${list.length} failed from the last run` : scopeText(),
		total: list.length,
		processed: 0,
		outcomes: [],
		state: "running",
		background: list.length > THRESHOLD,
		retryOf: retry?.id,
	}) as Run;
	runs.unshift(run);
	if (!retry) clearSelection();
	shownResult.value = null;

	const perRecord = run.background ? 90 : 25;
	for (const target of list) {
		await wait(perRecord);
		if (run.state === "stopped") break;
		run.outcomes.push(outcomeOf(action, target, !!retry));
		run.processed++;
	}
	if (run.state !== "stopped") run.state = "finished";
	settleQueued(run);
	report(run);
}

function outcomeOf(action: BulkActionSpec, target: { name: string; title: string }, retried: boolean): Outcome {
	const error = action.failure?.(target.name);
	// A retry clears the passing failures (a modified record, a lock); a rule failure stays.
	if (error && !(retried && hash(target.name) % 2 === 0))
		return { ...target, status: "failed", error };
	if (action.name === "submit" && tweaks.queued) return { ...target, status: "queued" };
	return { ...target, status: "done" };
}

// A queued submit settles later, one record at a time, as the Submission Queue works.
async function settleQueued(run: Run) {
	for (const outcome of run.outcomes) {
		if (outcome.status !== "queued") continue;
		await wait(700);
		if (hash(outcome.name) % 12 === 1) {
			outcome.status = "failed";
			outcome.error = "Submission failed in the queue: Allocated To is not set";
		} else outcome.status = "done";
	}
}

function report(run: Run) {
	const failed = run.outcomes.filter((o) => o.status === "failed").length;
	const done = run.outcomes.filter((o) => o.status === "done").length;
	if (!run.background && failed) {
		shownResult.value = run.id;
		return;
	}
	if (run.background) return;
	toast.success(`${run.action.done} ${done} record${done === 1 ? "" : "s"}`);
	runs.splice(runs.indexOf(run), 1);
}

export function stop(run: Run) {
	run.state = "stopped";
}

export function dismiss(run: Run) {
	runs.splice(runs.indexOf(run), 1);
	if (shownResult.value === run.id) shownResult.value = null;
}

export function retryFailed(run: Run) {
	void start(run.action, run);
}

export function selectFailed(run: Run) {
	const current = host.value;
	if (!current) return;
	const shown = new Set(current.rows.value.map((row) => row.name));
	current.selection.value = run.outcomes
		.filter((o) => o.status === "failed" && shown.has(o.name))
		.map((o) => o.name);
	shownResult.value = null;
}

function copyRows() {
	const current = host.value!;
	const picked = new Set(current.selection.value);
	const rows = current.rows.value.filter((row) => allMatching.value || picked.has(row.name));
	void navigator.clipboard?.writeText(rows.map((row) => `${row.name}\t${titleOf(row)}`).join("\n"));
	toast.success(`Copied ${rows.length} rows`, {
		description: allMatching.value ? "All matching rows, read once from the server" : undefined,
	});
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
