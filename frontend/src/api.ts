import type { Maze, Point } from "./core/maze";

export type RunMode = "manual" | "bfs" | "astar";

export type Run = {
  id: string;
  schemaVersion: 1;
  mode: RunMode;
  maze: Maze;
  found: boolean;
  path: Point[];
  visitedOrder: Point[] | null;
  computeMs: number | null;
  manualElapsedMs: number | null;
  createdAt?: string;
  pathLength?: number | null;
  visitedCount?: number | null;
};

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(typeof body.detail === "string" ? body.detail : "请求失败");
  }
  return response.json() as Promise<T>;
}

export const createRun = async (run: Run) =>
  json<Run>(await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(run) }));

export const listRuns = async () => json<{ items: Run[] }>(await fetch("/api/runs"));
