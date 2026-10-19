<script setup>
import { formatAge } from "@/utils/relative-time";

defineProps({
  recent: { type: Object, default: null },
  now: { type: Number, default: () => Date.now() },
});

const icon = {
  user: "i-carbon-user-follow",
  repo: "i-carbon-data-base",
  commit: "i-carbon-version",
};
</script>

<template>
  <el-card shadow="never" data-testid="recent-card">
    <template #header><b>Recent activity</b></template>
    <div v-if="recent?.error" class="muted" data-testid="recent-unavailable">
      Recent activity unavailable.
    </div>
    <div
      v-else-if="recent && !recent.items.length"
      class="muted"
      data-testid="recent-empty"
    >
      Nothing yet.
    </div>
    <div v-else-if="recent">
      <router-link
        v-for="item in recent.items"
        :key="item.id"
        :to="item.link"
        class="item"
        :data-testid="`recent-${item.kind}`"
      >
        <span :class="icon[item.kind]" class="ic" aria-hidden="true" />
        <span class="t"
          ><b>{{ item.actor }}</b> {{ item.text }}</span
        >
        <span class="when">{{ formatAge(item.at, now) }}</span>
      </router-link>
    </div>
  </el-card>
</template>

<style scoped>
.item {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 7px 2px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
}
.item:last-child {
  border-bottom: 0;
}
.item:hover {
  background: var(--bg-hover);
}
.ic {
  font-size: 15px;
  color: var(--text-secondary, #6b7280);
  align-self: center;
}
.t {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.when {
  color: var(--text-secondary, #6b7280);
  font-size: 12px;
  white-space: nowrap;
}
.muted {
  color: var(--text-secondary, #6b7280);
}
</style>
