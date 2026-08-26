# PROTOTYPE stubs

`Home.vue`, `List.vue`, `Record.vue` — the three generated views every app gets.

They are `crm/frontend2/src/pages/*` moved into the framework, essentially unchanged.
That is the point: the 123 files of frontend2 are not being redesigned by this map, they
are changing owner. The map's fog on "how frontend2's 123 files decompose" is asking how
many of them end up here versus in `_consumer/`, and on this scaffold's reading the
answer is *almost all of them here* — CRM's genuinely-app-specific surface is the four
files in `_consumer/`.
