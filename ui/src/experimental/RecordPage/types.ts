// The Record page customization API: what a script's handlers receive and the
// item schemas the four surfaces accept.
import type { Component } from "vue";
import type { Router } from "vue-router";
import type { FieldAccess } from "../../composables/useDocPermissions";

/** Where an added or moved item lands; absent or unknown anchors append. */
export type Position = { before?: string; after?: string };

export interface SurfaceItem {
  name: string;
  label?: string;
  icon?: string;
  [key: string]: any;
}

export interface QuickAction extends SurfaceItem {
  label: string;
  description?: string;
  run?: (page: RecordPageApi) => any;
}

export interface HeaderAction extends SurfaceItem {
  label: string;
  /** The menu band this action joins; omitted means `actions`. */
  group?: string;
  run?: (page: RecordPageApi) => any;
}

export interface TabCreateAction {
  label: string;
  icon: string;
  run: (page: RecordPageApi) => any;
}

export interface TabItem extends SurfaceItem {
  label: string;
  component?: Component;
  props?: Record<string, any>;
  /** Joins the composer's `+` menu while this tab is on the strip. */
  create?: TabCreateAction;
}

export interface PanelSectionItem extends SurfaceItem {
  component?: Component;
  props?: Record<string, any>;
  opened?: boolean;
}

export interface SurfaceVerbs<Item extends SurfaceItem = SurfaceItem> {
  add(item: Item, position?: Position): void;
  hide(name: string): void;
  show(name: string): void;
  update(name: string, patch: Partial<Item>): void;
  move(name: string, position: Position): void;
  has(name: string): boolean;
  order(names: string[]): void;
}

/** The tabs surface also tells a handler which tab the reader is on. */
export interface TabsApi extends SurfaceVerbs<TabItem> {
  readonly active: string;
}

export interface PageToast {
  success(message: string): void;
  error(message: string): void;
}

/** A field as a script writes it: DocField vocabulary, not `FieldMeta`'s camelCase. */
export interface PageDialogField {
  fieldname: string;
  fieldtype: string;
  label?: string;
  /** Link target, or a `Select`'s newline-separated choices. */
  options?: string;
  reqd?: boolean | 0 | 1;
  read_only?: boolean | 0 | 1;
  hidden?: boolean | 0 | 1;
  depends_on?: string;
  mandatory_depends_on?: string;
  read_only_depends_on?: string;
  description?: string;
  /** Closed on purpose: `page.fields`' patch vocabulary is enumerated too, so
   *  the two script-facing field types agree on what a script may write. */
}

/**
 * What a script may override on one of the record's fields — v1's
 * `setFieldProperty` vocabulary, enumerated and spelled as a DocField spells it
 * (`PageDialogField`'s precedent: an author reads DocType Customize and writes
 * what they read there). Closed, like every other curated forward: a key not
 * named here is dropped with a dev-mode warning.
 *
 * v1's `button_color` is absent — no renderer here honours it.
 */
export interface PageFieldPatch {
  // `0 | 1` alongside the boolean, as `PageDialogField` has it: a DocField
  // spells these as ints, and `page.meta`'s own refusal advises `{ hidden: 1 }`.
  hidden?: boolean | 0 | 1;
  read_only?: boolean | 0 | 1;
  reqd?: boolean | 0 | 1;
  label?: string;
  placeholder?: string;
  description?: string;
  /** Link target, or a `Select`'s newline-separated choices. */
  options?: string;
  /** Search filters for a `Link` field. v1 spells it this way; so do we. */
  link_filters?: Record<string, unknown>;
  /** Decimal places for a numeric field. */
  precision?: number | string;
  /** Renders this component in the field's slot instead of the default one. */
  component?: Component;
  /** Props bound onto whichever component renders the field. */
  props?: Record<string, any>;
}

/**
 * What `get` hands back: the same keys `update` writes, resolved as the renderer
 * resolves them, plus the two that identify the field. Deliberately the *same*
 * vocabulary rather than the internal `FieldMeta` — v1's `getField` cannot read
 * back what its own setter wrote, and that asymmetry is the bug this avoids.
 */
export interface PageField extends PageFieldPatch {
  fieldname: string;
  fieldtype: string;
  // Resolved, so these are answered as booleans however they were written.
  hidden?: boolean;
  read_only?: boolean;
  reqd?: boolean;
}

