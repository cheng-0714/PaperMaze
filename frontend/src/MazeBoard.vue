<script setup lang="ts">
import { computed, ref } from "vue";
import type { Maze, Point } from "./core/maze";
import { pointKey } from "./core/maze";
import type { AstarTeachingState, BfsTeachingState, SearchAlgorithm, SearchResult } from "./core/search";
import type { GeneratorEdge, GeneratorPlaybackState } from "./core/generator";
import type { DistanceField } from "./core/analysis";
import PaperLayers from "./PaperLayers.vue";

const props = defineProps<{
  maze: Maze; player: Point; editable: boolean; showHeatmap: boolean; distanceField: DistanceField;
  results: Partial<Record<SearchAlgorithm, SearchResult>>; activeAlgorithm: SearchAlgorithm | null;
  visited: readonly Point[]; path: readonly Point[]; manualPath: readonly Point[];
  teaching: BfsTeachingState | null; astarTeaching: AstarTeachingState | null;
  generator: GeneratorPlaybackState | null;
}>();
defineEmits<{ edit: [event: MouseEvent]; keydown: [event: KeyboardEvent] }>();
const svg = ref<SVGSVGElement | null>(null);
const cell = 24;
const size = computed(() => props.maze.size * cell);
const line = (path: readonly Point[]) => path.map(p => `${(p.col + .5) * cell},${(p.row + .5) * cell}`).join(" ");
const edgeLine = (edge: GeneratorEdge) => line([edge.from, edge.to]);
const heatCells = computed(() => props.showHeatmap ? props.distanceField.flatMap((row, r) => row.flatMap((distance, c) => distance === null ? [] : [{ row: r, col: c, distance }])) : []);
const maxDistance = computed(() => Math.max(1, ...heatCells.value.map(p => p.distance)));
const layers = computed(() => (["bfs", "astar"] as const).flatMap(algorithm => {
  const result = props.results[algorithm];
  if (!result) return [];
  return [{ algorithm, visited: props.activeAlgorithm === algorithm ? props.visited : result.visitedOrder, path: props.activeAlgorithm === algorithm ? props.path : result.path }];
}));
const displayedMaze = computed<Maze>(() => {
  if (!props.generator || props.generator.completed) return props.maze;
  const cells = props.maze.cells.map(row => row.map(() => 1 as 0 | 1));
  for (const edge of props.generator.carvedEdges) for (const point of [edge.from, edge.to, edge.wall]) cells[point.row]![point.col] = 0;
  cells[props.maze.start.row]![props.maze.start.col] = 0;
  cells[props.maze.goal.row]![props.maze.goal.col] = 0;
  return { ...props.maze, cells };
});
defineExpose({ focus: () => svg.value?.focus({ preventScroll: true }) });
</script>

<template>
  <svg ref="svg" class="maze" :class="{ editable }" :viewBox="`-42 -42 ${size + 84} ${size + 84}`" role="img" aria-label="地宫舆图，聚焦后以方向键或 WASD 移步" tabindex="0" @keydown="$emit('keydown', $event)" @click="svg?.focus({ preventScroll: true }); $emit('edit', $event)">
    <PaperLayers :maze="displayedMaze" :cell="cell" />
    <g pointer-events="none">
      <g v-if="showHeatmap">
        <rect v-for="point in heatCells" :key="pointKey(point)" :x="point.col * cell + 1" :y="point.row * cell + 1" :width="cell - 2" :height="cell - 2" :fill="`hsl(${38 - point.distance / maxDistance * 22} 52% ${75 - point.distance / maxDistance * 28}%)`" opacity=".65" />
      </g>
      <g v-if="generator">
        <polyline v-for="edge in generator.frontier" :key="edgeLine(edge)" :points="edgeLine(edge)" class="generator-frontier" />
        <circle v-if="generator.current" :cx="(generator.current.col + .5) * cell" :cy="(generator.current.row + .5) * cell" r="5" class="teaching-current" />
      </g>
      <g v-for="layer in layers" :key="layer.algorithm">
        <circle v-for="point in layer.visited" :key="pointKey(point)" :cx="(point.col + (layer.algorithm === 'bfs' ? .4 : .6)) * cell" :cy="(point.row + .5) * cell" r="2.6" :class="`visited-${layer.algorithm}`" />
        <polyline v-if="layer.path.length > 1" :points="line(layer.path)" :class="`path-${layer.algorithm}`" />
      </g>
      <g v-if="teaching">
        <circle v-for="point in teaching.visited" :key="pointKey(point)" :cx="(point.col + .5) * cell" :cy="(point.row + .5) * cell" r="3" class="visited-bfs" />
        <polyline :points="line(teaching.path)" class="path-bfs" />
        <circle v-if="teaching.current" :cx="(teaching.current.col + .5) * cell" :cy="(teaching.current.row + .5) * cell" r="5" class="teaching-current" />
      </g>
      <g v-if="astarTeaching">
        <circle v-for="point in astarTeaching.visited" :key="pointKey(point)" :cx="(point.col + .5) * cell" :cy="(point.row + .5) * cell" r="3" class="visited-astar" />
        <polyline :points="line(astarTeaching.path)" class="path-astar" />
        <circle v-if="astarTeaching.current" :cx="(astarTeaching.current.point.col + .5) * cell" :cy="(astarTeaching.current.point.row + .5) * cell" r="5" class="teaching-current" />
      </g>
      <polyline v-if="!layers.length && !teaching && !astarTeaching" :points="line(manualPath.length > 1 ? manualPath : path)" class="manual-path" />
      <circle :cx="(maze.start.col + .5) * cell" :cy="(maze.start.row + .5) * cell" r="6.5" class="start" />
      <path :d="`M${(maze.goal.col + .5) * cell} ${maze.goal.row * cell + 4}l8 8-8 8-8-8Z`" class="goal" />
      <circle :cx="(player.col + .5) * cell" :cy="(player.row + .5) * cell" r="4.6" class="player" />
    </g>
  </svg>
</template>
