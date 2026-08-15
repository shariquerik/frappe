// How the header's one flat list becomes three renderings (ticket 65) and what
// happens when it asks for more top-level controls than fit (ticket 66).
import { Surface, type ResolvedItem } from "./surface";
import type { HeaderAction, Position } from "./types";

/** A control the host draws in the header itself, left of `⋯ │ Save`. */
export type HeaderControl =
  | { kind: "button"; item: HeaderAction }
  | { kind: "dropdown"; item: HeaderAction; members: HeaderAction[] };

/**
 * One band of the `⋯` menu. `label` is set only on a collapsed dropdown, which
 * is the single band that renders a heading.
 */
export interface HeaderBand {
  group: string;
  label?: string;
  items: HeaderAction[];
}

export interface HeaderProjection {
  controls: HeaderControl[];
  bands: HeaderBand[];
}

/**
 * Project the resolved items into the header's controls and the `⋯` menu's
 * bands, given how many top-level controls the host has room for.
 *
 * Takes the resolved list rather than the visible one because a **hidden
 * dropdown takes its members with it**: it is a container above them, as a
 * hidden `panelSection` is above its fields, and `hide('telephony')` is how a
 * script removes the whole control (ticket 66 §5).
 *
 * Overflow is host-side and unobservable: a script cannot read back that its
 * button was demoted, so nothing here writes to the surface.
 */
export function projectHeaderActions(
  resolved: ResolvedItem<HeaderAction>[],
  budget: number
): HeaderProjection {
  const hiddenContainers = new Set(
    resolved
      .filter((entry) => entry.hidden && entry.item.display === "dropdown")
      .map((entry) => entry.item.name)
  );
  const items = resolved
    .filter(
      (entry) => !entry.hidden && !hiddenContainers.has(entry.item.group ?? "")
    )
    .map((entry) => entry.item);
  // An empty dropdown is a button that opens nothing, so it is dropped before
  // the budget applies and its slot passes to the next control in order.
  const controls = controlsOf(items).filter(
    (control) => control.kind === "button" || control.members.length
  );
  const kept = Math.max(budget, 0);
  return {
    controls: controls.slice(0, kept),
    bands: [...demotedBands(controls.slice(kept)), ...menuBands(items)],
  };
}

function controlsOf(items: HeaderAction[]): HeaderControl[] {
  const controls: HeaderControl[] = [];
  const containers = new Map<string, HeaderControl & { kind: "dropdown" }>();
  for (const item of items) {
    if (item.display === "dropdown") {
      const control = { kind: "dropdown" as const, item, members: [] };
      containers.set(item.name, control);
      controls.push(control);
    } else if (item.display === "button") {
      controls.push({ kind: "button", item });
    }
  }
  // A member joins its container wherever the container sits: a dropdown is
  // placed by its own item, never by its first member (ticket 65).
  for (const item of items) {
    if (item.display) continue;
    containers.get(item.group ?? "")?.members.push(item);
  }
  return controls;
}

// A demoted control keeps a band of its own, ahead of the built-ins and in
// top-level order, with no signal that it wanted to be a button (ticket 66 §4).
// Banding by its own name, not by its `group`, is what keeps a demoted button
// from reading as a member of a dropdown that was demoted beside it.
function demotedBands(controls: HeaderControl[]): HeaderBand[] {
  return controls.map((control) =>
    control.kind === "button"
      ? { group: control.item.name, items: [control.item] }
      : {
          group: control.item.name,
          label: control.item.label,
          items: control.members,
        }
  );
}

// Bands are derived from the one flat list by adjacency: an omitted `group`
// means `actions`, an unknown value makes a new band where its first item sits.
function menuBands(items: HeaderAction[]): HeaderBand[] {
  const containers = new Set(
    items.filter((item) => item.display === "dropdown").map((item) => item.name)
  );
  const bands: HeaderBand[] = [];
  for (const item of items) {
    if (item.display || containers.has(item.group ?? "")) continue;
    const group = item.group ?? "actions";
    const last = bands[bands.length - 1];
    if (last?.group === group) last.items.push(item);
    else bands.push({ group, items: [item] });
  }
  return bands;
}

/**
 * Where an item renders, as a comparable key. Read off the **declared**
 * `display` and never off the effective one, so nothing computed from it can
 * become width-dependent (ticket 66 §5).
 */
export function renderingOf(item: HeaderAction, items: HeaderAction[]): string {
  if (item.display === "button") return "button";
  if (item.display === "dropdown") return `dropdown:${item.name}`;
  const container = items.find(
    (other) => other.name === item.group && other.display === "dropdown"
  );
  return container ? `dropdown:${container.name}` : "menu";
}

type AnchorClaim = { verb: string; name: string; anchor: string };

/**
 * The header's surface, which is an ordinary `Surface` plus one warning: an
 * anchor naming an item in a different rendering still splices where it always
 * did, and says so (ticket 65).
 *
 * The check runs over the *resolved* list rather than at call time, because a
 * member can be added before the container that decides its rendering.
 */
export class HeaderActionsSurface extends Surface<HeaderAction> {
  private claims: AnchorClaim[] = [];
  private said = new Set<string>();

  add(item: HeaderAction, position?: Position) {
    this.claim("add", item.name, position);
    super.add(item, position);
  }

  move(name: string, position: Position) {
    this.claim("move", name, position);
    super.move(name, position);
  }

  // Claims are staged with the ops they belong to: a replay rebuilds the list
  // from built-ins, so the claims that produced the old one go with it.
  beginReplay() {
    this.claims = [];
    super.beginReplay();
  }

  resolve() {
    const resolved = super.resolve();
    if (import.meta.env.DEV)
      this.warnCrossRendering(resolved.map((e) => e.item));
    return resolved;
  }

  private claim(verb: string, name: string, position?: Position) {
    const anchor = position?.before ?? position?.after;
    if (anchor) this.claims.push({ verb, name, anchor });
  }

  private warnCrossRendering(items: HeaderAction[]) {
    for (const claim of this.claims) {
      const item = items.find((one) => one.name === claim.name);
      const anchor = items.find((one) => one.name === claim.anchor);
      if (!item || !anchor) continue;
      if (renderingOf(item, items) === renderingOf(anchor, items)) continue;
      const message =
        `[record-page] headerActions.${claim.verb}('${claim.name}'): anchor ` +
        `'${claim.anchor}' renders as ${describe(anchor, items)}, but ` +
        `'${claim.name}' renders as ${describe(
          item,
          items
        )} — position orders ` +
        `items only within one rendering.`;
      if (this.said.has(message)) continue;
      this.said.add(message);
      console.warn(message);
    }
  }
}

function describe(item: HeaderAction, items: HeaderAction[]) {
  if (item.display === "button") return "a top-level button";
  if (item.display === "dropdown") return `the “${item.label}” dropdown button`;
  const rendering = renderingOf(item, items);
  if (rendering === "menu") return "an entry in the ⋯ menu";
  const container = items.find(
    (one) => one.name === rendering.slice("dropdown:".length)
  );
  return `an entry in the “${container?.label ?? ""}” dropdown`;
}
