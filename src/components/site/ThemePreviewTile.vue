<script setup>
import { computed } from "vue";
import { createThemePalette } from "../../shared/site-theme.js";

// One mode of the Theme preview: the page and card colors with the text, link, button and
// border colors the visitor site derives from them.
const props = defineProps({
  mode: { type: String, required: true },
  primary: { type: String, required: true },
  background: { type: String, required: true },
  card: { type: String, required: true },
});

const style = computed(() => {
  const { primary, background, card } = props;
  const palette = createThemePalette({ primary, background, card });
  return {
    "--preview-primary": primary,
    "--preview-background": background,
    "--preview-card": card,
    "--preview-text": palette.text,
    "--preview-card-text": palette.cardText,
    "--preview-primary-text": palette.buttonText,
    "--preview-link": palette.link,
    "--preview-border": palette.border,
  };
});
</script>

<template>
  <div class="theme-preview" :style="style">
    <span class="preview-mode">{{
      mode === "light" ? "Light mode" : "Dark mode"
    }}</span>
    <div class="preview-card">
      <p class="preview-eyebrow">YOUR NEXT PROJECT</p>
      <h4>A home for your ideas</h4>
      <p>Share models and datasets with your community.</p>
      <span class="preview-link">Browse repositories →</span
      ><button type="button">Create repository</button>
    </div>
  </div>
</template>

<style scoped>
.theme-preview {
  padding: 24px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--preview-background);
  color: var(--preview-text);
}
.preview-mode {
  display: block;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 600;
}
.preview-card {
  padding: 24px;
  background: var(--preview-card);
  color: var(--preview-card-text);
  border: 1px solid var(--preview-border);
  border-radius: 12px;
}
.preview-eyebrow {
  color: var(--preview-link);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.preview-card h4 {
  font-size: 23px;
  margin: 12px 0;
}
.preview-card > p:not(.preview-eyebrow) {
  opacity: 0.75;
  font-size: 14px;
  line-height: 1.7;
}
.preview-link {
  display: block;
  color: var(--preview-link);
  font-size: 13px;
  margin: 18px 0;
}
.preview-card button {
  color: var(--preview-primary-text);
  background: var(--preview-primary);
  padding: 10px 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
}
</style>
