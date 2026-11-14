// PROTOTYPE (#47374): RailColumn's app menu, for the layouts that draw the logo elsewhere.

import { computed, h, inject, shallowRef } from "vue";
import type { DropdownOptions } from "frappe-ui";
import type { Boot } from "@/boot";
import AppLogo from "../AppLogo.vue";
import { menuApps } from "../appSwitchOrder";
import type { PlacesApp } from "../palettePlaces";
import { loadDocument } from "../tabKeepAlive";
import { shellMenu } from "../shellActs";

const APP_MENU = ["all_apps", "open_settings", "customize_sidebar", "copy_link", "about"];

export function useAppMenu() {
	const boot = inject<Boot>("boot")!;
	const appTitle = computed(() => boot.app_title ?? boot.app!);
	const places = shallowRef<PlacesApp[]>([]);

	const menu = computed<DropdownOptions>(() => {
		const apps = menuApps(places.value, boot.app).map((app) => ({
			label: app.title,
			icon: () => h(AppLogo, { logo: app.logo, title: app.title, size: 16 }),
			onClick: () => loadDocument(app.route),
		}));
		const actions = { group: "", hideLabel: true, options: shellMenu(APP_MENU) };
		return apps.length ? [{ group: "", hideLabel: true, options: apps }, actions] : [actions];
	});

	function loadApps() {
		void import("../palettePlaces")
			.then((module) => module.loadApps())
			.then((apps) => (places.value = apps))
			.catch(() => {});
	}

	return { boot, appTitle, menu, loadApps };
}
