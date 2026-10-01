// 3 of 4: htm tagged templates bound to h. Runs with no compile step.
// The import name for htm is not decided; "htm" stands in for it here.
import { h, ref } from "vue";
import htm from "htm";
import { Badge, Button, Textarea } from "frappe-ui";

const html = htm.bind(h);

const THEMES = { Draft: "gray", "To Deliver": "amber", Completed: "green", Cancelled: "red" };

const NoteDialog = {
	props: { close: Function },
	setup(props) {
		const text = ref("");
		return () => html`
			<div class="flex flex-col gap-3">
				<${Textarea}
					modelValue=${text.value}
					onUpdate:modelValue=${(value) => (text.value = value)}
					placeholder="What did the customer say?"
					rows=${4}
				/>
				<${Button}
					variant="solid"
					label="Save note"
					disabled=${!text.value}
					onClick=${() => props.close(text.value)}
				/>
			</div>
		`;
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
			return html`
				<div class="flex flex-col gap-2 p-3">
					<div class="flex items-center justify-between">
						<${Badge} label=${doc.status} theme=${THEMES[doc.status]} />
						<${Button} label="Add note" onClick=${addNote} />
					</div>
					<ul class="text-sm">
						${doc.items.map(
							(row) => html`
								<li key=${row.name} class="flex justify-between">
									<span>${row.item_name}</span>
									<span class="text-ink-gray-5">${row.qty} × ${row.rate}</span>
								</li>
							`,
						)}
					</ul>
					${late && html`<p class="text-sm text-ink-red-4">Late: due on ${doc.delivery_date}</p>`}
				</div>
			`;
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
