<!-- PROTOTYPE (#47098), throwaway: one setting. On the page: label and a one-line help on the left,
     the control in a 320px column ending on the column's right edge (`action`: as wide as the
     control, the help up to 480px), so stacked rows share both edges. The Customize mark sits right
     after the label in a slot that is always there and takes no height, so nothing re-wraps or
     shifts between Design and Customize. `wide` puts the control under the label at the column's
     full width. In the 380px panel (variant C) everything stacks. `prop` names the setting the mark
     watches. The search matches the label, the help, the prop and `keywords`; a row it leaves out
     hides. -->
<template>
	<div v-if="place === 'panel'" class="group/row flex flex-col gap-2 py-2">
		<div class="flex min-w-0 items-start gap-1">
			<div class="min-w-0 flex-1">
				<p class="text-base text-ink-gray-8">{{ label }}</p>
				<p v-if="help || $slots.help" class="mt-0.5 text-p-sm text-ink-gray-5"><slot name="help">{{ help }}</slot></p>
			</div>
			<SettingsMark v-bind="mark" @reset="reset" />
		</div>
		<div class="min-w-0" :class="{ 'opacity-60': lock }" :inert="Boolean(lock)"><slot /></div>
	</div>
	<div v-else-if="wide" ref="root" v-show="shown" class="group/row flex flex-col gap-2.5 py-2">
		<div class="min-w-0">
			<p class="flex items-center gap-1 text-base text-ink-gray-8">
				<span class="min-w-0">{{ label }}</span>
				<span class="flex h-0 shrink-0 items-center"><SettingsMark v-bind="mark" @reset="reset" /></span>
			</p>
			<p v-if="help || $slots.help" class="mt-0.5 text-p-sm text-ink-gray-5"><slot name="help">{{ help }}</slot></p>
		</div>
		<div class="min-w-0" :class="{ 'opacity-60': lock }" :inert="Boolean(lock)"><slot /></div>
	</div>
	<div v-else ref="root" v-show="shown" class="group/row grid items-start gap-x-3 py-2" :class="action ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_320px]'">
		<div class="min-w-0 pt-px">
			<p class="flex items-center gap-1 text-base text-ink-gray-8">
				<span class="min-w-0">{{ label }}</span>
				<span class="flex h-0 shrink-0 items-center"><SettingsMark v-bind="mark" @reset="reset" /></span>
			</p>
			<p v-if="help || $slots.help" class="mt-0.5 text-p-sm text-ink-gray-5" :class="action && 'max-w-[480px]'"><slot name="help">{{ help }}</slot></p>
		</div>
		<div class="flex min-h-7 min-w-0 items-center justify-end" :class="{ 'opacity-60': lock }" :inert="Boolean(lock)"><slot /></div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import SettingsMark from "./SettingsMark.vue";
import { SettingsKey, SettingsPlaceKey, useSearchable } from "./settings";

const props = defineProps<{ label: string; help?: string; prop?: string; wide?: boolean; action?: boolean; resetLabel?: string; keywords?: string }>();
const ui = inject(SettingsKey)!;
const place = inject(SettingsPlaceKey, "page");
const root = ref<HTMLElement | null>(null);
const shown = useSearchable(() => [props.label, props.help, props.prop, props.keywords].join(" "), () => props.label, () => root.value);

const lock = computed(() => (props.prop ? ui.lock(props.prop) : ""));
const mark = computed(() => {
	if (!props.prop) return {};
	if (lock.value) return { lock: lock.value };
	if (!ui.changed(props.prop)) return {};
	return { changed: true, resetText: `Reset to ${ui.app}'s value (${props.resetLabel ?? (ui.shipped(props.prop) || "none")})` };
});
const reset = () => props.prop && ui.reset(props.prop);
</script>
