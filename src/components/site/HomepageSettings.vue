<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import { useAdminStore } from "@/stores/admin";
import { getSiteHomepage, updateSiteHomepage } from "@/utils/api";
import HomepageHero from "../../shared/components/HomepageHero.vue";
import {
  DEFAULT_HOMEPAGE,
  isSafeHomepageUrl,
  normalizeHomepage,
} from "../../shared/site-homepage.js";

const router = useRouter();
const adminStore = useAdminStore();
const draft = reactive({ ...DEFAULT_HOMEPAGE });
const saved = ref(null);
const loaded = ref(false);
const busy = ref(false);
const errorMessage = ref("");
const disabled = computed(() => busy.value || !loaded.value);
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

function checkAuth() {
  if (adminStore.token) return true;
  loaded.value = false;
  router.push("/login");
  return false;
}

function showError(error, fallback) {
  if ([401, 403].includes(error.response?.status)) {
    loaded.value = false;
    adminStore.logout();
    router.push("/login");
    errorMessage.value = "Invalid admin token. Please login again.";
  } else {
    const detail = error.response?.data?.detail;
    errorMessage.value = Array.isArray(detail)
      ? detail.map((item) => item.msg || String(item)).join("; ")
      : String(detail || error.message || fallback);
  }
  ElMessage.error(errorMessage.value);
}

function applySaved(homepage) {
  const config = normalizeHomepage(homepage);
  if (!config)
    throw new Error("The server returned invalid homepage settings.");
  Object.assign(draft, config);
  saved.value = { ...config };
}

async function loadHomepage() {
  if (busy.value || !checkAuth()) return;
  busy.value = true;
  loaded.value = false;
  errorMessage.value = "";
  try {
    applySaved(await getSiteHomepage(adminStore.token));
    loaded.value = true;
  } catch (error) {
    showError(error, "Failed to load homepage settings");
  } finally {
    busy.value = false;
  }
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
  busy.value = true;
  errorMessage.value = "";
  try {
    applySaved(
      await updateSiteHomepage(adminStore.token, {
        ...draft,
        title: draft.title.trim(),
      }),
    );
    ElMessage.success("Homepage settings saved");
  } catch (error) {
    showError(error, "Failed to save homepage settings");
  } finally {
    busy.value = false;
  }
}

function restoreDefaults() {
  if (disabled.value || !checkAuth()) return;
  Object.assign(draft, DEFAULT_HOMEPAGE);
  errorMessage.value = "";
}

onMounted(loadHomepage);
</script>

<template>
  <section class="homepage-settings">
    <SiteSettingsHeader
      title="Homepage"
      subtitle="Create a welcoming homepage for visitors. Signed-in users see their personal workspace."
    >
      <template #actions>
        <div class="save-actions" data-testid="homepage-actions">
          <el-button :disabled="busy" @click="loadHomepage">Reload</el-button>
          <el-button type="danger" :disabled="disabled" @click="restoreDefaults"
            >Restore</el-button
          ><el-button
            type="primary"
            native-type="submit"
            form="homepage-settings-form"
            :disabled="disabled || !hasChanges"
            :loading="busy"
            >Save</el-button
          >
        </div>
      </template>
    </SiteSettingsHeader>

    <p v-if="errorMessage" class="homepage-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="!loaded" class="homepage-help" role="status">
      {{
        busy
          ? "Loading homepage settings…"
          : "Load the current settings before editing."
      }}
    </p>

    <form id="homepage-settings-form" @submit.prevent="saveHomepage">
      <fieldset :disabled="disabled" class="homepage-fields">
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
            <div v-for="field in textFields" :key="field.key" class="field">
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
              <p v-if="field.multiline" class="homepage-help">
                Press Enter, or type \n / \r\n to start a new line.
              </p>
            </div>
            <div class="field">
              <label for="homepage-description">Description</label
              ><textarea
                id="homepage-description"
                v-model="draft.description"
                rows="4"
                maxlength="2000"
              />
              <p class="homepage-help">Plain text, up to 2000 characters.</p>
            </div>
            <div class="field">
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
              <div class="field">
                <label :for="`homepage-${action.key}-label`">Label</label
                ><input
                  :id="`homepage-${action.key}-label`"
                  v-model="draft[`${action.key}_label`]"
                  type="text"
                  maxlength="80"
                />
              </div>
              <div class="field">
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
            <p class="homepage-help">
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
      <p class="homepage-help">
        {{
          draft.show_repositories
            ? "Repository discovery will appear below this card."
            : "Repository discovery is hidden on the visitor homepage."
        }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.homepage-settings {
  color: var(--text-primary);
}
.homepage-help {
  color: var(--text-secondary);
  margin: 8px 0 16px;
  line-height: 1.5;
  font-size: 14px;
}
.homepage-error {
  padding: 12px;
  margin-bottom: 16px;
  color: var(--color-danger, #dc2626);
  border: 1px solid currentColor;
  border-radius: 8px;
}
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
.homepage-fields {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
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
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.field label {
  font-weight: 600;
  font-size: 14px;
}
.field input,
.field textarea,
.field select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--bg-base);
  color: var(--text-primary);
  font: inherit;
}
.field textarea {
  resize: vertical;
}
.field .homepage-help {
  margin: 0;
}
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-info);
  outline-offset: 2px;
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
.save-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.save-actions :deep(.el-button) {
  margin-left: 0;
}
.homepage-fields:disabled {
  opacity: 0.65;
}
@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .save-actions {
    width: 100%;
  }
  .save-actions :deep(.el-button) {
    flex: 1;
  }
}
</style>
