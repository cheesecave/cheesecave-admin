<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";
import { useThemeStore } from "@/stores/theme";
import { loginLocation } from "@/utils/login-redirect";

const router = useRouter();
const adminStore = useAdminStore();
const themeStore = useThemeStore();

onMounted(async () => {
  // Initialize theme
  themeStore.init();

  // On a cold load the router has not resolved the first navigation yet, so
  // the requested page is only known once it is ready.
  await router.isReady();

  // Redirect to login if not authenticated
  if (
    !adminStore.isAuthenticated &&
    router.currentRoute.value.path !== "/login"
  ) {
    router.push(loginLocation(router.currentRoute.value.fullPath));
  }
});
</script>

<template>
  <router-view />
</template>

<style>
/* Global styles are in style.css */
</style>
