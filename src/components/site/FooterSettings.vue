<script setup>
import { ref } from "vue";
import SiteSettingsHeader from "./SiteSettingsHeader.vue";
import SiteActions from "./SiteActions.vue";
import { useAppearanceSettings } from "./useAppearanceSettings.js";
import { useSiteBrandingStore } from "@/stores/siteBranding";
import { getSiteBranding, updateSiteBranding } from "@/utils/api";
import { DEFAULT_BRANDING } from "../../shared/site-branding.js";
import {
  DEFAULT_FOOTER,
  FOOTER_ATTRIBUTION,
  normalizeFooter,
} from "../../shared/site-appearance.js";

const brandingStore = useSiteBrandingStore();
const description = ref("");
const savedDescription = ref("");
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
} = useAppearanceSettings("footer", DEFAULT_FOOTER, normalizeFooter, {
  load: getSiteBranding,
  apply(branding) {
    brandingStore.apply(branding);
    description.value = brandingStore.branding.footer_description;
    savedDescription.value = brandingStore.branding.footer_description;
  },
  hasChanges: () => description.value !== savedDescription.value,
  validate: () =>
    Array.from(description.value).length > 2000
      ? "Footer description must be at most 2000 characters."
      : "",
  validationMessage:
    "Enter a title for every group and a label and safe URL for each link. Use at most 3 groups, 8 links per group and 100 characters per title or label.",
  async save(token) {
    if (description.value === savedDescription.value) return;
    const branding = await updateSiteBranding(token, {
      footer_description: description.value,
    });
    brandingStore.apply(branding);
    description.value = brandingStore.branding.footer_description;
    savedDescription.value = brandingStore.branding.footer_description;
  },
  restore: () => {
    description.value = DEFAULT_BRANDING.footer_description;
  },
});
function addGroup() {
  if (!disabled.value && draft.value.groups.length < 3)
    draft.value.groups.push({ title: "", links: [] });
}
function addLink(group) {
  if (!disabled.value && group.links.length < 8)
    group.links.push({ label: "", url: "" });
}
</script>

