<script setup lang="ts">
// Frappe OS desktop root: wallpaper, desktop icons, windows, split-exit pill,
// menu bar, dock, command palette. Owns the global keyboard listener — Command
// shortcuts route through the OS dispatcher (ADR-0037), Esc dismisses — and the
// pointer (drag/resize + dock auto-hide) listeners. Theme is
// owned by frappe-ui's useTheme (it writes <html data-theme>); we just boot it.
import { computed, onMounted, onBeforeUnmount, nextTick, ref } from "vue";
import type { ComponentPublicInstance } from "vue";
import { ToastProvider, useTheme } from "frappe-ui";
import { useOS } from "@/desktop";
import { desktopContextItems, dispatchShortcut } from "@/actions";
import { cellToPixel, layoutDesktop, CELL_W } from "@/desktop/grid";
import { usePlacements, placementView, defaultLabel, writePlacementOverride } from "@/placements";
import { tileMenuOptions } from "@/placements/tile-menu";
import type { SurfaceRef, ResolvedPlacement } from "@/types";
import { dirtyWindows } from "@/desktop/working-state";
import AppIconTile from "./components/AppIconTile.vue";
import { MenuBar } from "./components/MenuBar";
import { Dock } from "./components/Dock";
import { OSWindow, CloseConfirmDialog } from "./components/Window";
import { CommandPalette } from "./components/CommandPalette";
import OSContextMenu from "./components/OSContextMenu.vue";
import FullscreenPrompt from "./components/FullscreenPrompt.vue";
import AboutDialog from "./components/AboutDialog.vue";

const os = useOS();

// Theme is owned by frappe-ui (light/dark/system): the first useTheme() call
// restores the saved choice, writes <html data-theme>, and installs the
// prefers-color-scheme listener. Call it at boot so the theme applies on load,
// not only once the Appearance pane mounts. The ThemeSwitcher in Settings drives
// the same singleton.
useTheme();

const wp = computed(() => os.currentWp.value);
// The wallpaper fill: an image wallpaper is drawn cover/center; a gradient is its raw CSS background
// (ADR-0036). One style object so the desktop layer branches on image presence, not two elements.
const wpStyle = computed(() =>
	wp.value.image
		? { backgroundImage: `url("${wp.value.image}")`, backgroundSize: "cover", backgroundPosition: "center" }
		: { background: wp.value.bg },
);

// The desktop size is a single reactive source (os.desktopRef), refreshed on mount and on resize via
// os.syncDesktopSize, so the cell→pixel projection, the live drag clamp, AND the drop-snap on release
// all read the same up-to-date dimensions — they can't drift after a window resize.
const desktop = os.desktopRef;

// The desktop icons are no longer hardcoded — they are the server-resolved `desktop` Placements
// (ADR-0023). Each pin gets a concrete grid cell (stored override, or auto-placed into the next
// free cell), the cell is projected to pixels, and a pin mid-drag follows the cursor by its offset.
interface DesktopIcon {
	key: string;
	ref: SurfaceRef;
	label: string;
	logo?: string;
	icon?: string;
	cell: { column: number; row: number };
	x: number;
	y: number;
	pin: ResolvedPlacement; // the resolved placement this tile renders — the target of its Remove menu
}
const pins = computed<ResolvedPlacement[]>(() => usePlacements().desktop());
const desktopIcons = computed<DesktopIcon[]>(() => {
	const list = pins.value;
	const cells = layoutDesktop(list, desktop.h);
	const drag = os.iconDragState;
	return list.map((p, i) => {
		const view = placementView(p);
		const cell = cells[i];
		const px = cellToPixel(cell, desktop.w);
		const dragging = drag.key === view.key;
		return {
			...view,
			cell,
			x: px.x + (dragging ? drag.dx : 0),
			y: px.y + (dragging ? drag.dy : 0),
			pin: p,
		};
	});
});

