<script setup>
defineProps({ queue: { type: Object, default: null } });
</script>

<template>
  <el-card shadow="never" data-testid="queue-card">
    <template #header>
      <div class="h">
        <b>Task queue</b>
        <router-link to="/tasks" class="more"
          >Open Background Tasks →</router-link
        >
      </div>
    </template>
    <div v-if="queue?.error" class="muted" data-testid="queue-unavailable">
      Task queue unavailable.
    </div>
    <div v-else-if="queue">
      <div class="nums">
        <router-link
          :to="{ path: '/tasks', query: { status: 'queued' } }"
          data-testid="queue-queued"
          ><b>{{ queue.queued }}</b
          ><span>queued</span></router-link
        >
        <router-link
          :to="{ path: '/tasks', query: { status: 'running' } }"
          data-testid="queue-running"
          ><b>{{ queue.running }}</b
          ><span>running</span></router-link
        >
        <router-link
          :to="{
            path: '/tasks',
            query: { status: 'succeeded', window: '24h' },
          }"
          data-testid="queue-succeeded"
          ><b>{{ queue.succeeded_24h }}</b
          ><span>ok / 24 h</span></router-link
        >
        <router-link
          :to="{ path: '/tasks', query: { status: 'failed', window: '24h' } }"
          :class="{ bad: queue.failed_24h }"
          data-testid="queue-failed"
          ><b>{{ queue.failed_24h }}</b
          ><span>failed / 24 h</span></router-link
        >
      </div>
      <div
        class="bars"
        role="img"
        aria-label="Tasks finished per hour over the last 24 hours"
        data-testid="queue-bars"
      >
        <span v-for="(b, i) in queue.hourly" :key="i" class="col">
          <i
            class="ok"
            :style="{ height: Math.min(40, 2 + b.ok * 2) + 'px' }"
          />
          <i
            v-if="b.failed"
            class="fail"
            :style="{ height: Math.min(12, 4 + b.failed * 3) + 'px' }"
          />
        </span>
      </div>
      <div class="muted" data-testid="queue-oldest">
        <template v-if="queue.oldest_queued_age_s === null"
          >Nothing is waiting.</template
        >
        <template v-else
          >Oldest queued: {{ queue.oldest_queued_age_s }} s</template
        >
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.h {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.more {
  font-size: 12px;
  color: var(--admin-text-primary);
  text-decoration: none;
}
.nums {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.nums a {
  text-decoration: none;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--bg-hover);
}
.nums b {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.nums span {
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
}
.nums a.bad b {
  color: var(--admin-text-danger);
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 56px;
}
.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.col i {
  display: block;
}
.ok {
  background: var(--color-success);
  opacity: 0.75;
  border-radius: 2px 2px 0 0;
}
.fail {
  background: var(--color-error);
}
.muted {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  margin-top: 6px;
}
</style>
