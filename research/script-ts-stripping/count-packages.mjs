// Counts the packages installed in a node_modules folder (top level and scoped).
// Usage: node count-packages.mjs <node_modules>
import { readdirSync } from "node:fs";

const dir = process.argv[2];
let count = 0;
for (const entry of readdirSync(dir)) {
  if (entry.startsWith(".")) continue;
  count += entry.startsWith("@") ? readdirSync(`${dir}/${entry}`).length : 1;
}
process.stdout.write(`${count}`);
