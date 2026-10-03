<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import SiteBrandingSettings from "@/components/site/SiteBrandingSettings.vue";
import HomepageSettings from "@/components/site/HomepageSettings.vue";

const route = useRoute();
const router = useRouter();
const activeTab = computed(() =>
  route.query.tab === "homepage" ? "homepage" : "branding",
);
const tabs = [
  { key: "branding", label: "Branding", icon: "i-carbon-paint-brush" },
  { key: "homepage", label: "Homepage", icon: "i-carbon-home" },
];

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
        subtitle="Manage your site's identity and visitor homepage in one place."
      />
      <el-card class="site-settings-card" shadow="never">
        <div class="site-tabs" role="tablist" aria-label="Site settings">
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
            <component
              :is="
                activeTab === 'homepage'
                  ? HomepageSettings
                  : SiteBrandingSettings
              "
              :key="activeTab"
            />
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
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-default);
  padding: 0 12px;
  background: var(--bg-hover);
}
.site-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.site-tabs button.active,
.site-tabs button.active:hover {
  background: var(--bg-card);
  border-bottom-color: var(--color-info, #409eff);
  color: var(--text-primary);
  font-weight: 600;
}
.site-tabs button:hover {
  background: var(--bg-hover);
}
.site-tabs button:focus-visible {
  outline: 2px solid var(--color-info);
  outline-offset: -3px;
  border-radius: 6px 6px 0 0;
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
    gap: 0;
  }
  .site-tabs button {
    flex: 1;
    justify-content: center;
    padding-inline: 10px;
  }
}
</style>
