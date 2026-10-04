import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAdminStore } from "@/stores/admin";
import { getSiteApiErrorMessage } from "@/utils/siteApiError";

// Share request state and authentication, leaving validation, drafts, uploads
// and multi-step saves in the settings module that owns those operations.
export function useSiteSettingsRequest() {
  const router = useRouter();
  const adminStore = useAdminStore();
  const loaded = ref(false);
  const busy = ref(false);
  const errorMessage = ref("");
  const disabled = computed(() => busy.value || !loaded.value);

  function checkAuth() {
    if (adminStore.token) return true;
    loaded.value = false;
    router.push("/login");
    return false;
  }

  function showError(error, fallback) {
    if ([401, 403].includes(error?.response?.status)) {
      loaded.value = false;
      adminStore.logout();
      router.push("/login");
      errorMessage.value = "Invalid admin token. Please login again.";
    } else errorMessage.value = getSiteApiErrorMessage(error, fallback);
    ElMessage.error(errorMessage.value);
  }

  async function runRequest(operation, { fallback, success } = {}) {
    if (busy.value || !checkAuth()) return;
    busy.value = true;
    errorMessage.value = "";
    try {
      await operation(adminStore.token);
      if (success) ElMessage.success(success);
    } catch (error) {
      showError(error, fallback);
    } finally {
      busy.value = false;
    }
  }

  return {
    loaded,
    busy,
    disabled,
    errorMessage,
    checkAuth,
    showError,
    runRequest,
  };
}
