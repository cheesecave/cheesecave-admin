<script setup>
defineProps({
  health: { type: Object, default: null },
  workers: { type: Object, default: null },
  queue: { type: Object, default: null },
  build: { type: Object, default: null },
});

const ok = (section) => section && !section.error;
</script>

<template>
  <section class="strip" aria-label="System status" data-testid="status-strip">
    <template v-if="ok(health)">
      <router-link
        v-for="dep in health.dependencies"
        :key="dep.name"
        to="/health"
        class="chip"
        :title="dep.detail || dep.status"
        :aria-label="`${dep.name}: ${dep.status}`"
        :data-testid="`status-dep-${dep.name}`"
      >
        <i class="dot" :class="`dot-${dep.status}`" aria-hidden="true" />
        {{ dep.name }}
        <span v-if="dep.latency_ms != null" class="muted"
          >{{ dep.latency_ms }} ms</span
        >
        <span v-if="dep.status !== 'ok'" class="state">{{ dep.status }}</span>
      </router-link>
    </template>
    <span
      v-else-if="health"
      class="chip muted"
      data-testid="status-health-unavailable"
    >
      Health unavailable
    </span>
    <span v-if="ok(health) || health" class="sep" aria-hidden="true" />
    <router-link
      v-if="ok(workers)"
      to="/tasks"
      class="chip"
      data-testid="status-workers"
    >
      Workers {{ workers.online }} online
      <span v-if="workers.lost" class="bad">· {{ workers.lost }} lost</span>
    </router-link>
    <router-link
      v-if="ok(queue)"
      to="/tasks"
      class="chip"
      data-testid="status-queue"
    >
      Queue {{ queue.queued }} queued · {{ queue.running }} running
    </router-link>
    <span class="grow" />
    <span v-if="ok(build)" class="chip muted" data-testid="status-build"
      >backend {{ build.backend }}</span
    >
  </section>
</template>

<style scoped>
.strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  margin-bottom: 16px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}
a.chip:hover {
  outline: 1px solid var(--border-strong);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  background: var(--text-tertiary, #9ca3af);
}
.dot-ok {
  background: var(--color-success);
}
.dot-down {
  background: var(--color-error);
}
.muted {
  color: var(--text-secondary, #6b7280);
}
.bad,
.state {
  color: var(--color-error);
  font-weight: 600;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--border-default);
}
.grow {
  flex: 1;
}
</style>
