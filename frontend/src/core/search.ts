import { pointKey as key, type Maze, type Point } from "./maze";

export type SearchAlgorithm = "bfs" | "astar";

export type SearchResult = {
  found: boolean;
  path: Point[];
  visitedOrder: Point[];
  computeMs: number;
};

export type SearchTeachingEvent =
  | { type: "start"; point: Point }
  | { type: "dequeue"; point: Point }
  | { type: "inspect"; from: Point; to: Point; outcome: "boundary" | "wall" | "visited" | "discover" }
  | { type: "discover"; from: Point; to: Point; distance: number }
  | { type: "finish"; found: boolean };

export type BfsTeachingState = {
  current: Point | null;
  queue: Point[];
  visited: Point[];
  parents: Map<string, Point>;
  completed: boolean;
  found: boolean;
  path: Point[];
};

export type BfsTeachingTrace = {
  events: SearchTeachingEvent[];
  result: SearchResult;
};
export type AstarCandidate = { point: Point; g: number; h: number; f: number };

export type AstarTeachingEvent =
  | { type: "start"; candidate: AstarCandidate }
  | { type: "select"; candidate: AstarCandidate }
  | { type: "inspect"; from: Point; to: Point; outcome: "boundary" | "wall" | "queued" | "discover" | "relax" }
  | { type: "discover"; from: Point; to: Point; candidate: AstarCandidate }
  | { type: "relax"; from: Point; to: Point; candidate: AstarCandidate }
  | { type: "finish"; found: boolean };

export type AstarTeachingState = {
  current: AstarCandidate | null;
  frontier: AstarCandidate[];
  visited: Point[];
  parents: Map<string, Point>;
  scores: Map<string, AstarCandidate>;
  completed: boolean;
  found: boolean;
  path: Point[];
};

export type AstarTeachingTrace = {
  events: AstarTeachingEvent[];
  result: SearchResult;
};

const neighbors = (maze: Maze, point: Point): Point[] => [
  { row: point.row - 1, col: point.col },
  { row: point.row, col: point.col + 1 },
  { row: point.row + 1, col: point.col },
  { row: point.row, col: point.col - 1 },
].filter(({ row, col }) => row >= 0 && col >= 0 && row < maze.size && col < maze.size && maze.cells[row]?.[col] === 0);

const candidateNeighbors = (point: Point): Point[] => [
  { row: point.row - 1, col: point.col },
  { row: point.row, col: point.col + 1 },
  { row: point.row + 1, col: point.col },
  { row: point.row, col: point.col - 1 },
];

function buildPath(parents: Map<string, Point>, goal: Point): Point[] {
  const path = [goal];
  let current = goal;
  while (parents.has(key(current))) {
    current = parents.get(key(current))!;
    path.push(current);
  }
  return path.reverse();
}

export function buildBfsTeachingTrace(maze: Maze): BfsTeachingTrace {
  const started = performance.now();
  const queue: Point[] = [maze.start];
  const queued = new Set([key(maze.start)]);
  const parents = new Map<string, Point>();
  const distances = new Map([[key(maze.start), 0]]);
  const visitedOrder: Point[] = [];
  const events: SearchTeachingEvent[] = [{ type: "start", point: maze.start }];
  let found = false;

  while (queue.length) {
    const current = queue.shift()!;
    visitedOrder.push(current);
    events.push({ type: "dequeue", point: current });
    if (key(current) === key(maze.goal)) {
      found = true;
      events.push({ type: "finish", found: true });
      break;
    }
    for (const next of candidateNeighbors(current)) {
      if (next.row < 0 || next.col < 0 || next.row >= maze.size || next.col >= maze.size) {
        events.push({ type: "inspect", from: current, to: next, outcome: "boundary" });
        continue;
      }
      if (maze.cells[next.row]?.[next.col] !== 0) {
        events.push({ type: "inspect", from: current, to: next, outcome: "wall" });
        continue;
      }
      if (queued.has(key(next))) {
        events.push({ type: "inspect", from: current, to: next, outcome: "visited" });
        continue;
      }
      queued.add(key(next));
      parents.set(key(next), current);
      distances.set(key(next), distances.get(key(current))! + 1);
      queue.push(next);
      events.push({ type: "inspect", from: current, to: next, outcome: "discover" });
      events.push({ type: "discover", from: current, to: next, distance: distances.get(key(next))! });
    }
  }
  if (!found) events.push({ type: "finish", found: false });
  const path = found ? buildPath(parents, maze.goal) : [];
  return { events, result: { found, path, visitedOrder, computeMs: performance.now() - started } };
}

