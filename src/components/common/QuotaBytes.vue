<script setup>
// PROTOTYPE: a quota or a size; null is "no limit", written the way the chosen option writes it.
// `standalone`: the value is all the field shows (not the right side of "x / …").
import { formatBytes } from "@/utils/api";

defineProps({
  bytes: { type: Number, default: null },
  standalone: { type: Boolean, default: false },
});
</script>

<template>
  <Unlimited
    v-if="bytes === null || bytes === undefined"
    :kind="standalone ? 'standalone' : 'value'"
  />
  <span v-else>{{ formatBytes(bytes) }}</span>
</template>
