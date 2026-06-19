<script setup lang="ts">
// ⌘K command palette — custom centered/blurred overlay (the spotlight look is
// outside frappe-ui Dialog's chrome). Searches apps + doctype lists + records.
import { ref, watch, nextTick } from 'vue'
import { useOS } from '@/store'
const os = useOS()
const inputEl = ref<HTMLInputElement | null>(null)
watch(() => os.state.paletteOpen, (open) => { if (open) nextTick(() => inputEl.value?.focus()) })
</script>

<template>
  <div v-if="os.state.paletteOpen" class="absolute inset-0 z-[95000] flex items-start justify-center bg-surface-alpha-gray-4 pt-[13vh] backdrop-blur-[3px] [animation:osFade_.12s_ease]" @click="os.closePalette()">
    <div class="w-[560px] max-w-[92vw] overflow-hidden rounded-[14px] border border-outline-gray-2 bg-surface-base shadow-[var(--shadow-2xl)] [animation:osPop_.14s_ease]" @click.stop>
      <div class="flex items-center gap-2.5 border-b border-outline-gray-1 px-4 py-[14px]">
        <span class="lucide-search size-[18px] text-ink-gray-4"></span>
        <input ref="inputEl" v-model="os.state.paletteQuery" placeholder="Search apps, doctypes, records…" class="flex-1 border-none bg-transparent text-[15px] text-ink-gray-9 outline-none [font-family:var(--font-sans)]" />
        <span class="rounded-[5px] border border-outline-gray-2 bg-surface-gray-2 px-[7px] py-[2px] text-[11px] text-ink-gray-4">esc</span>
      </div>
      <div class="max-h-[52vh] overflow-auto p-[7px]">
        <div v-for="(r, i) in os.paletteResults.value" :key="i" class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-gray-2" @click="r.run()">
          <span class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] bg-surface-gray-2 text-ink-gray-6"><span :class="r.icon" class="size-[15px]"></span></span>
          <div class="flex min-w-0 flex-col gap-px"><span class="text-[13.5px] text-ink-gray-9">{{ r.label }}</span><span class="text-[11px] text-ink-gray-4">{{ r.sub }}</span></div>
          <span class="ml-auto flex-shrink-0 text-[11px] text-ink-gray-4">{{ r.kindLabel }}</span>
        </div>
        <div v-if="!os.paletteResults.value.length" class="p-[26px] text-center text-[13px] text-ink-gray-4">No matches for "{{ os.state.paletteQuery }}"</div>
      </div>
    </div>
  </div>
</template>