// Press-and-drag a desktop icon: hand the icon's current top-left and every OTHER pin's cell to the
// pointer loop, which on release snaps to a grid cell and calls back here to persist the move as a
// User-layer override (the frontend's only write path — never the baseline/Site rows). A press that
// doesn't move SELECTS the icon (Finder-style; opening is the @dblclick below), not opens it. A plain
// click replaces the selection with this icon; Cmd/Ctrl or Shift makes it an additive multi-select.
function onIconPointerDown(di: DesktopIcon, e: PointerEvent): void {
	// Only a primary-button press starts a drag; a right-click is a context menu (reka opens it),
	// never a move — and never the press that would otherwise select.
	if (e.button !== 0) return;
	clearRenameTimer(); // a new press voids any rename armed by the previous click
	const additive = e.metaKey || e.ctrlKey || e.shiftKey;
	// Clicking the LABEL of an already-focused icon arms a rename (Finder-style). Captured BEFORE we
	// (re)select: only when this icon was already the sole selection and the press hit its name.
	const armRename = !additive && os.soleSelectedIcon() === di.key && isLabelTarget(e.target);
	// Select on PRESS (Finder-style), not on release — the highlight must appear the instant you
	// click, and stay lit while you drag. A plain press replaces; Cmd/Ctrl or Shift toggles.
	os.selectIcon(di.key, { additive });
	const px = cellToPixel(di.cell, desktop.w);
	const occupied = desktopIcons.value.filter((o) => o.key !== di.key).map((o) => o.cell);
	os.startIconDrag(di.key, px.x, px.y, occupied, (cell, moved) => {
		// A real move persists a User-layer position override (the frontend's only write path). A press
		// that didn't move on an already-focused label arms rename — after a beat, so a double-click
		// (which opens) can cancel it first; the delay is what disambiguates single-click from double.
		if (moved) writePlacementOverride({ region: "desktop", ref: di.ref, position: cell });
		else if (armRename) renameTimer = window.setTimeout(() => startRename(di), 250);
	}, e);
}

// The rename gesture: a click on a focused icon's label (armed above) opens the editor after a short
// delay; a double-click cancels that pending rename and opens the app instead. `data-icon-label` on
// the name span is how the press tells a label-click from an icon-click.
let renameTimer: number | null = null;
function clearRenameTimer(): void {
	if (renameTimer != null) {
		clearTimeout(renameTimer);
		renameTimer = null;
	}
}
function isLabelTarget(target: EventTarget | null): boolean {
	return !!(target as HTMLElement | null)?.closest?.("[data-icon-label]");
}
function onIconDblClick(di: DesktopIcon): void {
	clearRenameTimer();
	os.openRef(di.ref);
}

// Inline rename of a desktop icon (ADR-0023): the "Rename" tile-menu entry swaps this pin's label for
// an input seeded with its current name. Commit (Enter / blur) persists a User-layer label override —
// the same write path as a move — when the name actually changed; an empty name clears the override
// back to the reference-derived label. Escape cancels. Only one icon renames at a time.
const renamingKey = ref<string | null>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
// The rename input lives inside the icon v-for, where a STRING ref collects an array — autofocus
// would miss it, and an unfocused input never fires its Enter/Esc/blur handlers, trapping edit mode.
// A function ref binds the single mounted input (only one matches renamingKey) directly.
function setRenameInput(el: Element | ComponentPublicInstance | null): void {
	renameInput.value = el as HTMLInputElement | null;
}
async function startRename(di: DesktopIcon): Promise<void> {
	renamingKey.value = di.key;
	renameDraft.value = di.label;
	await nextTick();
	// Focus on the NEXT FRAME, not just nextTick. When Rename comes from the context menu, reka's
	// focus scope is still tearing down this tick and would trap/revert an immediate focus — leaving
	// the input focused-looking but un-editable until you click it. A frame later the menu is gone.
	requestAnimationFrame(() => {
		renameInput.value?.focus();
		renameInput.value?.select();
	});
}
function commitRename(di: DesktopIcon): void {
	if (renamingKey.value !== di.key) return;
	renamingKey.value = null;
	// Collapse whitespace so " My   App " never persists doubled/edge spaces; an empty result clears
	// the override back to the reference-derived default (the placeholder the user saw while editing).
	const name = renameDraft.value.trim().replace(/\s+/g, " ");
	if (name !== di.label) writePlacementOverride({ region: "desktop", ref: di.ref, label: name });
}
function cancelRename(): void {
	renamingKey.value = null;
}
// Return / F2 renames the one selected desktop icon (Finder-style; double-click still opens). Bails
// while already renaming — so the rename input's own Return commits instead of re-opening the editor.
function isEditableTarget(el: EventTarget | null): boolean {
	const node = el as HTMLElement | null;
	return !!node && (node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName));
}
function startRenameSelected(target: EventTarget | null): boolean {
	if (renamingKey.value || isEditableTarget(target)) return false;
	const key = os.soleSelectedIcon();
	const di = key ? desktopIcons.value.find((d) => d.key === key) : undefined;
	if (!di) return false;
	startRename(di);
	return true;
}
// Desktop icon labels sit on top of an arbitrary wallpaper. Following macOS Finder: one treatment
// for every wallpaper — slightly heavier white text with a soft two-layer dark halo (a tight ring
// plus a drop shadow), no box. The wide blur is what keeps it legible over busy or light backgrounds.
const desktopLabelStyle =
	"font-size:12px;line-height:1.3;text-align:center;font-weight:500;color:#fff;" +
	"text-shadow:0 0 3px rgba(0,0,0,0.55),0 1px 4px rgba(0,0,0,0.5);";
