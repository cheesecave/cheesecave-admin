<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";
import { globalSearch } from "@/utils/api";
import { ElMessage } from "element-plus";

const router = useRouter();
const adminStore = useAdminStore();

const dialogVisible = ref(false);
const searchQuery = ref("");
const searchResults = ref(null);
const loading = ref(false);
const searchDebounceTimer = ref(null);
const selectedIndex = ref(0);

// Computed flat list of all results for keyboard navigation
const flatResults = computed(() => {
  if (!searchResults.value) return [];

  const results = [];

  // Add users
  if (searchResults.value.results.users) {
    searchResults.value.results.users.forEach((user) => {
      results.push({
        type: "user",
        data: user,
        label: user.username,
        sublabel: user.email,
      });
    });
  }

  // Add repositories
  if (searchResults.value.results.repositories) {
    searchResults.value.results.repositories.forEach((repo) => {
      results.push({
        type: "repo",
        data: repo,
        label: repo.full_id,
        sublabel: `${repo.repo_type} • ${repo.owner_username}`,
      });
    });
  }

  // Add commits
  if (searchResults.value.results.commits) {
    searchResults.value.results.commits.forEach((commit) => {
      results.push({
        type: "commit",
        data: commit,
        label: commit.message,
        sublabel: `${commit.username} • ${commit.commit_id.substring(0, 8)}`,
      });
    });
  }

  return results;
});

const hasResults = computed(() => {
  return flatResults.value.length > 0;
});

// Below two characters the box is a command palette: pages and actions, filtered by what is typed.
const commands = [
  {
    kind: "Action",
    label: "Create user",
    icon: "i-carbon-user-follow",
    to: { path: "/users", query: { create: "1" } },
  },
  {
    kind: "Action",
    label: "Reset a password",
    icon: "i-carbon-password",
    to: { path: "/users", query: { reset: "1" } },
  },
  {
    kind: "Action",
    label: "New invitation",
    icon: "i-carbon-email",
    to: { path: "/invitations", query: { create: "1" } },
  },
  {
    kind: "Action",
    label: "Failed tasks, last 24 h",
    icon: "i-carbon-warning",
    to: { path: "/tasks", query: { status: "failed", window: "24h" } },
  },
  {
    kind: "Action",
    label: "Users over quota",
    icon: "i-carbon-meter",
    to: { path: "/users", query: { filter: "over_quota" } },
  },
  { kind: "Page", label: "Overview", icon: "i-carbon-dashboard", to: "/" },
  { kind: "Page", label: "Health", icon: "i-carbon-activity", to: "/health" },
  {
    kind: "Page",
    label: "Background Tasks",
    icon: "i-carbon-task",
    to: "/tasks",
  },
  {
    kind: "Page",
    label: "Storage",
    icon: "i-carbon-data-volume",
    to: "/storage",
  },
];
const paletteMode = computed(
  () => !(searchQuery.value && searchQuery.value.length >= 2),
);
const shownCommands = computed(() => {
  const typed = (searchQuery.value || "").toLowerCase();
  return commands.filter((c) => c.label.toLowerCase().includes(typed));
});

// One list for the keyboard: the matching commands first, then the search results.
const navItems = computed(() => [
  ...shownCommands.value.map((command) => ({ command })),
  ...(paletteMode.value ? [] : flatResults.value),
]);
const selectedResult = computed(
  () => flatResults.value[selectedIndex.value - shownCommands.value.length],
);

function runCommand(command) {
  closeDialog();
  router.push(command.to);
}

function openDialog() {
  dialogVisible.value = true;
  searchQuery.value = "";
  searchResults.value = null;
  selectedIndex.value = 0;
}

function closeDialog() {
  dialogVisible.value = false;
  searchQuery.value = "";
  searchResults.value = null;
}

async function performSearch() {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = null;
    return;
  }

  loading.value = true;
  try {
    searchResults.value = await globalSearch(
      adminStore.token,
      searchQuery.value,
      ["users", "repos", "commits"],
      10,
    );
    selectedIndex.value = 0; // Reset selection
  } catch (error) {
    console.error("Search failed:", error);
    ElMessage.error("Search failed. Please try again.");
  } finally {
    loading.value = false;
  }
}

function handleSearchInput() {
  selectedIndex.value = 0;
  // Clear existing timer
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value);
  }

  // Set new timer - wait 300ms after last input before searching
  searchDebounceTimer.value = setTimeout(() => {
    performSearch();
  }, 300);
}

