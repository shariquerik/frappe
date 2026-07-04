<script setup lang="ts">
// ⌘K command palette — custom centered/blurred overlay (the spotlight look is outside
// frappe-ui Dialog's chrome). Searches apps + applets + doctype lists + live records.
// Gameplan-style layout: grouped sections with muted headers, bare-icon rows, full
// keyboard navigation (↓↑ / ↵ / esc) driving one highlighted active row, and a footer
// hint bar with the key legend.
import { computed, ref, watch, nextTick } from 'vue'
import { useOS } from '@/desktop'
// Concrete module, not the @/types barrel — see the compiler-sfc macro gotcha in summary.md.
import type { PaletteItem } from '@/config/types'

const os = useOS()
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const active = ref(0)

const KIND_SECTIONS: Record<string, string> = {
  Recent: 'Recents',
  App: 'Applications',
  Applet: 'Applets',
  List: 'Lists',
  Record: 'Records',
  Setting: 'Settings',
  Command: 'Commands',
}

// Group results by kind (sections ordered by their best-ranked member), then index rows
// in DISPLAY order — the single active-index drives highlight, ↓↑ and Enter, so keyboard
// order must match what's on screen, not the pre-grouping rank order.
const groups = computed(() => {
  const byTitle = new Map<string, PaletteItem[]>()
  os.paletteResults.value.forEach((item: PaletteItem) => {
    const title = KIND_SECTIONS[item.kindLabel] || item.kindLabel
    if (!byTitle.has(title)) byTitle.set(title, [])
    byTitle.get(title)!.push(item)
  })
  let index = 0
  return [...byTitle].map(([title, items]) => ({
    title,
    rows: items.map((item) => ({ item, index: index++ })),
  }))
})
// The flat list in display order — what the active index addresses.
const ordered = computed(() => groups.value.flatMap((g) => g.rows.map((r) => r.item)))
const count = computed(() => ordered.value.length)

watch(() => os.state.paletteOpen, (open) => {
  if (open) { active.value = 0; nextTick(() => inputEl.value?.focus()) }
})
watch(() => os.state.paletteQuery, () => { active.value = 0 })
// Late-arriving record hits can shrink the list (stale rows replaced); keep active in range.
watch(count, (n) => { if (active.value >= n) active.value = Math.max(0, n - 1) })

function move(delta: number) {
  if (!count.value) return
  active.value = (active.value + delta + count.value) % count.value
  nextTick(() => listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
}
const choose = () => ordered.value[active.value]?.run()
</script>

<template>
  <div v-if="os.state.paletteOpen" class="absolute inset-0 z-[95000] flex items-start justify-center bg-surface-alpha-gray-4 pt-[13vh] backdrop-blur-[3px] [animation:osFade_.12s_ease]" @click="os.closePalette()">
    <div class="flex max-h-[62vh] w-[560px] max-w-[92vw] flex-col overflow-hidden rounded-[14px] border border-outline-gray-2 bg-surface-base shadow-[var(--shadow-2xl)] [animation:osPop_.14s_ease]" @click.stop>
      <div class="flex items-center gap-3 border-b border-outline-gray-1 px-[18px] py-3">
        <span class="lucide-search size-4 text-ink-gray-7"></span>
        <input
          ref="inputEl"
          v-model="os.state.paletteQuery"
          placeholder="Search"
          autocomplete="off"
          class="flex-1 appearance-none !border-none !bg-transparent text-base text-ink-gray-8 placeholder-ink-gray-4 !shadow-none !outline-none !ring-0 [font-family:var(--font-sans)] focus:!border-none focus:!shadow-none focus:!outline-none focus:!ring-0"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="choose()"
          @keydown.esc.prevent="os.closePalette()"
        />
      </div>
      <div ref="listEl" class="min-h-0 flex-1 overflow-auto pb-2">
        <div v-for="group in groups" :key="group.title" class="mb-2 mt-[18px] first:mt-3">
          <div class="mb-2.5 px-[18px] text-base text-ink-gray-5">{{ group.title }}</div>
          <div v-for="{ item, index } in group.rows" :key="index" class="px-2.5">
            <div
              :data-active="index === active"
              class="flex w-full min-w-0 cursor-pointer items-center rounded px-2 py-2 text-base font-medium text-ink-gray-8"
              :class="{ 'bg-surface-gray-3': index === active }"
              @mousemove="active = index"
              @click="item.run()"
            >
              <span :class="item.icon" class="mr-3 size-4 flex-shrink-0 text-ink-gray-7"></span>
              <span class="overflow-hidden text-ellipsis whitespace-nowrap">{{ item.label }}</span>
              <span class="ml-auto whitespace-nowrap pl-2 font-normal text-ink-gray-5">{{ item.sub }}</span>
            </div>
          </div>
        </div>
        <div v-if="!count" class="p-[26px] text-center text-base text-ink-gray-4">No matches for "{{ os.state.paletteQuery }}"</div>
      </div>
      <div class="flex items-center gap-4 border-t border-outline-gray-1 px-4 py-[9px] text-[11.5px] text-ink-gray-5">
        <span class="flex items-center gap-1.5">
          <kbd class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[6px] py-[1px] font-sans text-[11px] text-ink-gray-6">↓</kbd>
          <kbd class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[6px] py-[1px] font-sans text-[11px] text-ink-gray-6">↑</kbd>
          to navigate
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[6px] py-[1px] font-sans text-[11px] text-ink-gray-6">↵</kbd>
          to select
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[6px] py-[1px] font-sans text-[11px] text-ink-gray-6">esc</kbd>
          to close
        </span>
        <span class="ml-auto flex items-center gap-1.5">
          <kbd class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[6px] py-[1px] font-sans text-[11px] text-ink-gray-6">⌘K</kbd>
          to open
        </span>
      </div>
    </div>
  </div>
</template>
