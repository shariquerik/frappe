<!-- PROTOTYPE (#45253): RailColumn's avatar menu, copied so the index can draw it without the rail. -->
<template>
	<Dropdown :options="menu" :side="side" :align="align">
		<slot :user="boot.session.user" />
	</Dropdown>
	<LogoutDialog v-model="confirmingLogout" />
</template>

<script setup lang="ts">
import { computed, h, inject, ref } from "vue";
import { Avatar, Dropdown, useColorScheme, type DropdownOptions } from "frappe-ui";
import type { Boot } from "@/boot";
import LogoutDialog from "@/shell/LogoutDialog.vue";

const props = withDefaults(
	defineProps<{
		side?: "bottom" | "top" | "right" | "left";
		align?: "start" | "center" | "end";
		extra?: { label: string; icon: string; onClick: () => void }[];
	}>(),
	{ side: "bottom", align: "end", extra: () => [] }
);

const boot = inject<Boot>("boot")!;
const confirmingLogout = ref(false);
const { colorScheme, setColorScheme } = useColorScheme();
const SCHEMES = [
	{ label: "Light", value: "light", icon: "lucide-sun" },
	{ label: "Dark", value: "dark", icon: "lucide-moon" },
	{ label: "System", value: "system", icon: "lucide-monitor" },
] as const;

const menu = computed<DropdownOptions>(() => [
	{ group: "", hideLabel: true, options: [profileHeader()] },
	{
		group: "",
		hideLabel: true,
		options: [
			{
				label: "My settings",
				icon: "lucide-circle-user",
				onClick: () => leave(`/app/user/${encodeURIComponent(boot.session.user.name)}`),
			},
			{
				label: "Theme",
				icon: "lucide-sun-moon",
				submenu: SCHEMES.map((scheme) => ({
					label: scheme.label,
					icon: scheme.icon,
					selected: colorScheme.value === scheme.value,
					onClick: () => setColorScheme(scheme.value),
				})),
			},
			...props.extra,
		],
	},
	{
		group: "",
		hideLabel: true,
		options: [
			{ label: "Desk v1", icon: "lucide-arrow-left-right", onClick: () => leave("/app") },
		],
	},
	{
		group: "",
		hideLabel: true,
		options: [
			{
				label: "Log out",
				icon: "lucide-log-out",
				theme: "red",
				onClick: () => (confirmingLogout.value = true),
			},
		],
	},
]);

function profileHeader() {
	const { full_name, user_image, email } = boot.session.user;
	return {
		label: full_name,
		disabled: true,
		slots: {
			item: () =>
				h(
					"div",
					{ class: "flex items-center gap-2 px-2 py-1.5", style: { cursor: "default" } },
					[
						h(Avatar, { image: user_image, label: full_name, size: "xl" }),
						h("div", { class: "flex flex-col gap-0.5 min-w-0" }, [
							h("div", { class: "truncate text-sm font-semibold text-ink-gray-9" }, full_name),
							h("div", { class: "truncate text-xs text-ink-gray-5" }, email),
						]),
					]
				),
		},
	};
}

function leave(href: string) {
	window.location.assign(href);
}
</script>
