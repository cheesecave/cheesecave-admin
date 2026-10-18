import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";

import { ElementPlusStubs } from "../helpers/vue";

vi.mock("vue-chartjs", () => ({
  Line: defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => h("canvas", { role: "img", ...attrs });
    },
  }),
}));

import ChartCard from "@/components/ChartCard.vue";
import TaskWorkers from "@/components/tasks/TaskWorkers.vue";

describe("accessible names of chart, progress and headings", () => {
  it("labels a chart with the title of its card", () => {
    const wrapper = mount(ChartCard, {
      props: { title: "Commits per day", labels: ["a"], datasets: [] },
      global: { stubs: ElementPlusStubs },
    });
    expect(wrapper.get("canvas").attributes("aria-label")).toBe(
      "Commits per day",
    );
  });

  it("labels the load bar of a worker", () => {
    const wrapper = mount(TaskWorkers, {
      props: {
        roster: {
          workers: [
            {
              id: "w1",
              name: "w1",
              hostname: "w1",
              pid: 1,
              queues: [],
              concurrency: 4,
              status: "online",
              running: 1,
              succeeded: 0,
              failed: 0,
              started_at: "2026-09-25T09:00:00+00:00",
              last_heartbeat_at: "2026-09-25T10:00:00+00:00",
              heartbeat_age_seconds: 1,
              stopped_at: null,
              tasks: [],
            },
          ],
          counts: { online: 1, draining: 0, lost: 0, stopped: 0 },
          hidden: 0,
          lost_after_seconds: 30,
          inactive_after_seconds: 86400,
        },
      },
      global: { stubs: ElementPlusStubs },
    });
    expect(wrapper.get("[data-el-progress]").attributes("aria-label")).toBe(
      "Worker load",
    );
  });
});
