<script setup>
// One input for "which user / organization / repository?". Type a name, an email address or a number (an id) and pick
// from the list, as on GitHub: each row is a picture, the name, the email when there is one, and the id. It replaces the
// inputs that wanted an id or an exact name typed from memory.
//
//   <EntityPicker v-model="form.org_id" :kinds="['org']" value-as="id" />          the form wants the org's id
//   <EntityPicker v-model="form.user" />                                          a username, users only
//   <EntityPicker v-model="ns" :kinds="['user', 'org']" allow-free-text />        a namespace, any text is also accepted
//   <EntityPicker v-model="repo" :kinds="['repo']" value-as="repo" />               "model:owner/name"
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useAdminStore } from "@/stores/admin";
import { lookupEntities } from "@/utils/api";
import EntityAvatar from "@/components/common/EntityAvatar.vue";

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  kinds: { type: Array, default: () => ["user"] },
  valueAs: { type: String, default: "username" }, // username | id | full_id | repo
  repoType: { type: String, default: "" },
  placeholder: { type: String, default: "Search by name, email or id" },
  allowFreeText: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  limit: { type: Number, default: 8 },
});
const emit = defineEmits(["update:modelValue", "change"]);

const store = useAdminStore();
const options = ref([]);
const loading = ref(false);
const query = ref("");
// value -> item, so the box can show the picture and name of what is selected. Reactive: a value that comes from outside is
// resolved after the first render, and the box must update when it is.
const known = reactive(new Map());
let timer = null;
let seq = 0;

// "repo" is "model:owner/name": the same owner/name can exist as a model and as a dataset, so the type is part of the value.
const valueOf = (item) =>
  props.valueAs === "id"
    ? item.id
    : props.valueAs === "repo"
      ? `${item.repo_type}:${item.full_id}`
      : props.valueAs === "full_id"
        ? item.full_id
        : item.username;
const labelOf = (item) => (item.kind === "repo" ? item.full_id : item.username);
const keyOf = (item) => `${item.kind}:${item.id ?? item.username}`;

function remember(items) {
  for (const item of items) known.set(valueOf(item), item);
}

const selectedItem = computed(() => {
  const v = props.modelValue;
  if (v === null || v === undefined || v === "") return null;
  return known.get(v) || null;
});

// The selected row stays in the list even when the typed text no longer matches it, or el-select would show the bare value.
const shown = computed(() => {
  const sel = selectedItem.value;
  if (sel && !options.value.some((o) => keyOf(o) === keyOf(sel))) return [sel, ...options.value];
  return options.value;
});

async function run(q) {
  const mine = ++seq;
  loading.value = true;
  try {
    const data = await lookupEntities(store.token, { q, kinds: props.kinds, limit: props.limit, repoType: props.repoType });
    if (mine !== seq) return; // a newer search is on its way: the last one typed wins
    options.value = data.results;
    remember(data.results);
  } catch {
    if (mine === seq) options.value = [];
  } finally {
    if (mine === seq) loading.value = false;
  }
}

function onSearch(q) {
  query.value = q;
  clearTimeout(timer);
  timer = setTimeout(() => run(q), 180);
}

function onVisible(open) {
  if (open && !options.value.length) run("");
  if (!open) query.value = "";
}

function onChange(v) {
  const empty = v === undefined || v === null || v === "";
  // Cleared: "" for a text value (the forms that held a string keep working), null for an id.
  emit("update:modelValue", empty ? (props.valueAs === "id" ? null : "") : v);
  emit("change", empty ? null : known.get(v) || { kind: props.kinds[0], username: String(v), synthetic: true });
}

// A value that arrives from outside (a saved form, a link): find who it is so the box can show a name instead of "17".
watch(
  () => props.modelValue,
  async (v) => {
    if (v === null || v === undefined || v === "" || known.has(v)) return;
    const q = props.valueAs === "id" ? `#${v}` : props.valueAs === "repo" ? String(v).split(":").slice(1).join(":") : String(v);
    try {
      const data = await lookupEntities(store.token, { q, kinds: props.kinds, limit: props.limit, repoType: props.repoType });
      remember(data.results);
    } catch {
      /* the plain value is still shown */
    }
    if (!known.has(v) && props.allowFreeText) known.set(v, { kind: props.kinds[0], username: String(v), full_id: String(v), synthetic: true });
    options.value = [...options.value];
  },
  { immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));

// "alice" typed -> [{t:"ali", hit:true}, {t:"ce"}] so the match can be set in bold without v-html.
function parts(text, q) {
  const s = String(text);
  const needle = q.trim().replace(/^#/, "").toLowerCase();
  const i = needle ? s.toLowerCase().indexOf(needle) : -1;
  if (i < 0) return [{ t: s, hit: false }];
  return [
    { t: s.slice(0, i), hit: false },
    { t: s.slice(i, i + needle.length), hit: true },
    { t: s.slice(i + needle.length), hit: false },
  ].filter((p) => p.t);
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    reserve-keyword
    default-first-option
    :allow-create="allowFreeText"
    :remote-method="onSearch"
    :loading="loading"
    :clearable="clearable"
    :disabled="disabled"
    :placeholder="placeholder"
    popper-class="entity-picker-popper"
    no-data-text="No match"
    loading-text="Searching…"
    style="width: 100%"
    @visible-change="onVisible"
    @change="onChange"
  >
    <template v-if="selectedItem" #prefix>
      <EntityAvatar :item="selectedItem" :size="18" />
    </template>
    <el-option v-for="item in shown" :key="keyOf(item)" :value="valueOf(item)" :label="labelOf(item)">
      <div class="ep-row" :data-testid="`entity-option-${labelOf(item)}`">
        <EntityAvatar :item="item" :size="28" />
        <div class="ep-main">
          <div class="ep-name">
            <span class="ep-text"><span v-for="(p, i) in parts(labelOf(item), query)" :key="i" :class="{ hit: p.hit }">{{ p.t }}</span></span>
            <span v-if="item.is_org" class="ep-tag org">Org</span>
            <span v-if="item.kind === 'repo'" class="ep-tag">{{ item.repo_type }}</span>
            <span v-if="item.kind === 'repo' && item.private" class="ep-tag">private</span>
            <span v-if="item.is_active === false" class="ep-tag off">disabled</span>
          </div>
          <div v-if="item.email" class="ep-sub">
            <span v-for="(p, i) in parts(item.email, query)" :key="i" :class="{ hit: p.hit }">{{ p.t }}</span>
          </div>
        </div>
        <span v-if="item.kind !== 'repo'" class="ep-id" :class="{ hit: item.matched === 'id' }">#{{ item.id }}</span>
      </div>
    </el-option>
  </el-select>
</template>

<style>
/* The list is teleported to <body>, so this block cannot be scoped. */
.entity-picker-popper {
  min-width: 340px !important;
}
.entity-picker-popper .el-select-dropdown__item {
  height: auto;
  padding: 6px 12px;
  line-height: 1.25;
}
.entity-picker-popper .ep-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.entity-picker-popper .ep-main {
  min-width: 0;
  flex: 1;
}
.entity-picker-popper .ep-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  white-space: nowrap;
}
.entity-picker-popper .ep-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.entity-picker-popper .ep-sub {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entity-picker-popper .hit {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 700;
  border-radius: 2px;
}
.entity-picker-popper .ep-id {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.entity-picker-popper .ep-tag {
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  padding: 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 400;
}
.entity-picker-popper .ep-tag.org {
  border-color: var(--color-org, #8b5cf6);
  color: var(--color-org, #8b5cf6);
}
.entity-picker-popper .ep-tag.off {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}
</style>
