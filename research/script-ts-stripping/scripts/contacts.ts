// Vue template string in a TypeScript script: only erasable type syntax.
import { ref, computed, type Ref } from "vue";
import { Badge, Button, Dialog } from "frappe-ui";
import type { RecordPage } from "frappe/desk";

interface Contact {
  name: string;
  full_name: string;
  email?: string;
}
type Theme = "green" | "gray";

const Contacts = {
  props: { page: Object },
  components: { Badge, Button, Dialog },
  setup(props: { page: RecordPage }) {
    const open: Ref<boolean> = ref(false);
    const note = ref<string>("");
    const contacts = computed(() => (props.page.doc.contacts as Contact[]) ?? []);
    const theme = computed<Theme>(() => (props.page.doc.status === "Won" ? "green" : "gray"));
    const save = (): void => {
      props.page.doc!.last_note = note.value;
      open.value = false;
    };
    return { open, note, contacts, theme, save };
  },
  template: `
    <div class="flex flex-col gap-2 p-3">
      <div class="flex items-center justify-between">
        <Badge :label="page.doc.status" :theme="theme" />
        <Button label="Add note" @click="open = true" />
      </div>
      <ul v-if="contacts.length" class="text-sm">
        <li v-for="c in contacts" :key="c.name">{{ c.full_name }} ({{ c.email }})</li>
      </ul>
      <p v-else class="text-ink-gray-5">No contacts yet</p>
      <Dialog v-model:open="open" title="Add note">
        <textarea class="w-full" rows="4" v-model="note" />
        <template #actions>
          <Button variant="solid" label="Save" @click="save" />
        </template>
      </Dialog>
    </div>`,
} satisfies Record<string, unknown>;

export default {
  onRefresh(page: RecordPage): void {
    page.panelSections.add({ name: "contacts", label: "Contacts", component: Contacts }, { before: "people" });
  },
};
