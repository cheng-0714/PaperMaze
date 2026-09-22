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
  { radius: 5, color: "#436e69" },
  { radius: 3.7, color: "#71978a" },
  { radius: 2.4, color: "#a4bbae" },
  { radius: 1.1, color: "#d2dbc8" },
];
</script>

<template>
  <defs>
    <linearGradient id="paper-floor" x2=".8" y2="1"><stop stop-color="#173e40"/><stop offset="1" stop-color="#376660"/></linearGradient>
    <linearGradient id="paper-surface" x2=".7" y2="1"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#e9e6d5"/></linearGradient>
    <path id="maze-cutout" :d="silhouette" />
    <clipPath id="paper-window"><rect :width="size" :height="size" rx="2"/></clipPath>
    <filter v-for="(layer, index) in layers" :id="`sheet-${index}`" :key="index" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology operator="dilate" :radius="layer.radius"/>
      <feDropShadow dx="1.2" dy="2" stdDeviation="1.1" flood-color="#142f2c" flood-opacity=".32"/>
    </filter>
    <filter id="surface-shadow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.4" flood-color="#183b35" flood-opacity=".38"/>
    </filter>
    <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="9" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect x="-32" y="-28" :width="size + 66" :height="size + 66" rx="6" fill="#b8baa9"/>
  <rect x="-36" y="-36" :width="size + 72" :height="size + 72" rx="6" fill="url(#paper-surface)"/>
  <rect x="-23" y="-23" :width="size + 46" :height="size + 46" rx="3" fill="#c8ceba"/>
  <rect x="-18" y="-18" :width="size + 36" :height="size + 36" rx="2" fill="#9bb3a4"/>
  <rect x="-12" y="-12" :width="size + 24" :height="size + 24" fill="#60897d"/>
  <rect x="-6" y="-6" :width="size + 12" :height="size + 12" fill="#365f58"/>
  <g clip-path="url(#paper-window)" aria-hidden="true">
    <rect :width="size" :height="size" fill="url(#paper-floor)"/>
    <use v-for="(layer, index) in layers" :key="index" href="#maze-cutout" :fill="layer.color" :filter="`url(#sheet-${index})`"/>
    <use href="#maze-cutout" fill="url(#paper-surface)" filter="url(#surface-shadow)"/>
  </g>
  <rect x="-36" y="-36" :width="size + 72" :height="size + 72" rx="6" filter="url(#paper-grain)" opacity=".055" pointer-events="none" aria-hidden="true"/>
</template>
