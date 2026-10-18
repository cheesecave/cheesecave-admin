import { onBeforeUnmount, ref } from "vue";

// True while the viewport is at most `maxWidth` px wide (the mobile layout of
// AdminLayout starts at 768 px). Tables use it to drop their pinned columns.
export function useCompactViewport(maxWidth = 768) {
  const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
  const compact = ref(query.matches);
  const update = (event) => (compact.value = event.matches);
  query.addEventListener("change", update);
  onBeforeUnmount(() => query.removeEventListener("change", update));
  return compact;
}
