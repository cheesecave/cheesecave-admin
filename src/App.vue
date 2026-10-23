<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElConfigProvider } from "element-plus";
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

  // A reload keeps the session: ask the backend whether the cookie still stands for one before deciding
  await adminStore.restore();

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
  <!-- Messages appear 72 px from the top: below the 60 px top bar, not over its title. -->
  <el-config-provider :message="{ offset: 72 }">
    <router-view />
  </el-config-provider>
</template>

<style>
/* Global styles are in style.css */
</style>
