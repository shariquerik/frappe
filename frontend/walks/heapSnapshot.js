// Reads a V8 heap snapshot and sizes what a set of objects alone keeps alive.

import { readFileSync } from "node:fs";

export class HeapSnapshot {
	static read(path) {
		return new HeapSnapshot(readFileSync(path));
	}

	constructor(buffer) {
		const header = JSON.parse(
			`${buffer.toString("utf8", 0, headerEnd(buffer)).replace(/[,\s]*$/, "")}}`
		);
		const { meta } = header.snapshot;
		this.nodeFields = meta.node_fields.length;
		this.edgeFields = meta.edge_fields.length;
		this.nodeTypes = meta.node_types[0];
		this.edgeTypes = meta.edge_types[0];
		this.nodes = numbers(buffer, '"nodes":[', header.snapshot.node_count * this.nodeFields);
		this.edges = numbers(buffer, '"edges":[', header.snapshot.edge_count * this.edgeFields);
		this.strings = strings(buffer);
		this.nodeCount = header.snapshot.node_count;
		this.firstEdge = this.edgeOffsets();
		this.weak = this.edgeTypes.indexOf("weak");
		this.internal = this.edgeTypes.indexOf("internal");
		// A WeakMap's key-to-value edge keeps nothing alive alone, so it counts as weak.
		this.ephemeral = new Uint8Array(this.strings.length);
		this.strings.forEach(
			(name, index) => (this.ephemeral[index] = name.includes("part of key"))
		);
	}

	type(node) {
		return this.nodeTypes[this.nodes[node * this.nodeFields]];
	}

	name(node) {
		return this.strings[this.nodes[node * this.nodeFields + 1]];
	}

	selfSize(node) {
		return this.nodes[node * this.nodeFields + 3];
	}

	/** [edge name, target node, edge type] for each edge leaving the node. */
	*edgesOf(node) {
		for (
			let edge = this.firstEdge[node];
			edge < this.firstEdge[node + 1];
			edge += this.edgeFields
		) {
			const type = this.edgeTypes[this.edges[edge]];
			const nameOrIndex = this.edges[edge + 1];
			const name =
				type === "element" || type === "hidden" ? nameOrIndex : this.strings[nameOrIndex];
			yield [name, this.edges[edge + 2] / this.nodeFields, type];
		}
	}

	properties(node) {
		const found = {};
		for (const [name, target, type] of this.edgesOf(node)) {
			if (type === "property" || type === "internal") found[name] ??= target;
		}
		return found;
	}

	/** Objects whose own properties include every one of `names`. */
	objectsWith(names) {
		const object = this.nodeTypes.indexOf("object");
		const matches = [];
		for (let node = 0; node < this.nodeCount; node++) {
			if (this.nodes[node * this.nodeFields] !== object) continue;
			const props = this.properties(node);
			if (names.every((name) => name in props)) matches.push(node);
		}
		return matches;
	}

	/** Nodes with an edge to one of `targets`, among those `accept` takes. */
	nodesPointingAt(targets, accept) {
		const found = [];
		for (let node = 0; node < this.nodeCount; node++) {
			if (!accept(node)) continue;
			for (
				let edge = this.firstEdge[node];
				edge < this.firstEdge[node + 1];
				edge += this.edgeFields
			) {
				if (!targets.has(this.edges[edge + 2] / this.nodeFields)) continue;
				found.push(node);
				break;
			}
		}
		return found;
	}

	/** Bytes freed when `held` goes, leaving out what only `barrier` leads to. */
	retainedSize(held, barrier = []) {
		const blocked = new Set([...held, ...barrier]);
		const marked = new Uint8Array(this.nodeCount);
		this.reach([0], blocked, marked);
		const freed = this.reach([...new Set(held)], new Set(barrier), marked);
		let bytes = 0;
		for (const node of freed) bytes += this.selfSize(node);
		return bytes;
	}

	/** Nodes reachable from `start` that are neither blocked nor already marked; marks them. */
	reach(start, blocked, marked) {
		const found = [];
		const stack = start.filter((node) => !marked[node]);
		for (const node of stack) marked[node] = 1;
		while (stack.length) {
			const node = stack.pop();
			found.push(node);
			for (
				let edge = this.firstEdge[node];
				edge < this.firstEdge[node + 1];
				edge += this.edgeFields
			) {
				if (this.isWeak(edge)) continue;
				const target = this.edges[edge + 2] / this.nodeFields;
				if (marked[target] || blocked.has(target)) continue;
				marked[target] = 1;
				stack.push(target);
			}
		}
		return found;
	}

	isWeak(edge) {
		const type = this.edges[edge];
		return (
			type === this.weak || (type === this.internal && this.ephemeral[this.edges[edge + 1]])
		);
	}

	edgeOffsets() {
		const offsets = new Uint32Array(this.nodeCount + 1);
		const edgeCountField = 4;
		for (let node = 0; node < this.nodeCount; node++) {
			const count = this.nodes[node * this.nodeFields + edgeCountField];
			offsets[node + 1] = offsets[node] + count * this.edgeFields;
		}
		return offsets;
	}
}

function headerEnd(buffer) {
	const at = buffer.indexOf('"nodes":[');
	if (at === -1) throw new Error("Not a heap snapshot");
	return at;
}

function numbers(buffer, marker, count) {
	const values = new Uint32Array(count);
	let at = buffer.indexOf(marker) + marker.length;
	for (let index = 0; index < count; index++) {
		while (buffer[at] < 48 || buffer[at] > 57) at++;
		let value = 0;
		while (buffer[at] >= 48 && buffer[at] <= 57) value = value * 10 + buffer[at++] - 48;
		values[index] = value;
	}
	return values;
}

function strings(buffer) {
	const found = [];
	// Every section before the strings is numbers, so the first match is the real one.
	let at = buffer.indexOf('"strings":[', headerEnd(buffer)) + '"strings":['.length;
	while (buffer[at] !== 93) {
		while (buffer[at] !== 34) at++;
		const start = at++;
		let escaped = false;
		while (buffer[at] !== 34 || escaped) {
			escaped = !escaped && buffer[at] === 92;
			at++;
		}
		found.push(JSON.parse(buffer.toString("utf8", start, ++at)));
		while (buffer[at] === 44 || buffer[at] === 10 || buffer[at] === 32) at++;
	}
	return found;
}
