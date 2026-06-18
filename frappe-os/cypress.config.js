import { defineConfig } from 'cypress'

// E2E runs against the live dev server (yarn dev, port 5273). The app is mounted
// under /os/, so specs visit '/os/...'. Start the server before `yarn e2e`.
//
// REQUIRES A LOGGED-IN BENCH. Now that the backend is wired up, `yarn dev` proxies
// /api to the local bench and boot.js fetches the whitelisted boot() through it; a
// Guest (or no bench running) means no boot payload and the app cannot mount. Run a
// bench (site f2.localhost on :8016) and be logged in before `yarn e2e`. These specs
// are therefore not part of an unattended/headless gate until that bench exists.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5273',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
  },
})
