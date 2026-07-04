// Public surface of the Customizations applet (ADR-0014 item 3, ADR-0015). The default export IS
// the SFC — the applet loader's contract (`load()` resolves to a module whose `default` is the
// component, see registry/applets.ts `loadApplet`). The applet only renders; the pure projection
// (cookCustomizations) lives in @/actions/customizations and reaches the applet through the OS API
// seam (os.registry.customizations, issue 05). Importers use `@/applets/Customizations`.
export { default } from './Customizations.vue'
