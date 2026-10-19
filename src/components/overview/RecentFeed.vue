<script setup>
defineProps({ recent: Object, top: Object });
</script>

<template>
  <el-card shadow="never" data-testid="recent-card">
    <template #header><b>Recent activity</b></template>
    <div v-if="recent && !recent.error" class="feed">
      <router-link v-for="r in recent.items" :key="r.id" :to="r.link" class="item">
        <span :class="r.icon" class="ic" />
        <span class="t"><b>{{ r.actor }}</b> {{ r.text }}</span>
        <span class="when">{{ r.when }}</span>
      </router-link>
    </div>
    <div v-else class="muted">Recent activity unavailable.</div>
  </el-card>
</template>

<style scoped>
.item { display: flex; gap: 10px; align-items: baseline; padding: 7px 2px; border-bottom: 1px solid var(--border-light); color: var(--text-primary); text-decoration: none; font-size: 13px; }
.item:last-child { border-bottom: 0; }
.item:hover { background: var(--bg-hover); }
.ic { font-size: 15px; color: var(--text-secondary, #6b7280); align-self: center; }
.t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.when { color: var(--text-secondary, #6b7280); font-size: 12px; white-space: nowrap; }
.muted { color: var(--text-secondary, #6b7280); }
</style>
