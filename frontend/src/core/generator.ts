import { type Cell, type Maze, type Point } from "./maze";

export type GeneratorAlgorithm = "dfs" | "prim" | "kruskal";
export type LogicalCell = Point;
export type GeneratorEdge = Readonly<{
  from: LogicalCell;
  to: LogicalCell;
  wall: Point;
}>;

export type GeneratorEvent =
  | Readonly<{ type: "start"; algorithm: GeneratorAlgorithm; logicalCellCount: number }>
  | Readonly<{ type: "visit"; cell: LogicalCell; stack?: ReadonlyArray<LogicalCell> }>
  | Readonly<{ type: "backtrack"; cell: LogicalCell; stack: ReadonlyArray<LogicalCell> }>
  | Readonly<{ type: "frontier"; cell: LogicalCell; frontier: ReadonlyArray<GeneratorEdge> }>
  | Readonly<{
      type: "candidate";
      edge: GeneratorEdge;
      stack?: ReadonlyArray<LogicalCell>;
      frontier?: ReadonlyArray<GeneratorEdge>;
    }>
  | Readonly<{ type: "carve"; edge: GeneratorEdge; carvedEdgeCount: number }>
  | Readonly<{ type: "skip"; edge: GeneratorEdge; reason: "visited" | "cycle" | "duplicate" }>
  | Readonly<{
      type: "union";
      edge: GeneratorEdge;
      roots: readonly [number, number];
      componentCount: number;
    }>
  | Readonly<{ type: "complete"; carvedEdgeCount: number }>;

export type GeneratorMetrics = Readonly<{
  logicalCellCount: number;
  carvedEdgeCount: number;
  componentCount: number;
  deadEnds: number;
  junctions: number;
  cycleRank: number;
  generatorId: GeneratorAlgorithm;
  generatorVersion: 1;
}>;

export type MazeGeneratorResult = Readonly<{
  maze: Maze;
  events: ReadonlyArray<GeneratorEvent>;
  metrics: GeneratorMetrics;
}>;
export type GeneratorPlaybackState = Readonly<{
  current: LogicalCell | null;
  stack: ReadonlyArray<LogicalCell>;
  frontier: ReadonlyArray<GeneratorEdge>;
  carvedEdges: ReadonlyArray<GeneratorEdge>;
  componentCount: number;
  completed: boolean;
}>;

type EdgeState = {
  readonly from: number;
  readonly to: number;
  readonly edge: GeneratorEdge;
  readonly key: string;
};

const DIRECTIONS = [
  { row: -2, col: 0 },
  { row: 0, col: 2 },
  { row: 2, col: 0 },
  { row: 0, col: -2 },
] as const;

const random32 = (seed: number) => () => {
  let value = (seed += 0x6d2b79f5);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const immutableArray = <T>(items: readonly T[]): ReadonlyArray<T> => Object.freeze(items.slice());

const immutablePoint = (row: number, col: number): Point => Object.freeze({ row, col });

function validateInputs(size: number, seed: number): void {
  if (!Number.isInteger(size) || size < 5 || size % 2 === 0) {
    throw new Error("Maze size must be an odd integer of at least 5.");
  }
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new Error("Seed must be an integer from 1 to 4294967295.");
  }
}

function makeLogicalCells(size: number): {
  cells: ReadonlyArray<LogicalCell>;
  indexAt: Map<string, number>;
} {
  const cells: LogicalCell[] = [];
  const indexAt = new Map<string, number>();
  for (let row = 1; row < size - 1; row += 2) {
    for (let col = 1; col < size - 1; col += 2) {
      indexAt.set(`${row},${col}`, cells.length);
      cells.push(immutablePoint(row, col));
    }
  }
  return { cells: immutableArray(cells), indexAt };
}

function edgeFor(
  cells: ReadonlyArray<LogicalCell>,
  from: number,
  to: number,
): GeneratorEdge {
  const source = cells[from]!;
  const target = cells[to]!;
  return Object.freeze({
    from: source,
    to: target,
    wall: immutablePoint((source.row + target.row) / 2, (source.col + target.col) / 2),
  });
}

