<script setup>
defineProps({ section: { type: Object, default: null } });

const icon = {
  danger: "i-carbon-warning-filled",
  warning: "i-carbon-warning-alt-filled",
  info: "i-carbon-information-filled",
};
const color = {
  danger: "var(--color-error)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
};
</script>

<template>
  <section
    v-if="section"
    class="att"
    aria-label="Needs attention"
    data-testid="attention"
  >
    <div
      v-if="section.error"
      class="clear muted"
      data-testid="attention-unavailable"
    >
      The attention list is unavailable right now.
    </div>
    <div
      v-else-if="!section.items.length"
      class="clear"
      data-testid="attention-clear"
    >
      <span class="i-carbon-checkmark-filled ok" aria-hidden="true" />
      All clear. Nothing needs your attention right now.
    </div>
    <template v-else>
      <header>
        <b>Needs attention</b
        ><span class="count">{{ section.items.length }}</span>
      </header>
      <router-link
        v-for="item in section.items"
        :key="item.id"
        :to="{ path: item.link.path, query: item.link.query }"
        class="row"
        :data-testid="`attention-${item.id}`"
      >
        <span
          :class="icon[item.severity]"
          :style="{ color: color[item.severity] }"
          class="ic"
          aria-hidden="true"
        />
        <span class="sev">{{ item.severity }}:</span>
        <span class="title">{{ item.title }}</span>
        <span v-if="item.hint" class="hint">{{ item.hint }}</span>
        <span class="go"
          >{{ item.link.label }}
          <span class="i-carbon-arrow-right" aria-hidden="true"
        /></span>
      </router-link>
    </template>
  </section>
</template>

<style scoped>
.att {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
}
header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  gap: 8px;
  align-items: center;
}
.count {
  background: var(--color-error);
  color: var(--admin-on-fill, #111);
  border-radius: 999px;
  font-size: 12px;
  padding: 0 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--border-light);
}
.row:last-child {
  border-bottom: 0;
}
.row:hover {
  background: var(--bg-hover);
}
.ic {
  font-size: 18px;
  flex: none;
}
.sev {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.title {
  font-weight: 600;
}
.hint {
  color: var(--text-secondary, #6b7280);
  font-size: 13px;
  flex: 1;
}
.go {
  margin-left: auto;
  color: var(--admin-text-primary);
  font-size: 13px;
  white-space: nowrap;
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.clear {
  padding: 12px 14px;
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--text-primary);
}
.ok {
  color: var(--admin-text-success);
  font-size: 18px;
}
.muted {
  color: var(--text-secondary, #6b7280);
}
@media (max-width: 600px) {
  .row {
    flex-wrap: wrap;
  }
  .hint {
    flex-basis: 100%;
    order: 3;
    padding-left: 28px;
  }
}
</style>
