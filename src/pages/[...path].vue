<script setup>
import { useRoute } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import { useSiteBrandingStore } from "@/stores/siteBranding";

const route = useRoute();
useSiteBrandingStore().setPageTitle("Page not found");
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader
        title="Page not found"
        subtitle="There is no admin page at this address."
      />
      <p class="mb-4">
        <code>{{ route.fullPath }}</code>
      </p>
      <router-link to="/">Back to the dashboard</router-link>
    </AdminPage>
  </AdminLayout>
</template>
