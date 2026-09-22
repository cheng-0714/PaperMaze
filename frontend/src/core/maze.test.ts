import { describe, expect, it } from "vitest";
import { generateMaze, movePlayer, type Maze } from "./maze";

describe("maze", () => {
  it("recreates the same connected maze from a seed", () => {
    const first = generateMaze(11, 12345);
    const second = generateMaze(11, 12345);

    expect(first).toEqual(second);
    expect(first.cells[first.start.row]?.[first.start.col]).toBe(0);
    expect(first.cells[first.goal.row]?.[first.goal.col]).toBe(0);
    expect(first.start).not.toEqual(first.goal);
  });

  it("moves only to an in-bounds passage", () => {
    const maze: Maze = {
      size: 3 as const,
      seed: 1,
      generatorVersion: 1,
      edited: false,
      start: { row: 1, col: 1 },
      goal: { row: 1, col: 2 },
      cells: [
        [1, 1, 1],
        [1, 0, 0],
        [1, 1, 1],
      ],
    };

    expect(movePlayer(maze, maze.start, "right")).toEqual({ position: { row: 1, col: 2 }, blocked: null });
    expect(movePlayer(maze, maze.start, "left")).toEqual({ position: maze.start, blocked: "wall" });
    expect(movePlayer(maze, { row: 0, col: 0 }, "up")).toEqual({
      position: { row: 0, col: 0 },
      blocked: "boundary",
    });
  });
});
