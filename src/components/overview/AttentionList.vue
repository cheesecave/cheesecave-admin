<script setup>
defineProps({ items: { type: Array, default: () => [] } });
const icon = { danger: "i-carbon-warning-filled", warning: "i-carbon-warning-alt-filled", info: "i-carbon-information-filled" };
const color = { danger: "var(--color-error)", warning: "var(--color-warning)", info: "var(--color-info)" };
</script>

<template>
  <section class="att" data-testid="attention">
    <div v-if="!items.length" class="clear"><span class="i-carbon-checkmark-filled" /> All clear. Nothing needs your attention right now.</div>
    <template v-else>
      <header><b>Needs attention</b><span class="count">{{ items.length }}</span></header>
      <router-link v-for="a in items" :key="a.id" :to="{ path: a.link.path, query: a.link.query }" class="row">
        <span :class="icon[a.severity]" :style="{ color: color[a.severity] }" class="ic" />
        <span class="title">{{ a.title }}</span>
        <span v-if="a.hint" class="hint">{{ a.hint }}</span>
        <span class="go">{{ a.link.label }} <span class="i-carbon-arrow-right" /></span>
      </router-link>
    </template>
  </section>
</template>

<style scoped>
.att { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
header { padding: 10px 14px; border-bottom: 1px solid var(--border-light); display: flex; gap: 8px; align-items: center; }
.count { background: var(--color-error); color: #fff; border-radius: 999px; font-size: 12px; padding: 0 8px; }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; color: var(--text-primary); text-decoration: none; border-bottom: 1px solid var(--border-light); }
.row:last-child { border-bottom: 0; }
.row:hover { background: var(--bg-hover); }
.ic { font-size: 18px; flex: none; }
.title { font-weight: 600; }
.hint { color: var(--text-secondary, #6b7280); font-size: 13px; flex: 1; }
.go { margin-left: auto; color: var(--color-info); font-size: 13px; white-space: nowrap; display: inline-flex; gap: 4px; align-items: center; }
.clear { padding: 12px 14px; display: flex; gap: 8px; align-items: center; color: var(--text-primary); }
.clear span:first-child { color: var(--color-success); font-size: 18px; }
@media (max-width: 600px) { .row { flex-wrap: wrap; } .hint { flex-basis: 100%; order: 3; padding-left: 28px; } .go { margin-left: auto; } }
</style>
