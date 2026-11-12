<!-- PROTOTYPE (#45867): `/doctype/new` and a DocType "created" this session draw the new-DocType
     draft page; any other name draws the saved-DocType page (#47095). The draft page stays mounted when Save moves
     its address from /doctype/new to /doctype/<name>; a new draft (the dialog's Continue) remounts it. -->
<template>
	<DraftPage v-if="isDraft" :key="draftGeneration" />
	<SavedPage v-else :key="name" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DraftPage from "./create/DraftPage.vue";
import SavedPage from "./create/SavedPage.vue";
import { created, draftGeneration } from "./create/newDoctype";

const route = useRoute();
const name = computed(() => String(route.params.name));
const isDraft = computed(() => name.value === "new" || created.has(name.value));
</script>
