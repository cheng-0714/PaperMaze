import { describe, expect, it } from "vitest";
import type { Maze } from "./maze";
import { searchMaze, validatePath } from "./search";

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
});
