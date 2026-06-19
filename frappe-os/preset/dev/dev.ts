// Applet dev-harness entry (ADR-0009 dev loop): mount the applet's SFC on a throwaway Vue,
// providing the stub OS API under OS_KEY exactly as the real host does. `yarn dev` in an
// applet package gives the author HMR over its SFC in isolation. (The shared-singleton LOAD
// is the production-only build+bench loop; this loop is purely for authoring the SFC.)
// Generic — the applet under test is injected by the preset via the `@applet/entry` alias,
// so this harness lives once in frappe-os and is reused by every applet.
import { createApp, h, provide } from "vue";
import { OS_KEY } from "@frappe-os/api"; // aliased to the host's os-api source in dev (preset)
// @ts-ignore — resolved by the preset's serve-mode alias to the applet's configured entry.
import Applet from "@applet/entry";
import { stubOs } from "./stub-os";

createApp({
  setup() {
    provide(OS_KEY, stubOs);
    return () => h(Applet);
  },
}).mount("#app");
