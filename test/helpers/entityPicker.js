import { defineComponent, h } from "vue";

// The real EntityPicker is tested on its own (test/components/common). A page test uses this stand-in: a text box that reports
// what is typed as the picked value, and that shows how the page configured it (kinds, free text, value kind) as data
// attributes, so what a page does with a chosen name is what its test exercises. A test that needs a richer pick (an item with
// an email and an id) emits `change` itself on the component.
export const EntityPickerStub = defineComponent({
  name: "EntityPicker",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    kinds: { type: Array, default: () => [] },
    valueAs: { type: String, default: "username" },
    allowFreeText: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    return () =>
      h(
        "div",
        {
          ...attrs,
          "data-entity-picker": "true",
          "data-kinds": props.kinds.join(","),
          "data-value-as": props.valueAs,
          "data-free-text": String(props.allowFreeText),
        },
        [
          h("input", {
            type: "text",
            value: props.modelValue ?? "",
            placeholder: props.placeholder,
            onInput: (event) => {
              const value = event.target.value;
              emit("update:modelValue", value);
              emit("change", value ? { username: value } : null);
            },
          }),
        ],
      );
  },
});
