<script setup lang="ts">
// The form Surface's left sidebar (ADR-0018): the record's Aspects — Details / Activities /
// Email — one of which is selected at a time. Replaces the app nav rail (AppSidebar) when the
// window hosts a form. The Aspect set is a hardcoded built-in array (core-for-now); selecting
// one emits its stable id. Styled on frappe-ui tokens to match AppSidebar.
import { FORM_ASPECTS } from '@/surface'

defineProps<{ selected: string }>()
defineEmits<{ select: [string] }>()
</script>

<template>
  <div
    class="flex w-[228px] flex-shrink-0 flex-col overflow-hidden border-r border-outline-gray-1 bg-surface-gray-1"
  >
    <div class="flex-1 overflow-auto px-2 py-2.5">
      <div
        v-for="a in FORM_ASPECTS"
        :key="a.id"
        class="my-px flex h-[30px] cursor-pointer items-center gap-2.5 rounded-[7px] px-[9px]"
        :data-aspect="a.id"
        @click="$emit('select', a.id)"
        :class="selected === a.id ? 'bg-surface-gray-3' : ''"
      >
        <span :class="a.icon" class="size-[15px] text-ink-gray-5 flex-shrink-0"></span>
        <span
          class="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
          :class="selected === a.id ? 'font-semibold text-ink-gray-9' : 'font-normal text-ink-gray-7'"
          >{{ a.label }}</span
        >
      </div>
    </div>
  </div>
</template>
