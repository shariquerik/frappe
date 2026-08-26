// crm/crm/fcrm/doctype/crm_deal/frontend/list.js
//
// The sibling of record.js. Same folder, same discovery, no extra registration --
// which is the argument for a `frontend/` subfolder rather than bare files beside
// crm_deal.js: `<scrubbed>_list.js` is already taken by desk v1's list script, in
// eight-plus places in frappe alone (#42068 §10). Inside the subfolder the reason
// for the doctype-name prefix evaporates, and it extends the way you want:
// kanban.js, calendar.js.

export default {
  columns: [{ fieldname: 'status', width: 120 }],
}
