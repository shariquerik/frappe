<!-- Vue SFC text. The SFC's default export is the component, so the handlers sit in a plain
     <script> as a named export and receive the component as a second argument. -->
<script>
export const handlers = {
  onRefresh(page, Contacts) {
    page.panelSections.add({ name: "contacts", label: "Contacts", component: Contacts }, { before: "people" });
  },
};
</script>

<script setup>
import { ref, computed } from "vue";
import { Badge, Button, Dialog } from "frappe-ui";

const props = defineProps({ page: Object });
const open = ref(false);
const note = ref("");
const contacts = computed(() => props.page.doc.contacts ?? []);
const theme = computed(() => (props.page.doc.status === "Won" ? "green" : "gray"));
const save = () => {
  props.page.doc.last_note = note.value;
  open.value = false;
};
</script>

<template>
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
  </div>
</template>