<template>
  <section class="site-settings">
    <SiteSettingsHeader
      title="Footer"
      subtitle="Manage the footer description and link groups."
    >
      <template #actions
        ><SiteActions
          :busy="busy"
          :disabled="disabled"
          :has-changes="hasChanges"
          show-restore
          show-save
          form-id="footer-settings-form"
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
          ? "Loading footer settings…"
          : "Load the current settings before editing."
      }}
    </p>
    <form id="footer-settings-form" @submit.prevent="save">
      <fieldset :disabled="disabled" class="site-settings-fields">
        <el-card class="appearance-card" shadow="never"
          ><template #header><h3>Description</h3></template>
          <div class="site-settings-field">
            <label for="footer-description">Footer description</label
            ><textarea
              id="footer-description"
              v-model="description"
              rows="3"
              maxlength="2000"
            />
            <p class="site-settings-help">
              Plain text, up to 2000 characters. Leave blank to hide the
              description.
            </p>
          </div></el-card
        >
        <div class="group-section-heading">
          <h3>Link groups</h3>
          <el-button
            :disabled="disabled || draft.groups.length >= 3"
            @click="addGroup"
            >Add group</el-button
          >
        </div>
        <el-card
          v-for="(group, groupIndex) in draft.groups"
          :key="groupIndex"
          class="appearance-card"
          shadow="never"
          ><template #header
            ><div class="group-heading">
              <h3>Group {{ groupIndex + 1 }}</h3>
              <el-button
                type="danger"
                size="small"
                :disabled="disabled"
                :aria-label="`Remove group ${groupIndex + 1}`"
                @click="draft.groups.splice(groupIndex, 1)"
                >Remove group</el-button
              >
            </div></template
          >
          <div class="site-settings-field">
            <label :for="`footer-group-${groupIndex}-title`">Group title</label
            ><input
              :id="`footer-group-${groupIndex}-title`"
              v-model="group.title"
              type="text"
              maxlength="100"
              required
            />
          </div>
          <div
            v-for="(link, linkIndex) in group.links"
            :key="linkIndex"
            class="link-editor"
          >
            <div class="site-settings-field">
              <label :for="`footer-group-${groupIndex}-link-${linkIndex}-label`"
                >Link {{ linkIndex + 1 }} label</label
              ><input
                :id="`footer-group-${groupIndex}-link-${linkIndex}-label`"
                v-model="link.label"
                type="text"
                maxlength="100"
                required
              />
            </div>
            <div class="site-settings-field">
              <label :for="`footer-group-${groupIndex}-link-${linkIndex}-url`"
                >Link URL</label
              ><input
                :id="`footer-group-${groupIndex}-link-${linkIndex}-url`"
                v-model="link.url"
                type="text"
                maxlength="2048"
                placeholder="/docs or https://example.com"
                required
              />
            </div>
            <el-button
              type="danger"
              :disabled="disabled"
              :aria-label="`Remove link ${linkIndex + 1} from group ${groupIndex + 1}`"
              @click="group.links.splice(linkIndex, 1)"
              >Remove</el-button
            >
          </div>
          <el-button
            :disabled="disabled || group.links.length >= 8"
            :aria-label="`Add link to group ${groupIndex + 1}`"
            @click="addLink(group)"
            >Add link</el-button
          ></el-card
        >
        <p class="site-settings-help group-help">
          Up to 3 groups and 8 links per group. Use a site path beginning with /
          or an HTTP(S) URL.
        </p>
        <el-card class="appearance-card" shadow="never"
          ><template #header><h3>Display</h3></template>
          <label for="footer-build-info" class="footer-toggle"
            ><input
              id="footer-build-info"
              v-model="draft.show_build_info"
              type="checkbox"
              role="switch"
            /><span>Show build information</span></label
          >
        </el-card>
      </fieldset>
    </form>
    <section
      v-if="loaded"
      class="appearance-preview"
      aria-label="Footer preview"
    >
      <h3>Preview</h3>
      <div class="footer-preview" data-testid="footer-preview">
        <div class="footer-preview-top">
          <div class="footer-preview-brand">
            <strong>{{ brandingStore.branding.site_name }}</strong>
            <p v-if="description">{{ description }}</p>
            <small
              >{{ FOOTER_ATTRIBUTION.project_label }} · Based on
              {{ FOOTER_ATTRIBUTION.upstream_label }}</small
            >
          </div>
          <div
            v-for="(group, index) in draft.groups"
            :key="index"
            class="footer-preview-group"
          >
            <h4>{{ group.title }}</h4>
            <ul>
              <li v-for="(link, linkIndex) in group.links" :key="linkIndex">
                <span>{{ link.label }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div class="footer-preview-bottom">
          <span>{{ FOOTER_ATTRIBUTION.copyright_text }}</span
          ><span>{{ FOOTER_ATTRIBUTION.license_label }}</span
          ><span v-if="draft.show_build_info">Build information</span>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped src="./site-settings.css"></style>
<style scoped>
.group-section-heading,
.group-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.group-section-heading {
  margin: 24px 0 16px;
}
.group-section-heading h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.link-editor {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr) auto;
  gap: 16px;
  align-items: end;
  margin-bottom: 16px;
}
.link-editor .site-settings-field {
  margin-bottom: 0;
}
.group-help {
  margin-bottom: 24px;
}
.footer-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
}
.footer-toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-info);
}
.footer-preview {
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  border-radius: 12px;
  padding: 28px;
}
.footer-preview-top {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.footer-preview-brand strong {
  font-size: 18px;
}
.footer-preview-brand p {
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 13px;
  margin-top: 12px;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.footer-preview-brand small {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.footer-preview-group h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
.footer-preview-group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.footer-preview-group li {
  color: var(--text-secondary);
  font-size: 12px;
  margin: 10px 0;
  overflow-wrap: anywhere;
}
.footer-preview-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  border-top: 1px solid var(--border-default);
  margin-top: 24px;
  padding-top: 18px;
  color: var(--text-secondary);
  font-size: 11px;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .footer-preview-top {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .footer-preview-brand {
    grid-column: 1 / -1;
  }
}
@media (max-width: 600px) {
  .link-editor {
    grid-template-columns: 1fr;
    gap: 10px;
    border-bottom: 1px solid var(--border-default);
    padding-bottom: 16px;
  }
  .link-editor :deep(.el-button) {
    justify-self: start;
  }
  .footer-preview {
    padding: 20px;
  }
  .footer-preview-top {
    grid-template-columns: 1fr;
  }
}
</style>
