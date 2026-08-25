// Turns a field's commit into the event key a script's handler is registered
// under, so events are dispatched where the value changed instead of diffed out
// of the document afterwards.
import type {
  CommitChannel,
  RowAddress,
  RowChange,
} from "../../components/Fields/types";
import { ROW_EVENTS } from "./flattenHandlers";

export interface CommitChannelHost {
  dispatch: (event: string, row?: RowAddress) => Promise<void> | void;
}

export interface RecordCommitChannel extends CommitChannel {
  /** Fires the handler of an edit whose commit never arrived (save mid-typing). */
  flush: () => Promise<void>;
}

interface Edit {
  event: string;
  value: any;
  row?: RowAddress;
}

export function createCommitChannel(
  host: CommitChannelHost
): RecordCommitChannel {
  let pending: Edit | null = null;
  let settled: Edit | null = null;

  /**
   * A commit only means something the last one did not, which is what makes
   * every echo of a value already committed a no-op: a control that re-emits as
   * it commits (frappe-ui's `TextInput` handles `input` and `change` alike),
   * and the final `change` Chromium fires when a save repaints a focused input
   * out of the DOM. A native `change` only ever carries a value that moved, so
   * no edit of the reader's is lost to this.
   */
  function settles(event: string, value: any): boolean {
    return !(settled?.event === event && Object.is(settled.value, value));
  }

  function commit(fieldname: string, value: any, row?: RowAddress) {
    const event = fieldEvent(fieldname, row);
    pending = null;
    if (!settles(event, value)) return;
    settled = { event, value, row };
    return host.dispatch(event, row);
  }

  return {
    pending: (fieldname, value, row) => {
      const event = fieldEvent(fieldname, row);
      if (settles(event, value)) pending = { event, value, row };
    },
    commit,
    rowChanged: (row, change) => {
      // A structural edit is itself a commit, and a removed row's pending edit
      // has nowhere left to land.
      pending = null;
      // A removed row has no address left to hand on: a handle for it throws on
      // every access by design, so `'<table>.onRemove'` takes `(page)` alone and
      // un-totals by re-folding the table (ticket 45 §3).
      host.dispatch(rowEvent(row, change), change === "add" ? row : undefined);
    },
    flush: async () => {
      const edit = pending;
      if (!edit) return;
      pending = null;
      settled = edit;
      await host.dispatch(edit.event, edit.row);
    },
  };
}

/** A child field is addressed by its table, on the one character a fieldname cannot hold. */
export function fieldEvent(fieldname: string, row?: RowAddress): string {
  return row ? `${row.parentfield}.${fieldname}` : fieldname;
}

/**
 * The lifecycle keys are `on`-prefixed, so they cannot be the commit event of a
 * child field called `add` — one spelling end to end, from what the author types
 * to what an unknown-key warning names (ticket 54).
 */
export function rowEvent(row: RowAddress, change: RowChange): string {
  return `${row.parentfield}.${ROW_EVENTS[change]}`;
}
