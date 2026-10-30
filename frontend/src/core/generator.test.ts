import { describe, expect, it } from "vitest";
import { generateMazeWithTrace, replayGeneratorTrace } from "./generator";
import { generateMaze } from "./maze";

const algorithms = ["dfs", "prim", "kruskal"] as const;

describe("generateMazeWithTrace", () => {
  it.each(algorithms)("creates a deterministic connected perfect maze with %s", (algorithm) => {
    const first = generateMazeWithTrace(11, 12345, algorithm);
    const second = generateMazeWithTrace(11, 12345, algorithm);

    expect(first.maze.cells).toEqual(second.maze.cells);
    expect(first.events).toEqual(second.events);
    expect(first.metrics).toEqual(second.metrics);
    expect(first.metrics).toMatchObject({ logicalCellCount: 25, carvedEdgeCount: 24, componentCount: 1, cycleRank: 0, generatorId: algorithm, generatorVersion: 1 });
    expect(first.events[0]).toMatchObject({ type: "start", algorithm });
    expect(first.events[first.events.length - 1]).toEqual({ type: "complete", carvedEdgeCount: 24 });
    expect(first.maze.cells.every((row, rowIndex) => row.every((cell, colIndex) => rowIndex === 0 || colIndex === 0 || rowIndex === 10 || colIndex === 10 || cell === 0 || cell === 1))).toBe(true);
  });

  it("keeps the traced DFS matrix compatible with the legacy generator", () => {
    expect(generateMazeWithTrace(11, 12345, "dfs").maze.cells).toEqual(generateMaze(11, 12345).cells);
  });

  it("exposes algorithm-specific process events", () => {
    expect(generateMazeWithTrace(11, 9, "dfs").events.some((event) => event.type === "backtrack")).toBe(true);
    expect(generateMazeWithTrace(11, 9, "prim").events.some((event) => event.type === "frontier")).toBe(true);
    expect(generateMazeWithTrace(11, 9, "kruskal").events.some((event) => event.type === "union")).toBe(true);
    expect(generateMazeWithTrace(11, 9, "kruskal").events.some((event) => event.type === "skip" && event.reason === "cycle")).toBe(true);
  });

  it("replays carved edges and frontier snapshots for backward and forward controls", () => {
    const trace = generateMazeWithTrace(11, 9, "prim");
    const partial = replayGeneratorTrace(trace.events, 4);
    const complete = replayGeneratorTrace(trace.events);

    expect(partial.carvedEdges.length).toBeLessThan(complete.carvedEdges.length);
    expect(partial.completed).toBe(false);
    expect(complete.carvedEdges.length).toBe(24);
    expect(complete.completed).toBe(true);
  });
});
