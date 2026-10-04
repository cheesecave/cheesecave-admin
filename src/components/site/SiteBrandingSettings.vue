<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import SiteActions from "./SiteActions.vue";
import { useSiteSettingsRequest } from "./useSiteSettingsRequest.js";
import { useSiteBrandingStore } from "@/stores/siteBranding";
import { getGifLoop } from "../../shared/site-branding.js";
import {
  getSiteBranding,
  updateSiteBranding,
  uploadSiteBrandingAsset,
  updateSiteBrandingAssetAnimation,
  resetSiteBrandingAsset,
} from "@/utils/api";

const siteBrandingStore = useSiteBrandingStore();
const draft = reactive({ site_name: "" });
const playback = ref(true);
const fileInputs = {};
const savedPlayback = computed(() =>
  getGifLoop(siteBrandingStore.branding.header_logo),
);
const {
  loaded,
  busy,
  errorMessage,
  disabled,
  checkAuth,
  showError,
  runRequest,
} = useSiteSettingsRequest();
const assets = [
  {
    key: "header_logo",
    label: "Header logo",
    description:
      "Shown in the site header. Upload separately from the favicon.",
    fallback: "/admin/images/logo-square.svg",
  },
  {
    key: "favicon",
    label: "Favicon",
    description: "Shown in browser tabs and bookmarks.",
    fallback: "/admin/favicon.svg",
  },
];
const accept =
  ".svg,.png,.jpg,.jpeg,.webp,.gif,.ico,image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon";

function copyText(branding) {
  draft.site_name = branding.site_name;
}

function copyPlayback(asset) {
  if (asset === "header_logo") playback.value = savedPlayback.value ?? true;
}

async function loadBranding() {
  await runRequest(
    async (token) => {
      loaded.value = false;
      siteBrandingStore.apply(await getSiteBranding(token));
      copyText(siteBrandingStore.branding);
      copyPlayback("header_logo");
      loaded.value = true;
    },
    { fallback: "Failed to load site branding" },
  );
}

async function saveText() {
  if (disabled.value || !checkAuth()) return;
  const siteName = draft.site_name.trim();
  if (!siteName || Array.from(siteName).length > 100) {
    showError(new Error("Enter a site name of 1–100 characters."));
    return;
  }
  await runRequest(
    async (token) => {
      siteBrandingStore.apply(
        await updateSiteBranding(token, {
          site_name: siteName,
        }),
      );
      copyText(siteBrandingStore.branding);
    },
    { fallback: "Failed to save site branding", success: "Site name saved" },
  );
}

function chooseAsset(asset) {
  if (disabled.value || !checkAuth()) return;
  fileInputs[asset]?.click();
}

async function uploadAsset(asset, event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = "";
  if (!file || disabled.value || !checkAuth()) return;
  if (!/\.(svg|png|jpe?g|webp|gif|ico)$/i.test(file.name)) {
    showError(new Error("Choose an SVG, PNG, JPEG, WebP, GIF or ICO image."));
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showError(new Error("Images must be 2 MiB or smaller."));
    return;
  }
  await mutateAsset(
    (token) =>
      asset === "header_logo"
        ? uploadSiteBrandingAsset(token, asset, file, playback.value)
        : uploadSiteBrandingAsset(token, asset, file),
    "Image uploaded",
    asset,
  );
}

async function resetAsset(asset) {
  if (disabled.value || !checkAuth()) return;
  await mutateAsset(
    (token) => resetSiteBrandingAsset(token, asset),
    "Default image restored",
    asset,
  );
}

async function savePlayback() {
  if (disabled.value || savedPlayback.value === null || !checkAuth()) return;
  await mutateAsset(
    (token) =>
      updateSiteBrandingAssetAnimation(token, "header_logo", playback.value),
    "GIF playback saved",
    "header_logo",
  );
}

async function mutateAsset(action, message, asset) {
  await runRequest(
    async (token) => {
      siteBrandingStore.apply(await action(token));
      copyPlayback(asset);
    },
    { fallback: "Failed to update image", success: message },
  );
}

onMounted(loadBranding);
</script>

