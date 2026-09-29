<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createRun, deleteRun, getRun, listRuns, type Run, type RunSummary } from "./api";
import { SUPPORTED_SIZES, type MazeSize, applyEdit, generateMaze, movePlayer, parseChallengeCode, pointKey, samePoint as same, toChallengeCode, type Direction, type EditTool, type Point } from "./core/maze";
import { searchMaze, validatePath, type SearchAlgorithm, type SearchResult } from "./core/search";
import PaperLayers from "./PaperLayers.vue";
import { usePlayback } from "./usePlayback";

const newSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;
const selectedSize = ref<MazeSize>(21);
const showSettings = ref(false);
const showHistory = ref(false);
const seedInput = ref(newSeed());
const maze = ref(generateMaze(selectedSize.value, seedInput.value));
const player = ref<Point>(maze.value.start);
const manualPath = ref<Point[]>([maze.value.start]);
const manualElapsedMs = ref<number | null>(null);
const startedAt = ref<number | null>(null);
const status = ref("点击迷宫，方向键移动");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const history = ref<RunSummary[]>([]);
const historyFilter = ref<"all" | Run["mode"]>("all");
const pendingRun = ref<Run | null>(null);
const results = ref<Partial<Record<SearchAlgorithm, SearchResult>>>({});
const activeAlgorithm = ref<SearchAlgorithm | null>(null);
const editTool = ref<"move" | EditTool>("move");
const challengeInput = ref("");
const playback = usePlayback();
const mazeElement = ref<SVGSVGElement | null>(null);
const cell = 24;

const boardSize = computed(() => maze.value.size * cell);
const challengeCode = computed(() => toChallengeCode(maze.value));
const pathLine = computed(() => playback.visiblePath.value.map(p => `${(p.col + .5) * cell},${(p.row + .5) * cell}`).join(" "));
const playbackBusy = computed(() => playback.total.value > 0 && playback.cursor.value < playback.total.value);

function clearRunState(message: string) {
  playback.cancel(); results.value = {}; activeAlgorithm.value = null;
  player.value = maze.value.start; manualPath.value = [maze.value.start]; startedAt.value = null; manualElapsedMs.value = null;
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
  const retrying = saveState.value === "error";
  pendingRun.value = run; saveState.value = "saving";
  try {
    const saved = await createRun(run);
    await refreshHistory();
    saveState.value = "saved"; pendingRun.value = null;
    if (retrying) status.value = "运行结果已重新保存";
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
    const elapsed = performance.now() - startedAt.value!; manualElapsedMs.value = elapsed; status.value = `抵达终点，共 ${manualPath.value.length - 1} 步，用时 ${(elapsed / 1000).toFixed(1)} 秒`;
    void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: "manual", maze: maze.value, found: true, path: manualPath.value, visitedOrder: null, computeMs: null, manualElapsedMs: elapsed });
  }
}

function runSearch(algorithm: SearchAlgorithm) {
  if (playbackBusy.value) return;
  const result = searchMaze(maze.value, algorithm);
  if (result.found && !validatePath(maze.value, result.path)) {
    status.value = `${algorithm.toUpperCase()} 返回了非法路径，结果未保存`;
    return;
  }
  results.value = { ...results.value, [algorithm]: result }; activeAlgorithm.value = algorithm; playback.play(result);
  status.value = result.found ? `${algorithm === "astar" ? "A*" : "BFS"} 搜索完成` : "当前迷宫无解";
  void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: algorithm, maze: maze.value, found: result.found, path: result.path, visitedOrder: result.visitedOrder, computeMs: result.computeMs, manualElapsedMs: null });
}
function switchResult(algorithm: SearchAlgorithm) {
  const result = results.value[algorithm]; if (!result) return;
  activeAlgorithm.value = algorithm; playback.play(result);
}

function editBoard(event: MouseEvent) {
  if (editTool.value === "move" || playbackBusy.value) return;
  const svg = event.currentTarget as SVGSVGElement;
  const matrix = svg.getScreenCTM();
  if (!matrix) { status.value = "暂时无法定位点击位置"; return; }
  const cursor = svg.createSVGPoint();
  cursor.x = event.clientX; cursor.y = event.clientY;
  const logical = cursor.matrixTransform(matrix.inverse());
  const point = { row: Math.floor(logical.y / cell), col: Math.floor(logical.x / cell) };
  if (editTool.value === "wall" && same(point, player.value)) { status.value = "不能在玩家当前位置放置墙体"; return; }
  const edited = applyEdit(maze.value, editTool.value, point);
  if (edited.error) { status.value = edited.error === "border" ? "外边框必须保持封闭" : edited.error === "wall" ? "起点和终点只能放在通路格" : "起点与终点不能重合或被墙覆盖"; return; }
  maze.value = edited.maze; clearRunState("已编辑");
}

