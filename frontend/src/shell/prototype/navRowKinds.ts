// PROTOTYPE (#47378): the types a person can add (#47376), and the checks a row's fields need.
// `iconClass` is written out whole: the icon CSS is built from class names found in the source.

export const ADDABLE = [
	{ type: "DocType", icon: "list", iconClass: "lucide-list", hint: "A list, or a single" },
	{ type: "View", icon: "layout-grid", iconClass: "lucide-layout-grid", hint: "A saved view or a view type" },
	{ type: "Record", icon: "file-text", iconClass: "lucide-file-text", hint: "One document" },
	{ type: "Page", icon: "layout-dashboard", iconClass: "lucide-layout-dashboard", hint: "An app's page" },
	{ type: "Link", icon: "link", iconClass: "lucide-link", hint: "A path here, or a URL" },
	{ type: "Act", icon: "zap", iconClass: "lucide-zap", hint: "Runs an action" },
	{ type: "Section", icon: "heading", iconClass: "lucide-heading", hint: "A heading that groups rows" },
];

export function kindOf(name: string) {
	return ADDABLE.find((k) => k.type === name) ?? { type: name, icon: "circle-dot", iconClass: "lucide-circle-dot", hint: "" };
}

/** `/…` is internal; http(s) on another origin is external; any other scheme is refused. */
export function classify(value: string): { ok: boolean; note: string } {
	if (!value) return { ok: false, note: "A path that starts with /, or an http(s) URL." };
	if (value.startsWith("/") && !value.startsWith("//")) return { ok: true, note: "Internal: opens here, in place." };
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
			return { ok: false, note: `Refused: "${parsed.protocol}" links can't be added. Use a /path or an http(s) URL.` };
		if (parsed.origin === location.origin)
			return { ok: true, note: "This site: write it as a /path so it opens in place." };
		return { ok: true, note: "External: opens in a new tab, marked with an arrow." };
	} catch {
		return { ok: false, note: "Refused: not a /path or an http(s) URL." };
	}
}

export function jsonable(value: unknown) {
	try {
		return JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value);
	} catch {
		return false;
	}
}
