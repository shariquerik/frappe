// Baseline: what an author writes today, with h().
import { h, ref, computed } from "vue";
import { Badge, Button, Dialog } from "frappe-ui";

const Contacts = {
  props: { page: Object },
  setup(props) {
    const open = ref(false);
    const note = ref("");
    const contacts = computed(() => props.page.doc.contacts ?? []);
    const theme = computed(() => (props.page.doc.status === "Won" ? "green" : "gray"));
    const save = () => {
      props.page.doc.last_note = note.value;
      open.value = false;
    };
    return () =>
      h("div", { class: "flex flex-col gap-2 p-3" }, [
        h("div", { class: "flex items-center justify-between" }, [
          h(Badge, { label: props.page.doc.status, theme: theme.value }),
          h(Button, { label: "Add note", onClick: () => (open.value = true) }),
        ]),
        contacts.value.length
          ? h("ul", { class: "text-sm" },
              contacts.value.map((c) => h("li", { key: c.name }, `${c.full_name} (${c.email})`)))
          : h("p", { class: "text-ink-gray-5" }, "No contacts yet"),
        h(Dialog, { open: open.value, "onUpdate:open": (v) => (open.value = v), title: "Add note" }, {
          default: () =>
            h("textarea", { class: "w-full", rows: 4, value: note.value,
              onInput: (e) => (note.value = e.target.value) }),
          actions: () => h(Button, { variant: "solid", label: "Save", onClick: save }),
        }),
      ]);
  },
};

export default {
  onRefresh(page) {
    page.panelSections.add({ name: "contacts", label: "Contacts", component: Contacts }, { before: "people" });
  },
};