// A tile label caps at two lines and ellipsizes the overflow (long doctype/record names never push
// the grid around). Applied only to the STATIC label span — the rename input keeps its single-line,
// content-sized shape (it appends its own sizing to desktopLabelStyle below, not this clamp).
const desktopLabelClamp =
	"display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%;word-break:break-word;";
// Rename edits in place: the input keeps the label's exact white-halo typography so the text never
// jumps to a dark-on-white box. A soft dark pill (same visual language as the halo) plus a white
// caret are the only "you're editing" cues — legible over any wallpaper, no harsh mode switch.
// field-sizing:content makes the input hug its text (like the label span it replaces) instead of
// spanning the whole cell; min-width keeps an empty field clickable, max-width caps it at the tile.
const renameInputStyle =
	desktopLabelStyle +
	"field-sizing:content;min-width:2.5ch;max-width:100%;box-sizing:content-box;" +
	"background:rgba(0,0,0,0.5);border-radius:5px;caret-color:#fff;outline:none;padding:0 4px;";
// A selected icon's highlight must clearly OUTRANK the faint hover wash (so selected ≠ hovered) and
// stay legible over ANY wallpaper. Same two-layer trick as the label halo: a translucent white fill
// carries dark wallpapers, and a hairline dark outer ring defines the edge on light ones.
const iconSelectedStyle = {
	background: "rgba(255,255,255,0.20)",
	boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.42), 0 0 0 1px rgba(0,0,0,0.18)",
};


// Right-click the wallpaper: a context menu (OSContextMenu, the shell's one menu primitive) rather
// than jumping straight into Settings. The entries render from the resolver (the `desktop:context`
// Region), not a literal array — so any app/site/user can contribute or customize them (ADR-0001).
const desktopMenuItems = computed(() => desktopContextItems(os));

// The one global keyboard listener. Command shortcuts (⌘K palette, ⌘N new window, …) are dispatched
// through the OS dispatcher (ADR-0037) — the SAME eligibility/invoke path as the menus, no bespoke
// per-key wiring. Escape (modal dismiss) and Return/F2 (rename the selected icon) are desktop
// gestures, not Command verbs, so they stay here.
function onKey(e: KeyboardEvent) {
	if (dispatchShortcut(e, os)) {
		e.preventDefault();
		return;
	}
	if ((e.key === "Enter" || e.key === "F2") && startRenameSelected(e.target)) {
		e.preventDefault();
		return;
	}
	if (e.key === "Escape") {
		os.state.paletteOpen = false;
		os.state.menu = null;
	}
}
const move = (e: PointerEvent) => os.onPointerMove(e);
const up = () => os.onPointerUp();
// Reload / tab-close guard (ADR-0029): stay silent unless a window holds an unsaved ephemeral
// draft, then trip the browser's native confirm. Durable state is already on disk, so it's safe.
function onBeforeUnload(e: BeforeUnloadEvent) {
	if (!dirtyWindows().length) return;
	e.preventDefault();
	e.returnValue = "";
}
onMounted(() => {
	os.syncDesktopSize();
	window.addEventListener("keydown", onKey);
	window.addEventListener("pointermove", move);
	window.addEventListener("pointerup", up);
	window.addEventListener("resize", os.syncDesktopSize);
	window.addEventListener("beforeunload", onBeforeUnload);
});
onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKey);
	window.removeEventListener("pointermove", move);
	window.removeEventListener("pointerup", up);
	window.removeEventListener("resize", os.syncDesktopSize);
	window.removeEventListener("beforeunload", onBeforeUnload);
});
</script>

