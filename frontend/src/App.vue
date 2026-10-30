<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createRun, deleteRun, getRun, listRuns, type Run, type RunSummary } from "./api";
import { SUPPORTED_SIZES, type MazeSize, applyEdit, generateMaze, movePlayer, parseChallengeCode, pointKey, samePoint as same, toChallengeCode, type Direction, type EditTool, type Point } from "./core/maze";
import { searchMaze, buildAstarTeachingTrace, buildBfsTeachingTrace, replayAstarTeaching, replayBfsTeaching, validatePath, type AstarTeachingEvent, type AstarTeachingTrace, type BfsTeachingTrace, type SearchAlgorithm, type SearchResult, type SearchTeachingEvent } from "./core/search";
import { generateMazeWithTrace, replayGeneratorTrace, type GeneratorAlgorithm, type GeneratorEvent, type MazeGeneratorResult } from "./core/generator";
import { analyzeMaze, manualMetrics } from "./core/analysis";
import MazeBoard from "./MazeBoard.vue";
import { scenes } from "./scenes";
import { usePlayback } from "./usePlayback";
import { useTeachingPlayback } from "./useTeachingPlayback";

const newSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;
const selectedSize = ref<MazeSize>(21);
const utilityDialog = ref<HTMLDialogElement | null>(null);
const endingDialog = ref<HTMLDialogElement | null>(null);
const utilityPanel = ref<"settings" | "history" | "generator" | null>(null);
const workspaceMode = ref<"explore" | "search" | "learn">("search");
const sceneIndex = ref(0);
const scene = computed(() => scenes[sceneIndex.value]!);
const completedScenes = ref<string[]>([]);
const sceneTransitioning = ref(false);
let sceneTimer = 0;
let revealObserver: IntersectionObserver | undefined;
const showGeneratorLab = ref(false);
const seedInput = ref(newSeed());
const maze = ref(generateMaze(selectedSize.value, seedInput.value));
const player = ref<Point>(maze.value.start);
const manualPath = ref<Point[]>([maze.value.start]);
const manualElapsedMs = ref<number | null>(null);
const collisionCount = ref<number | null>(0);
const wallCollisionCount = ref<number | null>(0);
const boundaryCollisionCount = ref<number | null>(0);
const manualCompleted = ref(false);
const startedAt = ref<number | null>(null);
const status = ref("步入石阵，以方向键移步");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const history = ref<RunSummary[]>([]);
const historyError = ref("");
const restoringId = ref<string | null>(null);
const historyFilter = ref<"all" | Run["mode"]>("all");
const pendingRun = ref<Run | null>(null);
const results = ref<Partial<Record<SearchAlgorithm, SearchResult>>>({});
const activeAlgorithm = ref<SearchAlgorithm | null>(null);
const editTool = ref<"move" | EditTool>("move");
const challengeInput = ref("");
const playback = usePlayback();
const teachingPlayback = useTeachingPlayback<SearchTeachingEvent | AstarTeachingEvent>();
const generatorPlayback = useTeachingPlayback<GeneratorEvent>();
const teachingTrace = ref<BfsTeachingTrace | null>(null);
const astarTeachingTrace = ref<AstarTeachingTrace | null>(null);
const generatorAlgorithm = ref<GeneratorAlgorithm>("dfs");
const generatorResult = ref<MazeGeneratorResult | null>(null);
const generatorComparisons = ref<ReadonlyArray<MazeGeneratorResult>>([]);
const mazeElement = ref<InstanceType<typeof MazeBoard> | null>(null);
const cell = 24;
const showHeatmap = ref(false);
const aiText = ref("");
const aiSource = ref<"local" | "deepseek" | "">("");
const aiLoading = ref(false);
const aiError = ref("");

