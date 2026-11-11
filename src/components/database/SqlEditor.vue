<script setup>
// CodeMirror 6 SQL editor. Completion comes from the live schema (table and column names), so it never goes stale.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const props = defineProps({
  modelValue: { type: String, default: "" },
  schema: { type: Object, default: () => ({}) }, // { table: [columns] }
});
const emit = defineEmits(["update:modelValue", "run"]);

const host = ref(null);
let view = null;
const language = new Compartment();

function languageExtension() {
  return sql({ dialect: PostgreSQL, schema: props.schema, upperCaseKeywords: true });
}

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        closeBrackets(),
        autocompletion(),
        syntaxHighlighting(defaultHighlightStyle),
        placeholder("SELECT ...   (Ctrl+Enter runs it; Ctrl+Space completes table and column names)"),
        language.of(languageExtension()),
        keymap.of([
          { key: "Mod-Enter", run: () => (emit("run"), true) },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit("update:modelValue", u.state.doc.toString());
        }),
        EditorView.theme({
          "&": { fontSize: "13px", minHeight: "190px", maxHeight: "420px" },
          ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflow: "auto" },
          ".cm-content": { minHeight: "190px" },
        }),
      ],
    }),
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  },
);
watch(
  () => props.schema,
  () => view?.dispatch({ effects: language.reconfigure(languageExtension()) }),
);
onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="sql-editor-host" data-testid="sql-editor" />
</template>

<style scoped>
.sql-editor-host {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-bg-color);
}
.sql-editor-host :deep(.cm-editor) {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
.sql-editor-host :deep(.cm-gutters) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  border-right: 1px solid var(--el-border-color);
}
</style>
