// Stand-ins for the three frappe-ui components the scripts use. They take the same
// props, so a script reads as it would against the real ones. PROTOTYPE only.
import { h } from "vue";

export const Badge = {
	props: { label: [String, Number], theme: String },
	setup: (props) => () => h("span", { class: `badge badge-${props.theme}` }, props.label),
};

export const Button = {
	props: { label: String, variant: String, disabled: Boolean },
	setup: (props) => () =>
		h("button", { class: `button-${props.variant || "subtle"}`, disabled: props.disabled }, props.label),
};

export const Textarea = {
	props: { modelValue: String, placeholder: String, rows: Number },
	emits: ["update:modelValue"],
	setup: (props, { emit }) => () =>
		h("textarea", {
			value: props.modelValue,
			placeholder: props.placeholder,
			rows: props.rows,
			onInput: (event) => emit("update:modelValue", event.target.value),
		}),
};
