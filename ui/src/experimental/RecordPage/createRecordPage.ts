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
import { FieldsSurface } from "./fields";
import { withRemovals } from "./pageCompatibility";
import { createPagePermissions } from "./pagePermissions";
import { readOnly, type ReadOnlyAdvice } from "./readOnly";
import { registrationsFor } from "./registry";
import { reportCustomizationError } from "./reportError";
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
  fireEvent: (event: string) => Promise<void>;
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

  async function fireEvent(event: string) {
    for (const { source, handlers } of registrationsFor(host.doctype)) {
      const handler = handlers[event];
      if (!handler) continue;
      await withRunningSource(source, async () => {
        try {
          await handler(page);
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
    if (vocabularyChecked || !import.meta.env.DEV) return;
    const fields = host.meta.value?.fields;
    if (!fields) return;
    vocabularyChecked = true;
    const known = knownHandlerKeys(fields);
    for (const { source, handlers } of registrationsFor(host.doctype))
      for (const key of Object.keys(handlers))
        if (!known.has(key))
          console.warn(
            `[record-page] ${source}.${key} on ${host.doctype} is neither an event nor a fieldname — it will never fire`,
          );
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

function knownHandlerKeys(fields: { fieldname: string; fieldtype: string }[]) {
  const known = new Set(RECORD_PAGE_EVENTS);
  for (const field of fields) {
    known.add(field.fieldname);
    if (field.fieldtype?.startsWith("Table")) {
      known.add(`${field.fieldname}_add`);
      known.add(`${field.fieldname}_remove`);
    }
  }
  return known;
}
