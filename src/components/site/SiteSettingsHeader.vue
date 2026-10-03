<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
});
</script>

<template>
  <header class="site-settings-header">
    <div class="site-settings-heading">
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="site-settings-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.site-settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.site-settings-heading {
  flex: 1;
  min-width: 0;
}
.site-settings-actions {
  flex-shrink: 0;
}
h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin: 8px 0 0;
}
@media (max-width: 600px) {
  .site-settings-header {
    flex-direction: column;
  }
  .site-settings-actions {
    width: 100%;
  }
}
</style>
