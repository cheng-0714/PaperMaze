import type { Maze, Point } from "./maze";

export type SearchAlgorithm = "bfs" | "astar";
export type SearchResult = {
  found: boolean;
  path: Point[];
  visitedOrder: Point[];
  computeMs: number;
};

const key = ({ row, col }: Point) => `${row},${col}`;
const neighbors = (maze: Maze, point: Point): Point[] => [
  { row: point.row - 1, col: point.col },
  { row: point.row, col: point.col + 1 },
  { row: point.row + 1, col: point.col },
  { row: point.row, col: point.col - 1 },
].filter(({ row, col }) => row >= 0 && col >= 0 && row < maze.size && col < maze.size && maze.cells[row]?.[col] === 0);

function buildPath(parents: Map<string, Point>, goal: Point): Point[] {
  const path = [goal];
  let current = goal;
  while (parents.has(key(current))) {
    current = parents.get(key(current))!;
    path.push(current);
  }
  return path.reverse();
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
        return af - bf || a.order - b.order;
      });
    }
    const current = frontier.shift()!;
    visitedOrder.push(current.point);
    if (key(current.point) === key(maze.goal)) {
      return { found: true, path: buildPath(parents, current.point), visitedOrder, computeMs: performance.now() - started };
    }
    for (const next of neighbors(maze, current.point)) {
      if (queued.has(key(next))) continue;
      queued.add(key(next));
      parents.set(key(next), current.point);
      frontier.push({ point: next, g: current.g + 1, order: order++ });
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
