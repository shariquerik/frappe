<script setup lang="ts">
// Name editor for the Account pane — a frappe-ui Dialog over the two permlevel-0 name fields.
// Visibility is a v-model the parent owns; saves through useAccount() and closes on success,
// while a save error keeps it open with the message shown.
import { computed, ref, watch } from 'vue'
import { Button, Dialog, FormControl } from 'frappe-ui'
import { useAccount } from '@/data/account'

const open = defineModel<boolean>()
const { state, save } = useAccount()

const firstName = ref('')
const lastName = ref('')

// Reseed from the cached doc each time the dialog opens, so an external change can't leave the
// inputs stale between opens.
watch(open, (isOpen) => {
  if (!isOpen) return
  firstName.value = (state.doc?.first_name as string) || ''
  lastName.value = (state.doc?.last_name as string) || ''
})

// Dirty only when a field differs from the saved doc; an all-whitespace first name would clear
// the identity, so it can't be saved.
const dirty = computed(
  () => firstName.value !== ((state.doc?.first_name as string) || '') || lastName.value !== ((state.doc?.last_name as string) || ''),
)
const canSave = computed(() => dirty.value && firstName.value.trim().length > 0)

async function submit(): Promise<void> {
  if (!canSave.value) return
  try {
    await save({ first_name: firstName.value.trim(), last_name: lastName.value.trim() })
    open.value = false
  } catch {
    // state.error is rendered inline; keep the dialog open so the edit isn't lost.
  }
}
</script>

<template>
  <Dialog v-model="open" :options="{ title: 'Edit name', size: 'sm' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <FormControl type="text" label="First name" v-model="firstName" @keydown.enter="submit" />
        <FormControl type="text" label="Last name" v-model="lastName" @keydown.enter="submit" />
        <div v-if="state.error" class="text-[12px] text-ink-red-6">{{ state.error }}</div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button label="Save" variant="solid" :loading="state.saving" :disabled="!canSave" @click="submit" />
      </div>
    </template>
  </Dialog>
</template>
