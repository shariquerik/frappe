// The fields surface (wayfinder ticket 42) as executable claims: an enumerated
// snake_case patch, a render-time overlay cleared by the replay, a reader that
// speaks the writer's vocabulary, and a permlevel floor an override cannot lift.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("frappe-ui", () => ({
  call: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  frappeRequest: vi.fn(),
  createResource: () => ({ data: null, loading: false, fetch() {}, reload() {} }),
}));

import { FieldsSurface, resetFieldWarnings } from "../fields";
import type { FieldsSurfaceHost } from "../fields";
import type { RawMetaField } from "../../../components/FormLayout/types";
import type { FieldAccess } from "../../../composables/useDocPermissions";

const FIELDS: RawMetaField[] = [
  { fieldname: "status", fieldtype: "Select", options: "Open\nWon" },
  { fieldname: "qty", fieldtype: "Int" },
  { fieldname: "rate", fieldtype: "Currency", depends_on: "eval:doc.qty > 0" },
  { fieldname: "secret", fieldtype: "Data", permlevel: 1 },
];

function makeSurface(
  host: Partial<FieldsSurfaceHost> = {},
): FieldsSurface {
  return new FieldsSurface({
    fields: () => FIELDS,
    doc: () => ({ qty: 0 }),
    fieldAccess: (): FieldAccess => "write",
    ...host,
  });
}

beforeEach(() => {
  resetFieldWarnings();
  vi.restoreAllMocks();
});

describe("the patch vocabulary", () => {
  it("splits a patch across the three points it is applied at", () => {
    const fields = makeSurface();
    fields.update("status", {
      read_only: true,
      label: "Stage",
      link_filters: { company: "Frappe" },
      props: { variant: "subtle" },
    });
    expect(fields.resolve().status).toEqual({
      override: { readOnly: true },
      meta: { label: "Stage", filters: { company: "Frappe" } },
      ui: { props: { variant: "subtle" } },
    });
  });

  it("takes `precision` as a number or the string a script may reach for", () => {
    const fields = makeSurface();
    fields.update("qty", { precision: "2" });
    expect(fields.resolve().qty.meta).toEqual({ precision: 2 });
  });

  it("drops a key that is not a field property a script may set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fields = makeSurface();
    fields.update("status", { hidden: true, fieldtype: "Data" } as any);
    expect(fields.resolve().status).toEqual({ override: { hidden: true } });
    expect(warn.mock.calls[0][0]).toContain("fieldtype");
  });

  it("names a field the doctype does not have, and still records nothing that renders", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    makeSurface().hide("nope");
    expect(warn.mock.calls[0][0]).toContain('page.fields.hide("nope")');
  });

  it("stays quiet while the meta is still loading", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fields = makeSurface({ fields: () => undefined });
    fields.hide("status");
    expect(warn).not.toHaveBeenCalled();
    // Recorded anyway: the meta lands later and the join applies it then.
    expect(fields.resolve().status).toEqual({ override: { hidden: true } });
  });
});

describe("the verbs", () => {
  it("reads `hide` and `show` as the same override, last one winning", () => {
    const fields = makeSurface();
    fields.hide("status");
    fields.show("status");
    expect(fields.resolve().status).toEqual({ override: { hidden: false } });
  });

  it("merges two patches for one field key by key", () => {
    const fields = makeSurface();
    fields.update("status", { label: "Stage", read_only: true });
    fields.update("status", { label: "Phase" });
    expect(fields.resolve().status).toEqual({
      meta: { label: "Phase" },
      override: { readOnly: true },
    });
  });

  it("answers `has` from the doctype's fields", () => {
    const fields = makeSurface();
    expect(fields.has("qty")).toBe(true);
    expect(fields.has("nope")).toBe(false);
  });

  it("clears every override on reset — the replay, and why a script needs no else", () => {
    const fields = makeSurface();
    fields.hide("status");
    fields.update("qty", { label: "Quantity" });
    fields.reset();
    expect(fields.resolve()).toEqual({});
  });
});

describe("get — the reader", () => {
  it("speaks the vocabulary the writer speaks, not the pipeline's", () => {
    const fields = makeSurface();
    fields.update("status", { read_only: true, label: "Stage" });
    expect(fields.get("status")).toMatchObject({
      fieldname: "status",
      fieldtype: "Select",
      label: "Stage",
      read_only: true,
      options: "Open\nWon",
    });
  });

  it("reads back what the setter wrote — the v1 asymmetry this exists to avoid", () => {
    const fields = makeSurface();
    expect(fields.get("qty")?.hidden).toBe(false);
    fields.hide("qty");
    expect(fields.get("qty")?.hidden).toBe(true);
  });

  it("resolves `depends_on`, and lets the override beat it", () => {
    const fields = makeSurface();
    // `qty` is 0, so `rate`'s condition is false and the field is hidden.
    expect(fields.get("rate")?.hidden).toBe(true);
    fields.show("rate");
    expect(fields.get("rate")?.hidden).toBe(false);
  });

  it("refuses to lift a permlevel denial", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fields = makeSurface({
      fieldAccess: (fieldname) => (fieldname === "secret" ? "none" : "write"),
    });
    fields.show("secret");
    expect(fields.get("secret")?.hidden).toBe(true);
  });

  it("hands back a read-only snapshot", () => {
    const snapshot = makeSurface().get("status")!;
    expect(() => {
      (snapshot as any).label = "Stage";
    }).toThrow("is read-only");
  });

  it("is null for a field the doctype does not have", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(makeSurface().get("nope")).toBeNull();
  });

  it("carries none of the pipeline's internals", () => {
    const snapshot = makeSurface().get("rate")! as Record<string, unknown>;
    for (const internal of ["dependsOn", "permDenied", "override", "readOnly"])
      expect(snapshot[internal]).toBeUndefined();
  });
});
