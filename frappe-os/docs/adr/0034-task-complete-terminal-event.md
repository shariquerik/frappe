# Enqueued-job completion rides a terminal `task_complete` event carrying the result

> **Status:** Accepted (2026-07-02). Grilled and implemented. Concerns the realtime seam
> (`frappe-os/src/data/realtime.ts`, ADR-0008 additive-only) and the bulk-update write path
> (`frappe-os/src/data/records.ts`; `frappe/desk/doctype/bulk_update/bulk_update.py`). Fixes review
> finding #4 (enqueued bulk failures were silently dropped).

A bulk update of 20–500 rows is **enqueued**: `submit_cancel_or_update_docs` returns `None` and the
work runs later in a worker (`_bulk_action`). The OS shell learned that the job had finished by
listening on the per-row `progress` event and firing when `percent >= 100`. Two defects fell out of
that:

1. **Failures were unknowable.** `frappe.publish_progress` hardcodes its payload to
   `{percent, title, description}` — there is no slot for the job's `failed` list. So the enqueued
   completion callback always toasted a clean success, regardless of how many rows the job rejected.
2. **The completion signal was itself unreliable.** `publish_progress` is emitted *inside* the
   per-row `try`, *after* `doc.save()`. If the **last** row throws, control jumps to `except`,
   `percent` never reaches 100, and the client's completion check **never fires** — a dangling
   "Updating…" toast and a list that never refreshes.

Both are the same root problem: **the completion result cannot ride a signal that a failure
suppresses.** So we stop inferring completion from a progress tick and give the job a real terminal
event that fires on every outcome and carries its result.

## A generic terminal event, not a bulk-specific one

The framework gains `frappe.publish_task_complete(result=None, task_id=None)` next to
`publish_progress` (`frappe/realtime/__init__.py`). It emits **one** event, `task_complete`, into the
same `task_progress:{task_id}` room the client already joins — so completion and progress share one
room, one subscribe. The event is **generic**: `progress` streams per-step ticks; `task_complete`
fires once at the end with the job's **opaque `result`**. A bulk action puts `{failed: [...]}` there;
a future enqueued job puts whatever it wants. The realtime primitive never learns what a bulk update
is.

## Emitted unconditionally, after the loop

`_bulk_action`'s `for` loop catches every per-row exception *inside* itself, so control **always**
reaches the line after the loop — including on a last-row failure. The terminal emit lives exactly
there:

```python
    # loop ends — per-row errors already swallowed
    frappe.publish_task_complete(result={"failed": failed}, task_id=task_id)
    return failed
```

One line repairs the completion signal (fires on every outcome) and carries the result.

**Both paths emit.** The inline `<20`-row path runs `_bulk_action` synchronously and returns `failed`
directly; it also reaches this line and emits into a room **no client is subscribed to** — a redis
no-op, harmless. We accepted that over threading an `enqueued` flag: keeping `_bulk_action` the
*single* place that both computes and announces the result is the stronger seam, and the stray emit
on small selections costs nothing.

## The client seam stays generic; completion moves off `progress`

`onTaskComplete(taskId, onDone)` now listens for `task_complete` (matching `task_id`) and hands the
raw `result` to `onDone(result?: unknown)` — untyped, because the seam is generic. `records.ts` is
the caller that knows the bulk shape and casts (`(result as { failed?: string[] })?.failed`). The
`percent >= 100` inference and the `progress` listener leave the seam entirely. The server still
streams `progress` ticks (untouched) for a future progress-bar UI the OS shell does not yet consume.

This also dissolves most of finding #3's leak: the old handler leaked forever on any job that never
hit 100; the terminal event fires on every outcome, so that common case is gone (the timeout /
`disconnect` cleanup #3 still adds covers only the true dark cases below).

## One `bulkSummary`, and an honest degraded path

Because the enqueued path now also has a `failed` list, `inlineBulkSummary` stops being
inline-specific — it becomes one `bulkSummary(total, failed, doctype)` used by both paths, so the
enqueued completion toast reads identically to the inline one (*"Updated 22 …; 3 failed."*).

When the terminal event never arrives — a **dark seam** (`getSocket()` returns null, no realtime in
boot), a dropped socket, or a crashed worker — the completion callback fires (via the #6 timeout
fallback) with **no** `result`. We cannot itemize failures, so we refresh the list and toast a softer
*"Background update finished."* rather than fabricate a success count. The rows still land in the DB
regardless of realtime; only the itemized report is lost, and the refresh shows true current state.

## Considered and rejected

- **Poll a job-result endpoint.** Store `failed` (RQ `job.result` or a cache key) and expose a
  whitelisted endpoint the client polls on completion/timeout. More robust to socket loss, but adds
  an endpoint, auth, result persistence + expiry, and a poll cadence — real surface for marginal gain
  on a channel that is already best-effort, when the fallback refresh already recovers true state.
- **A bulk-specific event** (e.g. `bulk_update_complete`). Rejected — the realtime seam already
  speaks in generic `onTaskComplete` terms; a generic `task_complete` with an opaque `result` is the
  reusable primitive, and confines the framework change to one helper mirroring `publish_progress`.
- **Piggyback `failed` on a final `progress` tick.** Rejected — `publish_progress`'s payload is
  hardcoded, and a `percent = 100` tick is exactly the signal a last-row failure suppresses. Overloads
  a streaming event with terminal semantics.
- **Gate the emit to the enqueued path with a flag.** Rejected — splits "compute the result" from
  "announce it" and threads a flag through `_bulk_action` to avoid a harmless no-op emit.

## Relationship to prior ADRs

- **ADR-0008 (additive-only compatibility).** This grows the realtime seam for a second need
  (terminal completion beside progress) additively — no reshape; a dark seam still degrades to a
  no-op. The `failed`-semantics of `_bulk_action` (errored rows and not-applicable/skipped rows both
  land in `failed`) are left unchanged, so the inline and enqueued paths stay symmetric.
