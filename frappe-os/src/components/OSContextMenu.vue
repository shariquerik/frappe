<script lang="ts">
// The option shape OSContextMenu renders — a flat menu item, or a separator. Kept framework-free
// (no frappe-ui / reka import) so option builders like tileMenuOptions can be unit-tested without
// dragging in the component's render graph. Grows a submenu / checkmark variant when the dock menu
// migrates onto this primitive.
export interface ContextMenuOption {
  label?: string
  onClick?: () => void
  icon?: string // a lucide class, drawn before the label
  theme?: 'gray' | 'red' // red marks a destructive item (Remove, Delete)
  disabled?: boolean
  separator?: boolean // a divider instead of an item — label / onClick are ignored
}
</script>

<script setup lang="ts">
// OSContextMenu — the desktop shell's declarative right-click menu. Wrap any single element in the
// default slot; reka-ui opens a cursor-anchored menu on right-click and owns the outside-click,
// Escape, and focus behaviour for us. Its content portals into #os-popover-layer (like OSDropdown)
// so it paints above windows and the dock despite the desktop's isolation:isolate sandbox. Built on
// reka-ui — the same primitives frappe-ui's own ContextMenu wraps — because that wrapper hardcodes a
// <body> portal we can't redirect into the desktop's popover layer.
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
} from 'reka-ui'

defineProps<{ options: ContextMenuOption[] }>()

// The item's text + highlight wash, mirroring frappe-ui's Menu (getMenuTextColor /
// getMenuBackgroundColor) so this menu is pixel-identical to the dock and menu-bar dropdowns —
// gray by default, red for a destructive item.
function itemClass(option: ContextMenuOption): string {
  return option.theme === 'red'
    ? 'text-ink-red-6 focus:bg-surface-red-3 data-[highlighted]:bg-surface-red-3'
    : 'text-ink-gray-7 focus:bg-surface-gray-2 data-[highlighted]:bg-surface-alpha-gray-2'
}

// The leading icon's ink — one notch softer than the label, red on a destructive item (matches
// frappe-ui's getMenuIconColor).
function iconClass(option: ContextMenuOption): string {
  return option.theme === 'red' ? 'text-ink-red-6' : 'text-ink-gray-6'
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal to="#os-popover-layer">
      <ContextMenuContent
        class="min-w-40 divide-y divide-outline-elevation-2 rounded-lg bg-surface-elevation-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="p-1.5">
          <template v-for="(option, i) in options" :key="i">
            <div v-if="option.separator" class="-mx-1.5 my-1.5 h-px bg-outline-elevation-2"></div>
            <ContextMenuItem
              v-else
              :disabled="option.disabled"
              class="flex min-h-7 w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-base outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-gray-4"
              :class="itemClass(option)"
              @select="option.onClick?.()"
            >
              <span v-if="option.icon" :class="[option.icon, 'size-4 shrink-0', iconClass(option)]"></span>
              <span class="min-w-0 flex-1">{{ option.label }}</span>
            </ContextMenuItem>
          </template>
        </div>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
