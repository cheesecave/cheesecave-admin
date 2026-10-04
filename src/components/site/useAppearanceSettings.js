import { computed, onMounted, ref } from "vue";
import { getSiteAppearance, updateSiteAppearance } from "@/utils/api";
import { useSiteSettingsRequest } from "./useSiteSettingsRequest.js";

export const copySettings = (value) => JSON.parse(JSON.stringify(value));

export function useAppearanceSettings(
  section,
  defaults,
  normalize,
  extras = {},
) {
  const draft = ref(copySettings(defaults));
  const saved = ref(copySettings(defaults));
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
    () =>
      JSON.stringify(draft.value) !== JSON.stringify(saved.value) ||
      Boolean(extras.hasChanges?.()),
  );

  function apply(value) {
    const config = normalize(value);
    if (!config)
      throw new Error(`Invalid ${section} settings returned by the server.`);
    draft.value = copySettings(config);
    saved.value = copySettings(config);
  }
  async function load() {
    await runRequest(
      async (token) => {
        loaded.value = false;
        const [appearance, extra] = await Promise.all([
          getSiteAppearance(token),
          extras.load?.(token),
        ]);
        apply(appearance[section]);
        extras.apply?.(extra);
        loaded.value = true;
      },
      { fallback: `Failed to load ${section} settings` },
    );
  }
  async function save() {
    if (disabled.value || !checkAuth()) return;
    const config = normalize(draft.value);
    const validation = extras.validate?.();
    if (!config || validation) {
      showError(
        new Error(
          validation ||
            extras.validationMessage ||
            `Check the ${section} settings before saving.`,
        ),
      );
      return;
    }
    await runRequest(
      async (token) => {
        const patch = Object.fromEntries(
          Object.entries(config).filter(
            ([key, value]) =>
              JSON.stringify(value) !== JSON.stringify(saved.value[key]),
          ),
        );
        if (Object.keys(patch).length) {
          const response = await updateSiteAppearance(token, {
            [section]: patch,
          });
          apply(response[section]);
        } else apply(config);
        await extras.save?.(token);
      },
      {
        fallback: `Failed to save ${section} settings`,
        success: `${section[0].toUpperCase()}${section.slice(1)} settings saved`,
      },
    );
  }
  function restore() {
    if (disabled.value || !checkAuth()) return;
    draft.value = copySettings(defaults);
    extras.restore?.();
    errorMessage.value = "";
  }
  onMounted(load);
  return {
    draft,
    loaded,
    busy,
    disabled,
    hasChanges,
    errorMessage,
    load,
    save,
    restore,
  };
}
