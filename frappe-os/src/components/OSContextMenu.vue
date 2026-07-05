<script lang="ts">
// The option shape OSContextMenu renders — a flat menu item, a separator, or a submenu parent. Kept
// framework-free (no frappe-ui / reka import) so option builders (tileMenuOptions, dockContextOptions,
// desktopContextItems) can be unit-tested without dragging in the component's render graph. This is
// the SINGLE context-menu primitive for the whole shell — desktop icons, dock tiles, the dock tray,
// and the wallpaper all render through it, so their items look and behave identically (ADR-0001).
export interface ContextMenuOption {
  label?: string
  onClick?: () => void
  icon?: string // a lucide class, drawn before the label
  theme?: 'gray' | 'red' // red marks a destructive item (Remove, Delete)
  disabled?: boolean
  separator?: boolean // a divider instead of an item — label / onClick are ignored
  selected?: boolean // a trailing checkmark (the live choice, e.g. the current dock position)
  submenu?: ContextMenuOption[] // a nested menu — this item is a parent holder, its own onClick ignored
  // The item's onClick moves focus itself (e.g. Rename opens an inline input). Without this, reka
  // returns focus to the trigger as the menu closes and steals the caret back out of that input.
  keepsFocus?: boolean
}
</script>

<script setup lang="ts">
// OSContextMenu — the desktop shell's declarative right-click menu. Wrap any single element in the
// default slot; reka-ui opens a cursor-anchored menu on right-click and owns the outside-click,
// Escape, and focus behaviour for us. Its content portals into #os-popover-layer (like OSDropdown)
// so it paints above windows and the dock despite the desktop's isolation:isolate sandbox. `open`
// is surfaced via `update:open` so a caller can react to the menu's lifetime (the dock keeps itself
// revealed while any of its menus is open). Built on reka-ui — the same primitives frappe-ui's own
// ContextMenu wraps — because that wrapper hardcodes a <body> portal we can't redirect into the
// desktop's popover layer.
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from 'reka-ui'

defineProps<{ options: ContextMenuOption[] }>()
defineEmits<{ 'update:open': [boolean] }>()

// Shared class strings so an item, a submenu trigger, and a submenu leaf are pixel-identical, and
// the menu surface matches between the root content and a submenu's content.
const MENU = 'min-w-40 rounded-lg bg-surface-elevation-2 p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none'
const ITEM = 'flex min-h-7 w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-base outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-gray-4 data-[highlighted]:bg-surface-alpha-gray-2 data-[state=open]:bg-surface-alpha-gray-2'

// The item's text + highlight wash, mirroring frappe-ui's Menu — gray by default, red for a
// destructive item.
function itemClass(option: ContextMenuOption): string {
  return option.theme === 'red' ? 'text-ink-red-6 data-[highlighted]:bg-surface-red-3' : 'text-ink-gray-7'
}

// The leading icon's ink — one notch softer than the label, red on a destructive item.
function iconClass(option: ContextMenuOption): string {
  return option.theme === 'red' ? 'text-ink-red-6' : 'text-ink-gray-6'
}

// Run an item's action, remembering if it manages focus itself (keepsFocus). On close, reka's
// closeAutoFocus normally hands focus back to the trigger — we preventDefault that for a keepsFocus
// item so the input its onClick just focused (Rename's inline editor) keeps the caret.
let keepFocusOnClose = false
function onSelect(option: ContextMenuOption): void {
  keepFocusOnClose = !!option.keepsFocus
  option.onClick?.()
}
function onCloseAutoFocus(event: Event): void {
  if (keepFocusOnClose) event.preventDefault()
  keepFocusOnClose = false
}
</script>

<template>
  <ContextMenuRoot @update:open="$emit('update:open', $event)">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal to="#os-popover-layer">
      <ContextMenuContent :class="MENU" @close-auto-focus="onCloseAutoFocus">
        <template v-for="(option, i) in options" :key="i">
          <div v-if="option.separator" class="-mx-1.5 my-1.5 border-t border-outline-elevation-2"></div>

          <!-- submenu parent: opens a nested menu, no click of its own -->
          <ContextMenuSub v-else-if="option.submenu">
            <ContextMenuSubTrigger :class="[ITEM, itemClass(option)]">
              <span v-if="option.icon" :class="[option.icon, 'size-4 shrink-0', iconClass(option)]"></span>
              <span class="min-w-0 flex-1">{{ option.label }}</span>
              <span class="lucide-chevron-right size-4 shrink-0 text-ink-gray-5"></span>
            </ContextMenuSubTrigger>
            <ContextMenuPortal to="#os-popover-layer">
              <ContextMenuSubContent :class="MENU">
                <ContextMenuItem
                  v-for="(sub, j) in option.submenu"
                  :key="j"
                  :disabled="sub.disabled"
                  :class="[ITEM, itemClass(sub)]"
                  @select="onSelect(sub)"
                >
                  <span v-if="sub.icon" :class="[sub.icon, 'size-4 shrink-0', iconClass(sub)]"></span>
                  <span class="min-w-0 flex-1">{{ sub.label }}</span>
                  <span v-if="sub.selected" class="lucide-check size-4 shrink-0 text-ink-gray-6"></span>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>

          <!-- leaf item -->
          <ContextMenuItem
            v-else
            :disabled="option.disabled"
            :class="[ITEM, itemClass(option)]"
            @select="onSelect(option)"
          >
            <span v-if="option.icon" :class="[option.icon, 'size-4 shrink-0', iconClass(option)]"></span>
            <span class="min-w-0 flex-1">{{ option.label }}</span>
            <span v-if="option.selected" class="lucide-check size-4 shrink-0 text-ink-gray-6"></span>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