const challengeCode = computed(() => toChallengeCode(maze.value));
const playbackBusy = computed(() => playback.total.value > 0 && playback.cursor.value < playback.total.value);
const structure = computed(() => analyzeMaze(maze.value));
const challengeMetrics = computed(() => { const metrics = manualMetrics(manualPath.value, structure.value.shortestPathLength, structure.value.reachablePassages, collisionCount.value ?? 0, manualElapsedMs.value); return manualCompleted.value ? metrics : { ...metrics, detourRate: null, efficiency: null, badge: "仍在途中" }; });
const teachingState = computed(() => teachingTrace.value ? replayBfsTeaching(teachingTrace.value.events, teachingPlayback.cursor.value) : null);
const astarTeachingState = computed(() => astarTeachingTrace.value ? replayAstarTeaching(astarTeachingTrace.value.events, teachingPlayback.cursor.value) : null);
const teachingBusy = computed(() => teachingTrace.value !== null || astarTeachingTrace.value !== null);
const teachingMessage = computed(() => {
  const event = teachingPlayback.visible.value[teachingPlayback.visible.value.length - 1];
  if (!event) return "石阵静默，准备自起点展开探查";
  if ("candidate" in event) return "A* 教学状态";
  if (event.type === "start") return "起点燃起火把，推入探查队列";
  if (event.type === "dequeue") return `探查队首石室：(${event.point.row}, ${event.point.col})`;
  if (event.type === "discover" && "distance" in event) return `探明相邻通路，距起点已走 ${event.distance} 步，排入队列候探`;
  if (event.type === "inspect") {
    if (event.outcome === "queued" || event.outcome === "relax") return "A* 教学状态";
    const labels: Record<"boundary" | "wall" | "visited" | "discover", string> = { boundary: "外围高墙阻隔", wall: "触及坚固石壁", visited: "石室早有刻痕，略过", discover: "暗门畅通，纳入前锋" };
    return `查探 (${event.to.row}, ${event.to.col})：${labels[event.outcome]}`;
  }
  if (event.type === "finish") return event.found ? "终点铜门洞开！循石板刻痕逆溯生路" : "暗巷探尽皆无通途，此阵死局";
  return "BFS 探查状态";
});
const astarTeachingMessage = computed(() => {
  const event = teachingPlayback.visible.value[teachingPlayback.visible.value.length - 1];
  if (!event) return "备妥星图罗盘，起点置入优先队列";
  if ("point" in event) return "BFS 教学状态";
  if (event.type === "start") return `起点入列：综合预估代价 f = ${event.candidate.f}`;
  if (event.type === "select") return `挑选中意石室（最小 f）：已踏过 g=${event.candidate.g}，遥测引力 h=${event.candidate.h}，总计 f=${event.candidate.f}`;
  if (event.type === "discover" && "candidate" in event) return `探得新岔路：已步入 g=${event.candidate.g}，终点估距 h=${event.candidate.h}，综合代价 f=${event.candidate.f}`;
  if (event.type === "relax") return `寻得更近捷径：修正为已行 g=${event.candidate.g}，总代价降至 f=${event.candidate.f}`;
  if (event.type === "inspect") {
    if (event.outcome === "visited") return "BFS 教学状态";
    const labels: Record<"boundary" | "wall" | "queued" | "discover" | "relax", string> = { boundary: "外围高墙阻隔", wall: "厚重石墙堵截", queued: "此前已有同等或更近捷径，略过", discover: "纳入优先星盘候探", relax: "修正出更近通路" };
    return `查探 (${event.to.row}, ${event.to.col})：${labels[event.outcome]}`;
  }
  if (event.type === "finish") return event.found ? "终点符印亮起！依最优步数逆推生门" : "候探星盘已空，迷雾深处无路可通";
  return "A* 探查状态";
});
const teachingStats = computed(() => {
  const events = teachingTrace.value?.events ?? astarTeachingTrace.value?.events ?? [];
  if (!events.length) return null;
  let frontier = 0;
  let maxFrontier = 0;
  for (const event of events) {
    if (event.type === "start") frontier += 1;
    if (event.type === "dequeue" || event.type === "select") frontier = Math.max(0, frontier - 1);
    if (event.type === "discover") frontier += 1;
    maxFrontier = Math.max(maxFrontier, frontier);
  }
  return { eventCount: events.length, maxFrontier, completed: teachingPlayback.cursor.value >= events.length };
});
const generatorState = computed(() => generatorResult.value ? replayGeneratorTrace(generatorResult.value.events, generatorPlayback.cursor.value) : null);
const generatorBusy = computed(() => generatorPlayback.total.value > 0 && generatorPlayback.cursor.value < generatorPlayback.total.value);
const generatorInvariant = computed(() => generatorResult.value ? generatorResult.value.metrics.componentCount === 1 && generatorResult.value.metrics.carvedEdgeCount === generatorResult.value.metrics.logicalCellCount - 1 && generatorResult.value.metrics.cycleRank === 0 : false);
const generatorMessage = computed(() => {
  const event = generatorPlayback.visible.value[generatorPlayback.visible.value.length - 1];
  if (!event) return "准备构筑地宫回廊";
  if (event.type === "start") return `${event.algorithm.toUpperCase()}：开辟 ${event.logicalCellCount} 间石室`;
  if (event.type === "visit") return `踏入石室 (${event.cell.row}, ${event.cell.col})`;
  if (event.type === "backtrack") return `沿通路折返至 (${event.cell.row}, ${event.cell.col})`;
  if (event.type === "frontier") return `Prim：更新前沿边际，共 ${event.frontier.length} 道备选石壁`;
  if (event.type === "candidate") return `查探石梁 (${event.edge.from.row},${event.edge.from.col}) → (${event.edge.to.row},${event.edge.to.col})`;
  if (event.type === "carve") return `凿通第 ${event.carvedEdgeCount} 道石壁`;
  if (event.type === "skip") return `略过石壁：${event.reason === "cycle" ? "凿通将产生多余回环" : event.reason === "visited" ? "对端石室早已贯通" : "重复备选"}`;
  if (event.type === "union") return `熔接互通区域，余下 ${event.componentCount} 处孤岛`;
  return `地宫构筑完成，共凿穿 ${event.carvedEdgeCount} 条甬道`;
});
const transport = computed(() => showGeneratorLab.value && generatorResult.value ? generatorPlayback : teachingBusy.value ? teachingPlayback : playback);
const transportPlaying = computed(() => transport.value.playing.value);
const transportTotal = computed(() => transport.value.total.value);
const transportCursor = computed(() => transport.value.cursor.value);
const transportSpeed = computed({ get: () => transport.value.speed.value, set: (value: number) => { transport.value.speed.value = value; } });
const comparisonWinner = computed(() => {
  if (!results.value.bfs || !results.value.astar) return "同起双法，比较此座石阵中的算路抉择。";
  const difference = results.value.bfs.visitedOrder.length - results.value.astar.visitedOrder.length;
  return difference === 0 ? "两门寻路古法此番探查了完全相同的石室数量。" : `${difference > 0 ? 'A*' : 'BFS'} 比对手少涉足了 ${Math.abs(difference)} 间石室。`;
});
function openUtility(panel: "settings" | "history" | "generator") {
  utilityPanel.value = panel;
  utilityDialog.value?.showModal();
}
function closeUtility() { utilityDialog.value?.close(); }
function toggleTransport() { if (transportPlaying.value) transport.value.pause(); else transport.value.play(); }
function startExploring() {
  if (teachingBusy.value) exitTeaching();
  if (showGeneratorLab.value) exitGenerator();
  playback.cancel(); results.value = {}; activeAlgorithm.value = null;
  if (manualCompleted.value) clearRunState("新的探险已启程");
  workspaceMode.value = "explore"; editTool.value = "move";
  mazeElement.value?.focus();
}
function selectMode(mode: "explore" | "search" | "learn") {
  if (mode === workspaceMode.value && !showGeneratorLab.value) return;
  if (mode === "explore") { startExploring(); return; }
  if (teachingBusy.value) exitTeaching();
  if (showGeneratorLab.value) exitGenerator();
  workspaceMode.value = mode;
}
function completeScene() {
  if (!completedScenes.value.includes(scene.value.id)) completedScenes.value = [...completedScenes.value, scene.value.id];
  try { localStorage.setItem("papermaze-journey", JSON.stringify(completedScenes.value)); } catch { /* Progress is optional when storage is unavailable. */ }
  endingDialog.value?.showModal();
}
function changeScene(index: number) {
  if (!scenes[index] || sceneTransitioning.value) return;
  endingDialog.value?.close();
  const enter = () => {
    sceneIndex.value = index;
    const seed = newSeed();
    clearGeneratorMode();
    maze.value = scene.value.algorithm === "dfs" ? generateMaze(selectedSize.value, seed) : generateMazeWithTrace(selectedSize.value, seed, scene.value.algorithm).maze;
    seedInput.value = seed; generatorAlgorithm.value = scene.value.algorithm;
    editTool.value = "move"; workspaceMode.value = "explore";
    clearRunState(`已抵达${scene.value.title}`);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { enter(); return; }
  sceneTransitioning.value = true;
  sceneTimer = window.setTimeout(() => {
    enter();
    sceneTimer = window.setTimeout(() => { sceneTransitioning.value = false; }, 350);
  }, 350);
}
function clearRunState(message: string) {
  playback.cancel(); teachingPlayback.clear(); teachingTrace.value = null; astarTeachingTrace.value = null; results.value = {}; activeAlgorithm.value = null;
  player.value = maze.value.start; manualPath.value = [maze.value.start]; startedAt.value = null; manualElapsedMs.value = null; collisionCount.value = 0; wallCollisionCount.value = 0; boundaryCollisionCount.value = 0; manualCompleted.value = false; showHeatmap.value = false;
  aiText.value = ""; aiSource.value = ""; aiError.value = "";
  saveState.value = "idle"; pendingRun.value = null; status.value = message;
}

function clearGeneratorMode() {
  generatorPlayback.clear();
  showGeneratorLab.value = false;
  generatorResult.value = null;
  generatorComparisons.value = [];
}
function buildMaze(size = selectedSize.value, seed = seedInput.value) {
  try {
    clearGeneratorMode();
    maze.value = generateMaze(size, seed); selectedSize.value = size; seedInput.value = seed;
    editTool.value = "move"; clearRunState("石阵已重布");
  } catch (error) { status.value = error instanceof Error ? error.message : "参数无效"; }
}
function startGenerator(algorithm = generatorAlgorithm.value, size = selectedSize.value, seed = seedInput.value) {
  try {
    const generated = generateMazeWithTrace(size, seed, algorithm);
    const comparisons = (["dfs", "prim", "kruskal"] as const).map((candidate) => candidate === algorithm ? generated : generateMazeWithTrace(size, seed, candidate));
    clearGeneratorMode();
    maze.value = generated.maze; selectedSize.value = size; seedInput.value = seed; generatorAlgorithm.value = algorithm;
    clearRunState(`${algorithm.toUpperCase()} 筑阵完成，正在展示开凿轨迹`);
    generatorResult.value = generated; generatorComparisons.value = comparisons; generatorPlayback.load(generated.events); showGeneratorLab.value = true; editTool.value = "move";
    closeUtility();
  } catch (error) { status.value = error instanceof Error ? error.message : "生成参数无效"; }
}
function regenerate() { buildMaze(selectedSize.value, newSeed()); }
function loadChallenge() {
  const parsed = parseChallengeCode(challengeInput.value);
  if (!parsed) { status.value = "密符格式无效，例如 PM1-21-12345"; return; }
  if (parsed.algorithm === "dfs") buildMaze(parsed.size, parsed.seed);
  else startGenerator(parsed.algorithm, parsed.size, parsed.seed);
  status.value = `已载入古符迷局 ${challengeInput.value.trim().toUpperCase()}`;
}
async function copyChallenge() {
  try { await navigator.clipboard.writeText(challengeCode.value); status.value = "挑战密符已抄录"; }
  catch { status.value = "暂时无法抄录，请手动选中密符"; }
}

async function persist(run: Run) {
  const retrying = saveState.value === "error";
  pendingRun.value = run; saveState.value = "saving";
  try {
    await createRun(run);
    await refreshHistory();
    if (pendingRun.value?.id !== run.id) return;
    saveState.value = "saved"; pendingRun.value = null;
    if (retrying) status.value = "历险手记已重新封存";
  } catch (error) {
    if (pendingRun.value?.id !== run.id) return;
    saveState.value = "error";
    status.value = `探险完成，但手记封存失败：${error instanceof Error ? error.message : "未知变故"}`;
  }
}

function move(direction: Direction) {
  if (sceneTransitioning.value || teachingBusy.value || generatorBusy.value || editTool.value !== "move" || same(player.value, maze.value.goal) || playbackBusy.value) return;
  const result = movePlayer(maze.value, player.value, direction);
  if (result.blocked) { collisionCount.value = (collisionCount.value ?? 0) + 1; if (result.blocked === "wall") wallCollisionCount.value = (wallCollisionCount.value ?? 0) + 1; else boundaryCollisionCount.value = (boundaryCollisionCount.value ?? 0) + 1; status.value = result.blocked === "wall" ? "前方乃厚重石壁" : "已抵石阵边界"; return; }
  if (startedAt.value === null) startedAt.value = performance.now();
  player.value = result.position; manualPath.value = [...manualPath.value, result.position]; status.value = "继续前行";
  if (same(result.position, maze.value.goal)) {
    const elapsed = performance.now() - startedAt.value!; manualElapsedMs.value = elapsed; manualCompleted.value = true; status.value = `穿出石阵！共踏过 ${manualPath.value.length - 1} 步，用时 ${(elapsed / 1000).toFixed(1)} 秒`;
    void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: "manual", maze: maze.value, found: true, path: manualPath.value, visitedOrder: null, computeMs: null, manualElapsedMs: elapsed, collisionCount: collisionCount.value, wallCollisionCount: wallCollisionCount.value, boundaryCollisionCount: boundaryCollisionCount.value });
    completeScene();
  }
}