/**
 * The fields surface: a script overriding the properties of fields authored
 * elsewhere. It speaks a strict subset of the surface verbs — there is no `add`,
 * `move` or `order`, because a script that adds a field is inventing a docfield
 * and ordering is the Form Layout's job.
 *
 * Overrides are a render-time overlay: never written into the layout, the Form
 * Layout row, or the doctype meta, and cleared by the ordinary replay before
 * every re-fire — so a conditional override is a plain `if` with no `else`.
 *
 * Two floors an override cannot cross: a permlevel denial (a `show()` on a
 * denied field is a no-op with a dev warning), and a hidden `panelSection`,
 * which is a container above its fields. Between an override and `depends_on`,
 * the override wins.
 */
export interface PageFields {
  hide(fieldname: string): void;
  show(fieldname: string): void;
  update(fieldname: string, patch: PageFieldPatch): void;
  /** Whether the doctype has this field at all. */
  has(fieldname: string): boolean;
  /** The field as it currently resolves — post-override, post-`depends_on`. */
  get(fieldname: string): PageField | null;
}

/**
 * A child row, as a script addresses it (ticket 43): an object holding
 * `(parentfield, key)` that **re-finds its row on every access**, so nothing
 * about a row's position is ever captured. Fields are read and written bare —
 * `row.amount = row.qty * row.rate`, character for character what a v1 script
 * writes — and a write through it is identical in effect to writing
 * `page.doc.products[2].amount`: the handle is an address, not a write channel,
 * and per ticket 44 neither fires anything.
 *
 * Reading or writing a row that has been removed **throws**, naming the path and
 * aborting the handler. v1 loses those writes silently.
 */
export interface PageRow {
  /**
   * Fires this row's handler for one child field — `row.trigger('rate')`
   * dispatches `'products.rate'` — across every registered source, and resolves
   * when they have all run. The fieldname is bare: the handle knows its table.
   *
   * The one engine member on a row. It shares a namespace with the child
   * doctype's fieldnames, and a child field literally named `trigger` is legal
   * (Frappe reserves five names, and this is not one), so the collision is
   * warned about once at load rather than defended against on every access.
   */
  trigger(fieldname: string): Promise<void>;
  [fieldname: string]: any;
}

/** One column of a `tabs` layout; its fields are written, not named. */
export interface PageDialogColumn {
  name?: string;
  label?: string;
  fields: PageDialogField[];
}

export interface PageDialogSection {
  name?: string;
  label?: string;
  hideLabel?: boolean;
  hideBorder?: boolean;
  collapsible?: boolean;
  opened?: boolean;
  depends_on?: string;
  columns: PageDialogColumn[];
}

export interface PageDialogTab {
  name?: string;
  label?: string;
  depends_on?: string;
  sections: PageDialogSection[];
}

/** What a custom `form` action's `onClick` receives. */
export interface PageDialogActionContext {
  /** The dialog's current values, keyed by fieldname. */
  data: Record<string, any>;
  /** Closes the dialog, resolving the opener's promise with `result`. */
  close: (result?: any) => void;
  /** Runs the mandatory-field check; false leaves the errors on screen. */
  validate: () => boolean;
}

export interface PageDialogAction {
  label: string;
  variant?: string;
  theme?: string;
  icon?: string;
  /** Omitted means the default: validate, then close with the form's data. */
  onClick?: (context: PageDialogActionContext) => any;
}

/**
 * `page.dialog.form()`'s options. Exactly one layout mode may be given —
 * `fields`, `tabs`, or `doctype` (optionally narrowed by `fieldnames`).
 */
export interface PageDialogFormOptions {
  title?: string;
  /** Flat field list, wrapped in one unlabelled section. */
  fields?: PageDialogField[];
  /** Full `tabs > sections > columns > fields` layout. */
  tabs?: PageDialogTab[];
  /** Renders the doctype's `Quick Entry` Form Layout, meta-derived if none. */
  doctype?: string;
  /** With `doctype`: only these fields, in this order. */
  fieldnames?: string[];
  defaults?: Record<string, any>;
  /** Fieldnames forced mandatory, whatever the layout says. */
  required?: string[];
  size?: string;
  /** Custom buttons; when given, Submit and `onSubmit` are not rendered. */
  actions?: PageDialogAction[];
  /** Runs on Submit after validation; throwing keeps the dialog open. */
  onSubmit?: (data: Record<string, any>) => any;
  onCancel?: () => any;
  submitLabel?: string;
  cancelLabel?: string;
  dismissible?: boolean;
}

/** Chrome for `open()`'s host dialog; the component renders the body. */
export interface PageDialogOpenOptions {
  title?: string;
  size?: string;
  dismissible?: boolean;
}