function edgeKey(from: number, to: number): string {
  return from < to ? `${from}:${to}` : `${to}:${from}`;
}

function neighbours(
  cells: ReadonlyArray<LogicalCell>,
  indexAt: ReadonlyMap<string, number>,
  index: number,
): number[] {
  const current = cells[index]!;
  const result: number[] = [];
  for (const delta of DIRECTIONS) {
    const neighbour = indexAt.get(`${current.row + delta.row},${current.col + delta.col}`);
    if (neighbour !== undefined) result.push(neighbour);
  }
  return result;
}

function freezeMaze(size: number, seed: number, cells: Cell[][], logical: ReadonlyArray<LogicalCell>, algorithm: GeneratorAlgorithm): Maze {
  const rows = cells.map((row) => Object.freeze(row.slice()) as ReadonlyArray<Cell>);
  return Object.freeze({
    size,
    seed,
    generatorVersion: 1 as const,
    generatorId: algorithm,
    edited: false,
    start: logical[0]!,
    goal: logical[logical.length - 1]!,
    cells: Object.freeze(rows),
  });
}

function makeMetrics(
  algorithm: GeneratorAlgorithm,
  logicalCellCount: number,
  carvedEdges: ReadonlyArray<EdgeState>,
  cells: ReadonlyArray<LogicalCell>,
): GeneratorMetrics {
  const adjacency: number[][] = Array.from({ length: logicalCellCount }, () => []);
  for (const edge of carvedEdges) {
    adjacency[edge.from]!.push(edge.to);
    adjacency[edge.to]!.push(edge.from);
  }

  const seen = new Uint8Array(logicalCellCount);
  let componentCount = 0;
  for (let start = 0; start < logicalCellCount; start += 1) {
    if (seen[start]) continue;
    componentCount += 1;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!;
      for (const next of adjacency[current]!) {
        if (!seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
  }

  let deadEnds = 0;
  let junctions = 0;
  for (const links of adjacency) {
    if (links.length === 1) deadEnds += 1;
    if (links.length >= 3) junctions += 1;
  }

  return Object.freeze({
    logicalCellCount: cells.length,
    carvedEdgeCount: carvedEdges.length,
    componentCount,
    deadEnds,
    junctions,
    cycleRank: carvedEdges.length - logicalCellCount + componentCount,
    generatorId: algorithm,
    generatorVersion: 1 as const,
  });
}

function makeStartEvent(algorithm: GeneratorAlgorithm, logicalCellCount: number): GeneratorEvent {
  return Object.freeze({ type: "start", algorithm, logicalCellCount });
}

function carve(
  grid: Cell[][],
  edge: GeneratorEdge,
  visited: Uint8Array | null,
  destination: number,
  carvedEdges: EdgeState[],
  edgeState: EdgeState,
): void {
  grid[edge.wall.row]![edge.wall.col] = 0;
  grid[edge.to.row]![edge.to.col] = 0;
  if (visited) visited[destination] = 1;
  carvedEdges.push(edgeState);
}

function generateDfs(
  seed: number,
  logical: ReadonlyArray<LogicalCell>,
  indexAt: ReadonlyMap<string, number>,
  grid: Cell[][],
): { events: GeneratorEvent[]; carvedEdges: EdgeState[] } {
  const random = random32(seed);
  const visited = new Uint8Array(logical.length);
  const stack: number[] = [0];
  const carvedEdges: EdgeState[] = [];
  const events: GeneratorEvent[] = [makeStartEvent("dfs", logical.length)];
  visited[0] = 1;
  grid[logical[0]!.row]![logical[0]!.col] = 0;
  events.push(Object.freeze({ type: "visit", cell: logical[0]!, stack: immutableArray([logical[0]!]) }));

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const candidates = neighbours(logical, indexAt, current).filter((candidate) => !visited[candidate]);
    if (candidates.length === 0) {
      stack.pop();
      events.push(
        Object.freeze({
          type: "backtrack",
          cell: logical[current]!,
          stack: immutableArray(stack.map((index) => logical[index]!)),
        }),
      );
      continue;
    }

    const next = candidates[Math.floor(random() * candidates.length)]!;
    const edge = edgeFor(logical, current, next);
    const state: EdgeState = Object.freeze({ from: current, to: next, edge, key: edgeKey(current, next) });
    events.push(
      Object.freeze({
        type: "candidate",
        edge,
        stack: immutableArray(stack.map((index) => logical[index]!)),
      }),
    );
    carve(grid, edge, visited, next, carvedEdges, state);
    events.push(Object.freeze({ type: "carve", edge, carvedEdgeCount: carvedEdges.length }));
    stack.push(next);
    events.push(
      Object.freeze({
        type: "visit",
        cell: logical[next]!,
        stack: immutableArray(stack.map((index) => logical[index]!)),
      }),
    );
  }
  return { events, carvedEdges };
}

function generatePrim(
  seed: number,
  logical: ReadonlyArray<LogicalCell>,
  indexAt: ReadonlyMap<string, number>,
  grid: Cell[][],
): { events: GeneratorEvent[]; carvedEdges: EdgeState[] } {
  const random = random32(seed);
  const visited = new Uint8Array(logical.length);
  const frontier: EdgeState[] = [];
  const frontierKeys = new Set<string>();
  const carvedEdges: EdgeState[] = [];
  const events: GeneratorEvent[] = [makeStartEvent("prim", logical.length)];

  const addFrontier = (from: number) => {
    for (const to of neighbours(logical, indexAt, from)) {
      const key = edgeKey(from, to);
      if (!visited[to] && !frontierKeys.has(key)) {
        const edge = edgeFor(logical, from, to);
        frontier.push(Object.freeze({ from, to, edge, key }));
        frontierKeys.add(key);
      }
    }
  };

  visited[0] = 1;
  grid[logical[0]!.row]![logical[0]!.col] = 0;
  addFrontier(0);
  events.push(Object.freeze({ type: "visit", cell: logical[0]! }));
  events.push(
    Object.freeze({
      type: "frontier",
      cell: logical[0]!,
      frontier: immutableArray(frontier.map(({ edge }) => edge)),
    }),
  );

  while (frontier.length > 0) {
    const position = Math.floor(random() * frontier.length);
    const state = frontier.splice(position, 1)[0]!;
    frontierKeys.delete(state.key);
    events.push(
      Object.freeze({
        type: "candidate",
        edge: state.edge,
        frontier: immutableArray(frontier.map(({ edge }) => edge)),
      }),
    );
    if (visited[state.to]) {
      events.push(Object.freeze({ type: "skip", edge: state.edge, reason: "visited" }));
      continue;
    }

    carve(grid, state.edge, visited, state.to, carvedEdges, state);
    events.push(Object.freeze({ type: "carve", edge: state.edge, carvedEdgeCount: carvedEdges.length }));
    addFrontier(state.to);
    events.push(Object.freeze({ type: "visit", cell: logical[state.to]! }));
    events.push(
      Object.freeze({
        type: "frontier",
        cell: logical[state.to]!,
        frontier: immutableArray(frontier.map(({ edge }) => edge)),
      }),
    );
  }
  return { events, carvedEdges };
}

function generateKruskal(
  seed: number,
  logical: ReadonlyArray<LogicalCell>,
  indexAt: ReadonlyMap<string, number>,
  grid: Cell[][],
): { events: GeneratorEvent[]; carvedEdges: EdgeState[] } {
  const random = random32(seed);
  const parent = Array.from({ length: logical.length }, (_, index) => index);
  const rank = new Uint8Array(logical.length);
  let componentCount = logical.length;
  const edges: EdgeState[] = [];
  for (let from = 0; from < logical.length; from += 1) {
    const cell = logical[from]!;
    const right = indexAt.get(`${cell.row},${cell.col + 2}`);
    const down = indexAt.get(`${cell.row + 2},${cell.col}`);
    for (const to of [right, down]) {
      if (to !== undefined) {
        const edge = edgeFor(logical, from, to);
        edges.push(Object.freeze({ from, to, edge, key: edgeKey(from, to) }));
      }
    }
  }
  for (let index = edges.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [edges[index], edges[swap]] = [edges[swap]!, edges[index]!];
  }

  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[value] !== value) {
      const next = parent[value]!;
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (left: number, right: number): readonly [number, number] | null => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return null;
    if (rank[leftRoot]! < rank[rightRoot]!) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent[rightRoot] = leftRoot;
    if (rank[leftRoot] === rank[rightRoot]) rank[leftRoot]! += 1;
    componentCount -= 1;
    return Object.freeze([leftRoot, rightRoot] as const);
  };

  const carvedEdges: EdgeState[] = [];
  const events: GeneratorEvent[] = [makeStartEvent("kruskal", logical.length)];
  grid[logical[0]!.row]![logical[0]!.col] = 0;
  for (const state of edges) {
    events.push(Object.freeze({ type: "candidate", edge: state.edge }));
    const roots = union(state.from, state.to);
    if (!roots) {
      events.push(Object.freeze({ type: "skip", edge: state.edge, reason: "cycle" }));
      continue;
    }
    events.push(Object.freeze({ type: "union", edge: state.edge, roots, componentCount }));
    carve(grid, state.edge, null, state.to, carvedEdges, state);
    events.push(Object.freeze({ type: "carve", edge: state.edge, carvedEdgeCount: carvedEdges.length }));
  }
  return { events, carvedEdges };
}


