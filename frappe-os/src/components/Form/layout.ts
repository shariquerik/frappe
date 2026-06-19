// Pure projection from the live DocType field schema to a single-tab, section-grouped,
// two-column @framework/ui FormLayout. No Vue, no store — mirrors route-map.ts: a tested
// projection OSForm stays thin over. Shapes live in ./types.
import type { LayoutField, LayoutTab, SchemaField } from './types'

// Fields are grouped into sections by their `section` (defaulting to 'Details', preserving
// schema order), then split round-robin across two columns. `editable=false` forces every
// field read-only; an individual field's own `read_only` flag still wins when editable.
export function buildFormLayout(fields: SchemaField[] = [], editable: boolean): LayoutTab[] {
  const secMap: { label: string; fields: LayoutField[] }[] = []
  fields.forEach((f) => {
    const title = f.section || 'Details'
    let section = secMap.find((x) => x.label === title)
    if (!section) { section = { label: title, fields: [] }; secMap.push(section) }
    section.fields.push({
      fieldname: f.fieldname,
      fieldtype: f.fieldtype,
      label: f.label,
      reqd: !!f.reqd,
      options: f.options || undefined,
      readOnly: !editable || !!f.read_only,
    })
  })
  const sections = secMap.map((s) => {
    const col0: LayoutField[] = [], col1: LayoutField[] = []
    s.fields.forEach((f, i) => (i % 2 ? col1 : col0).push(f))
    return { label: s.label, columns: [{ fields: col0 }, { fields: col1 }] }
  })
  return [{ sections }]
}
