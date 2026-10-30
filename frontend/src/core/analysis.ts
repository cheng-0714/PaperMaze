import type { Maze, Point } from "./maze";
import { pointKey } from "./maze";

export type DistanceField = ReadonlyArray<ReadonlyArray<number | null>>;
export type StructureReport = {
  passageRatio: number;
  deadEnds: number;
  junctions: number;
  shortestPathLength: number | null;
  curvature: "直达" | "曲折" | "蜿蜒";
  exploration: "开阔" | "探索" | "复杂";
  reachablePassages: number;
  distanceField: DistanceField;
};

const neighbors = (maze: Maze, point: Point) => [
  { row: point.row - 1, col: point.col },
  { row: point.row, col: point.col + 1 },
  { row: point.row + 1, col: point.col },
  { row: point.row, col: point.col - 1 },
].filter(({ row, col }) => row >= 0 && col >= 0 && row < maze.size && col < maze.size && maze.cells[row]?.[col] === 0);

export function buildDistanceField(maze: Maze): DistanceField {
  const field = Array.from({ length: maze.size }, () => Array<number | null>(maze.size).fill(null));
  const queue: Point[] = [maze.goal];
  field[maze.goal.row]![maze.goal.col] = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const next of neighbors(maze, current)) {
      if (field[next.row]![next.col] !== null) continue;
      field[next.row]![next.col] = field[current.row]![current.col]! + 1;
      queue.push(next);
    }
  }
  return field;
}

export function analyzeMaze(maze: Maze): StructureReport {
  let passages = 0;
  let deadEnds = 0;
  let junctions = 0;
  for (let row = 0; row < maze.size; row += 1) for (let col = 0; col < maze.size; col += 1) {
    if (maze.cells[row]?.[col] !== 0) continue;
    passages += 1;
    const degree = neighbors(maze, { row, col }).length;
    if (degree === 1) deadEnds += 1;
    if (degree >= 3) junctions += 1;
  }
  const distanceField = buildDistanceField(maze);
  const shortestPathLength = distanceField[maze.start.row]?.[maze.start.col] ?? null;
  const reachablePassages = distanceField.flat().filter((value) => value !== null).length;
  const passageRatio = passages / (maze.size * maze.size);
  const curvature = shortestPathLength === null ? "蜿蜒" : shortestPathLength < maze.size * 0.9 ? "直达" : shortestPathLength < maze.size * 1.8 ? "曲折" : "蜿蜒";
  const junctionRatio = passages ? junctions / passages : 0;
  const exploration = junctionRatio < 0.08 ? "开阔" : junctionRatio < 0.16 ? "探索" : "复杂";
  return { passageRatio, deadEnds, junctions, shortestPathLength, curvature, exploration, reachablePassages, distanceField };
}

export function manualMetrics(path: readonly Point[], shortestPathLength: number | null, reachablePassages: number, collisionCount: number, elapsedMs: number | null) {
  const manualSteps = Math.max(0, path.length - 1);
  const detourRate = shortestPathLength && shortestPathLength > 0 ? Math.max(0, (manualSteps - shortestPathLength) / shortestPathLength) : null;
  const efficiency = manualSteps > 0 && shortestPathLength !== null ? shortestPathLength / manualSteps : null;
  const explorationCoverage = reachablePassages > 0 ? new Set(path.map(pointKey)).size / reachablePassages : 0;
  const badge = efficiency === null ? "仍在途中" : efficiency >= 0.95 ? "精敏行者" : efficiency >= 0.75 ? "步履笃定" : "不畏险远";
  return { manualSteps, shortestPathLength, detourRate, efficiency, explorationCoverage, collisionCount, elapsedMs, badge };
}

