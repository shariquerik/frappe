// PROTOTYPE (#47056): the words a run shows while it runs and after.
import type { Run } from "./store";

const RUNNING: Record<string, string> = {
	delete: "Deleting",
	submit: "Submitting",
	cancel: "Cancelling",
	approve: "Approving",
	reject: "Rejecting",
	print: "Making the PDF for",
	export: "Exporting",
};

export function headingOf(run: Run) {
	if (run.state === "running") {
		const verb = RUNNING[run.action.name] ?? `${run.action.label}:`;
		return `${verb} ${run.processed} of ${run.total}`;
	}
	if (run.state === "stopped") return `${run.action.label} stopped after ${run.processed} of ${run.total}`;
	return `${run.action.label} finished`;
}
