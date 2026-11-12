// PROTOTYPE (#47100), throwaway: a field's conditions (`depends_on`, `mandatory_depends_on`,
// `read_only_depends_on`, a section's `collapsible_depends_on`) and a Link's `link_filters`, read
// into ui's ConditionBuilder tree and written back. Conditions are JavaScript (`eval:` with `doc`
// and `parent`) or a bare fieldname; the parser reads the simple subset (74% of the 2078 `eval:`
// conditions in the 7 apps on desk.localhost, plus 6% that need nested groups) and refuses the
// rest, which then stays as code, untouched. Nothing rewrites a stored condition until it is edited.
import type { ConditionField, ConditionGroup, ConditionNode, FieldConditionValue } from "@framework/ui/ConditionBuilder";
import type { LayoutTree } from "@/recordPage/formLayoutSource/types";
import type { EditorField } from "../editor";

export type Tree = ConditionGroup<FieldConditionValue>;
type Leaf = FieldConditionValue;

/** The two "fields" every record has: `doc.__islocal` (127 real uses) and `doc.docstatus` (80). */
export const RECORD_NEW = "__islocal";
export const DOCSTATUS = "docstatus";
const DOCSTATUS_LABELS = ["Draft", "Submitted", "Cancelled"];
/** A field-of-this-record value, in the conditions and in link_filters alike (`eval:doc.company`). */
export const REF = "eval:";

