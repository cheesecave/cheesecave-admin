<script setup>
// PROTOTYPE: a quota or a size; null is "no limit", written the way the chosen option writes it.
import { formatBytes } from "@/utils/api";

defineProps({ bytes: { type: Number, default: null } });
</script>

<template>
  <Unlimited v-if="bytes === null || bytes === undefined" />
  <span v-else>{{ formatBytes(bytes) }}</span>
</template>
