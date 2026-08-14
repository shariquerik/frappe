// Builds the curated `page` and the controller that fires events into it.
// Handlers run serially in run order, each in its own try/catch: a thrower is
// skipped half-applied, never taking the page or another source down with it.
// The one exception is `before_save`, the veto point: its throw aborts the save.
import { ref, type Ref } from "vue";
import type { Router } from "vue-router";
import { call, toast } from "frappe-ui";
import { withRunningSource } from "./context";
import { createPageDialogs, type PageDialogEntry } from "./dialog";
import type { Decorator } from "../../components/FormLayout/buildLayoutFromMeta";
import type { RawMetaField } from "../../components/FormLayout/types";
import { holdsChildRows } from "../../components/Fields/rowIdentity";
import type { RowAddress } from "../../components/Fields/types";
import { FieldsSurface, LAYOUT_BREAKS } from "./fields";
import { ROW_EVENTS } from "./flattenHandlers";
import { withRemovals } from "./pageCompatibility";
import { createPagePermissions } from "./pagePermissions";
import { readOnly, type ReadOnlyAdvice } from "./readOnly";
import { registrationsFor } from "./registry";
import { reportCustomizationError } from "./reportError";
import { createRows, warnRowIssue } from "./rows";
import { Surface } from "./surface";
import type {
  HeaderAction,
  PanelSectionItem,
  QuickAction,
  RecordPageApi,
  TabItem,
  TabsApi,
} from "./types";

/** The closed event vocabulary (wayfinder ticket 14); every other key is a fieldname. */
export const RECORD_PAGE_EVENTS = [
  "refresh",
  "before_save",
  "after_save",
  "on_tab_change",
];

// Everything `page` hands back is read-only (ticket 47), and each member names
// the verb that does support what the write was reaching for — a refusal that
// names nothing is a removal wearing a Proxy.
const META_IS_READ_ONLY: ReadOnlyAdvice = {
  path: "page.meta",
  instead: "page.fields.update('qty', { hidden: 1 })",
};

const PERMS_ARE_READ_ONLY: ReadOnlyAdvice = {
  path: "page.perms",
  instead: "a copy: { ...page.perms }, since rights come from the server",
};

const ROLES_ARE_READ_ONLY: ReadOnlyAdvice = {
  path: "page.roles",
  instead:
    "a copy: [...page.roles], since roles belong to the session, not the page",
};

// The two differ by one letter and hold structurally identical objects, so
// `page.saved.qty = 5` is a plausible typo for `page.doc.qty = 5` — and it would
// otherwise silently rewrite the baseline `isDirty`, the layout conditions and
// the conflict path all read.
const SAVED_IS_READ_ONLY: ReadOnlyAdvice = {
  path: "page.saved",
  instead: "page.doc, which is the draft this is the saved counterpart of",
};

export interface RecordPageHost {
  doctype: string;
  docname: string;
  doc: Ref<Record<string, any>>;
  /** The document as the server last showed it; the draft's baseline. */
  saved: Ref<Record<string, any>>;
  meta: Ref<any>;
  /** `docinfo.permissions` as `getdoc` gave it; the engine curates it. */
  perms: () => Record<string, any>;
  isDirty: () => boolean;
  /** The name of the tab the reader is on, as the host's strip resolves it. */
  activeTab: () => string;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  router: Router;
  /**
   * The per-field UI overlay hook the host also passes its layout source. Only
   * `page.fields.get` reads it here, and only so its answer cannot disagree
   * with what the host actually renders.
   */
  decorate?: Decorator;
  /**
   * A child doctype's meta fields, by doctype name — what makes the row half of
   * the event vocabulary knowable. Absent while the metas load, and for a host
   * that has none: the tables then speak `.onAdd` / `.onRemove` only, which is
   * what the vocabulary check assumes rather than warns about.
   */
  childFields?: (doctype: string) => RawMetaField[] | undefined;
  /** Resolves when sources that register after mount (Page Scripts) are in. */
  sourcesReady?: () => Promise<void>;
}

