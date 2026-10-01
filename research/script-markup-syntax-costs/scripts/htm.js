// htm: tagged templates bound to h, parsed at run time.
import { h, ref, computed } from "vue";
import htm from "htm";
import { Badge, Button, Dialog } from "frappe-ui";

const html = htm.bind(h);

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
    return () => html`
      <div class="flex flex-col gap-2 p-3">
        <div class="flex items-center justify-between">
          <${Badge} label=${props.page.doc.status} theme=${theme.value} />
          <${Button} label="Add note" onClick=${() => (open.value = true)} />
        </div>
        ${contacts.value.length
          ? html`<ul class="text-sm">
              ${contacts.value.map((c) => html`<li key=${c.name}>${c.full_name} (${c.email})</li>`)}
            </ul>`
          : html`<p class="text-ink-gray-5">No contacts yet</p>`}
        <${Dialog} open=${open.value} onUpdate:open=${(v) => (open.value = v)} title="Add note">${{
          default: () => html`<textarea class="w-full" rows="4" value=${note.value}
            onInput=${(e) => (note.value = e.target.value)} />`,
          actions: () => html`<${Button} variant="solid" label="Save" onClick=${save} />`,
        }}<//>
      </div>`;
  },
};

export default {
  onRefresh(page) {
    page.panelSections.add({ name: "contacts", label: "Contacts", component: Contacts }, { before: "people" });
  },
};
