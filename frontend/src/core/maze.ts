export type Point = Readonly<{ row: number; col: number }>;
export type Direction = "up" | "down" | "left" | "right";
export type Cell = 0 | 1;

export type Maze = Readonly<{
  size: number;
  seed: number;
  generatorVersion: 1;
  edited: boolean;
  start: Point;
  goal: Point;
  cells: ReadonlyArray<ReadonlyArray<Cell>>;
}>;

export const SUPPORTED_SIZES = [11, 21, 31] as const;
export type EditTool = "wall" | "passage" | "start" | "goal";
export const pointKey = (point: Point) => `${point.row},${point.col}`;
export const samePoint = (a: Point, b: Point) => a.row === b.row && a.col === b.col;

const mulberry32 = (seed: number) => () => {
  let value = (seed += 0x6d2b79f5);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

export function generateMaze(size: number, seed: number): Maze {
  if (!SUPPORTED_SIZES.includes(size as (typeof SUPPORTED_SIZES)[number])) {
    throw new Error("Maze size must be 11, 21, or 31.");
  }
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new Error("Seed must be an integer from 1 to 4294967295.");
  }

  const cells: Cell[][] = Array.from({ length: size }, () => Array<Cell>(size).fill(1));
  const random = mulberry32(seed);
  const start = { row: 1, col: 1 };
  const stack: Point[] = [start];
  cells[start.row]![start.col] = 0;

  while (stack.length) {
    const current = stack[stack.length - 1]!;
    const candidates = [
      { row: current.row - 2, col: current.col },
      { row: current.row, col: current.col + 2 },
      { row: current.row + 2, col: current.col },
      { row: current.row, col: current.col - 2 },
    ].filter(({ row, col }) => row > 0 && col > 0 && row < size - 1 && col < size - 1 && cells[row]![col] === 1);

    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(random() * candidates.length)]!;
    cells[(current.row + next.row) / 2]![(current.col + next.col) / 2] = 0;
    cells[next.row]![next.col] = 0;
    stack.push(next);
  }

  return {
    size,
    seed,
    generatorVersion: 1,
    edited: false,
    start,
    goal: { row: size - 2, col: size - 2 },
    cells,
  };
}

const DELTA: Record<Direction, Point> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export function movePlayer(maze: Maze, position: Point, direction: Direction) {
  const delta = DELTA[direction];
  const next = { row: position.row + delta.row, col: position.col + delta.col };
  if (next.row < 0 || next.col < 0 || next.row >= maze.size || next.col >= maze.size) {
    return { position, blocked: "boundary" as const };
  }
  if (maze.cells[next.row]?.[next.col] !== 0) {
    return { position, blocked: "wall" as const };
  }
  return { position: next, blocked: null };
}

export function applyEdit(maze: Maze, tool: EditTool, point: Point): { maze: Maze; error: "border" | "marker" | "wall" | null } {
  if (point.row <= 0 || point.col <= 0 || point.row >= maze.size - 1 || point.col >= maze.size - 1) {
    return { maze, error: "border" };
  }
  if (tool === "wall" && (samePoint(point, maze.start) || samePoint(point, maze.goal))) {
    return { maze, error: "marker" };
  }
  if ((tool === "start" && samePoint(point, maze.goal)) || (tool === "goal" && samePoint(point, maze.start))) {
    return { maze, error: "marker" };
  }
  if ((tool === "start" || tool === "goal") && maze.cells[point.row]?.[point.col] !== 0) {
    return { maze, error: "wall" };
  }
  const cells = maze.cells.map((row) => [...row]);
  cells[point.row]![point.col] = tool === "wall" ? 1 : 0;
  return {
    maze: {
      ...maze,
      edited: true,
      cells,
      start: tool === "start" ? point : maze.start,
      goal: tool === "goal" ? point : maze.goal,
    },
    error: null,
  };
}

export const toChallengeCode = (maze: Maze) => `PM${maze.generatorVersion}-${maze.size}-${maze.seed}`;

export function parseChallengeCode(code: string): { size: 11 | 21 | 31; seed: number } | null {
  const match = /^PM1-(11|21|31)-([1-9]\d*)$/.exec(code.trim().toUpperCase());
  if (!match) return null;
  const seed = Number(match[2]);
  if (!Number.isInteger(seed) || seed > 0xffffffff) return null;
  return { size: Number(match[1]) as 11 | 21 | 31, seed };
}
