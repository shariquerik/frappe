// crm/crm/fcrm/custom/contact/record.js
//
// CRM customizing frappe's Contact. Same shape as its own doctype; only the
// folder differs, mirroring the split frappe already makes for schema
// customizations (`custom/contact.json`, #42068 §10).
//
// It applies globally and unconditionally -- everyone who opens
// /deskv2/contact/CONTACT-0001 gets this, whether or not they came from CRM
// (#42068 §7). Note the URL: customizing a foreign doctype does NOT move it
// into /crmv2.

export default {
  actions: [{ name: 'link_deal', label: 'Link to deal', run: async (page) => {} }],
}
