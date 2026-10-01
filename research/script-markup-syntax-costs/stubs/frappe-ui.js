// Stand-ins for the three frappe-ui components, so each script's output can be rendered and
// compared without frappe-ui's own CSS and dependencies. Dialog draws both slots while open.
import { h } from "vue";

export const Badge = {
  props: { label: [String, Number], theme: String },
  setup: (props) => () => h("span", { "data-badge": props.theme }, props.label),
};

export const Button = {
  props: { label: String, variant: String },
  emits: ["click"],
  setup: (props, { emit }) => () =>
    h("button", { "data-variant": props.variant ?? "subtle", onClick: () => emit("click") }, props.label),
};

export const Dialog = {
  props: { open: Boolean, title: String },
  emits: ["update:open"],
  setup: (props, { slots }) => () =>
    props.open
      ? h("section", { "data-dialog": props.title }, [slots.default?.(), h("footer", slots.actions?.())])
      : null,
};