/**
 * What a `confirm`/`danger` callback receives: the engine's own object, not
 * frappe-ui's `DialogControl`. A rename underneath must not change what a stored
 * script does on an upgrade nobody reviewed.
 */
export interface PageDialogControl {
  /** Closes the dialog; the verb's promise settles from the verb, as ever. */
  close(): void;
  /** Shows an inline error and re-enables the buttons; `null` clears it. */
  setError(message: string | null): void;
}

/** One button on a `confirm`/`danger` — the five props `page` forwards. */
export interface PageDialogConfirmAction {
  label: string;
  variant?: string;
  theme?: string;
  icon?: string;
  /** Omitted means the button only dismisses, and the verb resolves `null`. */
  onClick?: (control: PageDialogControl) => any;
}

/** `confirm`'s options; a key not named here is dropped, not forwarded. */
export interface PageDialogConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  theme?: string;
  icon?: string;
  size?: string;
  dismissible?: boolean;
  onConfirm?: (control: PageDialogControl) => any;
  onCancel?: () => any;
  /** Custom buttons; when given, the confirm/cancel pair is not rendered. */
  actions?: PageDialogConfirmAction[];
}

/** `danger` forces red and its own icon, so it names neither. */
export type PageDialogDangerOptions = Omit<
  PageDialogConfirmOptions,
  "theme" | "icon"
>;

/**
 * The dialog capability. Every verb resolves `null` when the reader dismissed
 * the dialog — by Esc, the backdrop, the close button, or by navigating off the
 * record — so `if (!result) return` is the idiom. Un-awaited promises are
 * ignored: fire-and-forget stays legal.
 */
export interface PageDialog {
  /** Renders `component` in a dialog, passing it a `close(result)` prop. */
  open(
    component: Component,
    props?: Record<string, any>,
    options?: PageDialogOpenOptions,
  ): Promise<any>;
  /** The declarative tier: resolves `{fieldname: value}` on submit. */
  form(options: PageDialogFormOptions): Promise<Record<string, any> | null>;
  /** Resolves `true` when confirmed. */
  confirm(options: PageDialogConfirmOptions): Promise<true | null>;
  /** `confirm` in red, labelled Delete by default. */
  danger(options: PageDialogDangerOptions): Promise<true | null>;
}

/** The curated object every handler mutates — a script's whole capability surface. */
export interface RecordPageApi {
  doctype: string;
  docname: string;
  doc: Record<string, any>;
  /**
   * The document as the server last showed it — the v2 answer to "what was the
   * previous value": `page.saved.status !== page.doc.status`. Defined on the
   * first paint, readable in any handler, and read-only (`page.doc` is the
   * draft you edit).
   */
  saved: Record<string, any>;
  meta: Record<string, any> | null;
  /**
   * Every right frappe would check for this doctype — the 15 standard ones plus
   * any `Permission Type` registered against it — valued `0` or `1`.
   */
  perms: Record<string, any>;
  /** The session user's roles, resolved before any handler runs. */
  roles: string[];
  /** What this user may do with a field, by permlevel; an unknown one is `none`. */
  fieldAccess(fieldname: string): FieldAccess;
  isDirty: boolean;
  quickActions: SurfaceVerbs<QuickAction>;
  headerActions: SurfaceVerbs<HeaderAction>;
  tabs: TabsApi;
  panelSections: SurfaceVerbs<PanelSectionItem>;
  fields: PageFields;
  /**
   * The child table's rows as handles, in array order. Not a surface — there is
   * nothing here to arrange or override; it is how a row is *addressed*. A
   * fieldname that is not a child table dev-warns and answers empty.
   */
  rows(parentfield: string): PageRow[];
  save(): Promise<void>;
  reload(): Promise<void>;
  refresh(): Promise<void>;
  toast: PageToast;
  dialog: PageDialog;
  call(method: string, params?: Record<string, any>): Promise<any>;
  router: Router;
}

export type { FieldAccess };

/**
 * A handler's arguments are determined by its key (ticket 45 §3). A bare key —
 * an event or a parent fieldname — receives `(page)`. A dotted one receives the
 * row it happened to: `'products.qty'` and `'products.add'` get `(page, row)`,
 * while `'products.remove'` gets `(page)` alone, its row being gone.
 *
 * The row is an address, not a payload: it carries no event data, and the same
 * handle is obtainable from `page.rows()` in any handler at all. That is why
 * ticket 14's rule against invisible arguments survives — the key announces it.
 */
export type Handler = (page: RecordPageApi, row?: PageRow) => any;

/** What a script evaluates to: named event handlers, each receiving `page`. */
export type RecordPageHandlers = Record<string, Handler>;
