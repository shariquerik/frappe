// The fields surface (wayfinder ticket 42) — clause 2 of the v1-parity map.
//
// Not a `Surface`. The four list surfaces arrange items a script may also
// create; fields are a set authored elsewhere whose *properties* a script
// overrides, so the verbs are a strict subset and the key is a fieldname
// rather than an item name.
//
// Ops are recorded, not applied: `resolve()` folds them into one patch per
// field, which the host hands to `useFormLayout` as plain data. That keeps the
// override a render-time overlay — nothing is written into the layout, the Form
// Layout row or the doctype meta — and makes `reset()` the whole of the replay
// clear, so an authored script is a plain `if` with no `else`.
import { markRaw, reactive } from "vue";
import { mapField } from "../../components/FormLayout/buildLayoutFromMeta";
import { resolveFieldConditionals } from "../../components/FormLayout/resolveLayout";
import type { RawMetaField } from "../../components/FormLayout/types";
import type { FieldAccess } from "../../composables/useDocPermissions";
import { withAccess } from "../FormLayoutSource/fieldAccess";
import { applyFieldPatch, type FieldPatch } from "../FormLayoutSource/fieldPatch";
import { readOnly, type ReadOnlyAdvice } from "./readOnly";
import type { PageField, PageFieldPatch, PageFields } from "./types";

const SNAPSHOT_IS_READ_ONLY: ReadOnlyAdvice = {
  path: "page.fields.get()",
  instead: "page.fields.update(fieldname, { … }), which is the writable half",
};

type Slot = "meta" | "override" | "ui";

interface Landing {
  /** Which half of the `FieldPatch` this key lands on. */
  on: Slot;
  /** Its name there — the pipeline is camelCase, the script vocabulary is not. */
  as: string;
  coerce?: (value: any) => any;
}

const asBoolean = (value: any) => !!value;

/** Meta writes `precision` as a number; a script may reasonably say `"2"`. */
function asPrecision(value: any): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The enumerated vocabulary and where each key goes: v1's ten minus
 * `button_color` (nothing renders it), plus `component`/`props`, which
 * `FieldUI` already carries through the render path.
 *
 * The split is not cosmetic. `hidden`/`read_only`/`reqd` are recomputed on
 * every keystroke from the `depends_on` family, so they ride the carrier
 * `resolveFieldConditionals` applies last; the rest are computed once when the
 * node is built, so they are merged there.
 */
const PATCH_KEYS: Record<string, Landing> = {
  hidden: { on: "override", as: "hidden", coerce: asBoolean },
  read_only: { on: "override", as: "readOnly", coerce: asBoolean },
  reqd: { on: "override", as: "reqd", coerce: asBoolean },
  label: { on: "meta", as: "label" },
  placeholder: { on: "meta", as: "placeholder" },
  description: { on: "meta", as: "description" },
  options: { on: "meta", as: "options" },
  link_filters: { on: "meta", as: "filters" },
  precision: { on: "meta", as: "precision", coerce: asPrecision },
  // A component stored on a reactive op would be deep-reactified on its way in,
  // which Vue warns about and pays to proxy a whole render function.
  component: { on: "ui", as: "component", coerce: markRaw },
  props: { on: "ui", as: "props" },
};

/** The reverse of `PATCH_KEYS`, for reading a resolved node back out. */
const SNAPSHOT_KEYS = Object.entries(PATCH_KEYS).map(
  ([key, landing]) => [key, landing.as] as const,
);

export interface FieldsSurfaceHost {
  /** The doctype's flat meta `fields`; absent until the meta lands. */
  fields: () => RawMetaField[] | undefined;
  /** The draft document conditional expressions resolve against. */
  doc: () => Record<string, any>;
  fieldAccess: (fieldname: string) => FieldAccess;
}

type Op =
  | { verb: "hide" | "show"; fieldname: string }
  | { verb: "update"; fieldname: string; patch: FieldPatch };

export class FieldsSurface implements PageFields {
  // Reactive so the host's layout re-joins when a replay changes the overlay,
  // exactly as the four list surfaces re-resolve.
  private ops: Op[] = reactive([]);

  constructor(private host: FieldsSurfaceHost) {}

  hide(fieldname: string) {
    this.ops.push({ verb: "hide", fieldname });
    this.warnIfAbsent(fieldname, "hide");
  }

