<script setup lang="ts">
// frappe-ui Badge as the status pill, with the original's leading colored dot
// (a child span tinted to the badge's own text color via currentColor).
import { Badge } from 'frappe-ui'

withDefaults(defineProps<{ value?: string; theme?: string }>(), { theme: 'gray' })
</script>

<template>
  <Badge :theme="theme" variant="subtle" size="md">
    <span class="inline-flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
      {{ value }}
    </span>
  </Badge>
</template>
