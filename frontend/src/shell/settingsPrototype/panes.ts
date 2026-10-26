// PROTOTYPE (throwaway, branch prototype/settings-pane): the pane list the `Settings Dialog`
// merge would send, written by hand. Nothing here is the real contribution shape.

import { defineAsyncComponent, type Component } from "vue";

export type SaveMode = "auto" | "button";

export interface BindingSpec {
	type: "Single" | "Record";
	doctype: string;
	resolver?: "session_user";
}

export interface BlockSpec {
	key: string;
	/** The app that ships the block; differs from the pane's app for a foreign block. */
	app: string;
	label?: string;
	description?: string;
	save: SaveMode;
	/** A generated block: one binding, drawn as rows. */
	binding?: BindingSpec;
	/** Empty: the doctype's whole layout. */
	fields?: string[];
	/** A component block, with its named bindings. */
	component?: Component;
	bindings?: Record<string, BindingSpec>;
}

export interface PaneSpec {
	key: string;
	label: string;
	icon: string;
	description?: string;
	blocks: BlockSpec[];
}

export interface PaneGroup {
	prefix: string;
	label: string;
	panes: PaneSpec[];
}

const sessionUser: BindingSpec = { type: "Record", doctype: "User", resolver: "session_user" };
const systemSettings: BindingSpec = { type: "Single", doctype: "System Settings" };
const fcrmSettings: BindingSpec = { type: "Single", doctype: "FCRM Settings" };

const AppearanceBlock = defineAsyncComponent(() => import("./blocks/AppearanceBlock.vue"));
const BrandingBlock = defineAsyncComponent(() => import("./blocks/BrandingBlock.vue"));

export const GROUPS: PaneGroup[] = [
	{
		prefix: "desk",
		label: "Desk",
		panes: [
			{
				key: "profile",
				label: "Profile",
				icon: "lucide-circle-user",
				description: "Your name, language and how the desk notifies you.",
				blocks: [
					{
						key: "details",
						app: "frappe",
						save: "auto",
						binding: sessionUser,
						fields: ["first_name", "last_name", "language", "time_zone"],
					},
					{
						key: "appearance",
						app: "frappe",
						label: "Appearance",
						save: "auto",
						component: AppearanceBlock,
					},
					{
						key: "notifications",
						app: "frappe",
						label: "Notifications",
						save: "auto",
						binding: sessionUser,
						fields: [
							"document_follow_notify",
							"thread_notify",
							"send_me_a_copy",
							"allowed_in_mentions",
							"mute_sounds",
						],
					},
					{
						key: "telephony",
						app: "crm",
						label: "Calling (from CRM)",
						description: "CRM adds this block to desk's Profile pane.",
						save: "auto",
						binding: {
							type: "Record",
							doctype: "CRM Telephony Agent",
							resolver: "session_user",
						},
						fields: ["mobile_no", "default_medium"],
					},
				],
			},
			{
				key: "system",
				label: "System",
				icon: "lucide-settings",
				description: "Site-wide formats and login rules.",
				blocks: [
					{
						key: "formats",
						app: "frappe",
						label: "Date and number formats",
						save: "button",
						binding: systemSettings,
						fields: [
							"date_format",
							"time_format",
							"number_format",
							"first_day_of_the_week",
							"float_precision",
							"currency_precision",
						],
					},
					{
						key: "login",
						app: "frappe",
						label: "Login",
						save: "auto",
						binding: systemSettings,
						fields: [
							"allow_login_using_mobile_number",
							"allow_login_using_user_name",
							"login_with_email_link",
							"disable_user_pass_login",
						],
					},
				],
			},
			{
				key: "printing",
				label: "Printing",
				icon: "lucide-printer",
				blocks: [
					{
						key: "print-settings",
						app: "frappe",
						save: "button",
						binding: { type: "Single", doctype: "Print Settings" },
					},
				],
			},
		],
	},
	{
		prefix: "crm",
		label: "CRM",
		panes: [
			{
				key: "general",
				label: "General",
				icon: "lucide-sliders-horizontal",
				blocks: [
					{
						key: "fcrm-settings",
						app: "crm",
						save: "button",
						binding: fcrmSettings,
					},
				],
			},
			{
				key: "branding",
				label: "Branding",
				icon: "lucide-palette",
				description: "A custom component bound to FCRM Settings.",
				blocks: [
					{
						key: "brand",
						app: "crm",
						save: "auto",
						component: BrandingBlock,
						bindings: { settings: fcrmSettings },
					},
				],
			},
		],
	},
];

/** The current prefix's group first, the rest in run order. */
export function groupsFor(prefix: string): PaneGroup[] {
	const own = GROUPS.filter((group) => group.prefix === prefix);
	return [...own, ...GROUPS.filter((group) => group.prefix !== prefix)];
}

export function findPane(prefix: string, key: string): PaneSpec | undefined {
	return GROUPS.find((group) => group.prefix === prefix)?.panes.find((pane) => pane.key === key);
}

/** Every distinct binding a pane's blocks read, generated and named alike. */
export function paneBindings(pane: PaneSpec): BindingSpec[] {
	const all = pane.blocks.flatMap((block) => [
		...(block.binding ? [block.binding] : []),
		...Object.values(block.bindings ?? {}),
	]);
	return all.filter(
		(spec, index) => all.findIndex((other) => other.doctype === spec.doctype) === index
	);
}

export function bindingLabel(spec: BindingSpec): string {
	return spec.resolver === "session_user" ? `your ${spec.doctype}` : spec.doctype;
}