function startBfsTeaching() {
  workspaceMode.value = "learn";
  playback.cancel(); teachingPlayback.clear(); astarTeachingTrace.value = null; if (generatorBusy.value) exitGenerator();
  results.value = {};
  activeAlgorithm.value = null;
  teachingTrace.value = buildBfsTeachingTrace(maze.value);
  teachingPlayback.load(teachingTrace.value.events);
  editTool.value = "move";
  status.value = "BFS 队列推演就绪，点击下一步观察队列铺展";
}
function startAstarTeaching() {
  workspaceMode.value = "learn";
  playback.cancel();
  if (generatorBusy.value) exitGenerator();
  teachingPlayback.clear();
  teachingTrace.value = null;
  astarTeachingTrace.value = buildAstarTeachingTrace(maze.value);
  teachingPlayback.load(astarTeachingTrace.value.events);
  editTool.value = "move";
  status.value = "A* 星盘推演就绪，点击下一步观察优先权抉择";
}


function exitTeaching() {
  teachingPlayback.clear();
  teachingTrace.value = null;
  astarTeachingTrace.value = null;
  status.value = "已收起推演模式";
}
function exitGenerator() {
  generatorPlayback.clear();
  showGeneratorLab.value = false;
  status.value = "已停下筑造，保留当前石阵";
}

