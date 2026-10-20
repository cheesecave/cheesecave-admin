<script setup>
import { computed, ref } from "vue";
import ThemePreviewTile from "./ThemePreviewTile.vue";
import ThemeQuickSetup from "./ThemeQuickSetup.vue";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import SiteActions from "./SiteActions.vue";
import { useAppearanceSettings } from "./useAppearanceSettings.js";
import { DEFAULT_THEME, normalizeTheme } from "../../shared/site-appearance.js";
import { MARKDOWN_STYLES } from "../../shared/markdown-styles.js";

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
const styleIsListed = computed(() =>
  MARKDOWN_STYLES.some((style) => style.id === draft.value.markdown_style),
);
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
const previewColors = computed(() =>
  Object.fromEntries(
    modes.map((mode) => [
      mode,
      Object.fromEntries(
        colors.map(({ key }) => [
          key,
          safeColor(
            draft.value[`${key}_${mode}`],
            DEFAULT_THEME[`${key}_${mode}`],
          ),
        ]),
      ),
    ]),
  ),
);
const quickSetupOpen = ref(false);
const applyQuickSetup = (theme) => Object.assign(draft.value, theme);
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
        <div class="site-settings-field mode-field">
          <label for="theme-markdown-style">README style</label
          ><select id="theme-markdown-style" v-model="draft.markdown_style">
            <option v-if="!styleIsListed" :value="draft.markdown_style">
              {{ draft.markdown_style }} (not in this admin build)
            </option>
            <option
              v-for="style in MARKDOWN_STYLES"
              :key="style.id"
              :value="style.id"
            >
              {{ style.name }}
            </option>
          </select>
          <p class="site-settings-help">
            How READMEs and other Markdown look until a reader picks their own
            in Settings.
          </p>
        </div>
        <div class="quick-setup-row">
          <el-button @click="quickSetupOpen = true">Quick setup…</el-button>
          <span class="site-settings-help"
            >Pick one main color and fill all six colors from it.</span
          >
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
    <ThemeQuickSetup
      v-model="quickSetupOpen"
      :theme="draft"
      @apply="applyQuickSetup"
    />
    <section
      v-if="loaded"
      class="appearance-preview"
      aria-label="Theme preview"
    >
      <h3>Preview</h3>
      <div class="theme-columns">
        <ThemePreviewTile
          v-for="mode in modes"
          :key="mode"
          :mode="mode"
          :primary="previewColors[mode].primary"
          :background="previewColors[mode].background"
          :card="previewColors[mode].card"
          :data-testid="`theme-preview-${mode}`"
        />
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
.quick-setup-row {
  margin-bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
@media (max-width: 760px) {
  .theme-columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
