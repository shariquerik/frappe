// Does a vite 8 plugin see a .ts file before or after vite strips its types?
// Builds scripts/contacts.ts with two probe plugins (enforce "pre" and no
// enforce) and reports whether each saw `interface Contact` in the code.
// Usage: node vite-order.mjs
import { fromFrontend } from "./tools.mjs";

const { build } = await import(fromFrontend.resolve("vite"));
const seen = {};
const probe = (label, enforce) => ({
  name: `probe-${label}`,
  enforce,
  transform(code, id) {
    if (id.endsWith("contacts.ts")) seen[label] = { hasTypes: code.includes("interface Contact") };
  },
});

await build({
  root: new URL(".", import.meta.url).pathname,
  logLevel: "silent",
  configFile: false,
  plugins: [probe("pre", "pre"), probe("normal", undefined)],
  build: {
    write: false,
    lib: { entry: "scripts/contacts.ts", formats: ["es"] },
    rollupOptions: { external: [/^vue$/, /^frappe-ui$/, /^frappe\//] },
  },
});
console.log(JSON.stringify(seen));
