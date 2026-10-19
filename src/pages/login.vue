<script setup>
import { getApiErrorMessage } from "@/utils/api-error";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { safeRedirect } from "@/utils/login-redirect";
import { useAdminStore } from "@/stores/admin";
import { useSiteBrandingStore } from "@/stores/siteBranding";
import { ElMessage } from "element-plus";

const router = useRouter();
const route = useRoute();
const adminStore = useAdminStore();
const siteBrandingStore = useSiteBrandingStore();
const logoFailed = ref(false);
const logoSrc = computed(() =>
  !logoFailed.value && siteBrandingStore.branding.header_logo
    ? siteBrandingStore.branding.header_logo
    : "/admin/images/logo-square.svg",
);
watch(
  () => siteBrandingStore.branding.header_logo,
  () => (logoFailed.value = false),
);

siteBrandingStore.setPageTitle("Sign in");

const tokenInput = ref("");
const loading = ref(false);

// After a few wrong tokens the backend answers 429 with Retry-After: show the wait and keep the button off until it is over.
const waitSeconds = ref(0);
let waitTimer = null;

const waitText = computed(() => {
  const total = waitSeconds.value;
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
});

function startWait(error) {
  const header = Number(error.response?.headers?.["retry-after"]);
  const body = Number(error.response?.data?.detail?.retry_after);
  waitSeconds.value = Math.max(1, Math.ceil(header || body || 1));
  clearInterval(waitTimer);
  waitTimer = setInterval(() => {
    waitSeconds.value -= 1;
    if (waitSeconds.value <= 0) {
      clearInterval(waitTimer);
      waitTimer = null;
    }
  }, 1000);
}

onBeforeUnmount(() => clearInterval(waitTimer));

async function handleLogin() {
  if (waitSeconds.value > 0) return;
  if (!tokenInput.value) {
    ElMessage.error("Please enter admin token");
    return;
  }

  loading.value = true;

  try {
    const success = await adminStore.login(tokenInput.value);
    if (success) {
      ElMessage.success("Login successful");
      router.push(safeRedirect(route.query.redirect));
    } else {
      ElMessage.error("Invalid admin token");
      tokenInput.value = "";
    }
  } catch (error) {
    console.error("Login error:", error);
    if (error.response?.status === 429) startWait(error);
    else ElMessage.error(getApiErrorMessage(error, "Login failed"));
    tokenInput.value = "";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-container">
    <div class="login-card">
      <div class="login-header">
        <img
          :src="logoSrc"
          :alt="`${siteBrandingStore.branding.site_name} logo`"
          class="login-brand-logo"
          @error="logoFailed = true"
        />
        <h1 class="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          {{ siteBrandingStore.branding.site_name }} Admin
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Enter your admin token to continue
        </p>
      </div>

      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-form-item>
          <el-input
            v-model="tokenInput"
            type="password"
            placeholder="Admin Token"
            size="large"
            show-password
            autocomplete="off"
          >
            <template #prefix><div class="i-carbon-locked" /></template>
          </el-input>
        </el-form-item>

        <div
          v-if="waitSeconds > 0"
          class="login-wait"
          role="alert"
          data-testid="login-wait"
        >
          <strong>Too many failed attempts.</strong>
          Try again in {{ waitText }}.
        </div>

        <el-button
          type="primary"
          size="large"
          :loading="loading"
          :disabled="waitSeconds > 0"
          native-type="submit"
          class="w-full"
        >
          {{ loading ? "Verifying..." : "Login" }}
        </el-button>
      </el-form>

      <div class="login-footer">
        <el-alert type="info" :closable="false" show-icon>
          <p class="text-sm">
            Admin token can be found in your environment configuration:
            <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              CHEESE_CAVE_ADMIN_SECRET_TOKEN
            </code>
          </p>
        </el-alert>
      </div>
    </div>
  </main>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px;
  width: 100%;
  max-width: 450px;
}

html.dark .login-card {
  background: #1f1f1f;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-brand-logo {
  display: block;
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  object-fit: contain;
}

.login-form {
  margin-bottom: 24px;
}

.login-footer {
  margin-top: 24px;
}

code {
  font-family: "Courier New", monospace;
  font-size: 12px;
}
.login-wait {
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 4px;
  background: var(--el-color-danger-light-9);
  color: var(--admin-text-danger);
  font-size: 14px;
}
</style>