const NUMERIC = new Set(["Int", "Float", "Currency", "Percent", "Rating"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Image", "Fold"]);
/** The types ui's operator table knows; the rest read as text. */
const KNOWN = new Set(["Data", "Long Text", "Small Text", "Text Editor", "Text", "Float", "Int", "Currency", "Percent", "Select", "Autocomplete", "Link", "Dynamic Link", "Check", "Duration", "Date", "Datetime", "Rating"]);

/** What a condition may name: this DocType's fields, its parent's on a child row, and the record's own. */
export interface ConditionScope {
	fields: ConditionField[];
	/** Table fields, offered as "has rows" (a Check), written `doc.items.length`. */
	tables: Set<string>;
}

export function conditionScope(own: EditorField[], options: { parent?: EditorField[]; submittable?: boolean } = {}): ConditionScope {
	const tables = new Set<string>();
	const fields: ConditionField[] = [];
	const add = (one: EditorField, prefix = "") => {
		if (NO_VALUE.has(one.fieldtype) || !one.fieldname) return;
		const fieldname = `${prefix}${one.fieldname}`;
		const label = `${prefix ? "Parent: " : ""}${one.label || one.fieldname}`;
		if (TABLES.has(one.fieldtype)) {
			tables.add(fieldname);
			fields.push({ label: `${label} (has rows)`, value: fieldname, fieldname, fieldtype: "Check" });
			return;
		}
		const fieldtype = KNOWN.has(one.fieldtype) ? one.fieldtype : "Data";
		fields.push({ label, value: fieldname, fieldname, fieldtype, options: fieldtype === "Link" || fieldtype === "Select" ? one.options : undefined });
	};
	for (const one of own) add(one);
	for (const one of options.parent ?? []) add(one, "parent.");
	fields.push({ label: "Record is new", value: RECORD_NEW, fieldname: RECORD_NEW, fieldtype: "Check" });
	if (options.submittable) fields.push({ label: "Document status", value: DOCSTATUS, fieldname: DOCSTATUS, fieldtype: "Select", options: DOCSTATUS_LABELS.join("\n") });
	return { fields, tables };
}

// ---------------------------------------------------------------- reading

type Token = { t: "id" | "num" | "str" | "op"; v: string };
const OPS = ["===", "!==", "==", "!=", "<=", ">=", "&&", "||", "<", ">", "!", "(", ")", "[", "]", ",", ".", "-"];

function tokenize(src: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < src.length) {
		const rest = src.slice(i);
		const space = /^\s+/.exec(rest);
		if (space) {
			i += space[0].length;
			continue;
		}
		const id = /^[A-Za-z_$][\w$]*/.exec(rest);
		if (id) {
			out.push({ t: "id", v: id[0] });
			i += id[0].length;
			continue;
		}
		const num = /^\d+(\.\d+)?/.exec(rest);
		if (num) {
			out.push({ t: "num", v: num[0] });
			i += num[0].length;
			continue;
		}
		if (rest[0] === "'" || rest[0] === '"') {
			let j = 1;
			let text = "";
			while (j < rest.length && rest[j] !== rest[0]) {
				if (rest[j] === "\\") j++;
				text += rest[j++];
			}
			if (j >= rest.length) throw new Error("unterminated string");
			out.push({ t: "str", v: text });
			i += j + 1;
			continue;
		}
		const op = OPS.find((one) => rest.startsWith(one));
		if (!op) throw new Error(`cannot read ${rest[0]}`);
		out.push({ t: "op", v: op });
		i += op.length;
	}
	return out;
}

type Operand =
	| { kind: "ref"; name: string; length: boolean }
	| { kind: "lit"; value: string | number | boolean | null }
	| { kind: "arr"; items: (string | number)[] }
	| { kind: "node"; node: ConditionNode };

class Parser {
	private at = 0;
	private tokens: Token[];
	private scope: ConditionScope;
	constructor(tokens: Token[], scope: ConditionScope) {
		this.tokens = tokens;
		this.scope = scope;
	}

	parse(): ConditionNode {
		const node = this.or();
		if (this.at < this.tokens.length) throw new Error("trailing tokens");
		return node;
	}

	private peek(v?: string, offset = 0) {
		const token = this.tokens[this.at + offset];
		return token && (v === undefined || token.v === v) ? token : undefined;
	}
	private take(v?: string) {
		const token = this.tokens[this.at];
		if (!token || (v !== undefined && token.v !== v)) throw new Error(`expected ${v}`);
		this.at++;
		return token;
	}

	private or(): ConditionNode {
		return this.chain("||", "or", () => this.and());
	}
	private and(): ConditionNode {
		return this.chain("&&", "and", () => this.unary());
	}
	private chain(op: string, conjunction: "and" | "or", next: () => ConditionNode): ConditionNode {
		const parts = [next()];
		while (this.peek(op)?.t === "op") {
			this.take();
			parts.push(next());
		}
		if (parts.length === 1) return parts[0];
		// `a && (b && c)` is `a && b && c`: one group, one operator.
		const conditions = parts.flatMap((one) => (isTree(one) && one.conjunction === conjunction ? one.conditions : [one]));
		return { conjunction, conditions };
	}

	private unary(): ConditionNode {
		if (this.peek("!")?.t === "op") {
			this.take();
			return negate(this.unary(), this.scope);
		}
		return this.primary();
	}

	private primary(): ConditionNode {
		if (this.peek("(")?.t === "op") {
			const like = this.tryLike();
			if (like) return like;
			this.take("(");
			const inner = this.or();
			this.take(")");
			return inner;
		}
		const left = this.operand();
		const op = this.tokens[this.at];
		if (op?.t === "op" && ["==", "===", "!=", "!==", "<", ">", "<=", ">="].includes(op.v)) {
			this.take();
			const right = this.operand();
			return compare(left, op.v, right, this.scope);
		}
		return truthy(left, this.scope);
	}

	/** The emitter's `like`: `(doc.x || "").includes("y")`. */
	private tryLike(): ConditionNode | null {
		const start = this.at;
		try {
			this.take("(");
			const ref = this.operand();
			this.take("||");
			const empty = this.take();
			this.take(")");
			this.take(".");
			this.take("includes");
			this.take("(");
			const text = this.take();
			this.take(")");
			if (ref.kind !== "ref" || empty.t !== "str" || empty.v !== "" || text.t !== "str") throw new Error("not like");
			return leaf(ref.name, "like", text.v, this.scope);
		} catch {
			this.at = start;
			return null;
		}
	}

	private operand(): Operand {
		const token = this.take();
		if (token.t === "id" && (token.v === "doc" || token.v === "parent") && this.peek(".")) {
			this.take(".");
			const name = this.take();
			if (name.t !== "id") throw new Error("expected a fieldname");
			const fieldname = token.v === "parent" ? `parent.${name.v}` : name.v;
			let length = false;
			if (this.peek(".") && this.peek("length", 1)) {
				this.at += 2;
				length = true;
			}
			// `doc.x.includes("y")`: x contains y.
			if (!length && this.peek(".") && this.peek("includes", 1)) {
				this.at += 2;
				this.take("(");
				const text = this.take();
				this.take(")");
				if (text.t !== "str") throw new Error("includes takes text");
				return { kind: "node", node: leaf(fieldname, "like", text.v, this.scope) };
			}
			return { kind: "ref", name: fieldname, length };
		}
		if (token.t === "id" && token.v === "in_list") {
			this.take("(");
			const list = this.array();
			this.take(",");
			const ref = this.operand();
			this.take(")");
			if (ref.kind !== "ref") throw new Error("in_list takes a field");
			return { kind: "node", node: leaf(ref.name, "in", list.map(String), this.scope) };
		}
		if (token.t === "id" && ["true", "false", "null", "undefined"].includes(token.v))
			return { kind: "lit", value: token.v === "true" ? true : token.v === "false" ? false : null };
		if (token.t === "num") return { kind: "lit", value: Number(token.v) };
		if (token.t === "op" && token.v === "-" && this.peek()?.t === "num") return { kind: "lit", value: -Number(this.take().v) };
		if (token.t === "str") return { kind: "lit", value: token.v };
		if (token.t === "op" && token.v === "[") {
			this.at--;
			const list = this.array();
			// `[...].includes(doc.x)` and `[...].indexOf(doc.x) !== -1`.
			if (this.peek(".") && this.peek("includes", 1)) {
				this.at += 2;
				this.take("(");
				const ref = this.operand();
				this.take(")");
				if (ref.kind !== "ref") throw new Error("includes takes a field");
				return { kind: "node", node: leaf(ref.name, "in", list.map(String), this.scope) };
			}
			if (this.peek(".") && this.peek("indexOf", 1)) {
				this.at += 2;
				this.take("(");
				const ref = this.operand();
				this.take(")");
				const op = this.take().v;
				const bound = this.operand();
				if (ref.kind !== "ref" || bound.kind !== "lit") throw new Error("indexOf");
				const found = (["!==", "!="].includes(op) && bound.value === -1) || (op === ">" && bound.value === -1) || (op === ">=" && bound.value === 0);
				const missing = (["===", "=="].includes(op) && bound.value === -1) || (op === "<" && bound.value === 0);
				if (!found && !missing) throw new Error("indexOf");
				return { kind: "node", node: leaf(ref.name, found ? "in" : "not in", list.map(String), this.scope) };
			}
			return { kind: "arr", items: list };
		}
		throw new Error(`cannot read ${token.v}`);
	}

	private array(): (string | number)[] {
		this.take("[");
		const items: (string | number)[] = [];
		while (!this.peek("]")) {
			const token = this.take();
			if (token.t !== "str" && token.t !== "num") throw new Error("array of literals only");
			items.push(token.t === "num" ? Number(token.v) : token.v);
			if (this.peek(",")) this.take(",");
		}
		this.take("]");
		return items;
	}
}

const isTree = (node: ConditionNode): node is Tree => Array.isArray((node as Tree).conditions);

function fieldOf(name: string, scope: ConditionScope) {
	const field = scope.fields.find((one) => one.fieldname === name);
	if (!field) throw new Error(`unknown field ${name}`);
	return field;
}

function leaf(fieldname: string, operator: Leaf["operator"], value: Leaf["value"], scope: ConditionScope): Leaf {
	fieldOf(fieldname, scope);
	return { fieldname, operator, value };
}

function truthy(operand: Operand, scope: ConditionScope): ConditionNode {
	if (operand.kind === "node") return operand.node;
	if (operand.kind !== "ref") throw new Error("a bare value is not a condition");
	const field = fieldOf(operand.name, scope);
	// `doc.items` is an array, so always true in JS; only `doc.items.length` asks for rows.
	if (scope.tables.has(operand.name) !== operand.length) throw new Error("a table needs .length");
	if (field.fieldtype === "Check") return { fieldname: operand.name, operator: "equals", value: "Yes" };
	return { fieldname: operand.name, operator: "is", value: "set" };
}

const FLIP: Record<string, string> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" };

function compare(left: Operand, op: string, right: Operand, scope: ConditionScope): ConditionNode {
	if (left.kind === "lit" && right.kind === "ref") return compare(right, FLIP[op] ?? op, left, scope);
	if (left.kind !== "ref" || left.length) throw new Error("compare a field");
	const field = fieldOf(left.name, scope);
	const equal = ["==", "==="].includes(op);
	const unequal = ["!=", "!=="].includes(op);
	if (right.kind === "ref") {
		if (right.length) throw new Error("compare a field");
		fieldOf(right.name, scope);
		const value = `${REF}${right.name.startsWith("parent.") ? right.name : `doc.${right.name}`}`;
		return { fieldname: left.name, operator: equal ? "equals" : unequal ? "not equals" : (op as Leaf["operator"]), value };
	}
	if (right.kind !== "lit") throw new Error("compare with a value");
	const value = right.value;
	if (field.fieldtype === "Check") {
		if (!equal && !unequal) throw new Error("a check is on or off");
		const on = value === 1 || value === true || value === "1";
		const off = value === 0 || value === false || value === "0";
		if (!on && !off) throw new Error("a check is on or off");
		return { fieldname: left.name, operator: "equals", value: on === equal ? "Yes" : "No" };
	}
	if (value === null || value === "") {
		if (!equal && !unequal) throw new Error("ordering against nothing");
		return { fieldname: left.name, operator: "is", value: equal ? "not set" : "set" };
	}
	if (left.name === DOCSTATUS) {
		const label = DOCSTATUS_LABELS[Number(value)];
		if (!label || (!equal && !unequal)) throw new Error("docstatus is 0, 1 or 2");
		return { fieldname: left.name, operator: equal ? "equals" : "not equals", value: label };
	}
	if (typeof value === "boolean") throw new Error("true and false only fit a check");
	return { fieldname: left.name, operator: equal ? "equals" : unequal ? "not equals" : (op as Leaf["operator"]), value: String(value) };
}

const NEGATED: Record<string, Leaf["operator"]> = {
	equals: "not equals", "not equals": "equals", in: "not in", "not in": "in", like: "not like", "not like": "like",
	"<": ">=", ">=": "<", ">": "<=", "<=": ">", is: "is not", "is not": "is",
};

function negate(node: ConditionNode, scope: ConditionScope): ConditionNode {
	if (isTree(node)) {
		// `!(a && b)` has no row of its own; De Morgan would rewrite what the person wrote.
		if (node.conditions.length !== 1) throw new Error("a negated group stays code");
		return negate(node.conditions[0], scope);
	}
	const one = node as Leaf;
	// A check (or "has rows", or "Record is new") offers "equals" only, so it flips its value.
	if (fieldOf(one.fieldname, scope).fieldtype === "Check" && one.operator === "equals") return { ...one, value: one.value === "Yes" ? "No" : "Yes" };
	if (one.operator === "is" || one.operator === "is not") return { ...one, operator: "is", value: (one.operator === "is") === (one.value === "set") ? "not set" : "set" };
	return { ...one, operator: NEGATED[one.operator] ?? one.operator };
}

export type Parsed = { ok: true; tree: Tree } | { ok: false };

export const emptyTree = (): Tree => ({ conjunction: "and", conditions: [] });

/** A stored condition as a tree, or `ok: false` when the builder cannot show it without changing it. */
export function parseCondition(raw: string | undefined | null, scope: ConditionScope): Parsed {
	const text = (raw ?? "").trim();
	if (!text) return { ok: true, tree: emptyTree() };
	try {
		if (text.startsWith("eval:")) {
			const body = text.slice(5).trim().replace(/;\s*$/, "");
			if (!body) return { ok: true, tree: emptyTree() };
			const node = new Parser(tokenize(body), scope).parse();
			return { ok: true, tree: isTree(node) ? node : { conjunction: "and", conditions: [node] } };
		}
		// A bare fieldname: truthy, and a table's must have rows (the v1 rule desk v2 keeps).
		if (!/^\w+$/.test(text)) return { ok: false };
		const field = fieldOf(text, scope);
		const node: Leaf = field.fieldtype === "Check" ? { fieldname: text, operator: "equals", value: "Yes" } : { fieldname: text, operator: "is", value: "set" };
		return { ok: true, tree: { conjunction: "and", conditions: [node] } };
	} catch {
		return { ok: false };
	}
}

/** The code view's text: the JavaScript after `eval:`, a bare fieldname spelled as `doc.x`. */
export function codeOf(raw: string | undefined | null) {
	const text = (raw ?? "").trim();
	if (!text) return "";
	if (text.startsWith("eval:")) return text.slice(5).trim();
	return /^\w+$/.test(text) ? `doc.${text}` : text;
}

// ---------------------------------------------------------------- writing

/** Drops rows with no field and groups left empty, as the builder's own adapters do. */
function clean(group: Tree): Tree {
	const conditions = group.conditions.flatMap((one): ConditionNode[] => {
		if (isTree(one)) {
			const inner = clean(one);
			return inner.conditions.length ? [inner.conditions.length === 1 ? inner.conditions[0] : inner] : [];
		}
		return (one as Leaf).fieldname ? [one] : [];
	});
	return { conjunction: group.conjunction ?? "and", conditions };
}

/** The tree as a condition: a bare fieldname when that is all it says, else `eval:` JavaScript. */
export function emitCondition(tree: Tree | null, scope: ConditionScope): string {
	const root = clean(tree ?? emptyTree());
	if (!root.conditions.length) return "";
	const only = root.conditions.length === 1 && !isTree(root.conditions[0]) ? (root.conditions[0] as Leaf) : null;
	if (only && /^\w+$/.test(only.fieldname) && only.fieldname !== RECORD_NEW && only.fieldname !== DOCSTATUS) {
		const field = scope.fields.find((one) => one.fieldname === only.fieldname);
		const set = only.operator === "is" && only.value === "set";
		const on = field?.fieldtype === "Check" && only.operator === "equals" && only.value === "Yes";
		if (set || on) return only.fieldname;
	}
	return `eval:${emitGroup(root, scope)}`;
}

function emitGroup(group: Tree, scope: ConditionScope): string {
	const many = group.conditions.length > 1;
	return group.conditions
		.map((one) => {
			if (isTree(one)) return many && one.conditions.length > 1 ? `(${emitGroup(one, scope)})` : emitGroup(one, scope);
			const text = emitLeaf(one as Leaf, scope);
			return many && text.includes(" && ") ? `(${text})` : text;
		})
		.join(group.conjunction === "or" ? " || " : " && ");
}

const refOf = (fieldname: string, scope: ConditionScope) => {
	const ref = fieldname.startsWith("parent.") ? fieldname : `doc.${fieldname}`;
	return scope.tables.has(fieldname) ? `${ref}.length` : ref;
};

function literal(value: unknown, field: ConditionField | undefined) {
	if (typeof value === "string" && value.startsWith(REF)) return value.slice(REF.length);
	if (field?.fieldname === DOCSTATUS) return String(Math.max(0, DOCSTATUS_LABELS.indexOf(String(value))));
	if (field && NUMERIC.has(field.fieldtype) && value !== "" && !Number.isNaN(Number(value))) return String(Number(value));
	return JSON.stringify(String(value ?? ""));
}

const listOf = (value: unknown) => (Array.isArray(value) ? value : String(value ?? "").split(",").map((one) => one.trim()).filter(Boolean));

function emitLeaf(one: Leaf, scope: ConditionScope): string {
	const field = scope.fields.find((f) => f.fieldname === one.fieldname);
	const ref = refOf(one.fieldname, scope);
	const value = one.value;
	if (field?.fieldtype === "Check" && (value === "Yes" || value === "No")) {
		const on = (value === "Yes") === (one.operator !== "not equals");
		return on ? ref : `!${ref}`;
	}
	switch (one.operator) {
		case "is":
		case "is not":
			return (one.operator === "is") === (value === "set") ? ref : `!${ref}`;
		case "equals":
			return `${ref} === ${literal(value, field)}`;
		case "not equals":
			return `${ref} !== ${literal(value, field)}`;
		case "in":
		case "not in": {
			const list = `[${listOf(value).map((item) => literal(item, field)).join(", ")}]`;
			return `${one.operator === "not in" ? "!" : ""}${list}.includes(${ref})`;
		}
		case "like":
		case "not like":
			return `${one.operator === "not like" ? "!" : ""}(${ref} || "").includes(${JSON.stringify(String(value ?? ""))})`;
		case "between": {
			const [from, to] = listOf(value);
			return `${ref} >= ${literal(from, field)} && ${ref} <= ${literal(to, field)}`;
		}
		default:
			return `${ref} ${one.operator} ${literal(value, field)}`;
	}
}

// ---------------------------------------------------------------- saying it

export type Summary = { kind: "empty" | "rules" | "code"; text: string };

/** The panel row's one line: "Always", "Is return is on and Customer is set", or the code. */
export function summarize(raw: string | undefined | null, scope: ConditionScope, empty: string): Summary {
	const parsed = parseCondition(raw, scope);
	if (!parsed.ok) return { kind: "code", text: codeOf(raw) };
	const root = clean(parsed.tree);
	if (!root.conditions.length) return { kind: "empty", text: empty };
	return { kind: "rules", text: sayGroup(root, scope, false) };
}

function sayGroup(group: Tree, scope: ConditionScope, nested: boolean): string {
	const text = group.conditions
		.map((one) => (isTree(one) ? sayGroup(one, scope, true) : sayLeaf(one as Leaf, scope.fields)))
		.join(group.conjunction === "or" ? " or " : " and ");
	return nested && group.conditions.length > 1 ? `(${text})` : text;
}

const joinOr = (items: string[], word = "or") => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`);

/** One row in words. Link filters pass `record` (this DocType's fields; theirs are the target's). */
export function sayLeaf(one: Leaf, fields: ConditionField[], record?: ConditionField[]): string {
	const filter = record !== undefined;
	record ??= fields;
	const field = fields.find((f) => f.fieldname === one.fieldname);
	const label = field?.label.replace(/ \(has rows\)$/, "") ?? one.fieldname;
	const value = one.value;
	const shown = (item: unknown) => {
		if (typeof item === "string" && item.startsWith(REF)) {
			const name = item.slice(REF.length).replace(/^doc\./, "");
			const other = record.find((f) => f.fieldname === name);
			return `this record's ${other?.label ?? name}`;
		}
		return String(item);
	};
	if (field?.fieldtype === "Check" && (value === "Yes" || value === "No") && !filter) {
		const on = (value === "Yes") === (one.operator !== "not equals");
		if (one.fieldname === RECORD_NEW) return on ? "Record is new" : "Record is saved";
		if (/ \(has rows\)$/.test(field.label)) return on ? `${label} has rows` : `${label} has no rows`;
		return `${label} is ${on ? "on" : "off"}`;
	}
	// A condition compares two fields of one record; a link filter, a target's field with this record's.
	const ref = !filter && typeof value === "string" && value.startsWith(REF);
	switch (one.operator) {
		case "is":
		case "is not":
			return `${label} is ${(one.operator === "is") === (value === "set") ? "set" : "empty"}`;
		case "equals":
			return ref ? `${label} is the same as ${shown(value).replace("this record's ", "")}` : `${label} is ${shown(value)}`;
		case "not equals":
			return ref ? `${label} differs from ${shown(value).replace("this record's ", "")}` : `${label} is not ${shown(value)}`;
		case "in":
			return `${label} is ${joinOr(listOf(value).map(shown))}`;
		case "not in":
			return `${label} is none of ${listOf(value).map(shown).join(", ")}`;
		case "like":
			return `${label} contains ${shown(value)}`;
		case "not like":
			return `${label} does not contain ${shown(value)}`;
		case ">":
			return `${label} is more than ${shown(value)}`;
		case "<":
			return `${label} is less than ${shown(value)}`;
		case ">=":
			return `${label} is at least ${shown(value)}`;
		case "<=":
			return `${label} is at most ${shown(value)}`;
		case "between": {
			const [from, to] = listOf(value);
			return `${label} is between ${from} and ${to}`;
		}
		default:
			return `${label} ${one.operator} ${shown(value)}`;
	}
}

