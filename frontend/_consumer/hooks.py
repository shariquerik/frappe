# crm/hooks.py — the entire declaration. Two lines.

app_name = "crm"

# #42065: bare path segment, scalar, Python-only truth.
# Overridden because CRM v1 holds /crm (charter item 8).
app_route = "crmv2"

# #42070: dotted path, called with no args, merged under the framework's core boot.
app_boot = "crm.boot.get_boot"

# Everything else is discovery by convention. No route table, no page list,
# no customization registry, no build hook.
