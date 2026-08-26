// The mount sequence. Read top to bottom: it is the whole lifecycle.
//
// The ordering constraint that shapes everything: boot must land BEFORE the router
// is created, because the router's base comes out of boot (#42070 §2, and see
// router/index.ts). That is a stronger requirement than "the shell blocks on boot" --
// it means the router cannot be a module-scope singleton the way CRM's is today.

import '@/index.css'
import { createApp } from 'vue'
import { FrappeUI, frappeRequest, setConfig } from 'frappe-ui'
import { spritePlugin } from 'frappe-ui/icons'

import { fetchBoot } from '@/boot'
import { createShellRouter } from '@/router'
import { loadTranslations } from '@/i18n'

setConfig('resourceFetcher', frappeRequest)

// 1. BLOCK on boot. Nothing renders first -- not a spinner, not chrome. #42070 §2:
//    nothing useful exists before the user, the timezone and the CSRF token do.
//    An unauthorized user gets the shell HTML at 200 and is refused HERE (#42112).
const boot = await fetchBoot()

// 2. Translations are deliberately NOT awaited (#42070 §6). Untranslated text is a
//    survivable first frame; a missing CSRF token is not. Keyed on
//    translations_version so it stays cacheable, which merging into boot would forfeit.
loadTranslations(boot.translations_version)

// 3. Contributions register before the router's first resolution -- same invariant
//    CRM's main.ts already holds, but the framework now owns it for every app.
//    No per-app register.ts, and no `extend_frontend` list to walk: everything is
//    already in this bundle (#42068 §9).
await import('@/contributions/registry')

// 4. NOW the router, because only now is the base known.
const router = createShellRouter(boot)

const app = createApp(Shell)
app.use(FrappeUI, { socketio: { port: boot.socketio_port } })
app.use(spritePlugin)
app.use(router)
app.mount('#app')
