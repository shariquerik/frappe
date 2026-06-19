// Types for the Form feature folder. `SchemaField` is one raw field from the live DocType
// field schema (the subset layout.ts reads); the `Layout*` shapes are the @framework/ui
// FormLayout structure buildFormLayout projects the schema into.
export interface SchemaField {
  fieldname: string
  fieldtype: string
  label: string
  reqd?: boolean | number
  options?: string
  read_only?: boolean | number
  section?: string
}

export interface LayoutField {
  fieldname: string
  fieldtype: string
  label: string
  reqd: boolean
  options: string | undefined
  readOnly: boolean
}

export interface LayoutColumn {
  fields: LayoutField[]
}

export interface LayoutSection {
  label: string
  columns: LayoutColumn[]
}

export interface LayoutTab {
  sections: LayoutSection[]
}
