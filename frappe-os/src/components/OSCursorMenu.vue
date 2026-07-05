<script setup lang="ts">
// A small floating context menu pinned to the cursor. Generic and presentation-only: the
// opener owns the menu state and the item handlers, this just renders the items at (x, y)
// and dismisses on an outside click / Escape (emitting `close`). A full-screen catcher
// behind the menu swallows the dismissing click — mirrors the Dock chooser's pattern.
import { onMounted, onUnmounted } from 'vue'

defineProps<{
  x: number
  y: number
  items: { label: string; onClick: () => void }[]
}>()
const emit = defineEmits<{ close: [] }>()

// Esc closes too — a context menu should never trap focus.
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- click-catcher: an outside click (or right-click) dismisses the menu -->
  <div class="fixed inset-0 z-[95000]" @pointerdown="emit('close')" @contextmenu.prevent="emit('close')"></div>
  <div
    class="fixed z-[95001] flex min-w-[180px] flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)]"
    :style="{ left: x + 'px', top: y + 'px' }"
    @pointerdown.stop
    @contextmenu.prevent.stop
  >
    <button
      v-for="item in items"
      :key="item.label"
      class="w-full cursor-pointer rounded-lg border-none bg-transparent px-[10px] py-[7px] text-left text-[12.5px] text-ink-gray-8 hover:!bg-surface-gray-2"
      @click="item.onClick(); emit('close')"
    >
      {{ item.label }}
    </button>
  </div>
</template>
