<script setup lang="ts">
import { computed, ref } from "vue";
import type { Maze, Point } from "./core/maze";

const props = defineProps<{ maze: Maze; visited: readonly Point[]; path: readonly Point[]; player: Point }>();
const emit = defineEmits<{ exit: [] }>();
const cell = 24;
const size = computed(() => props.maze.size * cell);
const pitch = ref(10);
const yaw = ref(-12);
const dragging = ref(false);
let gesture: { id: number; x: number; y: number; pitch: number; yaw: number } | null = null;
const clamp = (angle: number) => Math.max(-15, Math.min(15, angle));
const silhouette = computed(() => props.maze.cells.flatMap((row, r) => row.flatMap((value, c) =>
  value === 1 ? [`M${c * cell},${r * cell}h${cell}v${cell}h${-cell}Z`] : [])).join(" "));
const pathLine = computed(() => props.path.map(p => `${(p.col + .5) * cell},${(p.row + .5) * cell}`).join(" "));
const sheets = [
  { radius: 5, edge: 6, color: "#436e69", depth: 4 },
  { radius: 3.7, edge: 12, color: "#71978a", depth: 8 },
  { radius: 2.4, edge: 18, color: "#a4bbae", depth: 12 },
  { radius: 1.1, edge: 23, color: "#d2dbc8", depth: 16 },
  { radius: 0, edge: 36, color: "#f1efdf", depth: 20 },
];
function frame(edge: number) {
  const outer = size.value + 2 * edge;
  return `M${-edge},${-edge}h${outer}v${outer}h${-outer}Z M0,0v${size.value}h${size.value}v${-size.value}Z`;
}
function begin(event: PointerEvent) {
  if (event.button !== 0 || gesture) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch: pitch.value, yaw: yaw.value };
  dragging.value = true;
}
function drag(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId) return;
  yaw.value = clamp(gesture.yaw + (event.clientX - gesture.x) * .12);
  pitch.value = clamp(gesture.pitch - (event.clientY - gesture.y) * .12);
}
function end(event: PointerEvent) {
  if (gesture?.id !== event.pointerId) return;
  gesture = null;
  dragging.value = false;
  const element = event.currentTarget as HTMLElement;
  if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
}
function reset() { pitch.value = 0; yaw.value = 0; }
function onKey(event: KeyboardEvent) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Escape') emit('exit');
  else if (event.key === 'Home') reset();
  else if (event.key === 'ArrowUp') pitch.value = clamp(pitch.value + 3);
  else if (event.key === 'ArrowDown') pitch.value = clamp(pitch.value - 3);
  else if (event.key === 'ArrowLeft') yaw.value = clamp(yaw.value - 3);
  else yaw.value = clamp(yaw.value + 3);
}
</script>

<template>
  <div class="orbit-view">
    <div class="orbit-viewport" :class="{ dragging }" tabindex="0" role="region" aria-label="旋转观察迷宫：拖动或方向键旋转，Home 回正，Escape 返回操作" @pointerdown="begin" @pointermove="drag" @pointerup="end" @pointercancel="end" @lostpointercapture="end" @keydown="onKey">
      <div class="orbit-stack" :style="{ transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)` }">
        <svg class="orbit-sheet orbit-base" :viewBox="`-42 -42 ${size + 84} ${size + 84}`" aria-hidden="true">
          <rect x="-36" y="-36" :width="size + 72" :height="size + 72" rx="5" fill="#294f49"/>
        </svg>
        <svg class="orbit-sheet" :style="{ transform: `translateZ(${100 / (size + 84)}cqw)` }" :viewBox="`-42 -42 ${size + 84} ${size + 84}`" aria-hidden="true">
          <circle v-for="point in visited" :key="`${point.row},${point.col}`" :cx="(point.col + .5) * cell" :cy="(point.row + .5) * cell" r="2.4" class="visited"/>
          <polyline v-if="pathLine" :points="pathLine" class="path"/>
          <circle :cx="(maze.start.col + .5) * cell" :cy="(maze.start.row + .5) * cell" r="7" class="start"/>
          <rect :x="(maze.goal.col + .5) * cell - 5" :y="(maze.goal.row + .5) * cell - 5" width="10" height="10" rx="1" class="goal" :transform="`rotate(45 ${(maze.goal.col + .5) * cell} ${(maze.goal.row + .5) * cell})`"/>
          <circle :cx="(player.col + .5) * cell" :cy="(player.row + .5) * cell" r="4.8" class="player"/>
        </svg>
        <svg v-for="(sheet, index) in sheets" :key="index" class="orbit-sheet" :style="{ transform: `translateZ(${sheet.depth * 100 / (size + 84)}cqw)` }" :viewBox="`-42 -42 ${size + 84} ${size + 84}`" aria-hidden="true">
          <defs><filter :id="`orbit-cut-${index}`" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feMorphology operator="dilate" :radius="sheet.radius"/><feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#163b32" flood-opacity=".3"/></filter></defs>
          <path :d="`${frame(sheet.edge)} ${silhouette}`" fill-rule="evenodd" :fill="sheet.color" :filter="`url(#orbit-cut-${index})`"/>
        </svg>
      </div>
    </div>
    <div class="orbit-controls"><span>拖动观察</span><span class="orbit-angles">{{ Math.round(pitch) }}° / {{ Math.round(yaw) }}°</span><button @click="reset">回正</button><button @click="emit('exit')">返回操作</button></div>
  </div>
</template>

<style scoped>
.orbit-view { width: min(100%, 67vh); container-type: inline-size; }
.orbit-viewport { width: 100%; aspect-ratio: 1; perspective: 1100px; touch-action: none; cursor: grab; }
.orbit-viewport.dragging { cursor: grabbing; }
.orbit-viewport:focus-visible { outline: 1px solid #739b86; outline-offset: 10px; }
/* No filter, opacity or overflow on this ancestor: those flatten CSS 3D children. */
.orbit-stack { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .2s ease-out; }
.dragging .orbit-stack { transition: none; }
.orbit-sheet { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; backface-visibility: hidden; }
.orbit-base { filter: drop-shadow(10px 22px 18px #243d3544); }
.orbit-controls { display: flex; align-items: center; gap: 16px; color: var(--muted); font-size: 11px; padding-top: 22px; }
.orbit-controls button { font-size: 11px; }
.orbit-angles { margin-right: auto; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .orbit-view { width: min(100%, 65vh); } .orbit-controls { gap: 10px; } }
@media (prefers-reduced-motion: reduce) { .orbit-stack { transition: none; } }
</style>
