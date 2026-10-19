import { defineComponent, h } from "vue";

/** RouterLink stand-in that keeps the target visible: data-to holds the JSON of `to`. */
export const RouterLinkStub = defineComponent({
  name: "RouterLink",
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        "a",
        { ...attrs, "data-to": JSON.stringify(props.to) },
        slots.default?.(),
      );
  },
});

export const target = (wrapper) => JSON.parse(wrapper.attributes("data-to"));
