<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createRun, listRuns, type Run } from "./api";
import { generateMaze, movePlayer, type Direction, type Point } from "./core/maze";

const newSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;
const maze = ref(generateMaze(21, newSeed()));
const player = ref<Point>(maze.value.start);
const manualPath = ref<Point[]>([maze.value.start]);
const startedAt = ref<number | null>(null);
const status = ref("使用方向键、WASD 或按钮开始探索");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const history = ref<Run[]>([]);

const cell = computed(() => 24);
const boardSize = computed(() => maze.value.size * cell.value);

function same(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

function regenerate() {
  maze.value = generateMaze(maze.value.size, newSeed());
  player.value = maze.value.start;
  manualPath.value = [maze.value.start];
  startedAt.value = null;
  saveState.value = "idle";
  status.value = "新迷宫已生成";
}

async function saveManualRun(elapsed: number) {
  saveState.value = "saving";
  const run: Run = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    mode: "manual",
    maze: maze.value,
    found: true,
    path: manualPath.value,
    visitedOrder: null,
    computeMs: null,
    manualElapsedMs: elapsed,
  };
  try {
    const saved = await createRun(run);
    history.value.unshift(saved);
    saveState.value = "saved";
  } catch (error) {
    saveState.value = "error";
    status.value = `已完成，但保存失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

function move(direction: Direction) {
  if (same(player.value, maze.value.goal)) return;
  const result = movePlayer(maze.value, player.value, direction);
  if (result.blocked) {
    status.value = result.blocked === "wall" ? "前方是墙" : "已经到达边界";
    return;
  }
  if (startedAt.value === null) startedAt.value = performance.now();
  player.value = result.position;
  manualPath.value = [...manualPath.value, result.position];
  status.value = "继续前进";
  if (same(result.position, maze.value.goal)) {
    const elapsed = performance.now() - startedAt.value!;
    status.value = `抵达终点，共 ${manualPath.value.length - 1} 步`;
    void saveManualRun(elapsed);
  }
}

const keyDirections: Record<string, Direction> = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  const direction = keyDirections[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  try {
    history.value = (await listRuns()).items;
  } catch {
    status.value = "历史记录暂时不可用，仍可继续探索";
  }
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="page-shell">
    <header>
      <p class="eyebrow">ALGORITHM STUDIO</p>
      <h1>PaperMaze <span>纸境寻路实验室</span></h1>
      <p class="intro">生成一座纸雕迷宫，亲自探索，再观察算法如何找到出口。</p>
    </header>

    <section class="workspace">
      <div class="board-card">
        <div class="board-toolbar">
          <div><strong>{{ maze.size }} × {{ maze.size }}</strong><small>种子 {{ maze.seed }}</small></div>
          <button type="button" @click="regenerate">生成新迷宫</button>
        </div>
        <svg class="maze" :viewBox="`0 0 ${boardSize} ${boardSize}`" role="img" aria-label="可操作的迷宫画布">
          <rect width="100%" height="100%" rx="12" class="board-base" />
          <template v-for="(row, rowIndex) in maze.cells" :key="rowIndex">
            <rect
              v-for="(value, colIndex) in row"
              v-show="value === 1"
              :key="colIndex"
              :x="colIndex * cell"
              :y="rowIndex * cell"
              :width="cell"
              :height="cell"
              class="wall"
            />
          </template>
          <circle :cx="(maze.start.col + 0.5) * cell" :cy="(maze.start.row + 0.5) * cell" :r="cell * 0.28" class="start" />
          <rect :x="(maze.goal.col + 0.24) * cell" :y="(maze.goal.row + 0.24) * cell" :width="cell * 0.52" :height="cell * 0.52" rx="3" class="goal" />
          <circle :cx="(player.col + 0.5) * cell" :cy="(player.row + 0.5) * cell" :r="cell * 0.2" class="player" />
        </svg>
        <p class="status" aria-live="polite">{{ status }} <span v-if="saveState !== 'idle'">· {{ { saving: "正在保存", saved: "已保存", error: "保存失败" }[saveState] }}</span></p>
      </div>

      <aside class="side-panel">
        <section class="panel">
          <p class="section-label">手动探索</p>
          <div class="dpad" aria-label="方向控制">
            <button class="up" aria-label="向上" @click="move('up')">↑</button>
            <button class="left" aria-label="向左" @click="move('left')">←</button>
            <button class="down" aria-label="向下" @click="move('down')">↓</button>
            <button class="right" aria-label="向右" @click="move('right')">→</button>
          </div>
          <div class="metrics"><span>当前步数</span><strong>{{ manualPath.length - 1 }}</strong></div>
        </section>
        <section class="panel history-panel">
          <p class="section-label">最近运行</p>
          <p v-if="history.length === 0" class="empty">完成一次探索后，记录会出现在这里。</p>
          <article v-for="run in history.slice(0, 6)" :key="run.id" class="history-row">
            <span>{{ run.mode === 'manual' ? '手动挑战' : run.mode.toUpperCase() }}</span>
            <strong>{{ run.pathLength ?? run.path.length - 1 }} 步</strong>
          </article>
        </section>
      </aside>
    </section>
  </main>
</template>
