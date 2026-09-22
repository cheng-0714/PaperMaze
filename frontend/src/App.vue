<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createRun, deleteRun, getRun, listRuns, type Run } from "./api";
import { applyEdit, generateMaze, movePlayer, parseChallengeCode, toChallengeCode, type Direction, type EditTool, type Point } from "./core/maze";
import { searchMaze, type SearchAlgorithm, type SearchResult } from "./core/search";
import { usePlayback } from "./usePlayback";

const newSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;
const selectedSize = ref<11 | 21 | 31>(21);
const seedInput = ref(newSeed());
const maze = ref(generateMaze(selectedSize.value, seedInput.value));
const player = ref<Point>(maze.value.start);
const manualPath = ref<Point[]>([maze.value.start]);
const startedAt = ref<number | null>(null);
const status = ref("使用方向键、WASD 或按钮开始探索");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const history = ref<Run[]>([]);
const historyFilter = ref<"all" | Run["mode"]>("all");
const pendingRun = ref<Run | null>(null);
const results = ref<Partial<Record<SearchAlgorithm, SearchResult>>>({});
const activeAlgorithm = ref<SearchAlgorithm | null>(null);
const editTool = ref<"move" | EditTool>("move");
const challengeInput = ref("");
const playback = usePlayback();
const cell = 24;

const boardSize = computed(() => maze.value.size * cell);
const challengeCode = computed(() => toChallengeCode(maze.value));
const pointKey = (point: Point) => `${point.row},${point.col}`;
const same = (a: Point, b: Point) => a.row === b.row && a.col === b.col;
const visibleVisited = computed(() => new Set(playback.visibleVisited.value.map(pointKey)));
const visiblePath = computed(() => new Set(playback.visiblePath.value.map(pointKey)));

function clearRunState(message: string) {
  playback.cancel(); results.value = {}; activeAlgorithm.value = null;
  player.value = maze.value.start; manualPath.value = [maze.value.start]; startedAt.value = null;
  saveState.value = "idle"; pendingRun.value = null; status.value = message;
}

function buildMaze(size = selectedSize.value, seed = seedInput.value) {
  try {
    maze.value = generateMaze(size, seed); selectedSize.value = size; seedInput.value = seed;
    editTool.value = "move"; clearRunState("新迷宫已生成");
  } catch (error) { status.value = error instanceof Error ? error.message : "参数无效"; }
}
function regenerate() { buildMaze(selectedSize.value, newSeed()); }
function loadChallenge() {
  const parsed = parseChallengeCode(challengeInput.value);
  if (!parsed) { status.value = "挑战码格式无效，例如 PM1-21-12345"; return; }
  buildMaze(parsed.size, parsed.seed); status.value = `已加载挑战 ${challengeInput.value.trim().toUpperCase()}`;
}
async function copyChallenge() { await navigator.clipboard.writeText(challengeCode.value); status.value = "挑战码已复制"; }

