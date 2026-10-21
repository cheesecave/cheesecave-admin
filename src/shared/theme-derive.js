// Derives the six site theme colors from one main color, in OKLCH.
// The rules were fitted on 13 real light and dark themes (see cheesecave-admin#23).
const rgb = (hex) =>
  hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
const toLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const isHex = (value) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

function toOklab(hex) {
  const [r, g, b] = rgb(hex).map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex) {
  const [L, a, b] = toOklab(hex);
  return {
    L,
    C: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
}

const inGamut = (channels) =>
  channels.every((c) => c >= -0.0005 && c <= 1.0005);

// The most vivid chroma the screen can show at this lightness and hue.
export function maxChroma(L, h) {
  let low = 0;
  let high = 0.4;
  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut(fromOklch(L, mid, h))) low = mid;
    else high = mid;
  }
  return low;
}

export function oklchToHex(L, C, h) {
  const channels = fromOklch(L, Math.min(C, maxChroma(L, h)), h);
  return `#${channels
    .map((c) =>
      Math.round(clamp(toGamma(clamp(c, 0, 1)), 0, 1) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Distance in OKLab: about 0.02 is barely visible, 0.05 is clearly different.
export function colorDistance(first, second) {
  const a = toOklab(first);
  const b = toOklab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const RECOMMENDED_COLORS = Object.freeze([
  ["Blue", "#2563eb"],
  ["Indigo", "#4f46e5"],
  ["Violet", "#7c3aed"],
  ["Purple", "#9333ea"],
  ["Fuchsia", "#c026d3"],
  ["Pink", "#db2777"],
  ["Rose", "#e11d48"],
  ["Red", "#dc2626"],
  ["Orange", "#ea580c"],
  ["Amber", "#d97706"],
  ["Yellow", "#ca8a04"],
  ["Lime", "#65a30d"],
  ["Green", "#16a34a"],
  ["Teal", "#0d9488"],
  ["Cyan", "#0891b2"],
  ["Slate", "#475569"],
]);

// The dark page runs from lightness 0.23 (depth 0, soft) to 0.16 (depth 1, deep).
const darkPageLightness = (depth) => 0.23 - depth * 0.07;

export function deriveTheme(primary, depth) {
  const { L, C, h } = hexToOklch(primary);
  const page = darkPageLightness(depth);
  return {
    primary_light: primary,
    background_light: oklchToHex(0.96, 0.006, h),
    card_light: "#ffffff",
    primary_dark: oklchToHex(Math.max(L, 0.68), C, h),
    background_dark: oklchToHex(page, 0.01, h),
    card_dark: oklchToHex(page + 0.05, 0.012, h),
  };
}

// The 0-100 slider position that best explains a saved dark page color.
export const darkDepthOf = (background) =>
  Math.round(clamp((0.23 - hexToOklch(background).L) / 0.07, 0, 1) * 100);
