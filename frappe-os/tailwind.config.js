import frappeUIPreset from 'frappe-ui/tailwind'

export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}',
    // @framework/ui is `link:../ui`; scan its real source so classes used only
    // by its components are generated. Point at the real path rather than the
    // node_modules symlink, which Tailwind's globber doesn't reliably follow.
    '../ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  safelist: [
    { pattern: /!(text|bg)-/, variants: ['hover', 'active'] },
    // Icon classes from src/config/icons.ts are bound dynamically (`:class`), so
    // the JIT can't see them in source — list every lucide name the config maps to.
    'lucide-table', 'lucide-user', 'lucide-users', 'lucide-receipt', 'lucide-package',
    'lucide-building', 'lucide-file', 'lucide-globe', 'lucide-shield', 'lucide-layout-grid',
    'lucide-briefcase', 'lucide-shopping-cart', 'lucide-truck', 'lucide-wallet',
    'lucide-sticky-note', 'lucide-list-checks', 'lucide-bell', 'lucide-cloud',
    'lucide-settings', 'lucide-plug', 'lucide-sliders-horizontal', 'lucide-palette',
    'lucide-calendar', 'lucide-image', 'lucide-sun', 'lucide-moon', 'lucide-monitor',
  ],
  theme: { extend: {} },
  plugins: [],
}
