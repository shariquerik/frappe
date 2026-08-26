// The public contribution surface -- the complete list of what an app may contribute.
// If it is not in this file, an app cannot do it. That closure is charter item 1:
// there is no escape hatch to route around, because the alternative rotted (v1's
// Client Script tier).

export type Contribution =
  // 1. Customize a doctype's record page.  <module>/doctype/<scrubbed>/frontend/record.js
  | { kind: 'record'; app: string; doctype: string; handlers: RecordPageHandlers }
  // 2. Customize a doctype's list.         <module>/doctype/<scrubbed>/frontend/list.js
  | { kind: 'list'; app: string; doctype: string; handlers: ListPageHandlers }
  // 3. Customize a FOREIGN doctype.        <module>/custom/<scrubbed>/record.js
  //    Same two kinds; only the folder differs. Applies globally (#42068 §7).
  // 4. Add a genuinely new page.           <module>/frontend/pages/<slug>.js
  | { kind: 'page'; app: string; slug: string; component: () => Promise<unknown> }

// NOT contributable, each for a decided reason:
//   - a route table          -> generated from doctypes (#42068), pages are flat files
//   - a doctype opt-out      -> #42068 §6, it hides nothing and would be misread as
//                               a permission control
//   - shell chrome           -> see src/shell/README.md
//   - a vite plugin / config -> the framework owns the build (#42069)
//   - a boot key, from JS    -> boot is Python (#42070 §4)
//
// The list has exactly four entries and three of them are the same mechanism pointed
// at different folders. That is the test of whether the seam is small enough.
