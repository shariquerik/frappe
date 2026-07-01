<script setup lang="ts">
// Account pane body — the logged-in user's identity at the top of Settings (ADR-0027). A
// centered profile header: an uploadable avatar (hover → Edit) + full name + email, with the
// name and photo each edited through a small frappe-ui Dialog. Reads/writes ride useAccount(),
// which persists ONLY the permlevel-0 identity fields via the own-user self-DocShare — no
// System Manager needed.
import { computed, onMounted, ref } from 'vue'
import { Avatar, Button, LoadingIndicator } from 'frappe-ui'
import { useAccount } from '@/data/account'
import EditNameDialog from './EditNameDialog.vue'
import EditAvatarDialog from './EditAvatarDialog.vue'
import ChangePasswordDialog from './ChangePasswordDialog.vue'

const { state, load } = useAccount()
onMounted(() => load())

const fullName = computed(() => (state.doc?.full_name as string) || (state.doc?.name as string) || '')
const email = computed(() => (state.doc?.email as string) || (state.doc?.name as string) || '')

const nameOpen = ref(false)
const avatarOpen = ref(false)
const passwordOpen = ref(false)
</script>

<template>
  <div class="px-[22px] py-5">
    <div v-if="state.loading && !state.doc" class="flex items-center justify-center gap-2 py-6 text-[13px] text-ink-gray-5">
      <LoadingIndicator class="size-4" />
      Loading your account…
    </div>
    <div v-else-if="state.error && !state.doc" class="py-6 text-center text-[13px] text-ink-red-6">{{ state.error }}</div>

    <template v-else>
      <!-- Centered identity: uploadable avatar (hover → Edit) + full name + email -->
      <div class="flex flex-col items-center text-center">
        <div class="group relative size-[72px] cursor-pointer" @click="avatarOpen = true">
          <Avatar class="!size-[72px]" :image="state.doc?.user_image" :label="fullName" />
          <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            Edit
          </div>
        </div>
        <span class="mt-2.5 text-[16px] font-semibold text-ink-gray-9">{{ fullName }}</span>
        <span class="text-[12.5px] text-ink-gray-6">{{ email }}</span>
      </div>

      <!-- Setting rows — same structure as General/Dock: a divider between each row, the
           title/description on the left and the action button on the right. -->
      <div class="mt-6">
        <div class="flex items-center gap-3 border-b border-outline-gray-1 py-[11px]">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[13px] text-ink-gray-8">Name</span>
            <span class="text-[11.5px] text-ink-gray-5">The name shown across your workspace</span>
          </div>
          <Button label="Edit" @click="nameOpen = true" />
        </div>
        <div class="flex items-center gap-3 py-[11px]">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[13px] text-ink-gray-8">Password</span>
            <span class="text-[11.5px] text-ink-gray-5">Change the password you use to sign in</span>
          </div>
          <Button label="Change" @click="passwordOpen = true" />
        </div>
      </div>
    </template>

    <EditNameDialog v-model="nameOpen" />
    <EditAvatarDialog v-model="avatarOpen" />
    <ChangePasswordDialog v-model="passwordOpen" />
  </div>
</template>
