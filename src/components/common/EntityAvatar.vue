<script setup>
// The round (user) or rounded-square (organization) picture of an account, as on GitHub. Without an uploaded avatar it is
// the first letter on a colour taken from the name, so the same account always looks the same. A repository gets an icon.
import { computed, ref, watch } from "vue";

const props = defineProps({
  item: { type: Object, required: true },
  size: { type: Number, default: 28 },
});

const failed = ref(false);
watch(
  () => props.item?.username,
  () => (failed.value = false),
);

const isRepo = computed(() => props.item.kind === "repo");
const name = computed(() => props.item.username || props.item.full_id || "?");
const src = computed(() => {
  if (isRepo.value || !props.item.has_avatar || failed.value) return null;
  const base = props.item.is_org ? "organizations" : "users";
  return `/api/${base}/${encodeURIComponent(props.item.username)}/avatar`;
});
const hue = computed(() => {
  let h = 0;
  for (const ch of name.value) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
});
const repoIcon = computed(
  () =>
    ({
      model: "i-carbon-cube",
      dataset: "i-carbon-data-table",
      space: "i-carbon-application",
    })[props.item.repo_type] || "i-carbon-cube",
);
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.46)}px`,
  borderRadius: props.item.is_org || isRepo.value ? `${Math.round(props.size * 0.22)}px` : "50%",
  background: src.value || isRepo.value ? undefined : `hsl(${hue.value} 55% 46%)`,
}));
</script>

<template>
  <span class="entity-avatar" :class="{ repo: isRepo }" :style="style" aria-hidden="true">
    <img v-if="src" :src="src" alt="" loading="lazy" @error="failed = true" />
    <span v-else-if="isRepo" :class="repoIcon" />
    <template v-else>{{ name.charAt(0).toUpperCase() }}</template>
  </span>
</template>

<style scoped>
.entity-avatar {
  /* a picture that is still loading (or slow) shows a plain tile instead of nothing; the letter's own colour overrides it */
  background: var(--el-fill-color);
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #fff;
  font-weight: 600;
  line-height: 1;
  user-select: none;
}
.entity-avatar.repo {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.entity-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