function stepTeachingForward() { teachingPlayback.stepForward(); }
function stepTeachingBack() { teachingPlayback.stepBack(); }

function runSearch(algorithm: SearchAlgorithm) {
  if (generatorBusy.value) exitGenerator();
  if (teachingBusy.value) exitTeaching();
  if (playbackBusy.value) playback.cancel();
  const result = searchMaze(maze.value, algorithm);
  if (result.found && !validatePath(maze.value, result.path)) {
    status.value = `${algorithm.toUpperCase()} 算路穿壁逾矩，结果未予记录`;
    return;
  }
  results.value = { ...results.value, [algorithm]: result }; activeAlgorithm.value = algorithm; playback.play(result);
  status.value = result.found ? `${algorithm === "astar" ? "A*" : "BFS"} 寻径毕，通衢已现` : "此阵暗巷皆断，无解";
  void persist({ id: crypto.randomUUID(), schemaVersion: 1, mode: algorithm, maze: maze.value, found: result.found, path: result.path, visitedOrder: result.visitedOrder, computeMs: result.computeMs, manualElapsedMs: null });
}
function switchResult(algorithm: SearchAlgorithm) {
  const result = results.value[algorithm]; if (!result) return;
  if (teachingBusy.value) exitTeaching();
  if (showGeneratorLab.value) exitGenerator();
  workspaceMode.value = "search"; editTool.value = "move";
  activeAlgorithm.value = algorithm; playback.play(result);
}

function editBoard(event: MouseEvent) {
  if (teachingBusy.value || generatorBusy.value || editTool.value === "move" || playbackBusy.value) return;
  const svg = event.currentTarget as SVGSVGElement;
  const matrix = svg.getScreenCTM();
  if (!matrix) { status.value = "暂时无法定位点击位置"; return; }
  const cursor = svg.createSVGPoint();
  cursor.x = event.clientX; cursor.y = event.clientY;
  const logical = cursor.matrixTransform(matrix.inverse());
  const point = { row: Math.floor(logical.y / cell), col: Math.floor(logical.x / cell) };
  if (editTool.value === "wall" && same(point, player.value)) { status.value = "不可在行者立足处立石"; return; }
  const edited = applyEdit(maze.value, editTool.value, point);
  if (edited.error) { status.value = edited.error === "border" ? "外沿石壁不可毁损" : edited.error === "wall" ? "起终二门须设于通路之中" : "起终二门不可重合或被石壁覆压"; return; }
  maze.value = edited.maze; clearGeneratorMode(); clearRunState("石阵已改动");
}

async function refreshHistory() {
  try { history.value = (await listRuns(historyFilter.value === "all" ? undefined : historyFilter.value)).items; historyError.value = ""; }
  catch (error) { historyError.value = "行记卷轴暂无法翻阅，请稍候再试。"; throw error; }
}
function reloadHistory() { void refreshHistory().catch(() => undefined); }
async function restoreRun(id: string) {
  restoringId.value = id;
  try {
  const run = await getRun(id);
  closeUtility(); clearGeneratorMode(); maze.value = run.maze; selectedSize.value = run.maze.size as MazeSize; seedInput.value = run.maze.seed;
  clearRunState("已唤醒往昔探险行记"); workspaceMode.value = run.mode === "manual" ? "explore" : "search";
  if (run.mode !== "manual" && run.visitedOrder) {
    const result = { found: run.found, path: run.path, visitedOrder: run.visitedOrder, computeMs: run.computeMs ?? 0 };
    results.value = { [run.mode]: result }; activeAlgorithm.value = run.mode; playback.play(result);
  } else if (run.mode === "manual") {
    manualPath.value = run.path;
    player.value = run.path[run.path.length - 1] ?? run.maze.start;
    manualElapsedMs.value = run.manualElapsedMs; collisionCount.value = run.collisionCount ?? null; wallCollisionCount.value = run.wallCollisionCount ?? null; boundaryCollisionCount.value = run.boundaryCollisionCount ?? null; manualCompleted.value = true;
    playback.play({ found: true, path: run.path, visitedOrder: [], computeMs: 0 });
    status.value = `已重现亲身探险：${run.path.length - 1} 步，用时 ${((run.manualElapsedMs ?? 0) / 1000).toFixed(1)} 秒`;
  }
  } catch (error) { historyError.value = `未能重现此段行记：${error instanceof Error ? error.message : '请稍候再试'}`; }
  finally { restoringId.value = null; }
}
async function requestAiExplanation() {
  const reportMaze = maze.value;
  aiLoading.value = true; aiError.value = "";
  try {
    const response = await fetch("/api/ai/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      mazeSize: maze.value.size, passageRatio: structure.value.passageRatio, deadEnds: structure.value.deadEnds, junctions: structure.value.junctions,
      shortestPathLength: structure.value.shortestPathLength, manualSteps: manualCompleted.value ? manualPath.value.length - 1 : null,
      detourRate: challengeMetrics.value.detourRate, bfsVisited: results.value.bfs?.visitedOrder.length ?? null, astarVisited: results.value.astar?.visitedOrder.length ?? null,
      bfsPathLength: results.value.bfs?.found ? results.value.bfs.path.length - 1 : null, astarPathLength: results.value.astar?.found ? results.value.astar.path.length - 1 : null,
      bfsCoverage: results.value.bfs ? results.value.bfs.visitedOrder.length / Math.max(1, structure.value.reachablePassages) : null, astarCoverage: results.value.astar ? results.value.astar.visitedOrder.length / Math.max(1, structure.value.reachablePassages) : null,
    }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "AI 请求失败");
    if (maze.value === reportMaze) { aiText.value = data.text; aiSource.value = data.source; }
  } catch { if (maze.value === reportMaze) aiError.value = "算者批注暂时无法显现，请稍候重试。"; }
  finally { aiLoading.value = false; }
}
async function removeRun(id: string) {
  try { await deleteRun(id); history.value = history.value.filter((run) => run.id !== id); status.value = "此段行记已自卷轴抹去"; }
  catch { historyError.value = "未能抹去此段行记，请稍候重试。"; }
}

