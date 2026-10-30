import { describe, expect, it } from "vitest";
import { analyzeMaze, manualMetrics } from "./analysis";
import type { Maze } from "./maze";

const corridor: Maze = { size: 5, seed: 1, generatorVersion: 1, edited: true, start: { row: 1, col: 1 }, goal: { row: 1, col: 3 }, cells: [[1,1,1,1,1],[1,0,0,0,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1]] };

describe("maze analysis", () => {
  it("builds a reverse distance field and structural counts", () => {
    const report = analyzeMaze(corridor);
    expect(report.shortestPathLength).toBe(2);
    expect(report.distanceField[1]?.[1]).toBe(2);
    expect(report.deadEnds).toBe(2);
    expect(report.junctions).toBe(0);
  });
  it("returns explicit unavailable ratios for an unreachable challenge", () => {
    const report = analyzeMaze({ ...corridor, goal: { row: 3, col: 3 }, cells: corridor.cells.map((row) => [...row]) });
    expect(report.shortestPathLength).toBeNull();
    expect(manualMetrics([corridor.start], null, report.reachablePassages, 2, null).detourRate).toBeNull();
  });
  it("uses start-reachable passages as the coverage denominator on disconnected maps", () => {
    const cells = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 1 as 0 | 1));
    cells[1]![1] = 0; cells[1]![2] = 0; cells[1]![3] = 0; cells[9]![9] = 0;
    const report = analyzeMaze({ size: 11, seed: 1, generatorVersion: 1, edited: true, start: { row: 1, col: 1 }, goal: { row: 9, col: 9 }, cells });
    expect(report.shortestPathLength).toBeNull();
    expect(report.reachablePassages).toBe(3);
    expect(report.distanceField[9]?.[9]).toBe(0);
    expect(3 / Math.max(1, report.reachablePassages)).toBeLessThanOrEqual(1);
  });
});
