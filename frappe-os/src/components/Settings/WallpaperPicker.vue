<script setup lang="ts">
// Wallpaper picker body — rendered inside a desktop Window (OSWindow's 'wallpaper'
// role supplies the chrome/title bar). A gallery of wallpapers; the current one is ringed.
import { useOS } from '@/desktop'
const os = useOS()
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto p-[18px]">
    <div class="grid grid-cols-4 gap-[14px]">
      <button v-for="wp in os.wallpaperDefs()" :key="wp.id" class="flex cursor-pointer flex-col gap-[7px] border-none bg-transparent p-0 [font-family:var(--font-sans)]" @click="os.setWallpaper(wp.id)">
        <span class="block h-[78px] w-full rounded-[10px] shadow-[var(--shadow-sm)] outline-offset-1" :style="{ background: wp.bg, border: wp.id===os.currentWp.value.id ? '2px solid #0d8ef8' : '2px solid var(--outline-gray-2)', outline: wp.id===os.currentWp.value.id ? '2px solid #0d8ef8' : 'none' }"></span>
        <span class="text-center text-[12px]" :style="{ color: wp.id===os.currentWp.value.id ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)', fontWeight: wp.id===os.currentWp.value.id ? 600 : 400 }">{{ wp.label }}</span>
      </button>
    </div>
  </div>
</template>