async function persist(run: Run) {
  pendingRun.value = run; saveState.value = "saving";
  try {
    const saved = await createRun(run);
    history.value = [saved, ...history.value.filter((item) => item.id !== saved.id)];
    saveState.value = "saved"; pendingRun.value = null;
  } catch (error) {
    saveState.value = "error";
    status.value = `运行完成，但保存失败：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

function move(direction: Direction) {
  if (editTool.value !== "move" || same(player.value, maze.value.goal)) return;
  const result = movePlayer(maze.value, player.value, direction);
  if (result.blocked) { status.value = result.blocked === "wall" ? "前方是墙" : "已经到达边界"; return; }
  if (startedAt.value === null) startedAt.value = performance.now();
  player.value = result.position; manualPath.value = [...manualPath.value, result.position]; status.value = "继续前进";
  if (same(result.position, maze.value.goal)) {
    const elapsed = performance.now() - startedAt.value!; status.value = `抵达终点，共 ${manualPath.value.length - 1} 步`;
    void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: "manual", maze: maze.value, found: true, path: manualPath.value, visitedOrder: null, computeMs: null, manualElapsedMs: elapsed });
  }
}

function runSearch(algorithm: SearchAlgorithm) {
  const result = searchMaze(maze.value, algorithm);
  results.value = { ...results.value, [algorithm]: result }; activeAlgorithm.value = algorithm; playback.play(result);
  status.value = result.found ? `${algorithm.toUpperCase()} 找到 ${result.path.length - 1} 步路径，访问 ${result.visitedOrder.length} 个节点` : `${algorithm.toUpperCase()} 已完成搜索：当前迷宫无可达路径`;
  void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: algorithm, maze: maze.value, found: result.found, path: result.path, visitedOrder: result.visitedOrder, computeMs: result.computeMs, manualElapsedMs: null });
}
function switchResult(algorithm: SearchAlgorithm) {
  const result = results.value[algorithm]; if (!result) return;
  activeAlgorithm.value = algorithm; playback.play(result);
}

function editBoard(event: MouseEvent) {
  if (editTool.value === "move") return;
  const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  const point = { row: Math.floor(((event.clientY - bounds.top) / bounds.height) * maze.value.size), col: Math.floor(((event.clientX - bounds.left) / bounds.width) * maze.value.size) };
  if (editTool.value === "wall" && same(point, player.value)) { status.value = "不能在玩家当前位置放置墙体"; return; }
  const edited = applyEdit(maze.value, editTool.value, point);
  if (edited.error) { status.value = edited.error === "border" ? "外边框必须保持封闭" : "起点与终点不能重合或被墙覆盖"; return; }
  maze.value = edited.maze; clearRunState("迷宫已编辑，旧搜索结果已清除");
}

async function refreshHistory() { history.value = (await listRuns(historyFilter.value === "all" ? undefined : historyFilter.value)).items; }
async function restoreRun(id: string) {
  const run = await getRun(id); maze.value = run.maze; selectedSize.value = run.maze.size as 11 | 21 | 31; seedInput.value = run.maze.seed;
  clearRunState("已恢复历史快照");
  if (run.mode !== "manual" && run.visitedOrder) {
    const result = { found: run.found, path: run.path, visitedOrder: run.visitedOrder, computeMs: run.computeMs ?? 0 };
    results.value = { [run.mode]: result }; activeAlgorithm.value = run.mode; playback.play(result);
  }
}
async function removeRun(id: string) { await deleteRun(id); history.value = history.value.filter((run) => run.id !== id); status.value = "历史记录已删除"; }

const keyDirections: Record<string, Direction> = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  const direction = keyDirections[event.key]; if (!direction) return; event.preventDefault(); move(direction);
}
onMounted(async () => { window.addEventListener("keydown", onKeydown); try { await refreshHistory(); } catch { status.value = "历史记录暂时不可用，仍可继续探索"; } });
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="page-shell">
    <header><p class="eyebrow">ALGORITHM STUDIO · 01</p><h1>PaperMaze <span>纸境寻路实验室</span></h1><p class="intro">亲自穿过纸雕迷宫，编辑障碍，再观察 BFS 与 A* 如何寻找出口。</p></header>
    <section class="setup panel" aria-label="迷宫设置">
      <label>尺寸<select v-model.number="selectedSize"><option :value="11">11 × 11</option><option :value="21">21 × 21</option><option :value="31">31 × 31</option></select></label>
      <label>随机种子<input v-model.number="seedInput" type="number" min="1" max="4294967295" /></label>
      <button type="button" @click="buildMaze()">按参数生成</button><button type="button" class="secondary" @click="regenerate">随机生成</button>
      <div class="challenge"><code>{{ challengeCode }}</code><button type="button" class="text-button" @click="copyChallenge">复制</button></div>
      <label class="challenge-load">载入挑战码<input v-model="challengeInput" placeholder="PM1-21-12345" @keyup.enter="loadChallenge" /></label><button type="button" class="secondary" @click="loadChallenge">载入</button>
    </section>

    <section class="workspace">
      <div class="board-card">
        <div class="board-toolbar"><div><strong>{{ maze.size }} × {{ maze.size }}</strong><small>种子 {{ maze.seed }}{{ maze.edited ? ' · 已编辑' : '' }}</small></div><div class="legend"><span><i class="dot start-dot"></i>起点</span><span><i class="dot goal-dot"></i>终点</span><span><i class="dot visited-dot"></i>访问</span><span><i class="dot path-dot"></i>路径</span></div></div>
        <svg class="maze" :class="{ editable: editTool !== 'move' }" :viewBox="`0 0 ${boardSize} ${boardSize}`" role="img" aria-label="可操作的迷宫画布" @click="editBoard">
          <rect width="100%" height="100%" rx="12" class="board-base" />
          <template v-for="(row, rowIndex) in maze.cells" :key="rowIndex"><template v-for="(value, colIndex) in row" :key="colIndex">
            <rect v-if="value === 0 && visibleVisited.has(`${rowIndex},${colIndex}`)" :x="colIndex * cell + 3" :y="rowIndex * cell + 3" :width="cell - 6" :height="cell - 6" rx="5" class="visited" />
            <rect v-if="value === 0 && visiblePath.has(`${rowIndex},${colIndex}`)" :x="colIndex * cell + 7" :y="rowIndex * cell + 7" :width="cell - 14" :height="cell - 14" rx="5" class="path" />
            <rect v-if="value === 1" :x="colIndex * cell" :y="rowIndex * cell + 2" :width="cell" :height="cell - 2" class="wall-shadow" /><rect v-if="value === 1" :x="colIndex * cell" :y="rowIndex * cell" :width="cell" :height="cell - 3" class="wall" />
          </template></template>
          <circle :cx="(maze.start.col + .5) * cell" :cy="(maze.start.row + .5) * cell" :r="cell * .28" class="start" /><rect :x="(maze.goal.col + .24) * cell" :y="(maze.goal.row + .24) * cell" :width="cell * .52" :height="cell * .52" rx="3" class="goal" /><circle :cx="(player.col + .5) * cell" :cy="(player.row + .5) * cell" :r="cell * .2" class="player" />
        </svg>
        <p class="status" aria-live="polite">{{ status }} <span v-if="saveState !== 'idle'">· {{ { saving: '正在保存', saved: '已保存', error: '保存失败' }[saveState] }}</span><button v-if="saveState === 'error' && pendingRun" class="inline-action" @click="persist(pendingRun)">重试</button></p>
      </div>

      <aside class="side-panel">
        <section class="panel"><p class="section-label">算法实验</p><div class="button-row"><button @click="runSearch('bfs')">运行 BFS</button><button @click="runSearch('astar')">运行 A*</button></div>
          <div class="result-grid"><button v-for="algorithm in (['bfs','astar'] as const)" :key="algorithm" class="result-card" :class="{ active: activeAlgorithm === algorithm }" :disabled="!results[algorithm]" @click="switchResult(algorithm)"><b>{{ algorithm.toUpperCase() }}</b><span>{{ results[algorithm]?.found === false ? '无解' : `${(results[algorithm]?.path.length ?? 1) - 1} 步` }}</span><small>{{ results[algorithm]?.visitedOrder.length ?? '—' }} 个访问节点 · {{ results[algorithm]?.computeMs.toFixed(2) ?? '—' }} ms</small></button></div>
          <div class="playback-controls"><button :disabled="!playback.total.value" @click="playback.play()">重放</button><button :disabled="!playback.playing.value" @click="playback.pause">暂停</button><label>速度<select v-model.number="playback.speed.value"><option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select></label></div>
        </section>
        <section class="panel"><p class="section-label">手动探索与编辑</p><div class="tool-row" role="toolbar" aria-label="迷宫编辑工具"><button v-for="tool in (['move','wall','passage','start','goal'] as const)" :key="tool" :class="{ active: editTool === tool }" :aria-pressed="editTool === tool" @click="editTool = tool">{{ { move:'移动', wall:'画墙', passage:'擦除', start:'起点', goal:'终点' }[tool] }}</button></div>
          <div class="dpad" aria-label="方向控制"><button class="up" aria-label="向上" @click="move('up')">↑</button><button class="left" aria-label="向左" @click="move('left')">←</button><button class="down" aria-label="向下" @click="move('down')">↓</button><button class="right" aria-label="向右" @click="move('right')">→</button></div><div class="metrics"><span>当前步数</span><strong>{{ manualPath.length - 1 }}</strong></div>
        </section>
      </aside>
    </section>

    <section class="panel history-panel"><div class="history-heading"><div><p class="section-label">实验档案</p><h2>运行历史</h2></div><label>筛选<select v-model="historyFilter" @change="refreshHistory"><option value="all">全部</option><option value="manual">手动</option><option value="bfs">BFS</option><option value="astar">A*</option></select></label></div>
      <p v-if="history.length === 0" class="empty">完成一次手动挑战或算法搜索后，记录会出现在这里。</p><div class="history-list"><article v-for="run in history" :key="run.id" class="history-row"><span class="mode-badge">{{ run.mode === 'manual' ? '手动' : run.mode.toUpperCase() }}</span><div><strong>{{ run.found ? `${run.pathLength ?? run.path.length - 1} 步` : '无解' }}</strong><small>{{ run.maze.size }}×{{ run.maze.size }} · seed {{ run.maze.seed }}<template v-if="run.visitedCount != null"> · {{ run.visitedCount }} 次访问</template></small></div><button class="secondary" @click="restoreRun(run.id)">恢复</button><button class="danger" aria-label="删除此运行" @click="removeRun(run.id)">删除</button></article></div>
    </section>
  </main>
</template>
