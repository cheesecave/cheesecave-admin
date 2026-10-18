<script setup>
/**
 * @typedef {Object} Props
 * @property {string} title - Card title
 * @property {number|string} value - Main value to display
 * @property {string} [subtitle] - Optional subtitle
 * @property {string} [icon] - Icon class (e.g., "i-carbon-user-multiple")
 * @property {string} [color] - Color theme (blue/purple/green/orange/cyan/pink)
 */

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: [Number, String],
    required: true,
  },
  subtitle: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "i-carbon-data-base",
  },
  color: {
    type: String,
    default: "blue",
    validator: (value) =>
      ["blue", "purple", "green", "orange", "cyan", "pink", "red"].includes(
        value,
      ),
  },
});

const colorClasses = {
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
  green: "from-green-500 to-green-600",
  orange: "from-orange-500 to-orange-600",
  cyan: "from-cyan-500 to-cyan-600",
  pink: "from-pink-500 to-pink-600",
  red: "from-red-500 to-red-600",
};
</script>

<template>
  <div class="stat-card" :class="colorClasses[color]">
    <div :class="icon" class="stat-icon text-5xl mb-3 opacity-80" />
    <div class="stat-value text-5xl font-bold mb-2">{{ value }}</div>
    <div class="stat-title text-lg mb-2">
      {{ title }}
    </div>
    <div class="stat-subtitle text-sm" :aria-hidden="!subtitle">
      {{ subtitle }}
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  container-type: inline-size;
  display: flex;
  min-width: 0;
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
  padding: 32px;
  border-radius: var(--admin-card-radius);
  color: white;
  background: linear-gradient(
    135deg,
    var(--tw-gradient-from),
    var(--tw-gradient-to)
  );
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  flex-shrink: 0;
}

.stat-value {
  font-size: clamp(2rem, 20cqi, 3rem);
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2lh;
  overflow-wrap: anywhere;
}

.stat-title,
.stat-subtitle {
  width: 100%;
  min-height: 2lh;
  flex-shrink: 0;
  overflow-wrap: anywhere;
}

/* Gradients are one step darker than the usual 500/600 pair so the white text reads (AA, 4.5:1). */
.from-blue-500 {
  --tw-gradient-from: #2563eb;
}
.to-blue-600 {
  --tw-gradient-to: #1d4ed8;
}

.from-purple-500 {
  --tw-gradient-from: #9333ea;
}
.to-purple-600 {
  --tw-gradient-to: #7e22ce;
}

.from-green-500 {
  --tw-gradient-from: #15803d;
}
.to-green-600 {
  --tw-gradient-to: #166534;
}

.from-orange-500 {
  --tw-gradient-from: #c2410c;
}
.to-orange-600 {
  --tw-gradient-to: #9a3412;
}

.from-cyan-500 {
  --tw-gradient-from: #0e7490;
}
.to-cyan-600 {
  --tw-gradient-to: #155e75;
}

.from-pink-500 {
  --tw-gradient-from: #be185d;
}
.to-pink-600 {
  --tw-gradient-to: #9d174d;
}

.from-red-500 {
  --tw-gradient-from: #b91c1c;
}
.to-red-600 {
  --tw-gradient-to: #991b1b;
}
</style>
