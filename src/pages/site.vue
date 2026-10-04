<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import SiteBrandingSettings from "@/components/site/SiteBrandingSettings.vue";
import HomepageSettings from "@/components/site/HomepageSettings.vue";
import FooterSettings from "@/components/site/FooterSettings.vue";
import ThemeSettings from "@/components/site/ThemeSettings.vue";

const route = useRoute();
const router = useRouter();
const tabs = [
  { key: "branding", label: "Branding", icon: "i-carbon-paint-brush" },
  { key: "homepage", label: "Homepage", icon: "i-carbon-home" },
  { key: "footer", label: "Footer", icon: "i-carbon-link" },
  { key: "theme", label: "Theme", icon: "i-carbon-color-palette" },
];
const activeTab = computed(() =>
  tabs.some((tab) => tab.key === route.query.tab)
    ? route.query.tab
    : "branding",
);
const panels = {
  branding: SiteBrandingSettings,
  homepage: HomepageSettings,
  footer: FooterSettings,
  theme: ThemeSettings,
};

function selectTab(tab) {
  if (tab === activeTab.value) return;
  router.replace({ path: "/site", query: { ...route.query, tab } });
}

function handleTabKey(event, index) {
  let next;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  else if (event.key === "ArrowLeft")
    next = (index + tabs.length - 1) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;
  event.preventDefault();
  selectTab(tabs[next].key);
  event.currentTarget.parentElement
    .querySelectorAll('[role="tab"]')
    [next].focus();
}
</script>

<template>
  <AdminLayout>
    <AdminPage class="site-page">
      <AdminPageHeader
        title="Site"
        subtitle="Manage your site's identity, homepage, footer and appearance in one place."
      />
      <el-card class="site-settings-card" shadow="never">
        <div
          class="site-tabs admin-tab-list"
          role="tablist"
          aria-label="Site settings"
        >
          <button
            v-for="(tab, index) in tabs"
            :id="`site-${tab.key}-tab`"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-controls="`site-${tab.key}-panel`"
            :tabindex="activeTab === tab.key ? 0 : -1"
            :class="{ active: activeTab === tab.key }"
            @click="selectTab(tab.key)"
            @keydown="handleTabKey($event, index)"
          >
            <span :class="tab.icon" aria-hidden="true" /> {{ tab.label }}
          </button>
        </div>
        <section
          :id="`site-${activeTab}-panel`"
          class="site-tab-panel"
          role="tabpanel"
          :aria-labelledby="`site-${activeTab}-tab`"
        >
          <KeepAlive>
            <component :is="panels[activeTab]" :key="activeTab" />
          </KeepAlive>
        </section>
      </el-card>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.site-settings-card {
  background: var(--bg-card);
  border-color: var(--border-default);
  color: var(--text-primary);
}
.site-settings-card > :deep(.el-card__body) {
  padding: 0;
}
.site-tabs {
  margin: 24px 24px 0;
  max-width: calc(100% - 48px);
  overflow-x: auto;
  scrollbar-width: thin;
}
.site-tabs button {
  white-space: nowrap;
  flex-shrink: 0;
}
.site-tab-panel {
  min-width: 0;
  padding: 24px;
}
@media (max-width: 600px) {
  .site-tab-panel {
    padding: 16px;
  }
  .site-tabs {
    margin: 16px 16px 0;
    max-width: calc(100% - 32px);
  }
}
</style>
