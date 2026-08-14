// Turns a field's commit into the event key a script's handler is registered
// under, so events are dispatched where the value changed instead of diffed out
// of the document afterwards.
import type {
  CommitChannel,
  RowAddress,
  RowChange,
} from "../../components/Fields/types";

export interface CommitChannelHost {
  dispatch: (event: string, row?: RowAddress) => Promise<void> | void;
}

export interface RecordCommitChannel extends CommitChannel {
  /** Fires the handler of an edit whose commit never arrived (save mid-typing). */
  flush: () => Promise<void>;
}

export function createCommitChannel(
  host: CommitChannelHost
): RecordCommitChannel {
  let pending: { fieldname: string; row?: RowAddress } | null = null;

  function commit(fieldname: string, row?: RowAddress) {
    pending = null;
    return host.dispatch(fieldEvent(fieldname, row), row);
  }

  return {
    pending: (fieldname, row) => {
      pending = { fieldname, row };
    },
    commit,
    rowChanged: (row, change) => {
      // A structural edit is itself a commit, and a removed row's pending edit
      // has nowhere left to land.
      pending = null;
      host.dispatch(rowEvent(row, change), row);
    },
    flush: async () => {
      const edit = pending;
      if (!edit) return;
      await commit(edit.fieldname, edit.row);
    },
  };
}

/** A child field is addressed by its table, on the one character a fieldname cannot hold. */
export function fieldEvent(fieldname: string, row?: RowAddress): string {
  return row ? `${row.parentfield}.${fieldname}` : fieldname;
}

export function rowEvent(row: RowAddress, change: RowChange): string {
  return `${row.parentfield}.${change}`;
}
