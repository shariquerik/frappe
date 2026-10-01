// One adapter per type stripper. Each `load()` imports the tool and returns
// `strip(code) => js`. Tools already in the chosen path resolve from
// frontend/node_modules (or the repo root for esbuild); the rest from this
// folder's node_modules.
import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";

const FRAPPE = process.env.FRAPPE_APP ?? "/Users/shariq/crm-bench/apps/frappe";
const fromFrontend = createRequire(path.join(FRAPPE, "frontend/package.json"));
const fromRoot = createRequire(path.join(FRAPPE, "package.json"));
const fromHere = createRequire(import.meta.url);

export const tools = {
  "node-builtin": {
    where: "built into node (module.stripTypeScriptTypes, Amaro/SWC inside)",
    async load() {
      const { stripTypeScriptTypes } = await import("node:module");
      return (code) => stripTypeScriptTypes(code);
    },
  },
  "amaro-npm": {
    where: "npm amaro (same SWC wasm as node, as a package)",
    async load() {
      const amaro = fromHere("amaro");
      return (code) => amaro.transformSync(code, { mode: "strip-only" }).code;
    },
  },
  "ts-blank-space": {
    where: "npm ts-blank-space + typescript",
    async load() {
      const { default: tsBlankSpace } = await import(fromHere.resolve("ts-blank-space"));
      return (code) =>
        tsBlankSpace(code, (node) => {
          throw new Error(`unsupported: ${node.getText().slice(0, 40)}`);
        });
    },
  },
  sucrase: {
    where: "frontend/node_modules (via tailwindcss 3)",
    async load() {
      const { transform } = fromFrontend("sucrase");
      return (code) =>
        transform(code, {
          transforms: ["typescript"],
          disableESTransforms: true,
          keepUnusedImports: true,
        }).code;
    },
  },
  babel: {
    where: "npm @babel/core + @babel/plugin-transform-typescript",
    async load() {
      const babel = fromHere("@babel/core");
      const plugin = fromHere("@babel/plugin-transform-typescript");
      return (code) =>
        babel.transformSync(code, {
          filename: "script.ts",
          babelrc: false,
          configFile: false,
          retainLines: true,
          plugins: [[plugin, { onlyRemoveTypeImports: true, allowDeclareFields: true }]],
        }).code;
    },
  },
  "oxc-rolldown": {
    where: "frontend/node_modules rolldown/utils (vite 8's own Oxc)",
    async load() {
      const { transformSync } = await import(fromFrontend.resolve("rolldown/utils"));
      return (code) => {
        const result = transformSync("script.ts", code, {
          typescript: { onlyRemoveTypeImports: true },
        });
        if (result.errors.length) throw result.errors[0];
        return result.code;
      };
    },
  },
  "babel-parser-blank": {
    where: "frontend @babel/parser (already parsed by the compile module) + own blanking code",
    async load() {
      const { babelBlank } = await import("./babel-blank.mjs");
      return babelBlank;
    },
  },
  esbuild: {
    where: "repo-root node_modules (desk v1 build), not frontend/",
    async load() {
      const esbuild = fromRoot("esbuild");
      return (code) => esbuild.transformSync(code, { loader: "ts" }).code;
    },
  },
  typescript: {
    where: "frontend/node_modules (via @typescript-eslint)",
    async load() {
      const ts = fromFrontend("typescript");
      return (code) =>
        ts.transpileModule(code, {
          reportDiagnostics: false,
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            verbatimModuleSyntax: true,
          },
        }).outputText;
    },
  },
};

export const versions = () => ({
  node: process.versions.node,
  "node-builtin (amaro)": process.versions.amaro,
  "amaro-npm": JSON.parse(readFileSync(new URL("./node_modules/amaro/package.json", import.meta.url))).version,
  "ts-blank-space": fromHere("ts-blank-space/package.json").version,
  "typescript (for ts-blank-space)": fromHere("typescript/package.json").version,
  sucrase: fromFrontend("sucrase/package.json").version,
  "@babel/core": fromHere("@babel/core/package.json").version,
  "@babel/plugin-transform-typescript": fromHere("@babel/plugin-transform-typescript/package.json").version,
  rolldown: fromFrontend("rolldown/package.json").version,
  esbuild: fromRoot("esbuild/package.json").version,
  "typescript (frontend)": fromFrontend("typescript/package.json").version,
  "@babel/parser (frontend)": fromFrontend("@babel/parser/package.json").version,
  "@vue/compiler-dom (frontend)": fromFrontend("@vue/compiler-dom/package.json").version,
});

export { fromFrontend };
