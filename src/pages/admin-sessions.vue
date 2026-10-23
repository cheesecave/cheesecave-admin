<script setup>
import { getApiErrorMessage } from "@/utils/api-error";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "@/components/AdminLayout.vue";
import AdminPage from "@/components/AdminPage.vue";
import AdminPageHeader from "@/components/AdminPageHeader.vue";
import { useAdminStore } from "@/stores/admin";
import {
  listPanelSessions,
  revokeOtherPanelSessions,
  revokePanelSession,
} from "@/utils/api";
import { confirmDialog, showError, showSuccess } from "@/utils/dialogs";
import dayjs from "dayjs";

const router = useRouter();
const adminStore = useAdminStore();

const sessions = ref([]);
const loading = ref(false);
// An older backend, or one with sessions turned off, has nothing to list
const unavailable = ref(false);

const others = computed(() => sessions.value.filter((row) => !row.current));
const inSession = computed(() => adminStore.authMode === "session");

function formatDate(value) {
  if (!value) return "—";
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

// The user agent is long; the browser and the system are what a person recognises.
function describeAgent(agent) {
  if (!agent) return "Unknown";
  const browser =
    ["Edg", "Chrome", "Firefox", "Safari"]
      .map((name) => [name, agent.match(new RegExp(`${name}/([\\d.]+)`))])
      .find(([, found]) => found) ?? null;
  const system =
    ["Windows", "Mac OS X", "Android", "iPhone", "Linux"].find((name) =>
      agent.includes(name),
    ) ?? "";
  if (!browser) return agent.slice(0, 40);
  const [name, found] = browser;
  const label = name === "Edg" ? "Edge" : name;
  return `${label} ${found[1].split(".")[0]}${system ? ` on ${system}` : ""}`;
}

function endSessionAndLeave() {
  adminStore.logout();
  router.push("/login");
}

function handleApiError(error, fallback) {
  if (error.response?.status === 401 || error.response?.status === 403) {
    showError("Your admin session is over. Please sign in again.");
    endSessionAndLeave();
    return;
  }
  showError(
    getApiErrorMessage(error, fallback, { preferRequestMessage: true }),
  );
}

async function load() {
  loading.value = true;
  try {
    const data = await listPanelSessions(adminStore.token);
    sessions.value = data.sessions;
    unavailable.value = false;
  } catch (error) {
    if (error.response?.status === 404) {
      sessions.value = [];
      unavailable.value = true;
    } else {
      handleApiError(error, "Failed to load admin sessions");
    }
  } finally {
    loading.value = false;
  }
}

async function signOutSession(row) {
  try {
    await confirmDialog(
      row.current ? "Sign out" : "End session",
      row.current
        ? "End this session and sign out of the panel?"
        : `End the session from ${row.ip || "an unknown address"} (${describeAgent(row.user_agent)})?`,
      { confirmText: row.current ? "Sign out" : "End session" },
    );
  } catch {
    return;
  }
  try {
    await revokePanelSession(adminStore.token, row.id);
    if (row.current) {
      endSessionAndLeave();
      return;
    }
    showSuccess("Session ended");
    await load();
  } catch (error) {
    handleApiError(error, "Failed to end the session");
  }
}

async function signOutOthers() {
  try {
    await confirmDialog(
      "Sign out everywhere else",
      `End the ${others.value.length} other session(s)? This one stays.`,
      { confirmText: "End them" },
    );
  } catch {
    return;
  }
  try {
    const result = await revokeOtherPanelSessions(adminStore.token);
    showSuccess(`Ended ${result.revoked} session(s)`);
    await load();
  } catch (error) {
    handleApiError(error, "Failed to end the other sessions");
  }
}

onMounted(load);
</script>

<template>
  <AdminLayout>
    <AdminPage>
      <AdminPageHeader
        title="Admin Sessions"
        subtitle="Browsers signed in to this panel with the admin token. A session ends after 30 minutes without use and 12 hours at most; changing the admin token ends all of them."
      >
        <template #actions>
          <el-button
            :disabled="others.length === 0"
            @click="signOutOthers"
            data-testid="admin-sessions-end-others"
          >
            Sign out everywhere else
          </el-button>
          <el-button
            :loading="loading"
            @click="load"
            data-testid="admin-sessions-refresh"
          >
            Refresh
          </el-button>
        </template>
      </AdminPageHeader>

      <el-alert
        v-if="unavailable"
        type="info"
        :closable="false"
        show-icon
        title="This backend does not offer admin sessions"
        description="Either it is an older version or sessions are turned off, so the panel keeps the admin token in memory and signs out when the page is reloaded."
        data-testid="admin-sessions-unavailable"
      />
      <el-alert
        v-else-if="!inSession"
        type="warning"
        :closable="false"
        show-icon
        title="This panel is using the admin token, not a session"
        description="The sessions below belong to other browsers. Sign out and in again to make one for this browser."
        data-testid="admin-sessions-token-mode"
      />

      <el-card v-if="!unavailable" shadow="never" class="admin-sessions-card">
        <el-table
          v-loading="loading"
          :data="sessions"
          stripe
          empty-text="No active sessions"
          data-testid="admin-sessions-table"
        >
          <el-table-column label="Browser" min-width="200">
            <template #default="{ row }">
              <span data-testid="admin-sessions-agent">{{
                describeAgent(row.user_agent)
              }}</span>
              <el-tag
                v-if="row.current"
                type="success"
                size="small"
                class="ml-2"
                data-testid="admin-sessions-current"
              >
                This session
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="Address" width="170" />
          <el-table-column label="Signed in" width="180">
            <template #default="{ row }">{{
              formatDate(row.created_at)
            }}</template>
          </el-table-column>
          <el-table-column label="Last used" width="180">
            <template #default="{ row }">{{
              formatDate(row.last_used_at)
            }}</template>
          </el-table-column>
          <el-table-column label="Ends" width="230">
            <template #default="{ row }">
              <div>Idle: {{ formatDate(row.expires_at) }}</div>
              <div>Latest: {{ formatDate(row.absolute_expires_at) }}</div>
            </template>
          </el-table-column>
          <el-table-column
            label="Actions"
            fixed="right"
            width="140"
            align="right"
            header-align="right"
          >
            <template #default="{ row }">
              <el-button
                :type="row.current ? 'warning' : 'danger'"
                size="small"
                @click="signOutSession(row)"
                data-testid="admin-sessions-end"
              >
                {{ row.current ? "Sign out" : "End session" }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </AdminPage>
  </AdminLayout>
</template>

<style scoped>
.admin-sessions-card {
  margin-top: 16px;
}
</style>
