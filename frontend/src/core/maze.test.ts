import { describe, expect, it } from "vitest";
import { applyEdit, generateMaze, movePlayer, parseChallengeCode, toChallengeCode, type Maze } from "./maze";
import { searchMaze } from "./search";

describe("maze", () => {
  it("recreates the same connected maze from a seed", () => {
    for (const size of [11, 21, 31] as const) {
      const first = generateMaze(size, 12345);
      const second = generateMaze(size, 12345);
      expect(first).toEqual(second);
      expect(first.cells[first.start.row]?.[first.start.col]).toBe(0);
      expect(first.cells[first.goal.row]?.[first.goal.col]).toBe(0);
      expect(first.start).not.toEqual(first.goal);
      expect(searchMaze(first, "bfs").found).toBe(true);
    }
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

  it("edits passages, start and goal while protecting the border and markers", () => {
    const maze = generateMaze(11, 77);
    expect(applyEdit(maze, "passage", { row: 0, col: 1 }).error).toBe("border");
    expect(applyEdit(maze, "wall", maze.start).error).toBe("marker");
    expect(applyEdit(maze, "goal", { row: 2, col: 2 }).error).toBe("wall");
    const moved = applyEdit(maze, "start", { row: 1, col: 2 });
    expect(moved.error).toBeNull();
    expect(moved.maze.start).toEqual({ row: 1, col: 2 });
    expect(moved.maze.cells[1]?.[2]).toBe(0);
    expect(moved.maze.edited).toBe(true);
  });

  it("round-trips a deterministic challenge code", () => {
    const maze = generateMaze(21, 12345);
    expect(toChallengeCode(maze)).toBe("PM1-21-12345");
    expect(parseChallengeCode("PM1-21-12345")).toEqual({ size: 21, seed: 12345 });
    expect(parseChallengeCode("bad-code")).toBeNull();
  });
});
