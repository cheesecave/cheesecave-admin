<script setup>
import { computed } from "vue";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import SiteActions from "./SiteActions.vue";
import { useAppearanceSettings } from "./useAppearanceSettings.js";
import { DEFAULT_THEME, normalizeTheme } from "../../shared/site-appearance.js";
import { createThemePalette } from "../../shared/site-theme.js";

const {
  draft,
  loaded,
  busy,
  disabled,
  hasChanges,
  errorMessage,
  load,
  save,
  restore,
} = useAppearanceSettings("theme", DEFAULT_THEME, normalizeTheme, {
  validationMessage:
    "Choose a default mode and use six-digit HEX colors, for example #94621f.",
});
const modes = ["light", "dark"];
const colors = [
  {
    key: "primary",
    label: "Primary color",
    description: "Links, primary buttons and selection accents",
  },
  {
    key: "background",
    label: "Page background",
    description: "The background behind page content",
  },
  {
    key: "card",
    label: "Card background",
    description: "Cards and other elevated content surfaces",
  },
];
function safeColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
const previewStyles = computed(() =>
  Object.fromEntries(
    modes.map((mode) => {
      const primary = safeColor(
        draft.value[`primary_${mode}`],
        DEFAULT_THEME[`primary_${mode}`],
      );
      const background = safeColor(
        draft.value[`background_${mode}`],
        DEFAULT_THEME[`background_${mode}`],
      );
      const card = safeColor(
        draft.value[`card_${mode}`],
        DEFAULT_THEME[`card_${mode}`],
      );
      const palette = createThemePalette({ primary, background, card });
      return [
        mode,
        {
          "--preview-primary": primary,
          "--preview-background": background,
          "--preview-card": card,
          "--preview-text": palette.text,
          "--preview-card-text": palette.cardText,
          "--preview-primary-text": palette.buttonText,
          "--preview-link": palette.link,
          "--preview-border": palette.border,
        },
      ];
    }),
  ),
);
</script>

<template>
  <section class="site-settings">
    <SiteSettingsHeader
      title="Theme"
      subtitle="Set the visitor site's default mode and colors for light and dark appearances."
    >
      <template #actions
        ><SiteActions
          :busy="busy"
          :disabled="disabled"
          :has-changes="hasChanges"
          show-restore
          show-save
          form-id="theme-settings-form"
          @reload="load"
          @restore="restore"
      /></template>
    </SiteSettingsHeader>
    <p v-if="errorMessage" class="site-settings-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="!loaded" class="site-settings-help" role="status">
      {{
        busy
          ? "Loading theme settings…"
          : "Load the current settings before editing."
      }}
    </p>
    <form id="theme-settings-form" @submit.prevent="save">
      <fieldset :disabled="disabled" class="site-settings-fields">
        <div class="site-settings-field mode-field">
          <label for="theme-default-mode">Default appearance</label
          ><select id="theme-default-mode" v-model="draft.default_mode">
            <option value="system">Follow the visitor's system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p class="site-settings-help">
            Visitors can still choose their preferred mode.
          </p>
        </div>
        <div class="theme-columns">
          <el-card
            v-for="mode in modes"
            :key="mode"
            class="appearance-card"
            shadow="never"
            ><template #header
              ><h3>
                {{ mode === "light" ? "Light colors" : "Dark colors" }}
              </h3></template
            >
            <div
              v-for="color in colors"
              :key="color.key"
              class="site-settings-field"
            >
              <label :for="`theme-${color.key}-${mode}`">{{
                color.label
              }}</label>
              <div class="color-control">
                <input
                  type="color"
                  :value="
                    safeColor(
                      draft[`${color.key}_${mode}`],
                      DEFAULT_THEME[`${color.key}_${mode}`],
                    )
                  "
                  :aria-label="`${color.label} (${mode}) color picker`"
                  @input="draft[`${color.key}_${mode}`] = $event.target.value"
                /><input
                  :id="`theme-${color.key}-${mode}`"
                  v-model="draft[`${color.key}_${mode}`]"
                  type="text"
                  maxlength="7"
                  spellcheck="false"
                  :placeholder="DEFAULT_THEME[`${color.key}_${mode}`]"
                />
              </div>
              <p class="site-settings-help">{{ color.description }}</p>
            </div></el-card
          >
        </div>
      </fieldset>
    </form>
    <section
      v-if="loaded"
      class="appearance-preview"
      aria-label="Theme preview"
    >
      <h3>Preview</h3>
      <div class="theme-columns">
        <div
          v-for="mode in modes"
          :key="mode"
          class="theme-preview"
          :style="previewStyles[mode]"
          :data-testid="`theme-preview-${mode}`"
        >
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
      </div>
    </section>
  </section>
</template>

<style scoped src="./site-settings.css"></style>
<style scoped>
.mode-field {
  max-width: 360px;
}
.theme-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.color-control {
  display: flex;
  align-items: center;
  gap: 12px;
}
.color-control input[type="color"] {
  flex-shrink: 0;
  width: 44px;
  height: 42px;
  padding: 3px;
  cursor: pointer;
}
.color-control input[type="text"] {
  min-width: 0;
  font-family: monospace;
}
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
@media (max-width: 760px) {
  .theme-columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
