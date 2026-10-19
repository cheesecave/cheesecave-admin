<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: "" },
  delta: { type: Number, default: null },
  deltaLabel: { type: String, default: "7d" },
  series: { type: Array, default: () => [] },
  to: { type: String, required: true },
  color: { type: String, default: "var(--color-info)" },
});

// A short trend line: the counts created per bucket, scaled to the tile.
const spark = computed(() => {
  const s = props.series;
  if (s.length < 2) return "";
  const max = Math.max(...s, 1);
  const min = Math.min(...s, 0);
  return s
    .map(
      (v, i) =>
        `${(i / (s.length - 1)) * 100},${28 - ((v - min) / (max - min)) * 24 - 2}`,
    )
    .join(" ");
});
</script>

<template>
  <router-link :to="to" class="kpi">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div class="foot">
      <span
        v-if="delta !== null"
        class="delta"
        :class="{ up: delta > 0 }"
        data-testid="kpi-delta"
      >
        {{ delta > 0 ? "+" : "" }}{{ delta.toLocaleString("en-US") }}
        <span class="muted">/ {{ deltaLabel }}</span>
      </span>
      <span v-if="sub" class="muted" data-testid="kpi-sub"
        >{{ delta !== null ? " · " : "" }}{{ sub }}</span
      >
    </div>
    <svg
      v-if="spark"
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      class="spark"
      aria-hidden="true"
    >
      <polyline
        :points="spark"
        fill="none"
        :stroke="color"
        stroke-width="1.6"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  </router-link>
</template>

<style scoped>
.kpi {
  display: block;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 12px 14px 8px;
  color: var(--text-primary);
  text-decoration: none;
  min-width: 0;
}
.kpi:hover {
  border-color: var(--color-info);
}
.label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
}
.value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.foot {
  font-size: 12px;
  min-height: 18px;
}
.delta.up {
  color: var(--admin-text-success);
}
.muted {
  color: var(--text-secondary, #6b7280);
}
.spark {
  width: 100%;
  height: 28px;
  display: block;
  margin-top: 4px;
}
</style>