// ---------------------------------------------------------------- link filters

/** `link_filters` is a flat AND list, `[[doctype, fieldname, operator, value], ...]`, stored as JSON. */
const WIRE: Record<string, string> = { equals: "=", "not equals": "!=", like: "like", "not like": "not like", in: "in", "not in": "not in", is: "is", "is not": "is not", "<": "<", ">": ">", "<=": "<=", ">=": ">=", between: "between" };
const FROM_WIRE: Record<string, Leaf["operator"]> = Object.fromEntries([...Object.entries(WIRE).map(([ui, wire]) => [wire, ui]), ["==", "equals"], ["LIKE", "like"], ["NOT LIKE", "not like"]]) as any;

export function parseLinkFilters(raw: string | undefined | null, doctype: string, fields: ConditionField[]): Parsed {
	const text = (raw ?? "").trim();
	if (!text || text === "[]") return { ok: true, tree: emptyTree() };
	try {
		const rows = JSON.parse(text);
		if (!Array.isArray(rows)) return { ok: false };
		const conditions: Leaf[] = rows.map((row: unknown) => {
			if (!Array.isArray(row) || row.length !== 4 || row[0] !== doctype) throw new Error("not a link filter");
			const [, fieldname, wire, raw] = row;
			const operator = FROM_WIRE[String(wire)];
			const field = fields.find((one) => one.fieldname === fieldname);
			if (!operator || !field) throw new Error("unknown operator or field");
			let value: Leaf["value"] = Array.isArray(raw) ? raw.map(String) : String(raw ?? "");
			if (field.fieldtype === "Check" && operator === "equals") value = Number(raw) ? "Yes" : "No";
			if (operator.includes("like") && typeof value === "string") value = value.replace(/^%|%$/g, "");
			return { fieldname, operator, value };
		});
		return { ok: true, tree: { conjunction: "and", conditions } };
	} catch {
		return { ok: false };
	}
}

