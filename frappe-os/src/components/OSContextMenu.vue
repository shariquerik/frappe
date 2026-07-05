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
  ContextMenuSeparator,
} from 'reka-ui'

defineProps<{ options: ContextMenuOption[] }>()

// A destructive item inks red and highlights on a red wash; everything else is neutral gray —
// mirroring frappe-ui's own menu themes so the two menu families read the same.
function itemInk(option: ContextMenuOption): string {
  return option.theme === 'red'
    ? 'text-ink-red-6 data-[highlighted]:bg-surface-red-3'
    : 'text-ink-gray-8 data-[highlighted]:bg-surface-gray-2'
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal to="#os-popover-layer">
      <ContextMenuContent
        class="z-[95001] flex min-w-[180px] flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)] focus:outline-none"
      >
        <template v-for="(option, i) in options" :key="i">
          <ContextMenuSeparator v-if="option.separator" class="my-[5px] h-px bg-outline-gray-2" />
          <ContextMenuItem
            v-else
            :disabled="option.disabled"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-[10px] py-[7px] text-[12.5px] outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40"
            :class="itemInk(option)"
            @select="option.onClick?.()"
          >
            <span v-if="option.icon" :class="[option.icon, 'size-[15px]']"></span>
            {{ option.label }}
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