<template>
	<!-- isolation:isolate makes the desktop its own stacking context, so every
       window/chrome z-index stays local. That same sandbox means popovers
       portaled to <body> can't reliably paint above the desktop, so reka-ui
       popovers (frappe-ui Dropdown, …) are portaled into #os-popover-layer
       below, which sits at the top of the desktop's own z-index scale. -->
	<div
		:ref="(el) => os.setDesktopEl(el as HTMLElement | null)"
		:data-active-window="os.state.activeId || ''"
		class="relative h-screen w-full overflow-hidden bg-surface-gray-3 text-ink-gray-8 [font-family:var(--font-sans)] isolate"
	>
		<!-- wallpaper — right-click opens the desktop menu (OSContextMenu, one shell-wide primitive) -->
		<OSContextMenu :options="desktopMenuItems">
			<!-- a plain left-click on empty wallpaper clears the icon selection (Finder-style); a
			     right-click opens the menu and fires `contextmenu`, not `click`, so the menu is safe -->
			<div class="absolute inset-0 z-0" :style="wpStyle" @click="os.clearIconSelection()"></div>
		</OSContextMenu>

		<!-- desktop icons: edge-anchored grid cells (ADR-0023), each absolutely positioned at its
		     cell's projected pixel; drag snaps to a cell and writes a User-layer override. -->
		<OSContextMenu
			v-for="di in desktopIcons"
			:key="di.key"
			:options="tileMenuOptions(di.pin, { onRename: () => startRename(di) })"
		>
			<div
				class="absolute z-[1] flex flex-col items-center gap-[5px] rounded-lg border-none px-0.5 py-1.5"
				:class="[
					os.iconDragState.key === di.key ? 'z-[2] cursor-grabbing opacity-90' : '',
					os.isIconSelected(di.key) ? '' : 'hover:bg-[var(--surface-alpha-white-3)]',
				]"
				:style="{
					left: di.x + 'px',
					top: di.y + 'px',
					width: CELL_W - 14 + 'px',
					...(os.isIconSelected(di.key) ? iconSelectedStyle : {}),
				}"
				@pointerdown="onIconPointerDown(di, $event)"
				@dblclick="onIconDblClick(di)"
			>
				<AppIconTile :logo="di.logo" :icon="di.icon" :label="di.label" />
				<input
					v-if="renamingKey === di.key"
					:ref="setRenameInput"
					v-model="renameDraft"
					:placeholder="defaultLabel(di.pin)"
					:style="renameInputStyle"
					@pointerdown.stop
					@mousedown.stop
					@click.stop
					@keydown.enter.prevent="commitRename(di)"
					@keydown.esc.prevent="cancelRename()"
					@blur="commitRename(di)"
				/>
				<span v-else data-icon-label :style="desktopLabelStyle + desktopLabelClamp">{{ di.label }}</span>
			</div>
		</OSContextMenu>

		<!-- windows -->
		<OSWindow v-for="w in os.state.windows" :key="w.id" :win="w" />

		<!-- split exit pill -->
		<button
			v-if="os.state.split"
			class="absolute left-1/2 top-[42px] z-[80] inline-flex h-[30px] -translate-x-1/2 cursor-pointer items-center gap-[7px] rounded-full border border-outline-gray-2 bg-surface-base px-[14px] text-[12px] font-medium text-ink-gray-7 shadow-[var(--shadow-lg)]"
			@click="os.exitSplit()"
		>
			<span class="lucide-columns-2 size-[14px]"></span>Exit split view
		</button>

		<MenuBar />
		<Dock />
		<CommandPalette />
		<CloseConfirmDialog />
		<AboutDialog />
		<FullscreenPrompt />
		<ToastProvider />
		<div id="os-popover-layer" class="absolute z-[94000]"></div>

		<!-- the floating drag ghost: a tile being dragged OUT (a Finder drag-out, #04) has no
		     on-desktop element to follow the cursor, so we paint one here, centered on the pointer,
		     above everything and click-through. A desktop-icon move sets no ghost and renders none. -->
		<div
			v-if="os.dragGhost.view"
			class="pointer-events-none fixed z-[95000]"
			:style="{
				left: os.dragGhost.x - 23 + 'px',
				top: os.dragGhost.y - 23 + 'px',
				opacity: 0.9,
				transform: 'scale(1.05)',
			}"
		>
			<AppIconTile :logo="os.dragGhost.view.logo" :icon="os.dragGhost.view.icon" :label="os.dragGhost.view.label" />
		</div>
	</div>
</template>
