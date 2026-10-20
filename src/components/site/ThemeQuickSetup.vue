<script setup>
import { computed, reactive, ref, watch } from "vue";
import ThemePreviewTile from "./ThemePreviewTile.vue";
import { DEFAULT_THEME } from "../../shared/site-appearance.js";
import { contrastRatio } from "../../shared/site-theme.js";
import {
  RECOMMENDED_COLORS,
  colorDistance,
  darkDepthOf,
  deriveTheme,
  hexToOklch,
  isHex,
  maxChroma,
  oklchToHex,
} from "../../shared/theme-derive.js";

// Pick one main color and fill all six theme colors from it. Nothing is written until Apply.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  theme: { type: Object, required: true },
});
const emit = defineEmits(["update:modelValue", "apply"]);

const state = reactive({ brand: "", L: 0, C: 0, h: 0, depth: 0 });
const hexText = ref("");
const hexInvalid = ref(false);

function setBrand(hex) {
  const { L, C, h } = hexToOklch(hex);
  Object.assign(state, { brand: hex.toLowerCase(), L, C, h });
  hexText.value = state.brand;
  hexInvalid.value = false;
}
// A bar moved: the color follows the three numbers.
function setLch(L, C, h) {
  Object.assign(state, { L, C, h, brand: oklchToHex(L, C, h) });
  hexText.value = state.brand;
  hexInvalid.value = false;
}
function open() {
  setBrand(
    isHex(props.theme.primary_light)
      ? props.theme.primary_light
      : DEFAULT_THEME.primary_light,
  );
  state.depth = isHex(props.theme.background_dark)
    ? darkDepthOf(props.theme.background_dark)
    : 0;
}
watch(
  () => props.modelValue,
  (visible) => visible && open(),
  {
    immediate: true,
  },
);

const ceiling = computed(() => maxChroma(state.L, state.h));
// the ceiling never reaches 0 (it is a bisection), so white and black read as 0% without a special case
const vividness = computed(() =>
  Math.round(Math.min(1, state.C / Math.max(ceiling.value, 1e-9)) * 100),
);
const derived = computed(() => deriveTheme(state.brand, state.depth / 100));
const tooVivid = computed(() => state.C > ceiling.value + 0.002);
const swatches = computed(() =>
  RECOMMENDED_COLORS.map(([name, hex]) => ({
    name,
    hex,
    selected: colorDistance(state.brand, hex) < 0.012,
    // white on the pale colors would not read
    ink: contrastRatio(hex, "#ffffff") >= 3 ? "#ffffff" : "#000000",
  })),
);
const paleModes = computed(() =>
  ["light", "dark"].filter(
    (mode) =>
      contrastRatio(
        derived.value[`primary_${mode}`],
        derived.value[`card_${mode}`],
      ) < 3,
  ),
);

const track = (stops) => `linear-gradient(90deg, ${stops.join(", ")})`;
const barStyle = (stops, current) => ({
  "--track": track(stops),
  "--cur": current,
});
const hueStops = computed(() =>
  Array.from({ length: 13 }, (_, i) =>
    oklchToHex(state.L, Math.max(state.C, 0.1), i * 30),
  ),
);
const bars = computed(() => [
  {
    id: "hue",
    label: "Hue",
    min: 0,
    max: 359,
    value: Math.round(state.h) % 360,
    text: `${Math.round(state.h) % 360}°`,
    style: barStyle(hueStops.value, state.brand),
    set: (v) => setLch(state.L, state.C, v),
  },
  {
    id: "vividness",
    label: "Vividness",
    min: 0,
    max: 100,
    value: vividness.value,
    text: `${vividness.value}%`,
    style: barStyle(
      [oklchToHex(state.L, 0, state.h), oklchToHex(state.L, 1, state.h)],
      state.brand,
    ),
    set: (v) => setLch(state.L, (v / 100) * ceiling.value, state.h),
  },
  {
    id: "lightness",
    label: "Lightness",
    min: 20,
    max: 97,
    value: Math.round(state.L * 100),
    text: String(Math.round(state.L * 100)),
    style: barStyle(
      Array.from({ length: 9 }, (_, i) =>
        oklchToHex(0.2 + i * 0.0963, state.C, state.h),
      ),
      state.brand,
    ),
    set: (v) => setLch(v / 100, state.C, state.h),
  },
]);
const depthStyle = computed(() =>
  barStyle(
    [
      deriveTheme(state.brand, 0).background_dark,
      deriveTheme(state.brand, 1).background_dark,
    ],
    derived.value.background_dark,
  ),
);