<template>
  <section
    class="site-settings branding-settings"
    aria-label="Site branding settings"
  >
    <SiteSettingsHeader
      title="Branding"
      subtitle="Customize the site name, header logo and favicon. Edit the footer description in the Footer tab."
    >
      <template #actions>
        <SiteActions :busy="busy" @reload="loadBranding" />
      </template>
    </SiteSettingsHeader>

    <p v-if="errorMessage" class="site-settings-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="!loaded" class="site-settings-help" role="status">
      {{
        busy
          ? "Loading site branding…"
          : "Load the current settings before editing."
      }}
    </p>

    <el-card class="branding-card">
      <template #header
        ><h3 class="text-lg font-semibold">Site name</h3></template
      >
      <form id="site-name-form" @submit.prevent="saveText">
        <fieldset
          :disabled="disabled"
          class="site-settings-fields branding-fields"
        >
          <label for="site-name">Site name</label>
          <input
            id="site-name"
            v-model="draft.site_name"
            type="text"
            required
          />
          <SiteActions
            :show-reload="false"
            show-save
            :busy="busy"
            :disabled="disabled"
            form-id="site-name-form"
            save-label="Save site name"
          />
        </fieldset>
      </form>
    </el-card>

    <div class="branding-assets">
      <el-card v-for="asset in assets" :key="asset.key" class="branding-card">
        <template #header
          ><h3 class="text-lg font-semibold">{{ asset.label }}</h3></template
        >
        <p class="site-settings-help">{{ asset.description }}</p>
        <div
          class="branding-preview"
          :class="{ 'favicon-preview': asset.key === 'favicon' }"
        >
          <img
            :src="siteBrandingStore.branding[asset.key] || asset.fallback"
            :alt="`${asset.label} preview`"
          />
        </div>
        <p class="site-settings-help">
          {{
            siteBrandingStore.branding[asset.key]
              ? "Custom image"
              : "Default image"
          }}
        </p>
        <input
          :id="asset.key"
          :ref="(input) => (fileInputs[asset.key] = input)"
          type="file"
          hidden
          :accept="accept"
          :disabled="disabled"
          @change="uploadAsset(asset.key, $event)"
        />
        <el-button
          :disabled="disabled"
          :aria-label="`Upload ${asset.label.toLowerCase()}`"
          @click="chooseAsset(asset.key)"
          >Upload</el-button
        >
        <p class="site-settings-help">
          SVG, PNG, JPEG, WebP, GIF or ICO. Maximum 2 MiB. SVG must be
          self-contained and static.
          {{
            asset.key === "header_logo"
              ? "GIF animation is preserved."
              : "For favicons, only the first GIF frame is used."
          }}
        </p>
        <template v-if="asset.key === 'header_logo'">
          <label for="header_logo-playback" class="branding-upload-label">
            GIF playback
          </label>
          <select
            id="header_logo-playback"
            v-model="playback"
            :disabled="disabled"
            class="branding-playback"
          >
            <option :value="true">Loop forever</option>
            <option :value="false">Play once</option>
          </select>
          <p class="site-settings-help">
            Select before uploading a GIF, or save playback for the current GIF.
          </p>
        </template>
        <div class="site-settings-inline-actions">
          <el-button
            v-if="asset.key === 'header_logo' && savedPlayback !== null"
            type="primary"
            aria-label="Save header logo playback"
            :disabled="disabled || playback === savedPlayback"
            @click="savePlayback"
            >Save</el-button
          >
          <el-button
            type="danger"
            :aria-label="`Restore ${asset.label.toLowerCase()}`"
            :disabled="disabled || !siteBrandingStore.branding[asset.key]"
            @click="resetAsset(asset.key)"
            >Restore</el-button
          >
        </div>
      </el-card>
    </div>
    <p class="site-settings-help">
      Saved branding is cached in visitors' browsers. If the backend is
      unavailable, the last saved branding or the packaged defaults remain
      visible.
    </p>
  </section>
</template>

<style scoped src="./site-settings.css"></style>
<style scoped>
.branding-card {
  margin-bottom: 24px;
}
.branding-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.branding-assets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 24px;
}
.branding-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.branding-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.favicon-preview img {
  max-width: 64px;
  max-height: 64px;
}
.branding-upload-label {
  font-weight: 600;
  display: block;
  margin: 16px 0 8px;
}
@media (max-width: 720px) {
  .branding-assets {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
