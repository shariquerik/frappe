<script setup lang="ts">
// A labelled placeholder for a form Aspect whose data isn't wired yet (Activities / Email).
// The tracer-bullet slice (ADR-0018) proves the surface-driven sidebar + Aspect coordinate
// end-to-end before the timeline / Communication data is fetched — so this pane just names
// the Aspect and says "Coming soon". Details renders the real OSForm, never this.
import type { AspectDef } from '@/surface'

defineProps<{ aspect: AspectDef }>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
    <span :class="aspect.icon" class="size-7 text-ink-gray-4"></span>
    <div class="text-md font-semibold text-ink-gray-7">{{ aspect.label }}</div>
    <div class="text-[12.5px] text-ink-gray-4">Coming soon</div>
  </div>
</template>
