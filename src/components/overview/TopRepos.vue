<script setup>
import { ref } from "vue";
defineProps({ top: Object });
const by = ref("by_commits");
</script>

<template>
  <el-card shadow="never" data-testid="top-card">
    <template #header>
      <div class="h"><b>Top repositories</b>
        <span class="tabs"><button :class="{ on: by === 'by_commits' }" @click="by = 'by_commits'">commits</button><button :class="{ on: by === 'by_size' }" @click="by = 'by_size'">size</button></span>
      </div>
    </template>
    <div v-if="top && !top.error">
      <router-link v-for="r in top[by]" :key="r.repo_full_id" :to="{ path: '/repositories', query: { q: r.repo_full_id } }" class="row">
        <el-tag size="small" :type="r.repo_type === 'dataset' ? 'success' : r.repo_type === 'space' ? 'warning' : 'primary'">{{ r.repo_type }}</el-tag>
        <span class="n">{{ r.repo_full_id }}</span>
        <span class="v">{{ r.display }}</span>
      </router-link>
    </div>
  </el-card>
</template>

<style scoped>
.h { display: flex; justify-content: space-between; align-items: center; }
.tabs button { border: 1px solid var(--border-default); background: var(--bg-card); color: var(--text-primary); padding: 1px 10px; font-size: 12px; cursor: pointer; }
.tabs button:first-child { border-radius: 6px 0 0 6px; } .tabs button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
.tabs button.on { background: var(--color-info); color: #fff; border-color: var(--color-info); }
.row { display: flex; gap: 8px; align-items: center; padding: 6px 2px; color: var(--text-primary); text-decoration: none; font-size: 13px; border-bottom: 1px solid var(--border-light); }
.row:last-child { border-bottom: 0; } .row:hover { background: var(--bg-hover); }
.n { flex: 1; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; }
.v { font-variant-numeric: tabular-nums; color: var(--text-secondary, #6b7280); }
</style>
