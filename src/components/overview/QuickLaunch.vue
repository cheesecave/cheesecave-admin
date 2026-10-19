<script setup>
import { useRouter } from "vue-router";

defineProps({ badges: { type: Object, default: () => ({}) } });
const router = useRouter();

const actions = [
  {
    label: "Create user",
    icon: "i-carbon-user-follow",
    to: { path: "/users", query: { create: "1" } },
  },
  {
    label: "Reset a password",
    icon: "i-carbon-password",
    to: { path: "/users", query: { reset: "1" } },
  },
  {
    label: "New invitation",
    icon: "i-carbon-email",
    to: { path: "/invitations", query: { create: "1" } },
  },
  {
    label: "Run LFS reconciliation",
    icon: "i-carbon-data-volume",
    to: { path: "/storage", query: { tab: "lfs" } },
  },
];
const groups = [
  {
    name: "People",
    items: [
      ["Users", "/users"],
      ["Invitations", "/invitations"],
      ["Quota Overview", "/QuotaOverview"],
    ],
  },
  {
    name: "Content",
    items: [
      ["Repositories", "/repositories"],
      ["Commits", "/commits"],
      ["Fallback Sources", "/fallback-sources"],
    ],
  },
  {
    name: "Operations",
    items: [
      ["Background Tasks", "/tasks"],
      ["Health", "/health"],
      ["Storage", "/storage"],
      ["Cache", "/cache"],
    ],
  },
  {
    name: "Site",
    items: [
      ["Site", "/site"],
      ["Credentials", "/credentials"],
      ["Database", "/DatabaseViewer"],
    ],
  },
];
</script>

<template>
  <el-card shadow="never" data-testid="launch-card">
    <div class="actions">
      <span class="lbl">Quick actions</span>
      <button
        v-for="a in actions"
        :key="a.label"
        type="button"
        class="act"
        @click="router.push(a.to)"
      >
        <span :class="a.icon" aria-hidden="true" />{{ a.label }}
      </button>
      <span class="hint"
        >or press <kbd>Ctrl</kbd>+<kbd>K</kbd> for anything</span
      >
    </div>
    <div class="groups">
      <div v-for="g in groups" :key="g.name" class="g">
        <div class="gn">{{ g.name }}</div>
        <router-link
          v-for="[label, path] in g.items"
          :key="path"
          :to="path"
          class="m"
        >
          {{ label }}
          <span
            v-if="badges[path]"
            class="b"
            :class="badges[path].kind"
            :aria-label="`${badges[path].n} need attention`"
            >{{ badges[path].n }}</span
          >
        </router-link>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.lbl {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
  margin-right: 4px;
}
.act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}
.act:hover {
  border-color: var(--color-info);
}
.hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}
kbd {
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 0 5px;
  font-size: 11px;
}
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
}
.gn {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 4px;
}
.m {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
}
.m:hover {
  color: var(--admin-text-primary);
}
.b {
  border-radius: 999px;
  font-size: 11px;
  padding: 0 7px;
  color: var(--admin-on-fill, #111);
  background: var(--color-info);
}
.b.danger {
  background: var(--color-error);
}
.b.warning {
  background: var(--color-warning);
}
</style>
