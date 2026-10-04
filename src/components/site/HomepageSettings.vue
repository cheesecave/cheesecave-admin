<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import SiteActions from "./SiteActions.vue";
import { useSiteSettingsRequest } from "./useSiteSettingsRequest.js";
import { getSiteHomepage, updateSiteHomepage } from "@/utils/api";
import HomepageHero from "../../shared/components/HomepageHero.vue";
import {
  DEFAULT_HOMEPAGE,
  isSafeHomepageUrl,
  normalizeHomepage,
} from "../../shared/site-homepage.js";

const draft = reactive({ ...DEFAULT_HOMEPAGE });
const saved = ref(null);
const {
  loaded,
  busy,
  errorMessage,
  disabled,
  checkAuth,
  showError,
  runRequest,
} = useSiteSettingsRequest();
const hasChanges = computed(
  () => JSON.stringify(draft) !== JSON.stringify(saved.value),
);
const preview = computed(() => ({ ...draft, title: draft.title.trim() }));
const textFields = [
  {
    key: "eyebrow",
    label: "Eyebrow",
    limit: 100,
    placeholder: "A short introduction above the title",
  },
  { key: "title", label: "Title", limit: 200, required: true, multiline: true },
];
const actions = [
  { key: "primary", label: "Primary button" },
  { key: "secondary", label: "Secondary button" },
];

function applySaved(homepage) {
  const config = normalizeHomepage(homepage);
  if (!config)
    throw new Error("The server returned invalid homepage settings.");
  Object.assign(draft, config);
  saved.value = { ...config };
}

async function loadHomepage() {
  await runRequest(
    async (token) => {
      loaded.value = false;
      applySaved(await getSiteHomepage(token));
      loaded.value = true;
    },
    { fallback: "Failed to load homepage settings" },
  );
}

function validateDraft() {
  const limits = {
    eyebrow: 100,
    title: 200,
    description: 2000,
    primary_label: 80,
    secondary_label: 80,
    primary_url: 2048,
    secondary_url: 2048,
  };
  if (!draft.title.trim()) return "Enter a homepage title.";
  for (const [key, limit] of Object.entries(limits)) {
    if (Array.from(draft[key]).length > limit) {
      return `${key.replaceAll("_", " ")} must be at most ${limit} characters.`;
    }
  }
  if (
    !isSafeHomepageUrl(draft.primary_url) ||
    !isSafeHomepageUrl(draft.secondary_url)
  ) {
    return "Button links must start with a single / or use http:// or https://, without spaces or backslashes.";
  }
  return "";
}

async function saveHomepage() {
  if (disabled.value || !checkAuth()) return;
  const error = validateDraft();
  if (error) {
    showError(new Error(error));
    return;
  }
  await runRequest(
    async (token) => {
      applySaved(
        await updateSiteHomepage(token, {
          ...draft,
          title: draft.title.trim(),
        }),
      );
    },
    {
      fallback: "Failed to save homepage settings",
      success: "Homepage settings saved",
    },
  );
}

function restoreDefaults() {
  if (disabled.value || !checkAuth()) return;
  Object.assign(draft, DEFAULT_HOMEPAGE);
  errorMessage.value = "";
}

onMounted(loadHomepage);
</script>

