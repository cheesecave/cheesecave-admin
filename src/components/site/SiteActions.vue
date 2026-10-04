<script setup>
defineProps({
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  hasChanges: { type: Boolean, default: true },
  showReload: { type: Boolean, default: true },
  showRestore: { type: Boolean, default: false },
  showSave: { type: Boolean, default: false },
  formId: { type: String, default: "" },
  saveLabel: { type: String, default: "Save" },
});
defineEmits(["reload", "restore"]);
</script>

<template>
  <div class="site-actions">
    <el-button v-if="showReload" :disabled="busy" @click="$emit('reload')"
      >Reload</el-button
    >
    <el-button
      v-if="showRestore"
      type="danger"
      :disabled="busy || disabled"
      @click="$emit('restore')"
      >Restore</el-button
    >
    <el-button
      v-if="showSave"
      type="primary"
      native-type="submit"
      :form="formId"
      :aria-label="saveLabel"
      :disabled="busy || disabled || !hasChanges"
      :loading="busy"
      >Save</el-button
    >
  </div>
</template>

<style scoped>
.site-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.site-actions :deep(.el-button) {
  margin-left: 0;
}
@media (max-width: 600px) {
  .site-actions {
    width: 100%;
    gap: 8px;
  }
  .site-actions :deep(.el-button) {
    flex: 1;
  }
}
</style>