  show(fieldname: string) {
    this.ops.push({ verb: "show", fieldname });
    this.warnIfAbsent(fieldname, "show");
  }

  update(fieldname: string, patch: PageFieldPatch) {
    this.ops.push({ verb: "update", fieldname, patch: translate(fieldname, patch) });
    this.warnIfAbsent(fieldname, "update");
  }

  has(fieldname: string) {
    return !!this.raw(fieldname);
  }

  get(fieldname: string): PageField | null {
    const raw = this.raw(fieldname);
    if (!raw) {
      this.warnIfAbsent(fieldname, "get");
      return null;
    }
    // The same three calls the join makes for one field, in the same order, so
    // the reader cannot drift from what the renderer decided.
    const node = mapField(
      withAccess(raw, (field) => this.host.fieldAccess(field.fieldname)),
      {},
    );
    const patched = applyFieldPatch(node, this.resolve()[fieldname]);
    const resolved = resolveFieldConditionals(patched, this.host.doc());
    return readOnly(snapshot(resolved), SNAPSHOT_IS_READ_ONLY);
  }

  // Host side, below: not part of what a script may call.

  /** The replay clear: the next resolve starts from the authored layout alone. */
  reset() {
    this.ops.length = 0;
  }

  /** One patch per field, in op order — later verbs win, key by key. */
  resolve(): Record<string, FieldPatch> {
    const patches: Record<string, FieldPatch> = {};
    for (const op of this.ops) {
      const into = (patches[op.fieldname] ??= {});
      if (op.verb === "update") mergeInto(into, op.patch);
      else (into.override ??= {}).hidden = op.verb === "hide";
    }
    return patches;
  }

  private raw(fieldname: string): RawMetaField | undefined {
    return this.host.fields()?.find((field) => field.fieldname === fieldname);
  }

  /**
   * The op is recorded either way — a patch keyed by a fieldname the layout
   * does not carry is simply never applied, and dropping it here would lose it
   * for good in the window before the meta lands, when "absent" and "not here
   * yet" are indistinguishable. This only says so when it can tell.
   */
  private warnIfAbsent(fieldname: string, verb: string) {
    const fields = this.host.fields();
    if (!fields || this.raw(fieldname)) return;
    warnOnce(`page.fields.${verb}("${fieldname}") — no such field.`);
  }
}

/** Translate the script's vocabulary into the pipeline's, dropping the rest. */
function translate(fieldname: string, patch: PageFieldPatch): FieldPatch {
  const translated: FieldPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    const landing = PATCH_KEYS[key];
    if (!landing) {
      warnOnce(
        `page.fields.update("${fieldname}", { ${key} }) — not a field property a script may set; dropped.`,
      );
      continue;
    }
    const slot = (translated[landing.on] ??= {}) as Record<string, any>;
    slot[landing.as] = landing.coerce ? landing.coerce(value) : value;
  }
  return translated;
}

/** Shallow per half: two patches for one field merge key by key, last wins. */
function mergeInto(into: FieldPatch, from: FieldPatch) {
  if (from.meta) into.meta = { ...into.meta, ...from.meta };
  if (from.override) into.override = { ...into.override, ...from.override };
  if (from.ui) into.ui = { ...into.ui, ...from.ui };
}

/**
 * Read a resolved node back out in the vocabulary `update` writes. Curated the
 * same way, and for the same reason: the internal node also carries the child
 * doctype's whole layout, the raw conditional expressions and the permission
 * bookkeeping, none of which is a field property a script asked about.
 */
function snapshot(resolved: Record<string, any>): PageField {
  const field: PageField = {
    fieldname: resolved.fieldname,
    fieldtype: resolved.fieldtype,
  };
  for (const [key, as] of SNAPSHOT_KEYS) {
    const value = as === "component" || as === "props" ? resolved.ui?.[as] : resolved[as];
    if (value !== undefined) (field as Record<string, any>)[key] = value;
  }
  return field;
}

const warned = new Set<string>();

function warnOnce(message: string) {
  if (!import.meta.env.DEV || warned.has(message)) return;
  warned.add(message);
  console.warn(`[record-page] ${message}`);
}

/** Test seam: the warn-once memory is module state. */
export function resetFieldWarnings(): void {
  warned.clear();
}
