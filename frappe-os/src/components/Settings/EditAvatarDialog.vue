<script setup lang="ts">
// Profile-photo editor for the Account pane — a frappe-ui Dialog showing the current avatar
// with upload / remove affordances. Upload rides frappe-ui FileUploader (→ upload_file gives a
// file_url); both actions write user_image through useAccount(). Visibility is a v-model the
// parent owns; stays open so the result is visible, close via the Dialog's own chrome.
import { computed } from 'vue'
import { Avatar, Button, Dialog, FileUploader } from 'frappe-ui'
import { useAccount } from '@/data/account'

const open = defineModel<boolean>()
const { state, save } = useAccount()

const fullName = computed(() => (state.doc?.full_name as string) || (state.doc?.name as string) || '')

function isImage(file: { type?: string }): string {
  return file.type?.startsWith('image/') ? '' : 'Please choose an image file'
}

// An empty url (the remove affordance) clears the avatar back to initials.
async function setAvatar(fileUrl = ''): Promise<void> {
  try {
    await save({ user_image: fileUrl })
  } catch {
    // state.error is rendered inline.
  }
}
</script>

<template>
  <Dialog v-model="open" :options="{ title: 'Profile photo', size: 'sm' }">
    <template #body-content>
      <div class="flex flex-col items-center gap-4 py-1">
        <Avatar class="!size-24" :image="state.doc?.user_image" :label="fullName" />
        <div class="flex items-center gap-2">
          <FileUploader fileTypes="image/*" :validateFile="isImage" @success="(file: { file_url: string }) => setAvatar(file.file_url)">
            <template #default="{ openFileSelector, uploading }">
              <Button variant="solid" :loading="uploading || state.saving" label="Upload image" @click="openFileSelector" />
            </template>
          </FileUploader>
          <Button v-if="state.doc?.user_image" :loading="state.saving" label="Remove photo" @click="setAvatar()" />
        </div>
        <div v-if="state.error" class="text-[12px] text-ink-red-6">{{ state.error }}</div>
      </div>
    </template>
  </Dialog>
</template>
