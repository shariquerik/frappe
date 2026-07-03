<script setup lang="ts">
// Wallpaper picker body — the gallery embedded in Settings ▸ Wallpaper (Settings.vue). Shows the
// server-resolved catalog (global defaults ∪ the user's own uploads, ADR-0036) grouped into sections
// by category (Colors, Photos, …) with the user's uploads under "Your Wallpapers" (which holds the
// Upload tile). The current wallpaper is ringed; own wallpapers carry a remove control. Selecting
// persists the per-user choice; the catalog + writes are the src/wallpapers/ seam.
import { computed } from 'vue'
import { FileUploader } from 'frappe-ui'
import { useOS } from '@/desktop'
import { uploadWallpaper, deleteWallpaper } from '@/wallpapers'
import type { WallpaperDef } from '@/types'

const os = useOS()
const currentId = computed(() => os.currentWp.value.id)

// Shipped categories lead in a curated order; any other (admin-defined) category follows
// alphabetically, then the user's own uploads section closes the list.
const CATEGORY_ORDER = ['Photos', 'Colors']

interface Group {
  label: string
  items: WallpaperDef[]
  own: boolean // the "Your Wallpapers" section — carries the Upload tile
}

function rank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i < 0 ? CATEGORY_ORDER.length : i
}

const groups = computed<Group[]>(() => {
  const defs = os.wallpaperDefs()
  const byCategory = new Map<string, WallpaperDef[]>()
  for (const wp of defs) {
    if (!wp.isGlobal) continue
    const category = wp.category || 'Wallpapers'
    const bucket = byCategory.get(category) ?? []
    bucket.push(wp)
    byCategory.set(category, bucket)
  }
  const sections = [...byCategory.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((label) => ({ label, items: byCategory.get(label)!, own: false }))
  // Always present so the Upload tile is reachable even before the user has any uploads.
  sections.push({ label: 'Your Wallpapers', items: defs.filter((wp) => !wp.isGlobal), own: true })
  return sections
})

// A tile's fill: an image wallpaper is drawn cover/center from its small thumbnail (never the full
// background — the gallery would otherwise load every full-resolution image at once, ADR-0036), a
// user upload with no thumbnail falls back to its image, and a gradient is its raw CSS background.
function thumbStyle(wp: WallpaperDef): Record<string, string> {
  const src = wp.thumbnail || wp.image
  return src
    ? { backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: wp.bg || '' }
}

function isImage(file: { type?: string }): string {
  return file.type?.startsWith('image/') ? '' : 'Please choose an image file'
}

// A newly uploaded File → a private wallpaper labelled from its filename, then selected. Uploaded
// images default to dark chrome (light labels + shadow read over most photos).
function addWallpaper(file: { file_url: string; file_name?: string }): void {
  const label = (file.file_name || 'My wallpaper').replace(/\.[^.]+$/, '')
  void uploadWallpaper(label, file.file_url, true)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-[22px] overflow-auto p-[18px]">
    <section v-for="group in groups" :key="group.label">
      <h3 class="mb-[10px] text-[11px] font-medium uppercase tracking-wide text-ink-gray-5">{{ group.label }}</h3>
      <div class="grid grid-cols-4 gap-[14px]">
        <!-- Upload tile — only in the user's own section -->
        <FileUploader v-if="group.own" fileTypes="image/*" :validateFile="isImage" @success="addWallpaper">
          <template #default="{ openFileSelector, uploading }">
            <button
              class="flex w-full cursor-pointer flex-col gap-[7px] border-none bg-transparent p-0 [font-family:var(--font-sans)]"
              @click="openFileSelector"
            >
              <span
                class="flex h-[78px] w-full items-center justify-center rounded-[10px] border-2 border-dashed border-outline-gray-2 text-ink-gray-5"
              >
                <span class="size-5" :class="uploading ? 'lucide-loader-2 animate-spin' : 'lucide-plus'"></span>
              </span>
              <span class="text-center text-[12px] text-ink-gray-6">Upload</span>
            </button>
          </template>
        </FileUploader>

        <!-- Wallpaper tiles -->
        <div v-for="wp in group.items" :key="wp.id" class="group relative">
          <button
            class="flex w-full cursor-pointer flex-col gap-[7px] border-none bg-transparent p-0 [font-family:var(--font-sans)]"
            @click="os.setWallpaper(wp.id)"
          >
            <span
              class="block h-[78px] w-full rounded-[10px] shadow-[var(--shadow-sm)] outline-offset-1"
              :style="{
                ...thumbStyle(wp),
                border: wp.id === currentId ? '2px solid #0d8ef8' : '2px solid var(--outline-gray-2)',
                outline: wp.id === currentId ? '2px solid #0d8ef8' : 'none',
              }"
            ></span>
            <span
              class="truncate text-center text-[12px]"
              :style="{
                color: wp.id === currentId ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)',
                fontWeight: wp.id === currentId ? 600 : 400,
              }"
              >{{ wp.label }}</span
            >
          </button>
          <!-- Remove control — only on the user's own uploads (a global default has no owner delete) -->
          <button
            v-if="!wp.isGlobal"
            class="absolute right-[6px] top-[6px] hidden size-[22px] cursor-pointer items-center justify-center rounded-full border-none bg-surface-base text-ink-gray-7 shadow-[var(--shadow-sm)] group-hover:flex"
            title="Remove wallpaper"
            @click.stop="deleteWallpaper(wp.id)"
          >
            <span class="lucide-x size-3.5"></span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