<template>
  <section class="site-settings homepage-settings">
    <SiteSettingsHeader
      title="Homepage"
      subtitle="Create a welcoming homepage for visitors. Signed-in users see their personal workspace."
    >
      <template #actions>
        <SiteActions
          data-testid="homepage-actions"
          :busy="busy"
          :disabled="disabled"
          :has-changes="hasChanges"
          show-restore
          show-save
          form-id="homepage-settings-form"
          @reload="loadHomepage"
          @restore="restoreDefaults"
        />
      </template>
    </SiteSettingsHeader>

    <p v-if="errorMessage" class="site-settings-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="!loaded" class="site-settings-help" role="status">
      {{
        busy
          ? "Loading homepage settings…"
          : "Load the current settings before editing."
      }}
    </p>

    <form id="homepage-settings-form" @submit.prevent="saveHomepage">
      <fieldset :disabled="disabled" class="site-settings-fields">
        <div class="settings-grid" data-testid="homepage-settings">
          <el-card class="settings-card">
            <template #header><h2>Welcome card</h2></template>
            <label class="toggle-row" for="homepage-enabled"
              ><span
                >Show welcome card<small
                  >The large introduction card on the visitor homepage</small
                ></span
              ><input
                id="homepage-enabled"
                v-model="draft.enabled"
                type="checkbox"
                role="switch"
            /></label>
            <div
              v-for="field in textFields"
              :key="field.key"
              class="site-settings-field"
            >
              <label :for="`homepage-${field.key}`">{{ field.label }}</label>
              <textarea
                v-if="field.multiline"
                :id="`homepage-${field.key}`"
                v-model="draft[field.key]"
                rows="3"
                :maxlength="field.limit"
                :required="field.required"
              />
              <input
                v-else
                :id="`homepage-${field.key}`"
                v-model="draft[field.key]"
                type="text"
                :maxlength="field.limit"
                :required="field.required"
                :placeholder="field.placeholder"
              />
              <p v-if="field.multiline" class="site-settings-help">
                Press Enter, or type \n / \r\n to start a new line.
              </p>
            </div>
            <div class="site-settings-field">
              <label for="homepage-description">Description</label
              ><textarea
                id="homepage-description"
                v-model="draft.description"
                rows="4"
                maxlength="2000"
              />
              <p class="site-settings-help">
                Plain text, up to 2000 characters.
              </p>
            </div>
            <div class="site-settings-field">
              <label for="homepage-illustration">Illustration</label
              ><select id="homepage-illustration" v-model="draft.illustration">
                <option value="mouse-cheese">Mouse and cheese</option>
                <option value="none">None</option>
              </select>
            </div>
            <label class="toggle-row" for="homepage-animation"
              ><span
                >Animate illustration<small
                  >Reduced-motion preferences are always respected</small
                ></span
              ><input
                id="homepage-animation"
                v-model="draft.animation_enabled"
                type="checkbox"
                role="switch"
            /></label>
          </el-card>

          <el-card class="settings-card">
            <template #header><h2>Buttons and discovery</h2></template>
            <div
              v-for="action in actions"
              :key="action.key"
              class="action-fields"
            >
              <h3>{{ action.label }}</h3>
              <div class="site-settings-field">
                <label :for="`homepage-${action.key}-label`">Label</label
                ><input
                  :id="`homepage-${action.key}-label`"
                  v-model="draft[`${action.key}_label`]"
                  type="text"
                  maxlength="80"
                />
              </div>
              <div class="site-settings-field">
                <label :for="`homepage-${action.key}-url`">Link</label
                ><input
                  :id="`homepage-${action.key}-url`"
                  v-model="draft[`${action.key}_url`]"
                  type="text"
                  maxlength="2048"
                  placeholder="/get-started or https://example.com"
                />
              </div>
            </div>
            <p class="site-settings-help">
              Use a site path beginning with / or an HTTP(S) link. Leave a
              button label or link blank to hide that button.
            </p>
            <label class="toggle-row" for="homepage-discovery"
              ><span
                >Show repository discovery<small
                  >Popular models and datasets below the welcome card</small
                ></span
              ><input
                id="homepage-discovery"
                v-model="draft.show_repositories"
                type="checkbox"
                role="switch"
            /></label>
          </el-card>
        </div>
      </fieldset>
    </form>

    <section
      v-if="loaded"
      class="homepage-preview"
      data-testid="homepage-preview"
      aria-label="Visitor homepage preview"
    >
      <div class="preview-heading">
        <h2>Live preview</h2>
        <span>Unsaved changes appear here</span>
      </div>
      <HomepageHero v-if="draft.enabled" :config="preview" preview />
      <div v-else class="preview-empty">
        The welcome card is hidden. Visitors can still browse repositories when
        discovery is enabled.
      </div>
      <p class="site-settings-help">
        {{
          draft.show_repositories
            ? "Repository discovery will appear below this card."
            : "Repository discovery is hidden on the visitor homepage."
        }}
      </p>
    </section>
  </section>
</template>

<style scoped src="./site-settings.css"></style>
<style scoped>
.homepage-preview {
  margin-top: 32px;
}
.preview-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.preview-heading span {
  color: var(--text-secondary);
  font-size: 13px;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}
.preview-empty {
  padding: 40px 24px;
  border: 1px dashed var(--border-default);
  border-radius: 16px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  text-align: center;
}
.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.settings-card {
  background: var(--bg-card);
  border-color: var(--border-default);
  color: var(--text-primary);
}
.settings-card :deep(.el-card__header) {
  background: var(--bg-hover);
  border-bottom-color: var(--border-default);
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0 24px;
  font-weight: 600;
  cursor: pointer;
}
.toggle-row small {
  display: block;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.5;
  margin-top: 4px;
}
.toggle-row input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--color-info, #409eff);
}
.action-fields + .action-fields {
  border-top: 1px solid var(--border-default);
  padding-top: 20px;
  margin-top: 20px;
}
@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
