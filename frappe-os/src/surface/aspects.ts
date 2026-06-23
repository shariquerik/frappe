// The Aspects a form Surface can present — facets of a single record (ADR-0018): Details
// (the field form itself), Activities (the record's timeline), Email (its communications).
// Core-for-now: a single hardcoded built-in array with stable string ids — the ids the URL
// trailing segment uses (issue 02) and a future `form-aspect` extension point would key on
// (deferred, ADR-0018). NOT positional/anonymous. Details is the default and projects to the
// bare form path. This module is a pure leaf (no store/registry deps) so route-map can read
// the id set without pulling the desktop graph in.

export interface AspectDef {
  id: string
  label: string
  icon: string
}

// Details is wired to the existing form field grid; Activities/Email are labelled
// placeholder panes in this slice (no timeline/Communication data fetched yet).
export const FORM_ASPECTS: AspectDef[] = [
  { id: 'details', label: 'Details', icon: 'lucide-file-text' },
  { id: 'activities', label: 'Activities', icon: 'lucide-activity' },
  { id: 'email', label: 'Email', icon: 'lucide-mail' },
]

// The default Aspect — the bare form URL with no trailing segment resolves to this.
export const DEFAULT_ASPECT = 'details'

// True only for one of the known built-in Aspect ids. route-map uses this to read a URL
// trailing segment as an Aspect ONLY when it matches, so a record name is never misread as
// `record/aspect` (issue 02).
export const isAspectId = (id?: string | null): boolean => !!id && FORM_ASPECTS.some((a) => a.id === id)

export const aspectById = (id?: string | null): AspectDef | undefined => FORM_ASPECTS.find((a) => a.id === id)
