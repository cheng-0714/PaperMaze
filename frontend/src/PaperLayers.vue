<script setup lang="ts">
import { computed } from "vue";
import type { Maze } from "./core/maze";

const props = defineProps<{ maze: Maze; cell: number }>();
const size = computed(() => props.maze.size * props.cell);
// One silhouette per sheet: shadows follow the complete cutout, never individual tiles.
const silhouette = computed(() => props.maze.cells.flatMap((row, r) =>
  row.flatMap((value, c) => value === 1
    ? [`M${c * props.cell},${r * props.cell}h${props.cell}v${props.cell}h${-props.cell}Z`]
    : [])).join(" "));
const layers = [
  { radius: 3.4, color: "#bcc5c8" },
  { radius: 1.8, color: "#7691a6" },
];
</script>

<template>
  <defs>
    <pattern id="ink-hatching" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="#f4ead4" stroke-width=".5" opacity=".2"/></pattern>
    <path id="maze-cutout" :d="silhouette" />
    <clipPath id="paper-window"><rect :width="size" :height="size" rx="2"/></clipPath>
    <filter v-for="(layer, index) in layers" :id="`sheet-${index}`" :key="index" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology operator="dilate" :radius="layer.radius"/>
      <feDropShadow dx=".8" dy="1.4" stdDeviation=".6" flood-color="#243f59" flood-opacity=".22"/>
    </filter>
    <filter id="surface-shadow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feDropShadow dx=".6" dy="1" stdDeviation=".6" flood-color="#163c60" flood-opacity=".3"/>
    </filter>
    <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="9" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect x="-31" y="-28" :width="size + 66" :height="size + 66" fill="#c9bd9f"/>
  <rect x="-36" y="-36" :width="size + 72" :height="size + 72" fill="#f2ead8"/>
  <rect x="-25" y="-25" :width="size + 50" :height="size + 50" fill="none" stroke="#8c9caa" stroke-width=".8"/>
  <rect x="-19" y="-19" :width="size + 38" :height="size + 38" fill="none" stroke="#31597f" stroke-width="1.2"/>
  <path :d="`M-30-16v-14h14M${size + 16}-30h14v14M${size + 30},${size + 16}v14h-14M-16,${size + 30}h-14v-14`" fill="none" stroke="#31597f" stroke-width="1.1"/>
  <g clip-path="url(#paper-window)" aria-hidden="true">
    <rect :width="size" :height="size" fill="#eee5cf"/>
    <use v-for="(layer, index) in layers" :key="index" href="#maze-cutout" :fill="layer.color" :filter="`url(#sheet-${index})`"/>
    <use href="#maze-cutout" fill="#315b83" filter="url(#surface-shadow)"/>
    <use href="#maze-cutout" fill="url(#ink-hatching)"/>
  </g>
  <rect x="-36" y="-36" :width="size + 72" :height="size + 72" filter="url(#paper-grain)" opacity=".06" pointer-events="none" aria-hidden="true"/>
</template>
