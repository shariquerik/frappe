<script setup lang="ts">
// Password editor for the Account pane — a frappe-ui Dialog over the rate-limited
// change_password method. Password is NOT a doc field, so this owns its own local state (not
// useAccount's doc): current / new / confirm, with client-side confirm-match and server-side
// verification of the current password. Visibility is a v-model the parent owns; closes on
// success, and a server error (wrong current password, rate-limited) keeps it open with the
// message shown.
import { computed, ref, watch } from 'vue'
import { Button, Dialog, Password } from 'frappe-ui'
import { changePassword } from '@/data/account'

const open = defineModel<boolean>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const error = ref('')

// Clear every field and any prior error each time the dialog opens, so a secret never lingers
// in the buffer between opens.
watch(open, (isOpen) => {
  if (!isOpen) return
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  error.value = ''
})

// The new password and its confirmation must match before we bother the server; surface the
// mismatch inline only once the user has typed a confirmation.
const mismatch = computed(() => confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value)
const canSave = computed(
  () =>
    currentPassword.value.length > 0 &&
    newPassword.value.length > 0 &&
    newPassword.value === confirmPassword.value,
)

async function submit(): Promise<void> {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    await changePassword(currentPassword.value, newPassword.value)
    open.value = false
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model="open" :options="{ title: 'Change password', size: 'sm' }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <Password label="Current password" v-model="currentPassword" />
        <Password label="New password" v-model="newPassword" @keydown.enter="submit" />
        <Password label="Confirm new password" v-model="confirmPassword" @keydown.enter="submit" />
        <div v-if="mismatch" class="text-[12px] text-ink-red-6">New passwords don't match</div>
        <div v-else-if="error" class="text-[12px] text-ink-red-6">{{ error }}</div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button label="Change password" variant="solid" :loading="saving" :disabled="!canSave" @click="submit" />
      </div>
    </template>
  </Dialog>
</template>