const keyDirections: Record<string, Direction> = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  const direction = keyDirections[event.key]; if (!direction) return; event.preventDefault(); move(direction);
}
onMounted(async () => {
  for (const chapter of scenes.slice(1)) { const artwork = new Image(); artwork.src = chapter.artwork; }
  try { const saved: unknown = JSON.parse(localStorage.getItem("papermaze-journey") ?? "[]"); if (Array.isArray(saved)) completedScenes.value = saved.filter((id): id is string => typeof id === "string" && scenes.some(item => item.id === id)); } catch { /* A fresh journey is safe for invalid saved progress. */ }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  revealObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-visible"); revealObserver?.unobserve(entry.target); } }, { threshold: .15 });
  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(element => { if (reduced) element.classList.add("is-visible"); else { element.classList.add("will-reveal"); revealObserver?.observe(element); } });
  try { await refreshHistory(); } catch { status.value = "行记暂不可阅"; }
});
onBeforeUnmount(() => { revealObserver?.disconnect(); window.clearTimeout(sceneTimer); });
</script>

<template>
  <main class="paper-world">
    <a class="skip-link" href="#maze-area">直达石阵</a>
    <section class="journey-stage" :class="{ 'scene-transitioning': sceneTransitioning }" :aria-busy="sceneTransitioning">
      <img class="landscape" :src="scene.artwork" alt="" aria-hidden="true" fetchpriority="high" />
      <div class="page-shell">
        <header class="site-header">
          <a class="brand" href="#maze-area" aria-label="PaperMaze 羊皮纸迷宫">
            <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M22 4H4v32h32V4h-8v24H12V12h8v8h-1M28 36v-8M4 20h8M20 4v8" stroke="currentColor" stroke-width="1.8" /></svg>
            <span>PaperMaze<small>CHRONICLES OF THE LABYRINTH</small></span>
          </a>
          <nav aria-label="主要导航">
            <a class="nav-current" href="#maze-area" aria-current="page">石阵漫游</a>
            <button @click="openUtility('generator')">造境秘阁</button>
            <a href="#field-notes">寻路手记</a>
          </nav>
          <div class="header-actions"><button @click="openUtility('history')">足迹 <span>{{ history.length }}</span></button><button aria-label="打开石阵密匙" @click="openUtility('settings')">密匙 ↗</button></div>
        </header>

        <section class="atelier" aria-label="石阵漫游案台">
          <div class="editorial" data-reveal>
            <p class="eyebrow"><span class="small-rule"></span> PARCHMENT, TORCH & ANCIENT RUNES</p>
            <h1>The art of<br />finding a way.</h1>
            <p class="hero-subtitle">执火穿行于石壁与迷雾之间，在羊皮纸上辨明前路。</p>
            <div class="hero-actions"><button class="ink-button" @click="startExploring">{{ manualPath.length > 1 && !manualCompleted ? '继续探查' : '执火启程' }} <span aria-hidden="true">↗</span></button><button class="text-link" @click="regenerate">重布石阵</button></div>

            <div class="fieldbook">
              <div class="mode-tabs" role="group" aria-label="探索方式">
                <button v-for="mode in (['explore', 'search', 'learn'] as const)" :key="mode" :aria-pressed="workspaceMode === mode" @click="selectMode(mode)">{{ { explore: '手持火把', search: '算法寻路', learn: '步进推演' }[mode] }}</button>
              </div>
              <div v-if="showGeneratorLab && generatorResult" class="method-panel generator-process" aria-label="生成过程">
                <div class="method-heading"><span>{{ generatorAlgorithm.toUpperCase() }} · 筑阵手记</span><button class="text-link" @click="exitGenerator">收起</button></div>
                <p class="teaching-message" aria-live="polite">{{ generatorMessage }}</p>
                <div class="mini-metrics"><span>凿穿石壁 <b>{{ generatorState?.carvedEdges.length ?? 0 }}</b></span><span>连通区域 <b>{{ generatorState?.componentCount ?? generatorResult.metrics.componentCount }}</b></span></div>
                <div class="step-controls"><button :disabled="generatorPlayback.cursor.value === 0" @click="generatorPlayback.stepBack">← 倒回一步</button><button :disabled="generatorPlayback.cursor.value >= generatorPlayback.total.value" @click="generatorPlayback.stepForward">下一步 →</button><button @click="generatorPlayback.reset">重回初起</button></div>
              </div>
              <div v-else-if="workspaceMode === 'search'" class="method-panel" aria-label="算法寻路">
                <div class="algorithm-choices"><button :disabled="teachingBusy || generatorBusy" @click="runSearch('bfs')"><strong>BFS</strong><span>广度优先 · 潮涌探法</span><span class="choice-arrow" aria-hidden="true">↗</span></button><button :disabled="teachingBusy || generatorBusy" @click="runSearch('astar')"><strong>A*</strong><span>启发式 · 星芒引路</span><span class="choice-arrow" aria-hidden="true">↗</span></button></div>
                <p class="method-caption">{{ scene.discovery }}</p>
              </div>
              <div v-else-if="workspaceMode === 'explore'" class="method-panel manual-panel" aria-label="手动探索">
                <div class="dpad" aria-label="方向控制"><button class="up" aria-label="向上" @click="move('up')">↑</button><button class="left" aria-label="向左" @click="move('left')">←</button><button class="down" aria-label="向下" @click="move('down')">↓</button><button class="right" aria-label="向右" @click="move('right')">→</button></div>
                <div class="walk-count"><strong>{{ manualPath.length - 1 }}</strong><span>步，靴底印记</span><small>方向键 / WASD</small></div>
              </div>
              <div v-else class="method-panel" aria-label="算法讲解">
                <div class="lesson-choices"><button :disabled="generatorBusy" @click="startBfsTeaching">BFS 队列推演 <span>↗</span></button><button :disabled="generatorBusy" @click="startAstarTeaching">A* 星盘推演 <span>↗</span></button></div>
                <p v-if="!teachingBusy" class="method-caption">放慢推演节奏，看清每一步是如何在岔口前定夺的。</p>
                <div v-if="teachingBusy" class="teaching-panel" :aria-label="teachingTrace ? 'BFS 教学模式' : 'A* 教学模式'">
                  <div class="method-heading"><span>{{ teachingTrace ? 'BFS 队列' : 'A* 星盘' }} · {{ teachingPlayback.cursor.value }} / {{ teachingPlayback.total.value }}</span><button @click="exitTeaching">结束推演</button></div>
                  <p class="teaching-message" aria-live="polite">{{ teachingTrace ? teachingMessage : astarTeachingMessage }}</p>
                  <div class="mini-metrics"><span>已探石室 <b>{{ teachingState?.visited.length ?? astarTeachingState?.visited.length ?? 0 }}</b></span><span>候探之室 <b>{{ teachingState?.queue.length ?? astarTeachingState?.frontier.length ?? 0 }}</b></span></div>
                  <details class="queue-details"><summary>察看当前候探序列</summary><p>{{ teachingState ? teachingState.queue.map(pointKey).join(' → ') || '空' : astarTeachingState?.frontier.map(item => `(${pointKey(item.point)} g${item.g} h${item.h} f${item.f})`).join(' → ') || '空' }}</p></details>
                  <div class="step-controls"><button :disabled="teachingPlayback.cursor.value === 0" @click="stepTeachingBack">← 倒回一步</button><button :disabled="teachingPlayback.cursor.value >= teachingPlayback.total.value" @click="stepTeachingForward">下一步 →</button><button @click="teachingPlayback.reset">重回起点</button></div>
                </div>
              </div>
              <div class="tool-row" role="group" aria-label="石阵刻具"><span>刻具</span><button v-for="tool in (['move', 'wall', 'passage', 'start', 'goal'] as const)" :key="tool" :disabled="teachingBusy || generatorBusy || playbackBusy" :aria-pressed="editTool === tool" @click="editTool = tool">{{ { move: '移步', wall: '立石', passage: '凿空', start: '始门', goal: '终门' }[tool] }}</button></div>
            </div>
          </div>

          <figure id="maze-area" class="maze-plate" data-reveal style="--reveal-delay: 160ms">
            <figcaption class="plate-caption"><span>PLATE 0{{ sceneIndex + 1 }} <span class="caption-divider">/</span> {{ scene.english }}</span><button @click="openUtility('settings')">{{ maze.size }} × {{ maze.size }} <span aria-hidden="true">⌄</span></button></figcaption>
            <div class="paper-stage">
              <div class="compass" aria-hidden="true"><span>N</span><svg viewBox="0 0 32 32" fill="none"><path d="M16 2L19 13l11 3-11 3-3 11-3-11L2 16l11-3Z" stroke="currentColor" stroke-width=".7"/><path d="M16 2v28M2 16h28" stroke="currentColor" stroke-width=".4"/><path d="M16 2v14h-3Z" fill="currentColor"/></svg></div>
              <MazeBoard ref="mazeElement" :maze="maze" :player="player" :editable="editTool !== 'move'" :show-heatmap="showHeatmap" :distance-field="structure.distanceField" :results="results" :active-algorithm="activeAlgorithm" :visited="playback.visibleVisited.value" :path="playback.visiblePath.value" :manual-path="manualPath" :teaching="teachingState" :astar-teaching="astarTeachingState" :generator="showGeneratorLab ? generatorState : null" @edit="editBoard" @keydown="onKeydown" />
            </div>
            <div class="map-legend"><span><i class="legend-start"></i>始门</span><span><i class="legend-goal"></i>终门</span><span v-if="results.bfs" class="bfs-label">● BFS 潮涌</span><span v-if="results.astar" class="astar-label">● A* 星芒</span><label class="heatmap-toggle"><input v-model="showHeatmap" type="checkbox" />离门距离</label></div>
            <div class="transport"><button class="play-toggle" :disabled="!transportTotal" :aria-label="transportPlaying ? '暂停播放' : '开始播放'" @click="toggleTransport"><svg v-if="transportPlaying" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="2"/></svg><svg v-else viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3l10 7-10 7Z" fill="currentColor"/></svg></button><div class="playback-track" role="progressbar" aria-label="回放进度" :aria-valuenow="transportCursor" :aria-valuemin="0" :aria-valuemax="Math.max(1, transportTotal)"><span :style="{ transform: `scaleX(${transportTotal ? transportCursor / transportTotal : 0})` }"></span></div><span class="transport-label">{{ showGeneratorLab ? '筑阵回溯' : teachingBusy ? '推演回放' : '寻路回放' }}</span><label class="speed-control"><input v-model.number="transportSpeed" type="range" min="0.5" max="5" step="0.5" aria-label="播放速度" :aria-valuetext="`${transportSpeed} 倍速`" /><output>{{ transportSpeed }}×</output></label></div>
          </figure>
        </section>

        <div class="chapter-journal" data-reveal>
          <div class="chapter-story"><span class="eyebrow">CHAPTER 0{{ sceneIndex + 1 }} <span class="chapter-place">{{ scene.place }}</span></span><h2>{{ scene.title }}</h2><p>{{ scene.story }}</p></div>
          <nav class="chapter-navigation" aria-label="旅程场景"><button v-for="(chapter, index) in scenes" :key="chapter.id" :aria-current="sceneIndex === index ? 'step' : undefined" :disabled="sceneTransitioning" @click="changeScene(index)"><span class="chapter-number">{{ ['I', 'II', 'III'][index] }}<small v-if="completedScenes.includes(chapter.id)" aria-label="此关已通">✓</small></span><span>{{ chapter.title }}<small>{{ chapter.english }}</small></span><span aria-hidden="true">↗</span></button></nav>
        </div>
        <div class="stage-status"><p class="status" aria-live="polite">{{ status }} <span v-if="saveState !== 'idle'">· {{ { saving: '封缄中…', saved: '足迹已封入卷轴', error: '封缄失败' }[saveState] }}</span><button v-if="saveState === 'error' && pendingRun" @click="persist(pendingRun)">重新封存</button></p><span>{{ completedScenes.length }} / 3 处地宫已勘破</span></div>
      </div>
      <div class="scene-veil" aria-hidden="true"><span>翻开新的篇章。</span></div>
    </section>

    <section id="field-notes" class="field-notes page-shell" aria-label="实验报告">
      <div class="section-kicker" data-reveal><span>NOTES FROM THE LABYRINTH</span><span>羊皮纸迷宫 · 寻路手记</span></div>
      <div class="notes-heading"><h2><span data-reveal>Every turn,</span><br/><span data-reveal style="--reveal-delay: 160ms">a revelation.</span></h2><p data-reveal>石阵的机巧、靴底踏过的深浅，与两门古算法的决断，<br/>尽数录于此卷。</p></div>
      <dl class="structure-metrics" data-reveal><div><dt>通路占比 <span>Passages</span></dt><dd>{{ (structure.passageRatio * 100).toFixed(0) }}<small>%</small></dd></div><div><dt>绝路石室 <span>Dead ends</span></dt><dd>{{ structure.deadEnds }}</dd></div><div><dt>歧路枢纽 <span>Junctions</span></dt><dd>{{ structure.junctions }}</dd></div><div><dt>最短通衢 <span>Shortest path</span></dt><dd>{{ structure.shortestPathLength ?? '—' }}<small v-if="structure.shortestPathLength !== null">步</small></dd></div></dl>

      <div class="observations">
        <section class="comparison-note" data-reveal>
          <p class="note-number">OBSERVATION 01</p><h3>双法并举，殊途同归。</h3><p class="note-description">{{ comparisonWinner }}</p>
          <table class="comparison-table"><caption class="sr-only">BFS 与 A* 测算结果</caption><thead><tr><th scope="col">法门</th><th scope="col">通衢步数</th><th scope="col">涉足石室</th><th scope="col">地宫探查率</th></tr></thead><tbody><tr v-for="algorithm in (['bfs', 'astar'] as const)" :key="algorithm"><th scope="row"><button :disabled="!results[algorithm]" :class="`${algorithm}-label`" @click="switchResult(algorithm)">{{ algorithm === 'bfs' ? 'BFS' : 'A*' }} <span aria-hidden="true">↻</span></button></th><td>{{ results[algorithm] ? results[algorithm]!.found ? `${results[algorithm]!.path.length - 1} 步` : '无解' : '—' }}</td><td>{{ results[algorithm]?.visitedOrder.length ?? '—' }}</td><td>{{ results[algorithm] ? `${(results[algorithm]!.visitedOrder.length / Math.max(1, structure.reachablePassages) * 100).toFixed(0)}%` : '—' }}</td></tr></tbody></table>
          <div v-if="results.bfs || results.astar" class="search-bars" aria-label="访问节点对比"><div v-for="algorithm in (['bfs', 'astar'] as const)" :key="algorithm"><span>{{ algorithm === 'bfs' ? 'BFS' : 'A*' }}</span><div><i :class="algorithm" :style="{ transform: `scaleX(${(results[algorithm]?.visitedOrder.length ?? 0) / Math.max(1, results.bfs?.visitedOrder.length ?? 0, results.astar?.visitedOrder.length ?? 0)})` }"></i></div><small>{{ results[algorithm] ? `${results[algorithm]!.computeMs.toFixed(2)} ms` : '未施法' }}</small></div></div>
          <p class="fine-print">仅记录实测寻径数据，未计入推演回放耗时。</p>
        </section>
        <section class="challenge-note" data-reveal style="--reveal-delay: 80ms">
          <p class="note-number">OBSERVATION 02</p><h3>亲涉险径。</h3><p class="note-description">{{ manualCompleted ? challengeMetrics.badge : '火把尚明，不必急躁，每一步错踏都是辨认石壁的线索。' }}</p>
          <dl class="challenge-grid"><div><dt>实踏步数</dt><dd>{{ challengeMetrics.manualSteps }}</dd></div><div><dt>穿行耗时</dt><dd>{{ manualElapsedMs === null ? '—' : `${(manualElapsedMs / 1000).toFixed(1)} s` }}</dd></div><div><dt>歧路绕行率</dt><dd>{{ challengeMetrics.detourRate === null ? '—' : `${(challengeMetrics.detourRate * 100).toFixed(0)}%` }}</dd></div><div><dt>通路效能</dt><dd>{{ challengeMetrics.efficiency === null ? '—' : `${(challengeMetrics.efficiency * 100).toFixed(0)}%` }}</dd></div><div><dt>碰壁 / 触界</dt><dd>{{ wallCollisionCount ?? '—' }} / {{ boundaryCollisionCount ?? '—' }}</dd></div><div><dt>石阵性格</dt><dd class="character-label">{{ structure.curvature }} · {{ structure.exploration }}</dd></div></dl>
        </section>
      </div>

      <section class="analysis-note" aria-label="羊皮卷注" data-reveal>
        <div><p class="note-number">SCRIBE'S GLOSS</p><h3>羊皮卷注 · 算者回勘</h3><p class="note-description">对照石室步数与探查刻痕，解析这次寻径的机括与得失。</p><button class="outlined-button" :disabled="aiLoading" @click="requestAiExplanation">{{ aiLoading ? '研墨撰注中…' : '阅览算者批注' }} <span aria-hidden="true">↗</span></button></div>
        <div class="analysis-content" aria-live="polite"><p v-if="aiError" class="inline-error" role="alert">{{ aiError }}</p><div v-if="aiLoading" class="writing-skeleton" aria-label="正在研墨成文"><span></span><span></span><span></span></div><template v-else-if="aiText"><p class="ai-text">{{ aiText }}</p><span class="analysis-source">{{ aiSource === 'deepseek' ? 'DeepSeek · 远境密谕' : '卷末旧注 · 随卷即阅' }}</span></template><p v-else class="analysis-empty">“莫道歧路长，深巷皆有痕。”<small>待你行至终门，古算者的批注将铭于此处。</small></p></div>
      </section>
      <details v-if="generatorResult || teachingStats" class="technical-note"><summary>展开推演纪事密录</summary><p v-if="teachingStats">推演轨迹：{{ teachingStats.completed ? '已终局' : '推演中' }} · 历经 {{ teachingStats.eventCount }} 处决断 · 候探极值 {{ teachingStats.maxFrontier }}</p><p v-if="generatorResult">{{ generatorAlgorithm.toUpperCase() }}：包含 {{ generatorResult.metrics.logicalCellCount }} 处石室基座，凿通 {{ generatorResult.metrics.carvedEdgeCount }} 道隔壁。{{ generatorInvariant ? '石阵无死环且处处可通。' : '石阵结构检验未通。' }}</p><div v-if="generatorComparisons.length" class="generator-comparison"><p v-for="item in generatorComparisons" :key="item.metrics.generatorId">{{ item.metrics.generatorId.toUpperCase() }} · 绝路 {{ item.metrics.deadEnds }} · 歧路 {{ item.metrics.junctions }} · 环秩 {{ item.metrics.cycleRank }}</p></div></details>
      <footer class="site-footer"><div class="footer-brand">PaperMaze <span>羊皮纸迷宫</span></div><p>From shadows into light, one stone at a time.</p><details class="field-guide"><summary>探险纪要 ↗</summary><p>点击迷宫后以方向键或 WASD 移步。拾起工匠刻具，即可于图上立石堵路、凿石开道或移换起终二门。BFS 能平稳荡出最短通衢；A* 借星芒估算直指生门；步进推演可一窥算者算筹之变。往昔涉足之地，皆可从“足迹”卷轴随时召还。</p></details><a href="#maze-area">重回石阵 ↑</a></footer>
    </section>

    <dialog ref="utilityDialog" class="utility-modal" aria-labelledby="utility-heading" @close="utilityPanel = null" @click.self="closeUtility">
      <div class="dialog-body"><header class="dialog-heading"><div><p class="eyebrow">THE CARTOGRAPHER'S DESK</p><h2 id="utility-heading">{{ utilityPanel === 'settings' ? '重绘一张地宫舆图。' : utilityPanel === 'history' ? '翻阅往昔行记。' : '观摩地宫开凿之术。' }}</h2></div><button class="close-button" aria-label="关闭面板" @click="closeUtility">×</button></header>
        <template v-if="utilityPanel === 'settings'"><form class="settings-form" @submit.prevent="buildMaze(); closeUtility()"><label>地宫规模<select v-model.number="selectedSize"><option v-for="size in SUPPORTED_SIZES" :key="size" :value="size">{{ size }} × {{ size }}</option></select></label><label>符文种子<input v-model.number="seedInput" type="number" min="1" max="4294967295" step="1" required /></label><button class="ink-button" type="submit">绘制舆图 <span>↗</span></button></form><section class="challenge-settings"><h3>邀友同涉此阵。</h3><div class="challenge-code"><code>{{ challengeCode }}</code><button @click="copyChallenge">抄录</button></div><p v-if="maze.edited" class="fine-print">挑战古符可复原初始石阵。经工匠修改之图留存于行记中。</p><form @submit.prevent="loadChallenge"><label for="challenge-code">输入挑战密符</label><div class="challenge-input"><input id="challenge-code" v-model="challengeInput" placeholder="PM1-21-12345" required /><button type="submit">载入 ↗</button></div></form></section><p class="form-message" role="status">{{ status }}</p></template>
        <template v-else-if="utilityPanel === 'history'"><p v-if="historyError" class="inline-error" role="alert">{{ historyError }} <button @click="reloadHistory">重试</button></p><div class="history-filter"><p>{{ history.length }} 卷寻路行记</p><select v-model="historyFilter" aria-label="筛选历史" @change="reloadHistory"><option value="all">全部行记</option><option value="manual">亲身探险</option><option value="bfs">BFS 潮涌</option><option value="astar">A* 星芒</option></select></div><div v-if="!history.length && !historyError" class="history-empty"><span aria-hidden="true">∅</span><h3>卷轴尚白，尚未踏足。</h3><p>拔步穿行一次，或施展一门寻路之术，<br/>羊皮纸上便会留下第一行墨迹。</p></div><article v-for="run in history" :key="run.id" class="history-row"><span class="history-mode">{{ run.mode === 'manual' ? '独步' : run.mode === 'astar' ? 'A*' : 'BFS' }}</span><div><strong>{{ run.found ? `${run.pathLength ?? 0} 步通达` : '死局' }}</strong><small>{{ run.mazeSize }} × {{ run.mazeSize }} · 符文 {{ run.seed }}</small></div><button :disabled="restoringId !== null" @click="restoreRun(run.id)">{{ restoringId === run.id ? '引卷中…' : '重访 ↗' }}</button><button class="delete-run" aria-label="抹去此卷" @click="removeRun(run.id)">抹去</button></article></template>
        <template v-else-if="utilityPanel === 'generator'"><p class="dialog-intro">三种古法筑阵，三种回廊骨架。以同一枚符文种子起手，看混沌石室如何被雕琢出连贯生路。</p><form class="settings-form generator-form" @submit.prevent="startGenerator()"><label>筑阵古法<select v-model="generatorAlgorithm"><option value="dfs">DFS · 孤行深探，碰壁方回</option><option value="prim">Prim · 根系蔓延，破土成网</option><option value="kruskal">Kruskal · 熔铸石梁，孤室连通</option></select></label><label>地宫规模<select v-model.number="selectedSize"><option v-for="size in SUPPORTED_SIZES" :key="size" :value="size">{{ size }} × {{ size }}</option></select></label><label>符文种子<input v-model.number="seedInput" type="number" min="1" max="4294967295" step="1" required /></label><button class="ink-button" :disabled="generatorBusy" type="submit">开凿并观摩 <span>↗</span></button></form><p class="fine-print">开凿后，可在石阵下方推演回溯，细察每道甬道贯通之变。</p></template>
      </div>
    </dialog>
    <dialog ref="endingDialog" class="ending-modal" aria-labelledby="ending-heading"><div class="ending-content"><button class="close-button" aria-label="合上结语" @click="endingDialog?.close()">×</button><p class="eyebrow">A PASSAGE UNLOCKED · CHAPTER 0{{ sceneIndex + 1 }}</p><div class="arrival-mark" aria-hidden="true">{{ ['I', 'II', 'III'][sceneIndex] }}</div><h2 id="ending-heading">石门大启。</h2><p>{{ scene.ending }}</p><div class="ending-stats"><span>踏过 {{ challengeMetrics.manualSteps }} 步</span><span>用时 {{ ((manualElapsedMs ?? 0) / 1000).toFixed(1) }} 秒</span><span>{{ challengeMetrics.badge }}</span></div><button class="ink-button" @click="changeScene(sceneIndex < scenes.length - 1 ? sceneIndex + 1 : 0)">{{ sceneIndex < scenes.length - 1 ? `踏入下一章：${scenes[sceneIndex + 1]!.title}` : '重回古道起点，再涉迷阵' }} <span>↗</span></button></div></dialog>
  </main>
</template>
