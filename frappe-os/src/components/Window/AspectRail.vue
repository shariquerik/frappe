<script setup lang="ts">
// The form Surface's left sidebar (ADR-0018): the record's Aspects — Details / Activities /
// Email — one of which is selected at a time. Replaces the app nav rail (AppSidebar) when the
// window hosts a form. The Aspect set is a hardcoded built-in array (core-for-now); selecting
// one emits its stable id. Built on frappe-ui's SidebarItem to match AppSidebar.
import { SidebarItem } from 'frappe-ui'
import { FORM_ASPECTS } from '@/surface'

defineProps<{ selected: string }>()
const emit = defineEmits<{ select: [string] }>()
</script>

<template>
  <div
    class="flex w-60 flex-shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-outline-gray-1 bg-surface-sidebar p-2"
  >
    <SidebarItem
      v-for="a in FORM_ASPECTS"
      :key="a.id"
      :label="a.label"
      :icon="a.icon"
      :data-aspect="a.id"
      :isActive="selected === a.id"
      :onClick="() => emit('select', a.id)"
    />
  </div>
</template>