export interface RecordPageController {
  page: RecordPageApi;
  quickActions: Surface<QuickAction>;
  headerActions: Surface<HeaderAction>;
  tabs: Surface<TabItem>;
  panelSections: Surface<PanelSectionItem>;
  /** Field property overrides; the host feeds `resolve()` to its layout source. */
  fields: FieldsSurface;
  /** The replay: clears every surface, then runs every source's `refresh` in run order. */
  refresh: () => Promise<void>;
  /** `row` addresses the child row a dotted event happened to; see `Handler`. */
  fireEvent: (event: string, row?: RowAddress) => Promise<void>;
  /** True once the first replay has run — before it, surfaces are only built-ins. */
  ready: Ref<boolean>;
  /** The `open`/`form` dialogs on screen, for the host's `<PageDialogs>`. */
  dialogs: Ref<PageDialogEntry[]>;
  /** Closes them newest-first, each promise resolving `null`. */
  closeDialogs: () => void;
}

export function createRecordPage(host: RecordPageHost): RecordPageController {
  const quickActions = new Surface<QuickAction>();
  const headerActions = new Surface<HeaderAction>();
  const tabs = new Surface<TabItem>();
  const panelSections = new Surface<PanelSectionItem>();
  const permissions = createPagePermissions(host);
  const fields = new FieldsSurface({
    fields: () => host.meta.value?.fields,
    doc: () => host.doc.value,
    fieldAccess: (fieldname) => permissions.fieldAccess(fieldname),
    decorate: host.decorate,
  });
  const rows = createRows({
    doc: () => host.doc.value,
    fields: () => host.meta.value?.fields,
    childFields: host.childFields,
    dispatch: (event, row) => fireEvent(event, row),
  });
  // Every overlay a replay clears. `fields` is not a `Surface` — it overrides
  // properties rather than arranging items — but it clears with them.
  const surfaces: { reset: () => void }[] = [
    quickActions,
    headerActions,
    tabs,
    panelSections,
    fields,
  ];

  Object.defineProperty(tabs, "active", { get: () => host.activeTab() });

  const ready = ref(false);
  let vocabularyChecked = false;
  let replaying = 0;

  const dialogs = createPageDialogs({ isReplaying: () => replaying > 0 });

  const capabilities: RecordPageApi = {
    doctype: host.doctype,
    docname: host.docname,
    // Exempt from the read-only rule below, and deliberately: mutating the
    // document *is* the API. Do not "fix" this.
    get doc() {
      return host.doc.value;
    },
    get saved() {
      return readOnly(host.saved.value, SAVED_IS_READ_ONLY);
    },
    get meta() {
      return readOnly(host.meta.value, META_IS_READ_ONLY);
    },
    // Read-only goes outermost, so a write is refused before the DEV-only
    // unknown-right advisory inside `permissions.perms()` gets to fire.
    get perms() {
      return readOnly(permissions.perms(), PERMS_ARE_READ_ONLY);
    },
    get roles() {
      return readOnly(permissions.roles(), ROLES_ARE_READ_ONLY);
    },
    fieldAccess: (fieldname) => permissions.fieldAccess(fieldname),
    get isDirty() {
      return host.isDirty();
    },
    quickActions,
    headerActions,
    tabs: tabs as unknown as TabsApi,
    panelSections,
    fields,
    rows: rows.rows,
    save: () => host.save(),
    reload: () => host.reload(),
    refresh: () => refresh(),
    toast: {
      success: (message) => toast.success(message),
      error: (message) => toast.error(message),
    },
    dialog: dialogs.api,
    call: (method, params) => call(method, params),
    // The one member handed straight through, as COMPATIBILITY.md already
    // admits: it is the router, not our object, so the read-only rule has
    // nothing to say about it. Do not "fix" this either.
    router: host.router,
  };

  // Nothing has been removed yet, so this hands the same object straight back:
  // the guard, and its cost on every member read in every handler, exists only
  // once the removals list has something to say (ticket 20 §4).
  const page = withRemovals(capabilities);

  async function refresh() {
    await Promise.all([host.sourcesReady?.(), permissions.ready()]);
    warnUnknownHandlers();
    for (const surface of surfaces) surface.reset();
    // Counted, not a boolean: a script's own `page.refresh()` re-enters this.
    replaying += 1;
    try {
      await fireEvent("refresh");
    } finally {
      replaying -= 1;
    }
    ready.value = true;
  }

  async function fireEvent(event: string, row?: RowAddress) {
    // One handle for the whole dispatch, and the same object `page.rows()` hands
    // back: it is an address, so every source is looking at the same live row.
    const handle = row ? rows.handle(row) : undefined;
    for (const { source, handlers } of registrationsFor(host.doctype)) {
      const handler = handlers[event];
      if (!handler) continue;
      await withRunningSource(source, async () => {
        try {
          await handler(page, handle);
        } catch (error) {
          // `before_save` rethrows to abort the save, and is the one catch site
          // that does not report: the user is looking straight at a failed save,
          // so logging it would file a working veto as an error.
          if (event === "before_save") throw error;
          console.error(
            `[record-page] ${source}.${event} on ${host.doctype} threw`,
            error,
          );
          // No `route`: the reporter reads `location`, which is the URL an admin
          // can paste. `router.fullPath` drops the app's base and would make this
          // one site disagree with the other three.
          reportCustomizationError(error, {
            source,
            event,
            doctype: host.doctype,
            record: host.docname,
          });
        }
      });
    }
  }

  // Meta can lag the first paint, so the check waits for a replay that has fields.
  function warnUnknownHandlers() {
    if (!import.meta.env.DEV) return;
    const fields = host.meta.value?.fields;
    if (!fields) return;
    const registrations = registrationsFor(host.doctype);
    // Nothing to shadow and no keys to check when no source is registered — and
    // saying so anyway would fire the warning on every record a plain app opens.
    if (!registrations.length) return;
    // Deliberately *not* behind the latch below: this one reads the **child**
    // meta, which can land after the parent's — `handlerVocabulary`'s
    // `unresolved` list exists for exactly that window — so latching on the
    // parent alone would drop the collision warning for the whole session.
    // Re-attempting it costs a loop over the tables, and `warnRowIssue`
    // remembers what it has already said.
    warnShadowedChildFields(fields);
    if (vocabularyChecked) return;
    vocabularyChecked = true;
    const known = handlerVocabulary(fields, host.childFields);
    const said = new Set<string>();
    for (const { source, handlers } of registrations)
      for (const key of Object.keys(handlers)) {
        if (known.has(key)) continue;
        // A whole block written under a fieldname that holds no rows is one
        // mistake, not one per handler in it — so it is named by its table.
        const [table] = key.split(".");
        const nested = key.includes(".") && !known.isTable(table);
        const message = nested
          ? `${source}.${table} on ${host.doctype} is not a child table — nothing nested under it will fire`
          : `${source}.${key} on ${host.doctype} is neither an event nor a fieldname — it will never fire`;
        if (said.has(message)) continue;
        said.add(message);
        console.warn(`[record-page] ${message}`);
      }
  }

  /**
   * The three child fieldnames the table vocabulary occupies, named at load
   * because the engine knows the child's fields where v1 could only warn on
   * every access. Frappe reserves none of them (`RESERVED_KEYWORDS` is five
   * names plus the cached properties), so a child doctype may legitimately
   * carry any — and ticket 54 traded a guarantee for this warning knowingly.
   *
   * 54 called the result "an announced capability hole, never a misfire", and
   * for `trigger` that is exact. For the two lifecycle names it is not: a child
   * field named `onAdd` commits as `<table>.onAdd`, which is the *same string*
   * the row-added event dispatches, so the author's `onAdd` handler runs — with
   * a live row — on that field being edited. The hole is announced, but it is a
   * misfire, and the warning says so rather than the comfortable thing.
   */
  function warnShadowedChildFields(fields: RawMetaField[]) {
    for (const field of fields) {
      if (!holdsChildRows(field.fieldtype) || !field.options) continue;
      const child = host.childFields?.(field.options);
      if (!child) continue;
      const has = (fieldname: string) =>
        child.some((one) => one.fieldname === fieldname);
      // The verb wins and the field stays reachable through `page.doc`.
      if (has("trigger"))
        // Warned per child doctype for the session, not per controller: the same
        // shadow is the same fact on every record of the doctype, and navigating
        // between them must not restate it.
        warnRowIssue(
          `${field.options}.trigger is shadowed by the row handle's own trigger() — read it from page.doc.${field.fieldname} instead`,
        );
      // One string cannot be two events, and the field's commit is the one that
      // arrives unannounced — so the warning names the direction that bites.
      for (const lifecycle of Object.values(ROW_EVENTS))
        if (has(lifecycle))
          warnRowIssue(
            `${field.options}.${lifecycle} collides with the table's ${lifecycle} handler — editing that field on a row fires ${field.fieldname}.${lifecycle} as though a row had been ${lifecycle === ROW_EVENTS.add ? "added" : "removed"}. Rename the field, or handle it from page.doc.${field.fieldname}`,
          );
    }
  }

  return {
    page,
    quickActions,
    headerActions,
    tabs,
    panelSections,
    fields,
    refresh,
    fireEvent,
    ready,
    dialogs: dialogs.entries,
    closeDialogs: dialogs.closeAll,
  };
}

