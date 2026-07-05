<script setup lang="ts">
// The Finder's title-bar nav, rendered inside WindowChrome's default slot (mirroring AppToolbar):
// the "Finder" title on the left and a search box on the right. Typing narrows the body's tiles by
// label — the query is the Finder-singleton state (search.ts) that FinderBody reads. Escape or the
// clear button empties it. The interactive zone stops pointer/keyboard events so the title bar's
// drag/zoom and the desktop's global shortcuts don't fire while the box is in use.
import { computed } from 'vue'
import { useOS } from '@/desktop'
import { finderQuery, setFinderQuery, clearFinderQuery } from './search'
// OsWindow feeds defineProps, so import it from the concrete module, not the @/types barrel (its
// `export *` breaks @vue/compiler-sfc's macro resolver — see summary.md gotcha).
import type { OsWindow } from '@/surface/types'

const props = defineProps<{ win: OsWindow }>()
const os = useOS()
const focused = computed(() => os.state.activeId === props.win.id)
const query = computed<string>({ get: finderQuery, set: setFinderQuery })
</script>

<template>
  <span
    class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold"
    :class="focused ? 'text-ink-gray-8' : 'text-ink-gray-5'"
    >Finder</span
  >
  <span class="flex-1"></span>
  <!-- Search: a compact, recessed macOS-style search pill, right-aligned. Filters the body's tiles
       by label (search.ts); .stop keeps clicks/keys off the bar's drag-zoom and the desktop's
       global shortcuts. -->
  <div
    class="flex h-[26px] w-[168px] flex-shrink-0 items-center gap-1.5 rounded-md bg-surface-gray-2 px-2"
    @pointerdown.stop
    @dblclick.stop
  >
    <span class="lucide-search size-[13px] flex-shrink-0 text-ink-gray-4"></span>
    <input
      v-model="query"
      type="text"
      placeholder="Search"
      autocomplete="off"
      class="min-w-0 flex-1 appearance-none !border-none !bg-transparent text-[12px] text-ink-gray-8 placeholder-ink-gray-4 !shadow-none !outline-none !ring-0 [font-family:var(--font-sans)] focus:!border-none focus:!shadow-none focus:!outline-none focus:!ring-0"
      @keydown.esc.prevent="clearFinderQuery()"
      @keydown.stop
    />
    <button
      v-if="query"
      class="flex flex-shrink-0 cursor-pointer items-center rounded-full border-none bg-transparent p-0 text-ink-gray-4 hover:text-ink-gray-7"
      title="Clear search"
      @click="clearFinderQuery()"
    >
      <span class="lucide-circle-x size-[13px]"></span>
    </button>
  </div>
</template>