function typeHex(value) {
  hexText.value = value;
  hexInvalid.value = !isHex(value.trim());
  if (!hexInvalid.value) {
    const { L, C, h } = hexToOklch(value.trim());
    Object.assign(state, { L, C, h, brand: value.trim().toLowerCase() });
  }
}
const close = () => emit("update:modelValue", false);
function apply() {
  emit("apply", derived.value);
  close();
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="Quick color setup"
    width="min(980px, 94vw)"
    class="quick-setup"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="qs-body">
      <div class="qs-left">
        <section>
          <h4 class="qs-heading">Recommended colors</h4>
          <div class="qs-matrix" role="group" aria-label="Recommended colors">
            <button
              v-for="swatch in swatches"
              :key="swatch.name"
              type="button"
              class="qs-swatch"
              :data-testid="`qs-swatch-${swatch.name}`"
              :aria-pressed="String(swatch.selected)"
              :style="{ background: swatch.hex, color: swatch.ink }"
              @click="setBrand(swatch.hex)"
            >
              {{ swatch.name }}
            </button>
          </div>
        </section>
        <section>
          <h4 class="qs-heading">Your color</h4>
          <div class="qs-bars">
            <div v-for="bar in bars" :key="bar.id" class="qs-bar">
              <label :for="`qs-${bar.id}`">{{ bar.label }}</label>
              <input
                :id="`qs-${bar.id}`"
                class="qs-track"
                type="range"
                step="1"
                :min="bar.min"
                :max="bar.max"
                :value="bar.value"
                :style="bar.style"
                :aria-valuetext="bar.text"
                @input="bar.set(+$event.target.value)"
              />
              <output
                :data-testid="`qs-${bar.id}-value`"
                :for="`qs-${bar.id}`"
                >{{ bar.text }}</output
              >
            </div>
          </div>
          <div class="qs-hex">
            <span class="qs-current" :style="{ background: state.brand }" />
            <input
              id="qs-hex"
              type="text"
              maxlength="7"
              spellcheck="false"
              aria-label="Main color as HEX"
              :value="hexText"
              :aria-invalid="String(hexInvalid)"
              @input="typeHex($event.target.value)"
            />
            <span v-if="tooVivid" class="qs-gamut" data-testid="qs-gamut"
              >Too vivid for this lightness; shown as the closest color.</span
            >
          </div>
        </section>
        <section class="qs-depth">
          <div class="qs-bar">
            <label for="qs-depth">Dark depth</label>
            <input
              id="qs-depth"
              class="qs-track"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="state.depth"
              :style="depthStyle"
              :aria-valuetext="`${state.depth}%`"
              @input="state.depth = +$event.target.value"
            />
            <output data-testid="qs-depth-value" for="qs-depth"
              >{{ state.depth }}%</output
            >
          </div>
          <div class="qs-ends">
            <span>Soft dark</span><span>Deep dark</span>
          </div>
        </section>
      </div>
      <div class="qs-right">
        <ThemePreviewTile
          mode="light"
          data-testid="qs-preview-light"
          :primary="derived.primary_light"
          :background="derived.background_light"
          :card="derived.card_light"
        />
        <ThemePreviewTile
          mode="dark"
          data-testid="qs-preview-dark"
          :primary="derived.primary_dark"
          :background="derived.background_dark"
          :card="derived.card_dark"
        />
        <ul
          class="qs-colors"
          data-testid="qs-colors"
          aria-label="The six colors"
        >
          <li v-for="(value, key) in derived" :key="key">
            <i :style="{ background: value }" />{{ value }}
            <small>{{ key.replace("_", " ") }}</small>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <span
        class="qs-note"
        :class="{ warn: paleModes.length }"
        data-testid="qs-note"
        >{{
          paleModes.length
            ? `This color is pale on the card in ${paleModes.join(" and ")} mode, so the site darkens link text a little.`
            : "Fills all six fields; you can still edit each one afterwards."
        }}</span
      >
      <el-button @click="close">Cancel</el-button>
      <el-button id="qs-apply" type="primary" @click="apply">Apply</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.qs-body {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 24px;
}
.qs-left,
.qs-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.qs-heading {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.qs-matrix {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.qs-swatch {
  position: relative;
  height: 38px;
  padding: 0 8px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.qs-swatch[aria-pressed="true"] {
  box-shadow:
    0 0 0 2px var(--bg-card),
    0 0 0 4px var(--text-primary);
}
.qs-swatch[aria-pressed="true"]::after {
  content: "✓";
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
}
.qs-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.qs-bar {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 10px;
}
.qs-bar label {
  font-size: 13px;
  font-weight: 500;
}
.qs-bar output {
  font-family: monospace;
  font-size: 12.5px;
  text-align: right;
}
.qs-track {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 16px;
  margin: 0;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--track);
  cursor: pointer;
}
.qs-track::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--cur);
  border: 3px solid #fff;
  box-shadow:
    0 0 0 1.5px #000,
    0 1px 4px rgba(0, 0, 0, 0.4);
}
.qs-track::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--cur);
  border: 3px solid #fff;
  box-shadow: 0 0 0 1.5px #000;
}
.qs-track:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
.qs-hex {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.qs-current {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.qs-hex input {
  width: 112px;
  padding: 7px 10px;
  font-family: monospace;
  font-size: 13px;
}
.qs-hex input[aria-invalid="true"] {
  border-color: var(--el-color-danger);
}
.qs-gamut,
.qs-note {
  font-size: 12.5px;
  color: var(--text-secondary);
}
.qs-note {
  margin-right: auto;
}
.qs-note.warn {
  color: var(--el-color-warning-dark-2);
}
.qs-depth {
  padding-top: 14px;
  border-top: 1px solid var(--border-default);
}
.qs-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
.qs-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 0;
  margin: 0;
  list-style: none;
  font-family: monospace;
  font-size: 11.5px;
  color: var(--text-secondary);
}
.qs-colors i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 1px solid var(--border-default);
  border-radius: 3px;
}
@media (max-width: 760px) {
  .qs-body {
    grid-template-columns: 1fr;
  }
  .qs-bar {
    grid-template-columns: 70px minmax(0, 1fr) 48px;
  }
}
</style>
