// The three renderings (ticket 65) and the fitting rule (ticket 66) as
// executable claims.
import { describe, expect, it, vi } from "vitest";
import {
  HeaderActionsSurface,
  projectHeaderActions,
  renderingOf,
} from "../headerRenderings";
import type { HeaderAction } from "../types";

const BUDGET = 2;

function action(name: string, extra: Partial<HeaderAction> = {}): HeaderAction {
  return { name, label: name, ...extra };
}

const button = (name: string, extra: Partial<HeaderAction> = {}) =>
  action(name, { display: "button", ...extra });

const dropdown = (name: string, extra: Partial<HeaderAction> = {}) =>
  action(name, { display: "dropdown", ...extra });

/** The surface's own shape: what `resolve()` hands the host. */
function resolved(items: HeaderAction[], ...hidden: string[]) {
  return items.map((item) => ({
    item,
    source: "test",
    hidden: hidden.includes(item.name),
  }));
}

function project(items: HeaderAction[], budget = BUDGET) {
  return projectHeaderActions(resolved(items), budget);
}

function controlNames(items: HeaderAction[], budget = BUDGET) {
  return project(items, budget).controls.map(
    (control) => `${control.kind}:${control.item.name}`
  );
}

function bandNames(items: HeaderAction[], budget = BUDGET) {
  return project(items, budget).bands.map(
    (band) => `${band.group}[${band.items.map((item) => item.name).join(",")}]`
  );
}

describe("the three renderings", () => {
  it("gives a bare button, a dropdown of its own, and the shared menu", () => {
    const items = [
      button("refresh_quote"),
      dropdown("telephony"),
      action("call", { group: "telephony" }),
      action("sms", { group: "telephony" }),
      action("audit"),
    ];
    expect(controlNames(items)).toEqual([
      "button:refresh_quote",
      "dropdown:telephony",
    ]);
    expect(bandNames(items)).toEqual(["actions[audit]"]);
  });

  it("collects a dropdown's members wherever they sit in the flat list", () => {
    const items = [
      action("call", { group: "telephony" }),
      button("refresh_quote"),
      dropdown("telephony"),
      action("sms", { group: "telephony" }),
    ];
    const { controls } = project(items);
    const telephony = controls[1];
    expect(telephony.kind).toBe("dropdown");
    expect(
      telephony.kind === "dropdown" &&
        telephony.members.map((member) => member.name)
    ).toEqual(["call", "sms"]);
  });

  // A member never relocates the button it hangs off: the container's own
  // position places it (ticket 65).
  it("places a dropdown by its own item, not by its first member", () => {
    const items = [
      action("sms", { group: "telephony" }),
      button("refresh_quote"),
      dropdown("telephony"),
    ];
    expect(controlNames(items)).toEqual([
      "button:refresh_quote",
      "dropdown:telephony",
    ]);
  });

  it("keeps the adjacency banding for everything that stays in the menu", () => {
    const items = [
      action("favourite", { group: "favourite" }),
      action("copy_url"),
      action("copy_id"),
      action("delete", { group: "delete" }),
    ];
    expect(bandNames(items)).toEqual([
      "favourite[favourite]",
      "actions[copy_url,copy_id]",
      "delete[delete]",
    ]);
  });

  it("keeps a dropdown's members out of the menu bands", () => {
    const items = [
      action("copy_url"),
      dropdown("telephony"),
      action("call", { group: "telephony" }),
      action("copy_id"),
    ];
    expect(bandNames(items)).toEqual(["actions[copy_url,copy_id]"]);
  });
});

