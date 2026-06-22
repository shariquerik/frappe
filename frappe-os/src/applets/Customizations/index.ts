// Public surface of the Customizations applet (ADR-0014 item 3, ADR-0015). The default export IS
// the SFC — the applet loader's contract (`load()` resolves to a module whose `default` is the
// component, see registry/index.ts `loadApplet`). The pure projection lives in
// @/actions/customizations (tested independently of Vue). Importers use `@/applets/Customizations`.
export { default } from './Customizations.vue'
