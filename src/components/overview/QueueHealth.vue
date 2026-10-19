<script setup>
defineProps({ queue: Object });
</script>

<template>
  <el-card shadow="never" class="card" data-testid="queue-card">
    <template #header><div class="h"><b>Task queue</b><router-link to="/tasks" class="more">Open Background Tasks →</router-link></div></template>
    <div v-if="queue && !queue.error">
      <div class="nums">
        <router-link :to="{ path: '/tasks', query: { status: 'queued' } }"><b>{{ queue.queued }}</b><span>queued</span></router-link>
        <router-link :to="{ path: '/tasks', query: { status: 'running' } }"><b>{{ queue.running }}</b><span>running</span></router-link>
        <router-link :to="{ path: '/tasks', query: { status: 'succeeded', window: '24h' } }"><b>{{ queue.succeeded_24h }}</b><span>ok / 24h</span></router-link>
        <router-link :to="{ path: '/tasks', query: { status: 'failed', window: '24h' } }" :class="{ bad: queue.failed_24h }"><b>{{ queue.failed_24h }}</b><span>failed / 24h</span></router-link>
      </div>
      <div class="bars" aria-label="Last 24 hours, one bar per hour">
        <i v-for="(b, i) in queue.hourly" :key="i" :style="{ height: Math.max(2, b.ok * 2) + 'px' }" class="ok" :title="`${b.ok} ok, ${b.failed} failed`" /><i v-for="(b, i) in []" :key="'x'+i" />
      </div>
      <div class="bars bars-failed"><i v-for="(b, i) in queue.hourly" :key="i" :style="{ height: b.failed ? Math.max(4, b.failed * 6) + 'px' : '0px' }" class="fail" /></div>
      <div class="muted">Oldest queued: {{ queue.oldest_queued_age_s }} s</div>
    </div>
    <div v-else class="muted">Task queue unavailable.</div>
  </el-card>
</template>

<style scoped>
.h { display: flex; justify-content: space-between; align-items: baseline; }
.more { font-size: 12px; color: var(--color-info); text-decoration: none; }
.nums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.nums a { text-decoration: none; color: var(--text-primary); display: flex; flex-direction: column; padding: 6px 8px; border-radius: 8px; background: var(--bg-hover); }
.nums b { font-size: 22px; font-variant-numeric: tabular-nums; }
.nums span { font-size: 11px; color: var(--text-secondary, #6b7280); }
.nums a.bad b { color: var(--color-error); }
.bars { display: flex; align-items: flex-end; gap: 2px; height: 52px; }
.bars i { flex: 1; border-radius: 2px 2px 0 0; display: block; }
.ok { background: var(--color-success); opacity: .75; }
.bars-failed { height: 24px; margin-top: 2px; }
.fail { background: var(--color-error); }
.muted { font-size: 12px; color: var(--text-secondary, #6b7280); margin-top: 6px; }
</style>
