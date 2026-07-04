<script setup lang="ts">
// frappe-ui Dropdown, preconfigured for the desktop. It portals its menu into
// #os-popover-layer (defined in App.vue), which sits at the top of the desktop's
// isolated z-index scale — so menus paint above windows and the menu bar without
// each call site having to know about portals or z-index. Use this for any menu
// rendered on the OS desktop; all props and slots are forwarded to Dropdown.
//
// It also draws the keyboard-shortcut chip (ADR-0037): a desktop dropdown shows an item's
// `shortcut` glyph (⌘N) as trailing presentation, so every menu-bar menu gets chips for free. This
// is the default #item-suffix; a call site that passes its own item-suffix slot overrides it.
import { useSlots } from 'vue'
import { Dropdown } from 'frappe-ui'

defineOptions({ inheritAttrs: false })
const slots = useSlots()
</script>

<template>
  <Dropdown portal-to="#os-popover-layer" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
    <template v-if="!slots['item-suffix']" #item-suffix="{ item }">
      <kbd
        v-if="item.shortcut"
        class="ml-6 font-sans text-xs tabular-nums text-ink-gray-4"
        >{{ item.shortcut }}</kbd
      >
    </template>
  </Dropdown>
</template>
