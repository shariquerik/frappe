// Splits a heap snapshot of the desk into the cache stores: what each alone keeps alive.

import { HeapSnapshot } from "./heapSnapshot.js";

// Own property names that pick out each object; they survive minification.
const DATA_CACHE = ["documents", "lists", "readRecords", "fieldReads", "memo", "gate"];
const DOCUMENT_ENTRY = ["doctype", "name", "doc", "complete", "parts"];
const STORE_CACHE = ["stores", "held"];
const TIMELINE_STORE = ["doctype", "docname", "mounted", "pagesOut"];
const COMPONENT = ["uid", "vnode", "subTree", "appContext"];

export function splitStores(path, names) {
	return new StoreSplit(HeapSnapshot.read(path), names).rows();
}

class StoreSplit {
	constructor(snapshot, names) {
		this.snapshot = snapshot;
		this.names = names;
		this.cache = only(snapshot.objectsWith(DATA_CACHE), "DataCache");
		this.cacheParts = snapshot.properties(this.cache);
		this.entries = this.documentEntries();
		this.feeds = this.feedObjects();
		// Every Vue component instance: a store that keeps an unmounted page alive is sized apart.
		this.components = snapshot.objectsWith(COMPONENT);
	}

	rows() {
		const { records, lists, fieldReads } = this.entries;
		const { lists: listMap, memo, documents } = this.cacheParts;
		const { held: feeds, count: feedCount } = this.feeds;
		const both = [...records, ...feeds];
		const heldLists = this.mapObjects(listMap).length;
		const memoArrays = this.mapObjects(this.snapshot.properties(memo).held).length;
		return [
			this.row("complete records", records),
			this.row("feed stores", feeds, feedCount),
			this.row("complete records + feed stores", both, records.length),
			this.pagesRow(both, records.length),
			this.row("lists (ListEntry map)", [listMap], heldLists),
			this.row("rows memo", [memo], memoArrays),
			this.row("documents only a list row names", lists),
			this.row("field-read documents", fieldReads),
			this.row("whole DataCache", [this.cache], this.mapObjects(documents).length),
		];
	}

	row(store, held, count = held.length) {
		return sized(store, count, this.snapshot.retainedSize(held, this.components));
	}

	/** What the records and feed stores keep alive through component instances alone. */
	pagesRow(held, count) {
		const all = this.snapshot.retainedSize(held);
		return sized(
			"pages kept alive by them",
			count,
			all - this.snapshot.retainedSize(held, this.components)
		);
	}

	/** The documents map's entries, grouped by which step of the walk put them there. */
	documentEntries() {
		const held = new Set(this.mapObjects(this.cacheParts.documents));
		const byName = new Map();
		for (const entry of this.snapshot.objectsWith(DOCUMENT_ENTRY)) {
			if (held.has(entry))
				byName.set(this.snapshot.name(this.snapshot.properties(entry).name), entry);
		}
		const pick = (names) => names.flatMap((name) => byName.get(name) ?? []);
		const { records, lists, fieldReads } = this.names;
		return { records: pick(records), lists: pick(lists), fieldReads: pick(fieldReads) };
	}

	/** The feed stores, the map holding them, their pending-row trackers and the closures made for them. */
	feedObjects() {
		const snapshot = this.snapshot;
		const stores = snapshot.objectsWith(TIMELINE_STORE);
		const storeSet = new Set(stores);
		const data = new Set(stores.map((store) => snapshot.properties(store).data));
		const trackers = snapshot
			.objectsWith(["doc", "data"])
			.filter((node) => !storeSet.has(node) && data.has(snapshot.properties(node).data));
		const maps = snapshot
			.objectsWith(STORE_CACHE)
			.map((node) => snapshot.properties(node).stores);
		const contexts = snapshot.nodesPointingAt(
			storeSet,
			(node) =>
				snapshot.type(node) === "object" &&
				snapshot.name(node).startsWith("system / Context")
		);
		return { held: [...stores, ...trackers, ...maps, ...contexts], count: stores.length };
	}

	/** The objects a Map or Set holds as keys or values. */
	mapObjects(map) {
		const table = this.snapshot.properties(map).table;
		if (table === undefined) return [];
		const objects = [];
		for (const [, target] of this.snapshot.edgesOf(table)) {
			if (this.snapshot.type(target) === "object") objects.push(target);
		}
		return objects;
	}
}

function sized(store, count, bytes) {
	const perEntryKB = count ? Number((bytes / count / 1024).toFixed(1)) : null;
	return { store, count, retainedKB: Math.round(bytes / 1024), perEntryKB };
}

function only(nodes, label) {
	if (nodes.length !== 1)
		throw new Error(`Expected one ${label} in the snapshot, found ${nodes.length}`);
	return nodes[0];
}