export function replayBfsTeaching(events: readonly SearchTeachingEvent[], cursor = events.length): BfsTeachingState {
  const state: BfsTeachingState = { current: null, queue: [], visited: [], parents: new Map(), completed: false, found: false, path: [] };
  for (const event of events.slice(0, Math.max(0, Math.min(cursor, events.length)))) {
    if (event.type === "start") {
      state.queue = [event.point];
      state.visited = [event.point];
      continue;
    }
    if (event.type === "dequeue") {
      state.current = event.point;
      state.queue = state.queue.slice(1);
      continue;
    }
    if (event.type === "discover") {
      state.queue = [...state.queue, event.to];
      state.visited = [...state.visited, event.to];
      state.parents.set(key(event.to), event.from);
      continue;
    }
    if (event.type === "finish") {
      state.completed = true;
      state.found = event.found;
      state.path = event.found && state.current ? buildPath(state.parents, state.current) : [];
    }
  }
  return state;
}


const heuristic = (point: Point, goal: Point) => Math.abs(point.row - goal.row) + Math.abs(point.col - goal.col);

export function buildAstarTeachingTrace(maze: Maze): AstarTeachingTrace {
  const started = performance.now();
  const startHeuristic = heuristic(maze.start, maze.goal);
  const startCandidate: AstarCandidate = { point: maze.start, g: 0, h: startHeuristic, f: startHeuristic };
  const frontier: Array<{ candidate: AstarCandidate; order: number }> = [{ candidate: startCandidate, order: 0 }];
  const scores = new Map([[key(maze.start), startCandidate]]);
  const parents = new Map<string, Point>();
  const visitedOrder: Point[] = [];
  const events: AstarTeachingEvent[] = [{ type: "start", candidate: startCandidate }];
  let order = 1;
  let found = false;

  while (frontier.length) {
    frontier.sort((a, b) => a.candidate.f - b.candidate.f || a.candidate.h - b.candidate.h || a.order - b.order);
    const current = frontier.shift()!.candidate;
    events.push({ type: "select", candidate: current });
    visitedOrder.push(current.point);
    if (key(current.point) === key(maze.goal)) {
      found = true;
      events.push({ type: "finish", found: true });
      break;
    }
    for (const next of candidateNeighbors(current.point)) {
      if (next.row < 0 || next.col < 0 || next.row >= maze.size || next.col >= maze.size) {
        events.push({ type: "inspect", from: current.point, to: next, outcome: "boundary" });
        continue;
      }
      if (maze.cells[next.row]?.[next.col] !== 0) {
        events.push({ type: "inspect", from: current.point, to: next, outcome: "wall" });
        continue;
      }
      const nextKey = key(next);
      const nextG = current.g + 1;
      const nextH = heuristic(next, maze.goal);
      const candidate: AstarCandidate = { point: next, g: nextG, h: nextH, f: nextG + nextH };
      const previous = scores.get(nextKey);
      if (!previous) {
        scores.set(nextKey, candidate);
        parents.set(nextKey, current.point);
        frontier.push({ candidate, order: order++ });
        events.push({ type: "inspect", from: current.point, to: next, outcome: "discover" });
        events.push({ type: "discover", from: current.point, to: next, candidate });
      } else if (nextG < previous.g) {
        scores.set(nextKey, candidate);
        parents.set(nextKey, current.point);
        const staleIndex = frontier.findIndex((entry) => key(entry.candidate.point) === nextKey);
        if (staleIndex >= 0) frontier.splice(staleIndex, 1);
        frontier.push({ candidate, order: order++ });
        events.push({ type: "inspect", from: current.point, to: next, outcome: "relax" });
        events.push({ type: "relax", from: current.point, to: next, candidate });
      } else {
        events.push({ type: "inspect", from: current.point, to: next, outcome: "queued" });
      }
    }
  }
  if (!found) events.push({ type: "finish", found: false });
  const path = found ? buildPath(parents, maze.goal) : [];
  return { events, result: { found, path, visitedOrder, computeMs: performance.now() - started } };
}

