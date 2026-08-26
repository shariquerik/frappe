# crm/boot.py — NEW. The five keys that are genuinely CRM's.
# #42070 §4: forked from crm/www/crm.py::get_boot, which stays serving v1 untouched.

import frappe


def get_boot():
    # A raise here is caught, log_error'd and degraded by the framework (#42070 §5) --
    # so this function does NOT need CRM's existing defensive try/except around
    # get_state_options(). That defensiveness was a symptom of owning the page.
    return {
        "default_route": "/crmv2/crm-lead",
        "is_demo_site": frappe.conf.get("is_demo_site", False),
        "demo_data_created": frappe.db.get_default("crm_demo_data_created"),
        "state_options": get_state_options(),
    }


# NOTE, and it is a finding rather than a detail: #42070 named *five* CRM keys.
# The fifth is `extend_frontend` -- the runtime-extension list from map 1, whose
# whole purpose is telling a host to go load separately-built bundles. Under one
# bundle there is nothing to go and load. Whether the key survives is #42071's,
# so it is absent here and deliberately not deleted there.