/**
 * The whole vocabulary a handler key may be drawn from (tickets 44, 45): the
 * four events, every parent fieldname, and — for a child table — the dotted
 * family and nothing else.
 *
 * A Table fieldtype's **bare** fieldname is deliberately not here. It was only
 * ever firable because the deleted deep watch could not tell one row's edit from
 * another's, so a table has no control that commits under its own name; leaving
 * it in would accept `products() {}` silently and never fire it.
 */
function handlerVocabulary(
  fields: RawMetaField[],
  childFields?: (doctype: string) => RawMetaField[] | undefined,
) {
  const known = new Set(RECORD_PAGE_EVENTS);
  // Every child table on the doctype, so a nested block written under something
  // that is not one can be named as that rather than as a generic typo.
  const tables = new Set<string>();
  // Tables whose child doctype we cannot see. A host with no `childFields`, or
  // one whose child meta has not landed, must not accuse a correct key of being
  // a typo — so those tables are answered by prefix instead.
  const unresolved: string[] = [];
  for (const field of fields) {
    if (!holdsChildRows(field.fieldtype)) {
      known.add(field.fieldname);
      continue;
    }
    tables.add(field.fieldname);
    known.add(`${field.fieldname}.${ROW_EVENTS.add}`);
    known.add(`${field.fieldname}.${ROW_EVENTS.remove}`);
    // A Table MultiSelect has no per-cell editing, so its vocabulary is add and
    // remove alone — an honest gap rather than keys that would never fire.
    if (field.fieldtype !== "Table") continue;
    const child = field.options && childFields?.(field.options);
    if (!child) unresolved.push(field.fieldname);
    // A layout break has no value and so no commit; `page.fields` excludes them
    // for the same reason, and accepting one here would be a key that never fires.
    else
      for (const one of child)
        if (!LAYOUT_BREAKS.has(one.fieldtype))
          known.add(`${field.fieldname}.${one.fieldname}`);
  }
  return {
    has: (key: string) =>
      known.has(key) || unresolved.some((table) => key.startsWith(`${table}.`)),
    isTable: (fieldname: string) => tables.has(fieldname),
  };
}