describe("the fitting rule", () => {
  it("keeps the leading controls and demotes from the right", () => {
    const items = [button("one"), button("two"), button("three")];
    expect(controlNames(items)).toEqual(["button:one", "button:two"]);
    expect(bandNames(items)).toEqual(["three[three]"]);
  });

  it("demotes everything at budget 0, which is the mobile rule", () => {
    const items = [
      button("one"),
      dropdown("two"),
      action("call", { group: "two" }),
    ];
    expect(controlNames(items, 0)).toEqual([]);
    expect(bandNames(items, 0)).toEqual(["one[one]", "two[call]"]);
  });

  it("collapses a demoted dropdown whole, under its own label as a heading", () => {
    const items = [
      button("one"),
      button("two"),
      dropdown("telephony", { label: "Telephony" }),
      action("call", { group: "telephony" }),
      action("sms", { group: "telephony" }),
    ];
    const { bands } = project(items);
    expect(bands[0]).toMatchObject({ group: "telephony", label: "Telephony" });
    expect(bands[0].items.map((item) => item.name)).toEqual(["call", "sms"]);
  });

  // The only band that carries a heading is a collapsed dropdown's.
  it("gives a demoted bare button a band with no heading", () => {
    const items = [
      button("one"),
      button("two"),
      button("three"),
      action("audit"),
    ];
    const { bands } = project(items);
    expect(bands[0]).toEqual({ group: "three", items: [items[2]] });
  });

  it("demotes several controls in their top-level order, ahead of the built-ins", () => {
    const items = [
      button("one"),
      button("two"),
      button("three"),
      button("four"),
      action("copy_url"),
    ];
    expect(bandNames(items)).toEqual([
      "three[three]",
      "four[four]",
      "actions[copy_url]",
    ]);
  });

  // A promoted built-in overflows on the same rule and does not return to its
  // home band: provenance orders nothing here (ticket 66 §4).
  it("demotes a promoted built-in to the front, not back to its own band", () => {
    const items = [
      button("one"),
      button("two"),
      action("copy_url"),
      button("delete", { group: "delete" }),
    ];
    expect(bandNames(items)).toEqual(["delete[delete]", "actions[copy_url]"]);
  });

  // An empty dropdown is a button that opens nothing (ticket 66 §5).
  it("drops a dropdown with no visible members before the budget applies", () => {
    const items = [dropdown("telephony"), button("one"), button("two")];
    expect(controlNames(items)).toEqual(["button:one", "button:two"]);
    expect(bandNames(items)).toEqual([]);
  });

  // The container is above its members, as a hidden panelSection is above its
  // fields: hiding it removes the whole control, members and all.
  it("takes a hidden dropdown's members with it", () => {
    const items = [
      dropdown("telephony"),
      action("call", { group: "telephony" }),
      action("sms", { group: "telephony" }),
      action("copy_url"),
    ];
    const projection = projectHeaderActions(
      resolved(items, "telephony"),
      BUDGET
    );
    expect(projection.controls).toEqual([]);
    expect(projection.bands.map((band) => band.group)).toEqual(["actions"]);
  });

  // ...but a group naming no dropdown at all is still an invented menu band,
  // which is what a script writing `group: 'my_band'` has always got.
  it("leaves a group that names no dropdown as a band of its own", () => {
    const items = [
      action("audit", { group: "audit_band" }),
      action("copy_url"),
    ];
    expect(bandNames(items)).toEqual([
      "audit_band[audit]",
      "actions[copy_url]",
    ]);
  });
});

describe("the cross-rendering anchor warning", () => {
  function surface(items: HeaderAction[]) {
    const built = new HeaderActionsSurface();
    built.provideBuiltins(() => items);
    return built;
  }

  it("warns when an anchor renders somewhere else, and still splices", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = surface([button("refresh_quote"), action("delete")]);
    built.add(action("escalate"), { after: "refresh_quote" });
    expect(built.visible().map((item) => item.name)).toEqual([
      "refresh_quote",
      "escalate",
      "delete",
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("a top-level button");
    expect(warn.mock.calls[0][0]).toContain("an entry in the ⋯ menu");
    warn.mockRestore();
  });

  it("says nothing when both items render the same way", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = surface([action("copy_url"), action("delete")]);
    built.add(action("escalate"), { after: "copy_url" });
    built.visible();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // Checked against the final list, not at call time: a member can be added
  // before the container that decides its rendering.
  it("resolves the rendering over the final list", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = surface([button("refresh_quote")]);
    built.add(action("call", { group: "telephony" }), {
      after: "refresh_quote",
    });
    built.add(dropdown("telephony", { label: "Telephony" }));
    built.visible();
    expect(warn.mock.calls[0][0]).toContain("“Telephony” dropdown");
    warn.mockRestore();
  });

  it("warns once however often the list is resolved", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = surface([button("refresh_quote")]);
    built.add(action("escalate"), { after: "refresh_quote" });
    built.visible();
    built.visible();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("drops the claims a replay rebuilt the list without", () => {
    const built = surface([button("refresh_quote")]);
    built.add(action("escalate"), { after: "refresh_quote" });
    built.beginReplay();
    built.commitReplay();
    expect(built.visible().map((item) => item.name)).toEqual(["refresh_quote"]);
  });
});

describe("renderingOf", () => {
  // Read off the declared display, never the effective one, so nothing
  // computed from it can become width-dependent (ticket 66 §5).
  it("answers from the declared display alone", () => {
    const items = [button("one"), button("two"), button("three")];
    expect(renderingOf(items[2], items)).toBe("button");
  });

  it("puts a member in its container's rendering", () => {
    const items = [
      dropdown("telephony"),
      action("call", { group: "telephony" }),
    ];
    expect(renderingOf(items[1], items)).toBe("dropdown:telephony");
  });

  it("leaves a group that names no dropdown in the menu", () => {
    const items = [action("call", { group: "elsewhere" })];
    expect(renderingOf(items[0], items)).toBe("menu");
  });
});