async function refreshHistory() { history.value = (await listRuns(historyFilter.value === "all" ? undefined : historyFilter.value)).items; }
async function restoreRun(id: string) {
  const run = await getRun(id);
  showHistory.value = false; maze.value = run.maze; selectedSize.value = run.maze.size as MazeSize; seedInput.value = run.maze.seed;
  clearRunState("已恢复历史快照");
  if (run.mode !== "manual" && run.visitedOrder) {
    const result = { found: run.found, path: run.path, visitedOrder: run.visitedOrder, computeMs: run.computeMs ?? 0 };
    results.value = { [run.mode]: result }; activeAlgorithm.value = run.mode; playback.play(result);
  } else if (run.mode === "manual") {
    manualPath.value = run.path;
    player.value = run.path[run.path.length - 1] ?? run.maze.start;
    manualElapsedMs.value = run.manualElapsedMs;
    playback.play({ found: true, path: run.path, visitedOrder: [], computeMs: 0 });
    status.value = `已恢复手动挑战：${run.path.length - 1} 步，用时 ${((run.manualElapsedMs ?? 0) / 1000).toFixed(1)} 秒`;
  }
}
async function removeRun(id: string) { await deleteRun(id); history.value = history.value.filter((run) => run.id !== id); status.value = "历史记录已删除"; }

const keyDirections: Record<string, Direction> = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  const direction = keyDirections[event.key]; if (!direction) return; event.preventDefault(); move(direction);
}
onMounted(async () => { try { await refreshHistory(); } catch { status.value = "历史暂不可用"; } });
</script>

