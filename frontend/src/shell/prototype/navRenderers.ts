// PROTOTYPE (#47378): renderers for the two kinds the editor adds that no app ships yet,
// `View` (a doctype plus a saved view or a bare view type) and `Act` (a named act).

import { itemRenderers } from "@/contributions/registry";
import { routeFor } from "@/router/routeFor";

itemRenderers.View = {
	icon: "list",
	render(item) {
		if (!item.link_doctype) return null;
		// A saved view is an address of its own; a bare view type is context on the list's.
		const type = item.payload?.view_type as string | undefined;
		return {
			to: type
				? routeFor(item.link_doctype, null, { query: { view: type } })
				: routeFor(item.link_doctype, null, { view: item.link_to }),
		};
	},
	label(item) {
		return item.link_to ?? `${item.link_doctype} ${item.payload?.view_type ?? ""}`.trim();
	},
};

itemRenderers.Act = {
	icon: "zap",
	render(item) {
		return item.link_to ? { act: item.link_to, value: item.payload?.value } : null;
	},
	label(item) {
		return item.link_to;
	},
};
