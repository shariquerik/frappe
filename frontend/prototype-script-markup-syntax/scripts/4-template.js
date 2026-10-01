// 4 of 4: a Vue template string. Needs the full Vue build (compiler included)
// and `unsafe-eval` under a CSP. v-model, v-if and v-for work as in a .vue file.
import { ref } from "vue";
import { Badge, Button, Textarea } from "frappe-ui";

const THEMES = { Draft: "gray", "To Deliver": "amber", Completed: "green", Cancelled: "red" };

const NoteDialog = {
	props: { close: Function },
	components: { Button, Textarea },
	setup() {
		return { text: ref("") };
	},
	template: `
		<div class="flex flex-col gap-3">
			<Textarea v-model="text" placeholder="What did the customer say?" :rows="4" />
			<Button variant="solid" label="Save note" :disabled="!text" @click="close(text)" />
		</div>
	`,
};

const OrderSummary = {
	props: { page: Object },
	components: { Badge, Button },
	setup(props) {
		async function addNote() {
			const note = await props.page.dialog.open(NoteDialog, {}, { title: "Add a note" });
			if (!note) return;
			await props.page.call("myapp.api.add_note", { name: props.page.docname, note });
		}
		return { addNote, today, THEMES };
	},
	template: `
		<div class="flex flex-col gap-2 p-3">
			<div class="flex items-center justify-between">
				<Badge :label="page.doc.status" :theme="THEMES[page.doc.status]" />
				<Button label="Add note" @click="addNote" />
			</div>
			<ul class="text-sm">
				<li v-for="row in page.doc.items" :key="row.name" class="flex justify-between">
					<span>{{ row.item_name }}</span>
					<span class="text-ink-gray-5">{{ row.qty }} × {{ row.rate }}</span>
				</li>
			</ul>
			<p
				v-if="page.doc.status === 'To Deliver' && page.doc.delivery_date < today()"
				class="text-sm text-ink-red-4"
			>
				Late: due on {{ page.doc.delivery_date }}
			</p>
		</div>
	`,
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
