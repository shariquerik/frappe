<script setup lang="ts">
// The OS-owned placeholder a Window shows when its app declares no default surface and has no
// dashboard — rung 4 of the default-surface resolver (ADR-0021). It keeps every declared OS
// app openable rather than blank, naming the app so the empty state is legible. The dormant
// rung-3 (first doctype list) will replace it once the nav-source decision lands.
defineProps<{ appName: string }>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
    <span class="lucide-layout-dashboard size-7 text-ink-gray-4"></span>
    <div class="text-md font-semibold text-ink-gray-7">{{ appName }}</div>
    <div class="text-[12.5px] text-ink-gray-4">No default screen configured for this app</div>
  </div>
</template>