export function replayAstarTeaching(events: readonly AstarTeachingEvent[], cursor = events.length): AstarTeachingState {
  const state: AstarTeachingState = { current: null, frontier: [], visited: [], parents: new Map(), scores: new Map(), completed: false, found: false, path: [] };
  const removeCandidate = (candidate: AstarCandidate) => {
    const index = state.frontier.findIndex((entry) => key(entry.point) === key(candidate.point) && entry.g === candidate.g);
    if (index >= 0) state.frontier.splice(index, 1);
  };
  for (const event of events.slice(0, Math.max(0, Math.min(cursor, events.length)))) {
    if (event.type === "start") {
      state.frontier = [event.candidate];
      state.scores.set(key(event.candidate.point), event.candidate);
      continue;
    }
    if (event.type === "select") {
      state.current = event.candidate;
      removeCandidate(event.candidate);
      state.visited = [...state.visited, event.candidate.point];
      continue;
    }
    if (event.type === "discover" || event.type === "relax") {
      if (event.type === "relax") removeCandidate(event.candidate);
      state.frontier = [...state.frontier, event.candidate];
      state.scores.set(key(event.candidate.point), event.candidate);
      state.parents.set(key(event.to), event.from);
      continue;
    }
    if (event.type === "finish") {
      state.completed = true;
      state.found = event.found;
      state.path = event.found && state.current ? buildPath(state.parents, state.current.point) : [];
    }
  }
  return state;
}

export function searchMaze(maze: Maze, algorithm: SearchAlgorithm): SearchResult {
  const started = performance.now();
  const frontier: Array<{ point: Point; g: number; order: number }> = [{ point: maze.start, g: 0, order: 0 }];
  const queued = new Set([key(maze.start)]);
  const parents = new Map<string, Point>();
  const visitedOrder: Point[] = [];
  let order = 1;

  while (frontier.length) {
    if (algorithm === "astar") {
      frontier.sort((a, b) => {
        const af = a.g + Math.abs(a.point.row - maze.goal.row) + Math.abs(a.point.col - maze.goal.col);
        const bf = b.g + Math.abs(b.point.row - maze.goal.row) + Math.abs(b.point.col - maze.goal.col);
        const ah = Math.abs(a.point.row - maze.goal.row) + Math.abs(a.point.col - maze.goal.col);
        const bh = Math.abs(b.point.row - maze.goal.row) + Math.abs(b.point.col - maze.goal.col);
        return af - bf || ah - bh || a.order - b.order;
      });
    }
    const current = frontier.shift()!;
    visitedOrder.push(current.point);
    if (key(current.point) === key(maze.goal)) {
      return { found: true, path: buildPath(parents, current.point), visitedOrder, computeMs: performance.now() - started };
    }
    for (const next of neighbors(maze, current.point)) {
      const nextKey = key(next);
      const nextG = current.g + 1;
      if (queued.has(nextKey)) {
        if (algorithm === "astar") {
          const pending = frontier.find((entry) => key(entry.point) === nextKey);
          if (pending && nextG < pending.g) {
            pending.g = nextG;
            parents.set(nextKey, current.point);
          }
        }
        continue;
      }
      queued.add(nextKey);
      parents.set(nextKey, current.point);
      frontier.push({ point: next, g: nextG, order: order++ });
    }
  }

  return { found: false, path: [], visitedOrder, computeMs: performance.now() - started };
}

export function validatePath(maze: Maze, path: readonly Point[]): boolean {
  if (!path.length || key(path[0]!) !== key(maze.start) || key(path[path.length - 1]!) !== key(maze.goal)) return false;
  return path.every((point, index) => {
    if (maze.cells[point.row]?.[point.col] !== 0) return false;
    if (index === 0) return true;
    const previous = path[index - 1]!;
    return Math.abs(previous.row - point.row) + Math.abs(previous.col - point.col) === 1;
  });
}
