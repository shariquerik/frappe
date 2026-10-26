// PROTOTYPE: one draft per binding, read fresh on pane open. Saves are STUBBED: nothing is
// written to the server. A value containing "fail" is refused, to show the error state.

import { computed, reactive, type ComputedRef } from "vue";
import { getDocument } from "@framework/ui/api";
import { useDoctypeMeta } from "@framework/ui/composables/useDoctypeMeta";
import type { RawMetaField } from "@framework/ui/components/FormLayout/types";
import type { BindingSpec, BlockSpec, PaneSpec } from "./panes";
import { dataFields } from "./rows";

export interface BindingState {
	identity: string;
	doctype: string;
	name: string;
	single: boolean;
	doc: Record<string, any>;
	saved: Record<string, any>;
	loading: boolean;
	error: string;
	isNew: boolean;
	fieldErrors: Record<string, string>;
	/** Unwrapped by `reactive`: the meta's raw fields. */
	meta: RawMetaField[];
}

export type BlockStatus = "idle" | "saving" | "saved" | "error";

export interface BlockState {
	status: BlockStatus;
	message: string;
}

export interface PaneState {
	blocks: Record<string, BlockState>;
	bindingOf: (block: BlockSpec) => BindingState | undefined;
	namedBindings: (block: BlockSpec) => Record<string, BindingState>;
	fieldsOf: (block: BlockSpec) => string[];
	dirtyFields: (block: BlockSpec) => string[];
	/** Called when a control's value is final: an auto block saves it. */
	commit: (block: BlockSpec, fieldnames: string[]) => void;
	/** The Save bar: every button block's changes. */
	saveButtons: () => Promise<void>;
	discardButtons: () => void;
	buttonDirtyCount: ComputedRef<number>;
	buttonErrorCount: ComputedRef<number>;
	hasButtonBlocks: boolean;
	saving: ComputedRef<boolean>;
}

const SAVE_DELAY = 600;
const SAVED_MARK_FOR = 2500;

export function openPane(pane: PaneSpec, sessionUser: string): PaneState {
	const bindings = new Map<string, BindingState>();
	const blocks = reactive<Record<string, BlockState>>({});

	for (const block of pane.blocks) {
		blocks[block.key] = { status: "idle", message: "" };
		for (const spec of specsOf(block)) {
			const name = resolveName(spec, sessionUser);
			const identity = `${spec.doctype}/${name}`;
			if (!bindings.has(identity)) bindings.set(identity, load(spec, name, identity));
		}
	}

	const bindingOf = (block: BlockSpec) =>
		block.binding ? bindings.get(identityOf(block.binding, sessionUser)) : undefined;

	const namedBindings = (block: BlockSpec) =>
		Object.fromEntries(
			Object.entries(block.bindings ?? {}).map(([key, spec]) => [
				key,
				bindings.get(identityOf(spec, sessionUser))!,
			])
		);

	function fieldsOf(block: BlockSpec): string[] {
		if (block.fields?.length) return block.fields;
		const binding = bindingOf(block);
		return binding ? dataFields(binding.meta) : [];
	}

	function dirtyFields(block: BlockSpec): string[] {
		const pairs: [BindingState, string[]][] = block.binding
			? [[bindingOf(block)!, fieldsOf(block)]]
			: Object.values(namedBindings(block)).map((binding) => [
					binding,
					Object.keys(binding.doc),
			  ]);
		return pairs.flatMap(([binding, fields]) =>
			fields.filter((field) => !same(binding.doc[field], binding.saved[field]))
		);
	}

	function commit(block: BlockSpec, fieldnames: string[]) {
		if (block.save !== "auto") return;
		const changed = fieldnames.filter((field) => dirtyFields(block).includes(field));
		if (changed.length) save(block, changed);
	}

	async function save(block: BlockSpec, fieldnames: string[]) {
		const binding = bindingOf(block) ?? Object.values(namedBindings(block))[0];
		const state = blocks[block.key];
		state.status = "saving";
		await new Promise((resolve) => setTimeout(resolve, SAVE_DELAY));

		const refused = fieldnames.filter((field) =>
			String(binding.doc[field] ?? "")
				.toLowerCase()
				.includes("fail")
		);
		for (const field of fieldnames) delete binding.fieldErrors[field];
		if (refused.length) {
			for (const field of refused)
				binding.fieldErrors[field] = `The server refused this value (prototype: "fail").`;
			state.status = "error";
			state.message = `${refused.length} field${refused.length > 1 ? "s" : ""} not saved`;
			return;
		}
		for (const field of fieldnames) binding.saved[field] = clone(binding.doc[field]);
		binding.isNew = false;
		state.status = "saved";
		state.message = "";
		setTimeout(() => {
			if (state.status === "saved") state.status = "idle";
		}, SAVED_MARK_FOR);
	}

	const buttonBlocks = pane.blocks.filter((block) => block.save === "button");

	async function saveButtons() {
		await Promise.all(
			buttonBlocks
				.map((block) => [block, dirtyFields(block)] as const)
				.filter(([, fields]) => fields.length)
				.map(([block, fields]) => save(block, fields))
		);
	}

	function discardButtons() {
		for (const block of buttonBlocks) {
			const binding = bindingOf(block)!;
			for (const field of dirtyFields(block)) {
				binding.doc[field] = clone(binding.saved[field]);
				delete binding.fieldErrors[field];
			}
			blocks[block.key].status = "idle";
		}
	}

	return {
		blocks,
		bindingOf,
		namedBindings,
		fieldsOf,
		dirtyFields,
		commit,
		saveButtons,
		discardButtons,
		buttonDirtyCount: computed(() =>
			buttonBlocks.reduce((count, block) => count + dirtyFields(block).length, 0)
		),
		buttonErrorCount: computed(
			() => buttonBlocks.filter((block) => blocks[block.key].status === "error").length
		),
		hasButtonBlocks: buttonBlocks.length > 0,
		saving: computed(() => Object.values(blocks).some((block) => block.status === "saving")),
	};
}

function specsOf(block: BlockSpec): BindingSpec[] {
	return [...(block.binding ? [block.binding] : []), ...Object.values(block.bindings ?? {})];
}

function resolveName(spec: BindingSpec, sessionUser: string): string {
	return spec.type === "Single" ? spec.doctype : sessionUser;
}

function identityOf(spec: BindingSpec, sessionUser: string): string {
	return `${spec.doctype}/${resolveName(spec, sessionUser)}`;
}

function load(spec: BindingSpec, name: string, identity: string): BindingState {
	const { meta } = useDoctypeMeta(spec.doctype);
	const binding = reactive({
		identity,
		doctype: spec.doctype,
		name,
		single: spec.type === "Single",
		doc: {},
		saved: {},
		loading: true,
		error: "",
		isNew: false,
		fieldErrors: {},
		meta: computed(() => (meta.value?.fields ?? []) as RawMetaField[]),
	}) as unknown as BindingState;

	getDocument(spec.doctype, name)
		.then(({ data }) => {
			binding.saved = clone(data);
			binding.doc = clone(data);
		})
		.catch((error) => {
			if (error?.status === 404) {
				binding.isNew = true;
				binding.saved = { user: name };
				binding.doc = { user: name };
			} else binding.error = error?.message ?? String(error);
		})
		.finally(() => (binding.loading = false));
	return binding;
}

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function clone<T>(value: T): T {
	return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
