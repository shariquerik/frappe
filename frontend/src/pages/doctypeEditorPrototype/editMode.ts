// PROTOTYPE (#45867): a surface's edit mode, switched on by `?edit=<what>` so a walk can open
// it by address. Done and Cancel both leave it; nothing saves either way.
import { computed, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "frappe-ui";
import type { Editor } from "./editor";

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
