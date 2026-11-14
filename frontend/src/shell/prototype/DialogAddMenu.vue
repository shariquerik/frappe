<!--
  PROTOTYPE (#47378), variant B: "+ Add", opening below itself. "Add this page" comes first and
  fills in the page the person is on.
-->
<template>
	<Dropdown :options="options" align="end" side="bottom">
		<Button variant="ghost" icon-left="lucide-plus" label="Add" data-add />
	</Dropdown>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useRoute } from "vue-router";
import { Button, Dropdown } from "frappe-ui";
import type { Addresses } from "@/addresses";
import { type DraftRow, RAIL } from "./navDraft";
import { container, startAdd } from "./dialogPane";
import { ADDABLE } from "./navRowKinds";

const addresses = inject<Addresses>("addresses")!;
const route = useRoute();

const here = computed(() => thisPage());

const options = computed(() => {
	const types = ADDABLE.filter((kind) => container() !== RAIL || kind.type !== "Section").map(
		(kind) => ({
			label: kind.type,
			icon: kind.iconClass,
			onClick: () => startAdd(kind.type),
		})
	);
	const page = here.value;
	if (!page) return types;
	return [
		{
			group: "This page",
			options: [
				{
					label: `Add this page (${page.label})`,
					icon: "lucide-pin",
					onClick: () => startAdd(page.type, page.fields),
				},
			],
		},
		{ group: "New row", options: types },
	];
});

/** The page the person is on, as a row: a list, a saved view, or a record. */
function thisPage(): { type: string; label: string; fields: Partial<DraftRow> } | null {
	const slug = route.params.doctype;
	const doctype = typeof slug === "string" ? addresses.doctypeOf(slug) : null;
	if (!doctype) return null;
	const name = String(route.name ?? "");
	if (name.includes("saved-view"))
		return {
			type: "View",
			label: `${doctype} view`,
			fields: { link_doctype: doctype, link_to: String(route.params.key) },
		};
	if (name.includes("record") && route.params.name)
		return {
			type: "Record",
			label: String(route.params.name),
			fields: {
				link_doctype: doctype,
				link_to: String(route.params.name),
				label: String(route.params.name),
			},
		};
	return {
		type: "DocType",
		label: doctype,
		fields: { link_to: doctype, link_doctype: "DocType" },
	};
}
</script>
