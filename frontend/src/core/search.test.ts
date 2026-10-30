import { describe, expect, it } from "vitest";
import type { Maze } from "./maze";
import { buildAstarTeachingTrace, buildBfsTeachingTrace, replayAstarTeaching, replayBfsTeaching, searchMaze, validatePath } from "./search";

const maze = (cells: Maze["cells"], goal = { row: 1, col: 3 }): Maze => ({
  size: cells.length,
  seed: 1,
  generatorVersion: 1,
  edited: true,
  start: { row: 1, col: 1 },
  goal,
  cells,
});

describe("searchMaze", () => {
  it("solves a straight corridor", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    expect(searchMaze(input, "bfs").path).toHaveLength(3);
  });

  it("BFS returns a shortest valid path without changing the maze", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const before = JSON.stringify(input);
    const result = searchMaze(input, "bfs");

    expect(result.found).toBe(true);
    expect(result.path).toEqual([{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]);
    expect(validatePath(input, result.path)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("reports an unreachable goal with an empty path", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const before = JSON.stringify(input);
    expect(searchMaze(input, "bfs")).toMatchObject({ found: false, path: [] });
    expect(searchMaze(input, "astar")).toMatchObject({ found: false, path: [] });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("takes the legal detour around a wall", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const result = searchMaze(input, "bfs");
    expect(result.found).toBe(true);
    expect(result.path).toHaveLength(7);
    expect(validatePath(input, result.path)).toBe(true);
  });

  it("A* finds a path no longer than BFS and visits no more nodes on the fixture", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const bfs = searchMaze(input, "bfs");
    const astar = searchMaze(input, "astar");
    expect(astar.found).toBe(true);
    expect(astar.path.length).toBe(bfs.path.length);
    expect(astar.visitedOrder.length).toBeLessThanOrEqual(bfs.visitedOrder.length);
  });

  it("A* improves an already discovered route on an edited maze with cycles", () => {
    const input = maze([
      "11111111111",
      "10000010101",
      "11001000101",
      "11001011011",
      "10000000001",
      "10010101001",
      "10000000111",
      "10000110101",
      "10000001011",
      "10000000001",
      "11111111111",
    ].map((row) => Array.from(row, (cell) => Number(cell) as 0 | 1)), { row: 9, col: 9 });
    const before = JSON.stringify(input);
    const bfs = searchMaze(input, "bfs");
    const astar = searchMaze(input, "astar");

    expect(bfs.path.length - 1).toBe(16);
    expect(astar.path.length).toBe(bfs.path.length);
    expect(validatePath(input, astar.path)).toBe(true);
    expect(new Set(astar.visitedOrder.map((point) => `${point.row},${point.col}`)).size).toBe(astar.visitedOrder.length);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("buildBfsTeachingTrace", () => {
  it("records queue decisions and replays reversible BFS state", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const trace = buildBfsTeachingTrace(input);
    const types = trace.events.map((event) => event.type);

    expect(types[0]).toBe("start");
    expect(types).toContain("dequeue");
    expect(types).toContain("discover");
    expect(types).toContain("inspect");
    expect(types[types.length - 1]).toBe("finish");
    expect(trace.result.found).toBe(true);
    expect(validatePath(input, trace.result.path)).toBe(true);

    const firstStep = replayBfsTeaching(trace.events, 1);
    expect(firstStep.queue).toEqual([{ row: 1, col: 1 }]);
    expect(firstStep.visited).toEqual([{ row: 1, col: 1 }]);
    expect(firstStep.completed).toBe(false);

    const completed = replayBfsTeaching(trace.events, trace.events.length);
    expect(completed.completed).toBe(true);
    expect(completed.found).toBe(true);
    expect(completed.path).toEqual(trace.result.path);
    expect(replayBfsTeaching(trace.events, trace.events.length - 1).completed).toBe(false);
  });

  it("records an explicit unsuccessful finish for an unreachable goal", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const trace = buildBfsTeachingTrace(input);

    expect(trace.result).toMatchObject({ found: false, path: [] });
    expect(trace.events[trace.events.length - 1]).toEqual({ type: "finish", found: false });
    expect(replayBfsTeaching(trace.events, trace.events.length)).toMatchObject({ completed: true, found: false, path: [] });
  });
});

describe("buildAstarTeachingTrace", () => {
  it("drops stale frontier candidates after relaxation on cyclic maps", () => {
    const input = maze([
      "11111111111",
      "10000010101",
      "11001000101",
      "11001011011",
      "10000000001",
      "10010101001",
      "10000000111",
      "10000110101",
      "10000001011",
      "10000000001",
      "11111111111",
    ].map((row) => Array.from(row, (cell) => Number(cell) as 0 | 1)), { row: 9, col: 9 });
    const trace = buildAstarTeachingTrace(input);
    const firstRelax = trace.events.findIndex((event) => event.type === "relax");
    expect(firstRelax).toBeGreaterThanOrEqual(0);
    const state = replayAstarTeaching(trace.events, firstRelax + 1);
    const counts = new Map<string, number>();
    for (const entry of state.frontier) {
            const id = `${entry.point.row},${entry.point.col}`;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
  });

  it("records priority scores and reconstructs the shortest path", () => {
    const input = maze([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const trace = buildAstarTeachingTrace(input);
    const types = trace.events.map((event) => event.type);
    const initial = replayAstarTeaching(trace.events, 1);
    const completed = replayAstarTeaching(trace.events, trace.events.length);

    expect(types[0]).toBe("start");
    expect(types).toContain("select");
    expect(types).toContain("discover");
    expect(types[types.length - 1]).toBe("finish");
    expect(initial.frontier[0]).toMatchObject({ g: 0, h: 2, f: 2 });
    expect(trace.result.path.length).toBe(searchMaze(input, "bfs").path.length);
    expect(completed.completed).toBe(true);
    expect(completed.found).toBe(true);
    expect(completed.path).toEqual(trace.result.path);
  });
});
