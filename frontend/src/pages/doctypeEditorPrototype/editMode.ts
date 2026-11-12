// PROTOTYPE (#45867): a surface's edit mode, switched on by `?edit=<what>` so a walk can open
// it by address. Done and Cancel both leave it; nothing saves either way.
import { computed, shallowRef } from "vue";
import { useRoute, useRouter, type Router } from "vue-router";
import { toast } from "frappe-ui";
import { routeFor } from "@/router/routeFor";
import type { Editor, LayoutKey } from "./editor";

/**
 * PROTOTYPE (#47097): the in-place edit modes gave way to the DocType editor, opened at a layout
 * (`/doctype/<name>?layout=`). A path, not the named route: the prototype's `/doctype/:name`
 * matches ahead of DocType's own record route.
 */
export function openLayoutEditor(router: Router, doctype: string, layout: LayoutKey) {
	return router.push(router.resolve(routeFor("DocType", doctype, { query: { layout } })).fullPath);
}

export function useEditMode() {
	const route = useRoute();
	const router = useRouter();
	const editing = computed(() => String(route.query.edit ?? ""));
	const editor = shallowRef<Editor | null>(null);
	// `?row=conditional` pretends the doctype has a conditional row (none exist on this site).
	const fakeCondition = computed(() =>
		route.query.row === "conditional" ? 'doc.status == "Passive"' : undefined
	);

	function open(what: string) {
		router.replace({ query: { ...route.query, edit: what } });
	}
	function close(done: boolean) {
		const count = editor.value?.edits.value ?? 0;
		const { edit, ...query } = route.query;
		router.replace({ query });
		editor.value = null;
		if (done && count) toast.success(`Prototype: ${count} edit${count === 1 ? "" : "s"} would save`);
	}
	return { editing, editor, fakeCondition, open, close };
}