function handleKeyDown(event) {
  const list = navItems.value;
  if (!list.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, list.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const item = list[selectedIndex.value];
    if (item.command) runCommand(item.command);
    else handleSelectResult(item);
  }
}

function handleSelectResult(result) {
  closeDialog();

  switch (result.type) {
    case "user":
      router.push(`/users`);
      // Could expand to open user detail modal in the future
      ElMessage.success(`Navigate to user: ${result.data.username}`);
      break;

    case "repo":
      router.push(`/repositories`);
      ElMessage.success(`Navigate to repository: ${result.data.full_id}`);
      break;

    case "commit":
      router.push(`/commits`);
      ElMessage.success(`Navigate to commits`);
      break;
  }
}

function getIcon(type) {
  switch (type) {
    case "user":
      return "i-carbon-user";
    case "repo":
      return "i-carbon-data-base";
    case "commit":
      return "i-carbon-version";
    default:
      return "i-carbon-search";
  }
}

function getTypeColor(type) {
  switch (type) {
    case "user":
      return "primary";
    case "repo":
      return "success";
    case "commit":
      return "warning";
    default:
      return "info";
  }
}

// Keyboard shortcut handler
function handleGlobalKeyDown(event) {
  // Ctrl+K or Cmd+K
  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault();
    openDialog();
  }

  // Escape to close
  if (event.key === "Escape" && dialogVisible.value) {
    closeDialog();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeyDown);
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value);
  }
});

// Watch dialog visibility to focus input
watch(dialogVisible, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      const input = document.querySelector(".global-search-input input");
      if (input) input.focus();
    }, 100);
  }
});

