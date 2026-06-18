<script setup lang="ts">
// frappe-ui Dropdown, preconfigured for the desktop. It portals its menu into
// #os-popover-layer (defined in App.vue), which sits at the top of the desktop's
// isolated z-index scale — so menus paint above windows and the menu bar without
// each call site having to know about portals or z-index. Use this for any menu
// rendered on the OS desktop; all props and slots are forwarded to Dropdown.
import { Dropdown } from 'frappe-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Dropdown portal-to="#os-popover-layer" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </Dropdown>
</template>
