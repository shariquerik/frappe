<script setup lang="ts">
// Account pane body — the logged-in user's identity at the top of Settings (ADR-0027). A
// bespoke compact pane (consistent with the hand-built Appearance/Dock/General panes): a
// header card with avatar + full name + email and an editable first/last name. Reads &
// writes ride useAccount(), which persists ONLY the permlevel-0 identity fields via the
// own-user self-DocShare — no System Manager needed.
import { computed, onMounted, ref, watch } from 'vue'
import { Avatar, Button, FileUploader, FormControl, LoadingIndicator } from 'frappe-ui'
import { useAccount } from '@/data/account'

const { state, load, save } = useAccount()

// Local edit buffer for the two permlevel-0 name fields; re-seeded whenever the doc (re)loads
// so an external save can't leave the inputs stale.
const firstName = ref('')
const lastName = ref('')
watch(
  () => state.doc,
  (doc) => {
    firstName.value = (doc?.first_name as string) || ''
    lastName.value = (doc?.last_name as string) || ''
  },
  { immediate: true },
)

onMounted(() => load())

const fullName = computed(() => (state.doc?.full_name as string) || (state.doc?.name as string) || '')
const email = computed(() => (state.doc?.email as string) || (state.doc?.name as string) || '')

// The name is dirty only when a field differs from the saved doc; an all-whitespace first
// name would clear the identity, so it can't be saved.
const nameDirty = computed(
  () => firstName.value !== ((state.doc?.first_name as string) || '') || lastName.value !== ((state.doc?.last_name as string) || ''),
)
const canSaveName = computed(() => nameDirty.value && firstName.value.trim().length > 0)

function isImage(file: { type?: string }): string {
  return file.type?.startsWith('image/') ? '' : 'Please choose an image file'
}

function saveName(): void {
  if (!canSaveName.value) return
  save({ first_name: firstName.value.trim(), last_name: lastName.value.trim() })
}

// Avatar upload: FileUploader → upload_file gives a file_url → set user_image → save. An empty
// url (the remove affordance) clears the avatar back to initials.
function setAvatar(fileUrl = ''): void {
  save({ user_image: fileUrl })
}
</script>

<template>
  <div class="px-[22px] py-5">
    <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">ACCOUNT</div>

    <div v-if="state.loading && !state.doc" class="flex items-center gap-2 py-6 text-[13px] text-ink-gray-5">
      <LoadingIndicator class="size-4" />
      Loading your account…
    </div>
    <div v-else-if="state.error && !state.doc" class="py-6 text-[13px] text-ink-red-6">{{ state.error }}</div>

    <template v-else>
      <!-- Identity header: avatar (uploadable) + full name + email -->
      <div class="flex items-center gap-3.5 pb-5">
        <FileUploader :validateFile="isImage" @success="(file: { file_url: string }) => setAvatar(file.file_url)">
          <template #default="{ openFileSelector, uploading }">
            <div class="group relative size-14 cursor-pointer" @click="openFileSelector">
              <Avatar class="!size-14" :image="state.doc?.user_image" :label="fullName" />
              <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                Edit
              </div>
              <div v-if="uploading" class="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                <LoadingIndicator class="size-4 text-white" />
              </div>
            </div>
          </template>
        </FileUploader>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-[15px] font-semibold text-ink-gray-9">{{ fullName }}</span>
          <span class="truncate text-[12.5px] text-ink-gray-6">{{ email }}</span>
          <button v-if="state.doc?.user_image" class="mt-0.5 w-fit cursor-pointer border-none bg-transparent p-0 text-[11.5px] text-ink-gray-5 hover:text-ink-gray-7" @click="setAvatar()">
            Remove photo
          </button>
        </div>
      </div>

      <!-- Editable name (the two permlevel-0 fields) -->
      <div class="flex items-end gap-2.5 border-t border-outline-gray-1 py-[14px]">
        <FormControl class="flex-1" type="text" label="First name" v-model="firstName" @keydown.enter="saveName" />
        <FormControl class="flex-1" type="text" label="Last name" v-model="lastName" @keydown.enter="saveName" />
        <Button label="Save" variant="solid" :loading="state.saving" :disabled="!canSaveName" @click="saveName" />
      </div>
      <div v-if="state.error && state.doc" class="pb-2 text-[12px] text-ink-red-6">{{ state.error }}</div>
    </template>
  </div>
</template>
