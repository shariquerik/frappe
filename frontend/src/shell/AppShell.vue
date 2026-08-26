<!-- PROTOTYPE stub. Shell-owned chrome: rail, sidebar, header slot.

     The hole this file marks and does not fill: WHAT THE SIDEBAR FOLLOWS.
     #42068 §4 established it is not the prefix, and that desk v1 derives it from
     the routed doctype's module (sidebar.js:96-101) and deliberately keeps the
     previous context when it cannot resolve (sidebar.js:88-91). #42102 decides.

     Structurally this is crm/frontend2/src/components/AppShell.vue, moved. That
     move is most of what "the framework hosts the shell" means in files. -->
<template>
  <div class="flex h-full">
    <!-- rail + sidebar: #42102 -->
    <main class="min-w-0 flex-1">
      <!-- Keyed on path, not fullPath: saved-view tweaks rewrite the query and must
           NOT remount, which is exactly the ?view= / path split of #42068. -->
      <router-view :key="$route.path" />
    </main>
  </div>
</template>
