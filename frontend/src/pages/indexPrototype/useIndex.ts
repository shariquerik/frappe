// PROTOTYPE (#45253), throwaway: the index's data and keys, shared by every variant.
import { computed, onMounted, ref, type Ref } from "vue";
import { useRoute } from "vue-router";
import type { Boot } from "@/boot";
import builder from "./logos/builder.png";
import drive from "./logos/drive.png";
import helpdesk from "./logos/helpdesk.svg";
import hrms from "./logos/hrms.svg";
import insights from "./logos/insights.png";
import lms from "./logos/lms.svg";
import raven from "./logos/raven.svg";
import noBackground from "./logos/no-background.svg";

export type Tile = { app: string; title: string; logo?: string | null; href: string };

export const DATA_CASES = ["real", "many", "edge", "one", "none", "loading"] as const;
export type DataCase = (typeof DATA_CASES)[number];

const MORE: Tile[] = [
	{ app: "hrms", title: "Frappe HR", logo: hrms, href: "/apps/hrms" },
	{ app: "helpdesk", title: "Helpdesk", logo: helpdesk, href: "/helpdesk" },
	{ app: "lms", title: "Learning", logo: lms, href: "/lms" },
	{ app: "insights", title: "Insights", logo: insights, href: "/insights" },
	{ app: "drive", title: "Drive", logo: drive, href: "/drive" },
	{ app: "builder", title: "Builder", logo: builder, href: "/builder" },
	{ app: "raven", title: "Raven", logo: raven, href: "/raven" },
];

const EDGE: Tile[] = [
	{ app: "payments", title: "Payments", logo: null, href: "/apps/payments" },
	{ app: "plain", title: "Plain Mark", logo: noBackground, href: "/apps/plain" },
	{
		app: "long",
		title: "Point of Sale and Restaurant Management",
		logo: null,
		href: "/apps/long",
	},
	{ app: "drive", title: "Drive", logo: drive, href: "/drive" },
];

export function useIndex(boot: Boot, filterBox: Ref<{ inputElement?: HTMLInputElement | null } | null>) {
	const route = useRoute();
	const dataCase = computed<DataCase>(() => {
		const asked = route.query.data;
		return DATA_CASES.includes(asked as DataCase) ? (asked as DataCase) : "real";
	});

	const real = computed<Tile[]>(() =>
		(boot.apps ?? []).map((app) => ({
			app: app.app,
			title: app.title,
			logo: app.logo,
			href: app.route,
		}))
	);

	const apps = computed<Tile[]>(() => {
		switch (dataCase.value) {
			case "many":
				return [...real.value, ...MORE];
			case "edge":
				return [...real.value, ...EDGE];
			case "one":
				return real.value.slice(0, 1);
			case "none":
			case "loading":
				return [];
			default:
				return real.value;
		}
	});
	const loading = computed(() => dataCase.value === "loading");

	const query = ref("");
	const matches = computed(() => {
		const needle = query.value.trim().toLowerCase();
		return needle
			? apps.value.filter((app) => app.title.toLowerCase().includes(needle))
			: apps.value;
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			query.value = "";
		} else if (event.key === "Enter" && matches.value[0]) {
			window.location.assign(matches.value[0].href);
		}
	}

	onMounted(() => filterBox.value?.inputElement?.focus());

	return { apps, loading, query, matches, onKeydown, dataCase };
}
