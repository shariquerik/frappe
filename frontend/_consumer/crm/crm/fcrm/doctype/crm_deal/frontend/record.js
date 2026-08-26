// crm/crm/fcrm/doctype/crm_deal/frontend/record.js
//
// Was: crm/frontend2/src/customizations/CRM Deal.js
//
// The move is the whole story. Three things the author STOPS doing:
//   1. naming the doctype -- the folder is the doctype (#42068 §10)
//   2. importing registerRecordPage -- the default export IS the registration
//   3. being reachable by register.ts's `import.meta.glob('./*.js')` -- the
//      framework's plugin finds this file, in any app, with no per-app file.
//
// Note there is no import from '@framework/ui/experimental' at all. That import
// existed only to reach the registrar. The handler shape is unchanged.

export default {
  actions: [
    {
      name: 'mark_won',
      label: 'Mark as won',
      icon: 'lucide-trophy',
      run: async (page) => {
        page.doc.status = 'Won'
        await page.save()
      },
    },
  ],
}

// Open question this file raises, and the scaffold does not answer:
// a bare default export cannot be type-checked the way `registerRecordPage(dt, h)`
// could, because nothing names the contract at the callsite. `satisfies
// RecordPageHandlers` would need the import back. Worth a decision, not a ticket yet.
