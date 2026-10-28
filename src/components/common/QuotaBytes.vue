<script setup>
// A quota or a size. `null` is "no limit": the symbol on the right of "10 MB / ∞", and, with `standalone`, the
// symbol and its word where the quota is all a field shows. `undefined` is an unknown figure: a dash, never ∞.
import Unlimited from "@/components/common/Unlimited.vue";
import { formatBytes } from "@/utils/api";
import { UNLIMITED_LABEL } from "@/utils/unlimited";

defineProps({
  bytes: { type: Number, default: undefined },
  standalone: { type: Boolean, default: false },
});
</script>

<template>
  <template v-if="bytes === null">
    <template v-if="standalone">{{ UNLIMITED_LABEL }}</template>
    <Unlimited v-else />
  </template>
  <template v-else-if="bytes === undefined">&mdash;</template>
  <template v-else>{{ formatBytes(bytes) }}</template>
</template>
