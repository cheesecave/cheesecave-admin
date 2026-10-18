import { acceptHMRUpdate, defineStore } from "pinia";
import { onScopeDispose, ref } from "vue";
import {
  CACHE_KEY,
  DEFAULT_BRANDING,
  applyDocumentBranding,
  fetchBranding,
  normalizeBranding,
  parseCachedBranding,
  readCachedBranding,
  saveCachedBranding,
} from "../shared/site-branding.js";

export const useSiteBrandingStore = defineStore("siteBranding", () => {
  const branding = ref(readCachedBranding());
  const pageTitle = ref("");
  let revision = 0;

  function applyToDocument() {
    applyDocumentBranding(branding.value, {
      admin: true,
      page: pageTitle.value,
    });
  }

  function setPageTitle(title) {
    pageTitle.value = title;
    applyToDocument();
  }

  function apply(value) {
    const next = normalizeBranding(value);
    if (!next) throw new Error("Invalid site branding response");
    revision += 1;
    branding.value = next;
    saveCachedBranding(next);
    applyToDocument();
  }

  async function refresh() {
    const startedAt = revision;
    try {
      const next = await fetchBranding();
      if (revision === startedAt) apply(next);
    } catch {
      // The cached branding and packaged defaults remain usable offline.
    }
  }

  function handleStorage(event) {
    if (event.key !== CACHE_KEY && event.key !== null) return;
    const next = parseCachedBranding(event.newValue);
    if (!next && event.newValue !== null) return;
    revision += 1;
    branding.value = next || { ...DEFAULT_BRANDING };
    applyToDocument();
  }

  window.addEventListener("storage", handleStorage);
  onScopeDispose(() => window.removeEventListener("storage", handleStorage));
  applyToDocument();

  return { branding, pageTitle, apply, refresh, setPageTitle };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useSiteBrandingStore, import.meta.hot),
  );
}