export function emitLinkFilters(tree: Tree | null, doctype: string, fields: ConditionField[]): string {
	const rows = clean(tree ?? emptyTree()).conditions.filter((one): one is Leaf => !isTree(one));
	if (!rows.length) return "";
	return JSON.stringify(
		rows.map((one) => {
			const field = fields.find((f) => f.fieldname === one.fieldname);
			let value: unknown = one.value;
			if (field?.fieldtype === "Check" && one.operator === "equals") value = one.value === "Yes" ? 1 : 0;
			else if (field && NUMERIC.has(field.fieldtype) && !String(value).startsWith(REF) && !Number.isNaN(Number(value))) value = Number(value);
			else if (one.operator.includes("like")) value = `%${value}%`;
			else if (one.operator === "in" || one.operator === "not in") value = listOf(value);
			return [doctype, one.fieldname, WIRE[one.operator] ?? one.operator, value];
		})
	);
}

/** "All customers", or "Disabled is No · Customer Group is Commercial". */
export function summarizeLinkFilters(raw: string | undefined | null, doctype: string, fields: ConditionField[], record: ConditionField[]): Summary {
	const parsed = parseLinkFilters(raw, doctype, fields);
	if (!parsed.ok) return { kind: "code", text: (raw ?? "").trim() };
	const rows = parsed.tree.conditions as Leaf[];
	if (!rows.length) return { kind: "empty", text: `All ${pluralOf(doctype)}` };
	return { kind: "rules", text: rows.map((one) => sayLeaf(one, fields, record)).join(" · ") };
}

