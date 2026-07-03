// Wallpaper seam (src/wallpapers): the reactive catalog + per-user selection over the boot payload,
// with the write paths hitting callPost. api.js is mocked, so these pin the seam's own contract —
// boot → catalog mapping, the currentWp-style resolution (selection → default → first), the FALLBACK
// ground, and the optimistic upload/delete — without a backend.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({ callPost: vi.fn(async () => ({})) }))

import { callPost } from '@/data/api'
import {
  initWallpapers, useWallpapers, wallpaperSelection, setSelection, uploadWallpaper, deleteWallpaper,
} from '../src/wallpapers'

// One raw server row (the get_wallpapers shape). Globals-first ordering is the server's job; the
// seam preserves the delivered order.
function row(name, over = {}) {
  return { name, label: name, image: null, thumbnail: null, background: `bg-${name}`, category: 'Colors', dark: false, isGlobal: true, isDefault: false, ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
  initWallpapers(null) // reset the module-singleton store between tests
})

describe('catalog from boot', () => {
  it('maps server rows to WallpaperDefs (background → bg, name → id)', () => {
    initWallpapers({ wallpapers: [row('Duotone', { isDefault: true }), row('Mist')], wallpaper: 'Mist' })
    expect(useWallpapers()).toEqual([
      { id: 'Duotone', label: 'Duotone', bg: 'bg-Duotone', image: undefined, thumbnail: undefined, category: 'Colors', dark: false, isGlobal: true, isDefault: true },
      { id: 'Mist', label: 'Mist', bg: 'bg-Mist', image: undefined, thumbnail: undefined, category: 'Colors', dark: false, isGlobal: true, isDefault: false },
    ])
    expect(wallpaperSelection()).toBe('Mist')
  })

  it('maps an image wallpaper to image + thumbnail, leaving bg undefined', () => {
    initWallpapers({ wallpapers: [row('Beach', { image: '/files/beach.webp', thumbnail: '/files/thumbnails/beach.webp', background: null })] })
    expect(useWallpapers()[0]).toMatchObject({ id: 'Beach', image: '/files/beach.webp', thumbnail: '/files/thumbnails/beach.webp', bg: undefined })
  })

  it('falls back to the built-in ground when the server ships no catalog', () => {
    initWallpapers({}) // older server: no wallpapers key
    expect(useWallpapers()).toEqual([
      expect.objectContaining({ id: 'duotone', isDefault: true, dark: true }),
    ])
    expect(wallpaperSelection()).toBeNull()
  })
})

describe('setSelection', () => {
  it('applies optimistically and persists the per-user choice', () => {
    initWallpapers({ wallpapers: [row('Duotone'), row('Mist')] })
    setSelection('Mist')
    expect(wallpaperSelection()).toBe('Mist')
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.wallpapers.set_wallpaper', { name: 'Mist' })
  })
})

describe('uploadWallpaper', () => {
  it('catalogs the new row, appends it, and selects it', async () => {
    initWallpapers({ wallpapers: [row('Duotone')] })
    callPost.mockResolvedValueOnce(
      { name: 'w-new', label: 'Sunset', image: '/files/sunset.jpg', background: null, dark: true, isGlobal: false, isDefault: false },
    )
    const id = await uploadWallpaper('Sunset', '/files/sunset.jpg', true)
    expect(id).toBe('w-new')
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.wallpapers.upload_wallpaper', { label: 'Sunset', image: '/files/sunset.jpg', dark: 1 })
    expect(useWallpapers().map((w) => w.id)).toEqual(['Duotone', 'w-new'])
    expect(wallpaperSelection()).toBe('w-new') // upload also selects, so the new one applies at once
  })
})

describe('deleteWallpaper', () => {
  it('removes the row and clears the selection when the deleted one was selected', async () => {
    initWallpapers({ wallpapers: [row('Duotone'), row('Mine', { isGlobal: false })], wallpaper: 'Mine' })
    await deleteWallpaper('Mine')
    expect(callPost).toHaveBeenCalledWith('frappe.os_core.wallpapers.delete_wallpaper', { name: 'Mine' })
    expect(useWallpapers().map((w) => w.id)).toEqual(['Duotone'])
    expect(wallpaperSelection()).toBeNull()
  })

  it('leaves the selection intact when a different wallpaper was selected', async () => {
    initWallpapers({ wallpapers: [row('Duotone'), row('Mine', { isGlobal: false })], wallpaper: 'Duotone' })
    await deleteWallpaper('Mine')
    expect(wallpaperSelection()).toBe('Duotone')
  })
})