export function generateMazeWithTrace(
  size: number,
  seed: number,
  algorithm: GeneratorAlgorithm,
): MazeGeneratorResult {
  validateInputs(size, seed);
  if (algorithm !== "dfs" && algorithm !== "prim" && algorithm !== "kruskal") {
    throw new Error("Unknown maze generator algorithm.");
  }

  const { cells: logical, indexAt } = makeLogicalCells(size);
  const grid: Cell[][] = Array.from({ length: size }, () => Array<Cell>(size).fill(1));
  let generated: { events: GeneratorEvent[]; carvedEdges: EdgeState[] };
  if (algorithm === "dfs") {
    generated = generateDfs(seed, logical, indexAt, grid);
  } else if (algorithm === "prim") {
    generated = generatePrim(seed, logical, indexAt, grid);
  } else {
    generated = generateKruskal(seed, logical, indexAt, grid);
  }

  generated.events.push(Object.freeze({ type: "complete", carvedEdgeCount: generated.carvedEdges.length }));
  const maze = freezeMaze(size, seed, grid, logical, algorithm);
  const metrics = makeMetrics(algorithm, logical.length, generated.carvedEdges, logical);
  return Object.freeze({
    maze,
    events: immutableArray(generated.events),
    metrics,
  });
}
export function replayGeneratorTrace(events: readonly GeneratorEvent[], cursor = events.length): GeneratorPlaybackState {
  const state = {
    current: null as LogicalCell | null,
    stack: [] as LogicalCell[],
    frontier: [] as GeneratorEdge[],
    carvedEdges: [] as GeneratorEdge[],
    componentCount: 0,
    completed: false,
  };
  for (const event of events.slice(0, Math.max(0, Math.min(cursor, events.length)))) {
    if (event.type === "visit") {
      state.current = event.cell;
      state.stack = event.stack ? [...event.stack] : state.stack;
    } else if (event.type === "backtrack") {
      state.current = event.cell;
      state.stack = [...event.stack];
    } else if (event.type === "frontier") {
      state.current = event.cell;
      state.frontier = [...event.frontier];
    } else if (event.type === "candidate") {
      state.current = event.edge.from;
      if (event.stack) state.stack = [...event.stack];
      if (event.frontier) state.frontier = [...event.frontier];
    } else if (event.type === "carve") {
      state.carvedEdges = [...state.carvedEdges, event.edge];
      state.current = event.edge.to;
    } else if (event.type === "union") {
      state.componentCount = event.componentCount;
    } else if (event.type === "complete") {
      state.completed = true;
    }
  }
  return Object.freeze({
    current: state.current,
    stack: Object.freeze(state.stack),
    frontier: Object.freeze(state.frontier),
    carvedEdges: Object.freeze(state.carvedEdges),
    componentCount: state.componentCount,
    completed: state.completed,
  });
}