export function pluralOf(doctype: string) {
	const word = doctype.toLowerCase();
	if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
	if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
	return `${word}s`;
}

/** The Preview's Link filters: equality rows as a filters dict, a field-of-this-record value read from the doc. */
export function linkFiltersForPreview(raw: string | undefined | null, doc: Record<string, any>) {
	try {
		const rows = JSON.parse(raw || "[]");
		const filters: Record<string, unknown> = {};
		for (const [, fieldname, op, value] of rows) {
			const resolved = typeof value === "string" && value.startsWith("eval:doc.") ? doc[value.slice(9)] : value;
			if (resolved === undefined || resolved === null || resolved === "") continue;
			filters[fieldname] = op === "=" ? resolved : [op, resolved];
		}
		return Object.keys(filters).length ? filters : undefined;
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------- loading

/**
 * PROTOTYPE: desk v2's meta layout (`get_meta_layout`, form_layout.py:596-617) keeps a break's name
 * and label only, so a Section or Tab Break's `depends_on`, `collapsible` and `collapsible_depends_on`
 * never reach the record page. The editor puts them back from the break fields; the build should
 * do it on the server.
 */
export function seedBreakRules(trees: Record<string, LayoutTree>, fields: EditorField[]) {
	const byName = new Map(fields.map((one) => [one.fieldname, one as EditorField & Record<string, any>]));
	for (const tree of Object.values(trees))
		for (const tab of tree) {
			const tabField = byName.get(tab.name ?? "");
			if (tabField?.depends_on && !tab.dependsOn) tab.dependsOn = tabField.depends_on;
			for (const section of tab.sections ?? []) {
				const field = byName.get(section.name ?? "");
				if (!field) continue;
				if (field.depends_on && !section.dependsOn) section.dependsOn = field.depends_on;
				if (field.collapsible) section.collapsible = true;
				if (field.collapsible_depends_on) (section as any).collapsibleDependsOn = field.collapsible_depends_on;
			}
		}
}

/**
 * PROTOTYPE: Sales Invoice has no `link_filters` (ERPNext narrows its Links with `set_query` in
 * form scripts, 615 calls). The demo seeds the one ERPNext writes most, on Default Source Warehouse:
 * not a group, and of this invoice's company.
 */
export function seedDemo(doctype: string, fields: EditorField[]) {
	if (doctype !== "Sales Invoice") return;
	const warehouse = fields.find((one) => one.fieldname === "set_warehouse") as (EditorField & Record<string, any>) | undefined;
	if (warehouse && !warehouse.link_filters) warehouse.link_filters = JSON.stringify([["Warehouse", "is_group", "=", 0], ["Warehouse", "company", "=", "eval:doc.company"]]);
}
