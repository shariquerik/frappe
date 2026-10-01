// 1 of 4: h(), as a stored script is written today.
import { h, ref } from "vue";
import { Badge, Button, Textarea } from "frappe-ui";

const THEMES = { Draft: "gray", "To Deliver": "amber", Completed: "green", Cancelled: "red" };

const NoteDialog = {
	props: { close: Function },
	setup(props) {
		const text = ref("");
		return () =>
			h("div", { class: "flex flex-col gap-3" }, [
				h(Textarea, {
					modelValue: text.value,
					"onUpdate:modelValue": (value) => (text.value = value),
					placeholder: "What did the customer say?",
					rows: 4,
				}),
				h(Button, {
					variant: "solid",
					label: "Save note",
					disabled: !text.value,
					onClick: () => props.close(text.value),
				}),
			]);
	},
};

const OrderSummary = {
	props: { page: Object },
	setup(props) {
		async function addNote() {
			const note = await props.page.dialog.open(NoteDialog, {}, { title: "Add a note" });
			if (!note) return;
			await props.page.call("myapp.api.add_note", { name: props.page.docname, note });
		}

		return () => {
			const { doc } = props.page;
			const late = doc.status === "To Deliver" && doc.delivery_date < today();
			return h("div", { class: "flex flex-col gap-2 p-3" }, [
				h("div", { class: "flex items-center justify-between" }, [
					h(Badge, { label: doc.status, theme: THEMES[doc.status] }),
					h(Button, { label: "Add note", onClick: addNote }),
				]),
				h(
					"ul",
					{ class: "text-sm" },
					doc.items.map((row) =>
						h("li", { key: row.name, class: "flex justify-between" }, [
							h("span", row.item_name),
							h("span", { class: "text-ink-gray-5" }, `${row.qty} × ${row.rate}`),
						]),
					),
				),
				late && h("p", { class: "text-sm text-ink-red-4" }, `Late: due on ${doc.delivery_date}`),
			]);
		};
	},
};

function today() {
	return new Date().toISOString().slice(0, 10);
}

export default {
	onRefresh(page) {
		page.panelSections.add(
			{ name: "order_summary", label: "Order summary", component: OrderSummary },
			{ before: "people" },
		);
	},
};
