<script setup>
defineProps({ health: Object, workers: Object, queue: Object, build: Object });
const dot = { ok: "var(--color-success)", down: "var(--color-error)", disabled: "var(--text-tertiary, #9ca3af)" };
</script>

<template>
  <div class="strip" data-testid="status-strip">
    <template v-if="health && !health.error">
      <router-link
        v-for="d in health.dependencies"
        :key="d.name"
        to="/health"
        class="chip"
        :title="d.detail || d.status"
      >
        <i class="dot" :style="{ background: dot[d.status] }" />{{ d.name }}
        <span v-if="d.latency_ms != null" class="muted">{{ d.latency_ms }} ms</span>
      </router-link>
    </template>
    <span v-else class="chip muted">health unavailable</span>
    <span class="sep" />
    <router-link v-if="workers" to="/tasks" class="chip">
      Workers {{ workers.online }} online<span v-if="workers.lost" class="bad"> · {{ workers.lost }} lost</span>
    </router-link>
    <router-link v-if="queue" to="/tasks" class="chip">
      Queue {{ queue.queued }} queued · {{ queue.running }} running
    </router-link>
    <span class="grow" />
    <span v-if="build" class="chip muted">backend {{ build.backend }}</span>
  </div>
</template>

<style scoped>
.strip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; margin-bottom: 16px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--bg-hover); color: var(--text-primary); font-size: 13px; text-decoration: none; white-space: nowrap; }
.chip:hover { outline: 1px solid var(--border-strong); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.muted { color: var(--text-secondary, #6b7280); }
.bad { color: var(--color-error); font-weight: 600; }
.sep { width: 1px; height: 18px; background: var(--border-default); }
.grow { flex: 1; }
</style>
