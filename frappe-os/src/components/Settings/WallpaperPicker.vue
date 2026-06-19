<script setup lang="ts">
// Wallpaper picker — custom centered/blurred overlay (gallery look, not a
// frappe-ui Dialog). 8 wallpapers; current one is ringed.
import { useOS } from '@/desktop'
const os = useOS()
</script>

<template>
  <div v-if="os.state.wpPicker" class="absolute inset-0 z-[95000] flex items-center justify-center bg-surface-alpha-gray-4 backdrop-blur-[3px] [animation:osFade_.12s_ease]" @click="os.closeWallpaper()">
    <div class="w-[620px] max-w-[92vw] overflow-hidden rounded-[14px] border border-outline-gray-2 bg-surface-base shadow-[var(--shadow-2xl)] [animation:osPop_.14s_ease]" @click.stop>
      <div class="flex items-center gap-2.5 border-b border-outline-gray-1 px-[18px] py-[15px]">
        <span class="lucide-image size-[17px] text-ink-gray-5"></span>
        <span class="text-[14px] font-semibold text-ink-gray-9">Wallpaper</span>
        <div class="flex-1"></div>
        <button class="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-ink-gray-5" @click="os.closeWallpaper()"><span class="lucide-x size-[16px]"></span></button>
      </div>
      <div class="grid grid-cols-4 gap-[14px] p-[18px]">
        <button v-for="wp in os.wallpaperDefs()" :key="wp.id" class="flex cursor-pointer flex-col gap-[7px] border-none bg-transparent p-0 [font-family:var(--font-sans)]" @click="os.setWallpaper(wp.id)">
          <span class="block h-[78px] w-full rounded-[10px] shadow-[var(--shadow-sm)] outline-offset-1" :style="{ background: wp.bg, border: wp.id===os.currentWp.value.id ? '2px solid #0d8ef8' : '2px solid var(--outline-gray-2)', outline: wp.id===os.currentWp.value.id ? '2px solid #0d8ef8' : 'none' }"></span>
          <span class="text-center text-[12px]" :style="{ color: wp.id===os.currentWp.value.id ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)', fontWeight: wp.id===os.currentWp.value.id ? 600 : 400 }">{{ wp.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
