<script setup>
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import { getApiErrorMessage } from "@/utils/api-error";
import {
  getPasswordResetStatus,
  createPasswordResetLink,
  revokePasswordResetLink,
} from "@/utils/api";
import { copyToClipboard } from "@/utils/clipboard";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  token: { type: String, required: true },
  username: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);

const choices = ref([]);
const ttl = ref("");
const outstanding = ref(null); // expires_at of an unused link, if any
const issued = ref(null); // the link just created; only ever held here
const busy = ref(false);

const when = (iso) => dayjs(iso).format("YYYY-MM-DD HH:mm");
const labelOf = (key) => choices.value.find((c) => c.key === key)?.label ?? key;

async function load() {
  issued.value = null;
  outstanding.value = null;
  choices.value = [];
  try {
    const status = await getPasswordResetStatus(props.token, props.username);
    choices.value = status.choices;
    ttl.value = status.default;
    outstanding.value = status.active ? status.expires_at : null;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, "Failed to load reset link"));
  }
}

watch(
  () => props.modelValue,
  (open) => open && load(),
  { immediate: true },
);

async function create() {
  busy.value = true;
  try {
    issued.value = await createPasswordResetLink(
      props.token,
      props.username,
      ttl.value,
    );
    outstanding.value = null;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, "Failed to create reset link"));
  } finally {
    busy.value = false;
  }
}

async function withdraw() {
  busy.value = true;
  try {
    await revokePasswordResetLink(props.token, props.username);
    issued.value = null;
    outstanding.value = null;
    ElMessage.success("Link withdrawn");
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, "Failed to withdraw link"));
  } finally {
    busy.value = false;
  }
}

async function copy() {
  if (await copyToClipboard(issued.value.url)) ElMessage.success("Link copied");
  else ElMessage.error("Could not copy; select the link and copy it by hand");
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`Reset password for ${username}`"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-sm mb-3">
      Creates a one-time link. Send it to {{ username }}; they choose their own
      new password, so you never see it. Opening it signs them out everywhere
      once they set it.
    </p>

    <el-alert
      v-if="outstanding"
      data-testid="reset-active"
      type="info"
      :closable="false"
      class="mb-3"
    >
      An outstanding link expires {{ when(outstanding) }}. Creating a new one
      replaces it.
    </el-alert>

    <div v-if="!issued" class="flex items-center gap-2">
      <span class="text-sm">Valid for</span>
      <el-select v-model="ttl" style="width: 160px">
        <el-option
          v-for="c in choices"
          :key="c.key"
          :label="c.label"
          :value="c.key"
        />
      </el-select>
    </div>

    <div v-else>
      <el-input data-testid="reset-link" :model-value="issued.url" readonly />
      <p data-testid="reset-expiry" class="text-sm mt-2">
        Valid for {{ labelOf(issued.ttl) }}, until
        {{ when(issued.expires_at) }}.
      </p>
      <p data-testid="reset-once" class="text-sm mt-1">
        This is the only time the link is shown. Anyone who has it can set the
        password until it expires or is used.
      </p>
    </div>

    <template #footer>
      <el-button
        v-if="issued || outstanding"
        :disabled="busy"
        @click="withdraw"
      >
        Withdraw link
      </el-button>
      <el-button v-if="issued" @click="copy">Copy</el-button>
      <el-button
        v-else
        type="primary"
        :loading="busy"
        :disabled="!ttl"
        @click="create"
      >
        Create link
      </el-button>
      <el-button @click="emit('update:modelValue', false)">Close</el-button>
    </template>
  </el-dialog>
</template>
