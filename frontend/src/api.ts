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
  collisionCount?: number | null;
  wallCollisionCount?: number | null;
  boundaryCollisionCount?: number | null;
  createdAt?: string;
  pathLength?: number | null;
  visitedCount?: number | null;
};

export type RunSummary = Pick<Run, "id" | "mode" | "found" | "pathLength" | "visitedCount" | "computeMs" | "manualElapsedMs" | "createdAt"> & {
  mazeSize: number;
  seed: number;
  edited: boolean;
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

export const listRuns = async (mode?: RunMode) =>
  json<{ items: RunSummary[] }>(await fetch(`/api/runs${mode ? `?mode=${mode}` : ""}`));

export const getRun = async (id: string) => json<Run>(await fetch(`/api/runs/${encodeURIComponent(id)}`));

export async function deleteRun(id: string) {
  const response = await fetch(`/api/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("删除失败");
}