<template>
  <main class="page-shell">
    <header class="site-header">
      <h1>PaperMaze<span>纸境</span></h1>
      <nav aria-label="工作台"><button :aria-expanded="showSettings" @click="showSettings = !showSettings">设置</button><button :aria-expanded="showHistory" @click="showHistory = !showHistory">历史 <span class="count">{{ history.length }}</span></button></nav>
    </header>

    <section v-if="showSettings" class="settings" aria-label="迷宫设置">
      <label>尺寸<select v-model.number="selectedSize"><option v-for="size in SUPPORTED_SIZES" :key="size" :value="size">{{ size }} × {{ size }}</option></select></label>
      <label>种子<input v-model.number="seedInput" type="number" min="1" max="4294967295" /></label>
      <button @click="buildMaze()">生成</button>
      <div class="challenge"><code>{{ challengeCode }}</code><button @click="copyChallenge">复制</button><small v-if="maze.edited">仅复现原始地图</small></div>
      <label>挑战码<input v-model="challengeInput" placeholder="PM1-21-12345" @keyup.enter="loadChallenge" /></label><button @click="loadChallenge">载入</button>
    </section>

    <section v-if="showHistory" class="history-panel" aria-label="运行历史">
      <div class="history-heading"><h2>历史</h2><select v-model="historyFilter" aria-label="筛选历史" @change="refreshHistory"><option value="all">全部</option><option value="manual">手动</option><option value="bfs">BFS</option><option value="astar">A*</option></select></div>
      <p v-if="history.length === 0" class="empty">暂无记录</p>
      <article v-for="run in history" :key="run.id" class="history-row"><span>{{ run.mode === 'manual' ? '手动' : run.mode === 'astar' ? 'A*' : 'BFS' }}</span><div><strong>{{ run.found ? `${run.pathLength ?? 0} 步` : '无解' }}</strong><small>{{ run.mazeSize }} × {{ run.mazeSize }} · {{ run.seed }}</small></div><button @click="restoreRun(run.id)">恢复</button><button class="danger" aria-label="删除此运行" @click="removeRun(run.id)">删除</button></article>
    </section>

    <section class="workspace">
      <div class="board-card">
        <div class="board-toolbar"><span>{{ maze.size }} × {{ maze.size }}<small v-if="maze.edited">已编辑</small></span><button @click="regenerate">换一座迷宫 ↗</button></div>
        <div class="paper-stage">
          <svg ref="mazeElement" class="maze" :class="{ editable: editTool !== 'move' }" :viewBox="`-42 -42 ${boardSize + 84} ${boardSize + 84}`" role="img" aria-label="纸雕迷宫，聚焦后可用方向键或 WASD 移动" tabindex="0" @keydown="onKeydown" @click="editBoard">
            <PaperLayers :maze="maze" :cell="cell" />
            <g class="trace" pointer-events="none">
              <circle v-for="point in playback.visibleVisited.value" :key="pointKey(point)" :cx="(point.col + .5) * cell" :cy="(point.row + .5) * cell" r="2.4" class="visited"/>
              <polyline v-if="pathLine" :points="pathLine" class="path"/>
              <circle :cx="(maze.start.col + .5) * cell" :cy="(maze.start.row + .5) * cell" r="7" class="start"/>
              <rect :x="(maze.goal.col + .5) * cell - 5" :y="(maze.goal.row + .5) * cell - 5" width="10" height="10" rx="1" class="goal" :transform="`rotate(45 ${(maze.goal.col + .5) * cell} ${(maze.goal.row + .5) * cell})`"/>
              <circle :cx="(player.col + .5) * cell" :cy="(player.row + .5) * cell" r="4.8" class="player"/>
            </g>
          </svg>
        </div>
        <div class="board-footer"><p class="status" aria-live="polite">{{ status }}<span v-if="saveState !== 'idle'" class="save-status">{{ { saving: '保存中', saved: '已保存', error: '未保存' }[saveState] }}</span><button v-if="saveState === 'error' && pendingRun" @click="persist(pendingRun)">重试</button></p><span class="key-hint">↑ ↓ ← →</span></div>
      </div>

      <aside class="side-panel">
        <section class="control-section">
          <h2>寻路</h2>
          <div class="button-row"><button class="primary" :disabled="playbackBusy" @click="runSearch('bfs')">BFS<span aria-hidden="true">↗</span></button><button class="primary" :disabled="playbackBusy" @click="runSearch('astar')">A*<span aria-hidden="true">↗</span></button></div>
          <div v-if="results.bfs || results.astar" class="result-list">
            <button v-for="algorithm in (['bfs','astar'] as const)" :key="algorithm" class="result-row" :class="{ active: activeAlgorithm === algorithm }" :disabled="!results[algorithm]" @click="switchResult(algorithm)">
              <b>{{ algorithm === 'astar' ? 'A*' : 'BFS' }}</b><span>{{ !results[algorithm] ? '未运行' : results[algorithm]?.found === false ? '无解' : `${results[algorithm]!.path.length - 1} 步` }}</span><small v-if="results[algorithm]">{{ results[algorithm]!.visitedOrder.length }} 访问<br>{{ results[algorithm]!.computeMs.toFixed(2) }} ms</small>
            </button>
          </div>
          <div v-if="playback.total.value" class="playback-controls"><button @click="playback.play()">{{ playbackBusy && !playback.playing.value ? '继续' : '重放' }}</button><button :disabled="!playback.playing.value" @click="playback.pause">暂停</button><label class="speed-control"><input v-model.number="playback.speed.value" type="range" min="0.5" max="5" step="0.5" aria-label="播放速度" :aria-valuetext="`${playback.speed.value} 倍速`" /><output>{{ playback.speed.value }}×</output></label></div>
        </section>
        <section class="control-section">
          <h2>探索</h2>
          <div class="tool-row" role="toolbar" aria-label="迷宫编辑工具"><button v-for="tool in (['move','wall','passage','start','goal'] as const)" :key="tool" :disabled="playbackBusy" :class="{ active: editTool === tool }" :aria-pressed="editTool === tool" @click="editTool = tool">{{ { move:'移动', wall:'画墙', passage:'擦除', start:'起点', goal:'终点' }[tool] }}</button></div>
          <div class="manual-controls"><div class="dpad" aria-label="方向控制"><button class="up" aria-label="向上" @click="move('up')">↑</button><button class="left" aria-label="向左" @click="move('left')">←</button><button class="down" aria-label="向下" @click="move('down')">↓</button><button class="right" aria-label="向右" @click="move('right')">→</button></div><div class="manual-metrics"><strong>{{ manualPath.length - 1 }}<small> 步</small></strong><span v-if="manualElapsedMs !== null">{{ (manualElapsedMs / 1000).toFixed(1) }} s</span></div></div>
        </section>
        <details class="help"><summary>操作说明</summary><p>点击地图后，用方向键或 WASD 移动。选择编辑工具，再点击对应格子。</p><div class="legend"><span>○ 起点</span><span>◆ 终点</span><span>● 玩家</span></div><p>点为访问轨迹，线为最终路径。耗时仅计算搜索，不含播放与保存。</p></details>
      </aside>
    </section>


  </main>
</template>
