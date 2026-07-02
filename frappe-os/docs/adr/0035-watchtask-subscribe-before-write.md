# A background job is watched by a handle joined *before* the write, hardened for a shared socket

> **Status:** Accepted (2026-07-02). Implemented. Concerns the realtime seam
> (`frappe-os/src/data/realtime.ts`, ADR-0008 additive-only) and the bulk-update write path
> (`frappe-os/src/data/records.ts`). Fixes review findings #2, #3, #5, #6 — the hardening cluster
> ADR-0034 forecast ("the timeout / `disconnect` cleanup #3 still adds", "the #6 timeout fallback").

ADR-0034 gave the enqueued bulk path a real terminal signal (`task_complete` carrying `{failed}`).
That fixed *what* completion says (#4). This ADR fixes *when and how reliably* the client hears it,
on a socket that is shared for the whole process lifetime and can drop, reconnect, or never exist.

The old client, `onTaskComplete(taskId, onDone)`, was fire-and-forget: `records.ts` called it **after**
`apiBulkUpdate` returned. Four defects fell out, all rooted in treating an async background job as if
the client's listening were incidental:

- **#2 — subscribe races the job.** The room was joined only after the write's round-trip. A fast
  enqueued job could fire `task_complete` into a room no one had joined yet → dangling "Updating…",
  no refresh.
- **#3 — the handler leaks.** Cleanup lived only in the matched-task branch. A job whose event never
  arrived left the handler + room membership pinned on the shared, never-torn-down socket.
- **#5 — duplicate handshakes.** `getSocket` cached the resolved socket, not the in-flight connect;
  concurrent first callers each ran `io()`, opening duplicate connections.
- **#6 — reconnect loses the room, dark seam never completes.** Socket.IO rooms are per-connection
  and not restored on reconnect, so a dropped-and-recovered socket silently stopped hearing the
  event. And when there is no socket at all (no realtime in boot), completion never fires.

## The shape: a handle joined up front, then committed to one outcome

The seam becomes `watchTask(taskId): Promise<TaskWatch>`. The caller **awaits it before firing the
write**, so the room is joined first (closes #2). It then commits to exactly one outcome:

```ts
const taskId = newTaskId()
const watch = await watchTask(taskId)               // join the job's room BEFORE the write
const failed = await apiBulkUpdate(doctype, docnames, changes, taskId)
if (failed === null) return enqueuedBulk(..., watch) // enqueued → watch.onComplete(onDone)
watch.cancel()                                       // inline ran synchronously → drop the watch
```

`TaskWatch` is `{ onComplete(onDone), cancel() }`. Splitting *join* (up front) from *arm/cancel*
(after the write reveals which path the backend took) is what lets us pre-subscribe without the inline
path double-firing: the inline `<20`-row path also emits `task_complete` (ADR-0034, "both paths emit"),
but the client never registers a completion handler for it — `cancel()` leaves the room and that stray
emit lands on a socket with no listener. No threshold is duplicated client-side.

**Why arming-after-the-null-return is race-free:** `frappe.enqueue` returns (making `apiBulkUpdate`
resolve `null`) *before* a worker dequeues and runs the job, so the terminal event cannot precede the
null return. Only the room **join** must beat the job — hence join-before-write, arm-after. No event
buffering is needed.

## Single-fire cleanup covers every terminal path (#3)

`liveWatch` holds one `cleanup()` guarded by a `settled` flag; it removes the completion handler AND
the reconnect resubscriber, clears the timer, and leaves the room. It runs at most once, on **any** of:
completion, timeout, or cancel. A transient disconnect is deliberately **not** a cleanup trigger — we
want to survive it and rejoin (see #6); the timeout is the backstop for a disconnect that never
recovers. Nothing leaks on the shared socket.

## Reconnect rejoins; a dark seam still completes (#6)

`watchTask` registers `sock.on('connect', subscribe)`, so every (re)connection re-emits
`task_subscribe` and the per-connection room is restored. On a warm socket we also subscribe
immediately; on a cold one the first `connect` does it — no double-subscribe either way (and a
duplicate room join would be idempotent regardless).

When there is no socket (no `sitename` in boot), `watchTask` returns a `timeoutOnlyWatch`: completion
can only ride the timer. Either way, `onComplete` **always** eventually fires — with the job's result
when the event lands, or with `undefined` when the timeout backstops it — so the enqueued caller
always refreshes. `records.ts` reads a resultless completion as the soft
"Background update finished." toast (ADR-0034), never a fabricated success count.

## One deduped handshake (#5)

`getSocket` now caches the in-flight **connect promise**, not the resolved socket. Concurrent first
callers await one `io()`; a dark result (null) is cached too, so an unconfigured seam stays a cheap
no-op for the process lifetime.

## Two bounds left hard-coded (recorded, not hidden)

- `RECONNECTION_ATTEMPTS = 3` — should come from boot, not a literal
  (`.scratch/deferred-hardcoded/issues/01`).
- `TASK_TIMEOUT_MS = 120000` — the fallback delay ignores selection size; a size-scaled bound or a
  job-status poll is the proper fix (`.scratch/deferred-hardcoded/issues/02`, and ADR-0034's rejected
  "poll a job-result endpoint" is the home if we revisit it).

## Considered and rejected

- **Warm the socket but keep subscribing after the write.** Narrows the #2 window but doesn't close
  it — a fast job on a warm socket can still beat a post-write subscribe. Join-before-write is the
  only race-free point, and it's cheap (the socket is shared and deduped).
- **Buffer terminal events between join and arm.** Unnecessary: enqueue returns before the worker
  runs, so the event can't precede the null return (see above). Buffering would be dead complexity.
- **Cleanup on `disconnect`.** Rejected — it fights #6. A transient drop should rejoin, not tear down;
  a permanent drop is caught by the timeout.
- **Keep the fire-and-forget `onTaskComplete` signature.** It can't express join-before-write or an
  inline cancel, and gives the caller no handle to tear down — the very gaps #2/#3 are about.

## Why not reuse frappe-ui's socket client (review #7 — won't-fix)

Review #7 asked whether this custom seam should migrate onto frappe-ui. It should not, and #7 is
closed **won't-fix**:

- frappe-ui exports only `initSocket` — a ~10-line per-call `io()` factory reading `window.site_name`
  + a port option, **not** the boot payload our `socketUrl` derives from.
- Its `onDocUpdate` handles only `list_update`/`doctype_subscribe`, is **unexported**, and carries the
  **same reconnect bug** this ADR fixes (#6) — so it is not even a model to copy.
- It has **no task-progress / task-complete helper at all** — no `task_subscribe`, no completion
  event. That pattern is the entire reason this seam exists.

Our client is boot-driven (one shared, deduped singleton with a degrade path and bounded reconnects),
and after this change it is strictly more correct than frappe-ui's for the completion use case. The
seam stays additive (ADR-0008); if frappe-ui grows a real task-completion primitive later, revisit.

## Relationship to prior ADRs

- **ADR-0008 (additive-only).** Grows the realtime seam in place — no reshape of its role; a dark seam
  still degrades to a no-op (now via `timeoutOnlyWatch`), never a thrown error in a UI path.
- **ADR-0034 (terminal `task_complete`).** This is the client-reliability half of the same seam:
  0034 made completion *carry the result on every outcome*; 0035 makes the client *reliably hear it*
  on a shared, reconnecting, sometimes-absent socket. The `onComplete(result?)` contract and the
  soft resultless-completion toast are unchanged.
