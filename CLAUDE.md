## Guidelines for good code for a developer

1. Choose clean code over clever code.

3. Keep function sizes small, ideally 10 lines.

4. Try and keep files between 100 and 300 lines.

5. Don't keep too many files in a folder or module. Try and keep it under 15.

6. Avoid abbreviations.

7. Use standard API as much as possible.

8. Reuse. Write as little code as possible.

9. Use Frappe UI, espresso for UI styling.

10. Always write tests, and make sure they work.

11. Build the minimum working app, then iterate towards your goals.

## Building frappe-os from scratch

We are building frappe-os fresh. This means we do not get away with shallow fixes — we take bold decisions that make the architecture strong, not weak.

Before adding any fix or feature, decide up front:

1. **Naming** — pick precise, consistent names that fit the existing domain language.
2. **File structure** — decide where it lives before writing it.
3. **Reusability** — design the piece so it can be reused, not copy-pasted.
4. **Design** — think through the shape of the solution, not just the immediate need.
5. **Tests** — write tests, and make sure they pass.
6. **Extensibility** — decide how the feature fits the extensibility model before building it.
7. **Reuse first** — reuse components, APIs, and composables from `frappe-ui` or `@framework/ui` before implementing your own.
8. **Dark mode** — check that the change works well in dark mode, not just light.
9. **Grill before building** — if the feature needs grilling to settle its design rather than building right away, take the grilling approach first.

Because we are building fresh, do not settle for the simpler approach when it weakens the architecture.

If adding a feature makes the scope grow because the underlying architecture is not decided yet, stop and build the base first, then add the feature on top.

If you must hard-code any part, note it down together with the expected proper solution.
Record it as a deferred-hardcoded issue under
`frappe-os/.scratch/deferred-hardcoded/issues/NN-slug.md`, following the issue template in
`frappe-os/CLAUDE.md` (`# Title`, `Status:`, `Triage:`, `## What to build`,
`## Acceptance criteria`, `## Blocked by`). Each file captures one hard-coded shortcut and
the end-to-end proper solution that should replace it.