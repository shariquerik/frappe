// PROTOTYPE (#47056), throwaway: every bulk action the bar offers, with fake inputs and fake
// failures. Nothing here calls the server.
import { tweaks } from "./tweaks";

export type ActionGroup = "workflow" | "edit" | "collaborate" | "output" | "app" | "danger";

export interface FieldSpec {
	label: string;
	type: "select" | "text" | "check" | "textarea";
	options?: string[];
	value?: string | boolean;
}

export interface BulkActionSpec {
	name: string;
	label: string;
	icon: string;
	group: ActionGroup;
	/** The past tense for the toast and the result title. */
	done: string;
	/** Asks for input or a confirmation first. */
	fields?: FieldSpec[];
	confirm?: string;
	danger?: boolean;
	/** Runs with no server call, on the rows on screen (Copy). */
	local?: boolean;
	/** The cap it runs under: Print uses Print Settings. */
	cap?: number;
	/** A fake failure for some records, chosen by the record name. */
	failure?: (name: string) => string | null;
}

export const GROUP_LABELS: Record<ActionGroup, string> = {
	workflow: "Workflow",
	edit: "Edit",
	collaborate: "Assign, tag and share",
	output: "Print and export",
	app: "ToDo",
	danger: "Submit, cancel and delete",
};

const USERS = ["Faris Ansari", "Rushabh Mehta", "Suraj Shetty", "Ankush Menat", "Hussain Nagaria"];

function every(n: number, error: string) {
	return (name: string) => (hash(name) % n === 0 ? error : null);
}

export function hash(text: string) {
	let h = 0;
	for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
	return h;
}

export function allActions(): BulkActionSpec[] {
	const actions: BulkActionSpec[] = [];
	if (tweaks.workflow)
		actions.push(
			{
				name: "approve",
				label: "Approve",
				icon: "lucide-check",
				group: "workflow",
				done: "Approved",
				failure: every(7, "Approve is not allowed from the state Approved"),
			},
			{
				name: "reject",
				label: "Reject",
				icon: "lucide-x",
				group: "workflow",
				done: "Rejected",
				failure: every(9, "Reject needs the role Expense Approver"),
			}
		);
	actions.push(
		{
			name: "edit",
			label: "Edit",
			icon: "lucide-pencil",
			group: "edit",
			done: "Updated",
			fields: [
				{ label: "Status", type: "select", options: ["Open", "Closed", "Cancelled"], value: "Open" },
				{ label: "Priority", type: "select", options: ["Low", "Medium", "High"], value: "High" },
				{ label: "Date", type: "text", value: "2026-11-20" },
			],
			failure: every(11, "Document has been modified after you opened it"),
		},
		{
			name: "assign",
			label: "Assign to",
			icon: "lucide-user-plus",
			group: "collaborate",
			done: "Assigned",
			fields: [
				{ label: "Assign to", type: "select", options: USERS, value: USERS[0] },
				{ label: "Comment", type: "textarea", value: "" },
			],
			failure: every(13, "Faris Ansari cannot read this ToDo"),
		},
		{
			name: "clear-assignment",
			label: "Clear assignment",
			icon: "lucide-user-minus",
			group: "collaborate",
			done: "Cleared the assignment of",
		},
		{
			name: "assignment-rule",
			label: "Apply assignment rule",
			icon: "lucide-workflow",
			group: "collaborate",
			done: "Applied the assignment rule to",
			failure: every(6, "No assignment rule matches this record"),
		},
		{
			name: "add-tags",
			label: "Add tags",
			icon: "lucide-tag",
			group: "collaborate",
			done: "Tagged",
			fields: [{ label: "Tags", type: "text", value: "urgent, follow-up" }],
		},
		{
			name: "remove-tags",
			label: "Remove tags",
			icon: "lucide-tag",
			group: "collaborate",
			done: "Removed tags from",
			fields: [{ label: "Tags", type: "text", value: "follow-up" }],
		},
		{
			name: "follow",
			label: "Follow",
			icon: "lucide-bell",
			group: "collaborate",
			done: "Followed",
		},
		{
			name: "share",
			label: "Share",
			icon: "lucide-share-2",
			group: "collaborate",
			done: "Shared",
			fields: [
				{ label: "Share with", type: "select", options: USERS, value: USERS[2] },
				{ label: "Can write", type: "check", value: false },
				{ label: "Can share", type: "check", value: false },
			],
			failure: every(10, "You cannot share a record you cannot share"),
		},
		{
			name: "seen",
			label: "Mark as seen",
			icon: "lucide-eye",
			group: "collaborate",
			done: "Marked as seen",
		},
		{
			name: "unseen",
			label: "Mark as unseen",
			icon: "lucide-eye-off",
			group: "collaborate",
			done: "Marked as unseen",
		},
		{
			name: "print",
			label: "Print",
			icon: "lucide-printer",
			group: "output",
			done: "Printed",
			cap: 100,
			fields: [
				{ label: "Print format", type: "select", options: ["Standard", "ToDo Compact"], value: "Standard" },
				{ label: "Letter head", type: "select", options: ["None", "Frappe Technologies"], value: "None" },
			],
			failure: every(15, "No print permission"),
		},
		{
			name: "export",
			label: "Export",
			icon: "lucide-download",
			group: "output",
			done: "Exported",
			fields: [
				{ label: "File type", type: "select", options: ["Excel", "CSV"], value: "Excel" },
				{ label: "Only the list's columns", type: "check", value: true },
			],
		},
		{
			name: "copy",
			label: "Copy to clipboard",
			icon: "lucide-clipboard",
			group: "output",
			done: "Copied",
			local: true,
		},
		{
			name: "close",
			label: "Close",
			icon: "lucide-circle-check",
			group: "app",
			done: "Closed",
			failure: every(12, "Only the assignee can close this ToDo"),
		},
		{
			name: "reopen",
			label: "Re-open",
			icon: "lucide-rotate-ccw",
			group: "app",
			done: "Re-opened",
		}
	);
	if (tweaks.submittable)
		actions.push(
			{
				name: "submit",
				label: "Submit",
				icon: "lucide-send",
				group: "danger",
				done: "Submitted",
				danger: true,
				confirm: "Submitted records cannot be edited, only cancelled.",
				failure: every(8, "Mandatory field Allocated To is empty"),
			},
			{
				name: "cancel",
				label: "Cancel",
				icon: "lucide-ban",
				group: "danger",
				done: "Cancelled",
				danger: true,
				confirm: "Cancelled records cannot be submitted again; amend them instead.",
				failure: every(5, "Not submitted, so it cannot be cancelled"),
			}
		);
	actions.push({
		name: "delete",
		label: "Delete",
		icon: "lucide-trash-2",
		group: "danger",
		done: "Deleted",
		danger: true,
		confirm: "This cannot be undone.",
		failure: every(9, "Linked with Sales Invoice ACC-SINV-2026-00012"),
	});
	return actions;
}