// Expose openDialog for parent components
defineExpose({ openDialog });
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    width="600px"
    :show-close="false"
    class="global-search-dialog"
  >
    <div class="search-container">
      <!-- Search Input -->
      <el-input
        v-model="searchQuery"
        placeholder="Search users, repositories, commits... (Type to search)"
        size="large"
        clearable
        @input="handleSearchInput"
        @keydown="handleKeyDown"
        class="global-search-input"
      >
        <template #prefix>
          <div class="i-carbon-search text-xl text-gray-400" />
        </template>
        <template #suffix>
          <div class="flex items-center gap-2">
            <span
              v-if="loading"
              class="i-carbon-circle-dash animate-spin text-gray-400"
            />
            <el-tag size="small" effect="plain">Ctrl+K</el-tag>
          </div>
        </template>
      </el-input>

      <!-- Results -->
      <div class="results-container">
        <div v-if="paletteMode || shownCommands.length" data-testid="palette">
          <div class="section-header">
            <div class="i-carbon-flash text-orange-500" />
            <span>Go to and actions</span>
          </div>
          <div
            v-for="(c, i) in shownCommands"
            :key="c.label"
            class="result-item"
            :class="{ selected: selectedIndex === i }"
            data-testid="palette-item"
            @click="runCommand(c)"
          >
            <div :class="c.icon" class="text-lg" />
            <div class="result-content">
              <div class="result-title">{{ c.label }}</div>
            </div>
            <el-tag size="small" effect="plain">{{ c.kind }}</el-tag>
          </div>
          <p v-if="paletteMode" class="hint-text text-xs mt-2">
            Type two or more characters to search users, repositories and
            commits • <kbd>↑</kbd> <kbd>↓</kbd> to move • <kbd>Enter</kbd> to
            open • <kbd>Esc</kbd> to close
          </p>
        </div>
        <template v-if="!paletteMode">
          <div v-if="loading" class="text-center py-8 text-gray-500">
            <div class="i-carbon-circle-dash animate-spin text-2xl mb-2" />
            <p>Searching...</p>
          </div>

          <div
            v-else-if="!hasResults && !shownCommands.length"
            class="text-center py-8 text-gray-500"
          >
            <div class="i-carbon-search-locate text-3xl mb-2" />
            <p>No results found for "{{ searchQuery }}"</p>
          </div>

          <div v-else-if="hasResults" class="results-list">
            <!-- Users Section -->
            <div
              v-if="
                searchResults?.results?.users &&
                searchResults.results.users.length > 0
              "
              class="result-section"
            >
              <div class="section-header">
                <div class="i-carbon-user text-blue-600" />
                <span>Users ({{ searchResults.results.users.length }})</span>
              </div>
              <div
                v-for="(user, idx) in searchResults.results.users"
                :key="`user-${user.id}`"
                class="result-item"
                :class="{
                  selected:
                    selectedResult?.type === 'user' &&
                    selectedResult?.data.id === user.id,
                }"
                @click="
                  handleSelectResult({
                    type: 'user',
                    data: user,
                    label: user.username,
                    sublabel: user.email,
                  })
                "
              >
                <div class="i-carbon-user text-blue-600" />
                <div class="result-content">
                  <div class="result-label">{{ user.username }}</div>
                  <div class="result-sublabel">{{ user.email }}</div>
                </div>
                <el-tag
                  v-if="user.email_verified"
                  type="success"
                  size="small"
                  effect="plain"
                >
                  Verified
                </el-tag>
              </div>
            </div>

            <!-- Repositories Section -->
            <div
              v-if="
                searchResults?.results?.repositories &&
                searchResults.results.repositories.length > 0
              "
              class="result-section"
            >
              <div class="section-header">
                <div class="i-carbon-data-base text-green-600" />
                <span
                  >Repositories ({{
                    searchResults.results.repositories.length
                  }})</span
                >
              </div>
              <div
                v-for="repo in searchResults.results.repositories"
                :key="`repo-${repo.id}`"
                class="result-item"
                :class="{
                  selected:
                    selectedResult?.type === 'repo' &&
                    selectedResult?.data.id === repo.id,
                }"
                @click="
                  handleSelectResult({
                    type: 'repo',
                    data: repo,
                    label: repo.full_id,
                    sublabel: `${repo.repo_type} • ${repo.owner_username}`,
                  })
                "
              >
                <div class="i-carbon-data-base text-green-600" />
                <div class="result-content">
                  <div class="result-label">{{ repo.full_id }}</div>
                  <div class="result-sublabel">
                    {{ repo.repo_type }} • {{ repo.owner_username }}
                  </div>
                </div>
                <el-tag
                  v-if="repo.private"
                  type="warning"
                  size="small"
                  effect="plain"
                >
                  Private
                </el-tag>
              </div>
            </div>

            <!-- Commits Section -->
            <div
              v-if="
                searchResults?.results?.commits &&
                searchResults.results.commits.length > 0
              "
              class="result-section"
            >
              <div class="section-header">
                <div class="i-carbon-version text-orange-600" />
                <span
                  >Commits ({{ searchResults.results.commits.length }})</span
                >
              </div>
              <div
                v-for="commit in searchResults.results.commits"
                :key="`commit-${commit.id}`"
                class="result-item"
                :class="{
                  selected:
                    selectedResult?.type === 'commit' &&
                    selectedResult?.data.id === commit.id,
                }"
                @click="
                  handleSelectResult({
                    type: 'commit',
                    data: commit,
                    label: commit.message,
                    sublabel: `${commit.username} • ${commit.commit_id.substring(0, 8)}`,
                  })
                "
              >
                <div class="i-carbon-version text-orange-600" />
                <div class="result-content">
                  <div class="result-label">{{ commit.message }}</div>
                  <div class="result-sublabel">
                    {{ commit.username }} •
                    {{ commit.commit_id.substring(0, 8) }} •
                    {{ commit.repo_full_id }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.global-search-dialog :deep(.el-dialog) {
  margin-top: 10vh;
  border-radius: 12px;
  background-color: var(--bg-card);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-lg);
}

.global-search-dialog :deep(.el-dialog__header) {
  display: none;
}

.global-search-dialog :deep(.el-dialog__body) {
  padding: 0;
  background-color: var(--bg-card);
}

.search-container {
  padding: 20px;
}

.global-search-input {
  margin-bottom: 16px;
}

.global-search-input :deep(.el-input__wrapper) {
  background-color: var(--bg-hover);
  border-color: var(--border-default);
  transition: all 0.2s ease;
}

.global-search-input :deep(.el-input__wrapper:hover) {
  border-color: var(--color-info);
}

.global-search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--color-info);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.results-container {
  max-height: 400px;
  overflow-y: auto;
}

.results-container::-webkit-scrollbar {
  width: 8px;
}

.results-container::-webkit-scrollbar-track {
  background: var(--bg-hover);
  border-radius: 4px;
}

.results-container::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
}

.results-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  background-color: var(--bg-hover);
  border-radius: 6px;
  margin-bottom: 4px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.result-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-light);
  transform: translateX(4px);
}

.result-item.selected {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: var(--color-info);
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.result-sublabel {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint-text {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.hint-text p:first-child {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

kbd {
  display: inline-block;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 500;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  margin: 0 2px;
  box-shadow: 0 2px 0 var(--border-default);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
