from contextlib import asynccontextmanager
from datetime import UTC, datetime
import os
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.storage import delete_run, get_run, initialize, insert_run, list_runs


class Point(BaseModel):
    row: int = Field(ge=0)
    col: int = Field(ge=0)


class MazeSnapshot(BaseModel):
    size: Literal[11, 21, 31, 41, 51]
    seed: int = Field(ge=1, le=4_294_967_295)
    generatorVersion: Literal[1]
    generatorId: Literal["dfs", "prim", "kruskal"] = "dfs"
    edited: bool
    start: Point
    goal: Point
    cells: list[list[Literal[0, 1]]]

    @model_validator(mode="after")
    def valid_grid(self):
        if len(self.cells) != self.size or any(len(row) != self.size for row in self.cells):
            raise ValueError("cells must match maze size")
        for name, point in (("start", self.start), ("goal", self.goal)):
            if point.row >= self.size or point.col >= self.size or self.cells[point.row][point.col] != 0:
                raise ValueError(f"{name} must be an in-bounds passage")
        if self.start == self.goal:
            raise ValueError("start and goal must differ")
        return self


class RunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    schemaVersion: Literal[1]
    mode: Literal["manual", "bfs", "astar"]
    maze: MazeSnapshot
    found: bool
    path: list[Point] = Field(max_length=10_000)
    visitedOrder: list[Point] | None = Field(max_length=2601)
    computeMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    manualElapsedMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    collisionCount: int | None = Field(default=None, ge=0, le=100_000)
    wallCollisionCount: int | None = Field(default=None, ge=0, le=100_000)
    boundaryCollisionCount: int | None = Field(default=None, ge=0, le=100_000)

    @model_validator(mode="after")
    def valid_run(self):
        if self.found and len(self.path) < 2:
            raise ValueError("a successful run must contain a path")
        if not self.found and self.path:
            raise ValueError("an unsuccessful run must have an empty path")
        if self.found and (self.path[0] != self.maze.start or self.path[-1] != self.maze.goal):
            raise ValueError("path must start and finish at the configured points")
        for point in self.path:
            if point.row >= self.maze.size or point.col >= self.maze.size or self.maze.cells[point.row][point.col] != 0:
                raise ValueError("path must stay on passages")
        for left, right in zip(self.path, self.path[1:]):
            if abs(left.row - right.row) + abs(left.col - right.col) != 1:
                raise ValueError("path steps must be orthogonally adjacent")
        if self.mode == "manual":
            if not self.found or self.visitedOrder is not None or self.computeMs is not None or self.manualElapsedMs is None:
                raise ValueError("manual metrics are inconsistent")
            fields = (self.collisionCount, self.wallCollisionCount, self.boundaryCollisionCount)
            if any(value is not None for value in fields) and (any(value is None for value in fields) or self.collisionCount != self.wallCollisionCount + self.boundaryCollisionCount):
                raise ValueError("manual collision fields must be complete")
        else:
            if self.visitedOrder is None or self.computeMs is None or self.manualElapsedMs is not None or self.collisionCount is not None or self.wallCollisionCount is not None or self.boundaryCollisionCount is not None:
                raise ValueError("search metrics are inconsistent")
            for point in self.visitedOrder:
                if point.row >= self.maze.size or point.col >= self.maze.size or self.maze.cells[point.row][point.col] != 0:
                    raise ValueError("visited nodes must stay on passages")
            visited_keys = {(point.row, point.col) for point in self.visitedOrder}
            if not self.visitedOrder or self.visitedOrder[0] != self.maze.start or len(visited_keys) != len(self.visitedOrder):
                raise ValueError("search trace must start at the configured start and contain unique nodes")
            goal_visited = (self.maze.goal.row, self.maze.goal.col) in visited_keys
            if goal_visited != self.found:
                raise ValueError("search trace and found state are inconsistent")
        return self


class ReportSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mazeSize: int = Field(ge=1, le=51)
    passageRatio: float = Field(ge=0, le=1)
    deadEnds: int = Field(ge=0, le=2601)
    junctions: int = Field(ge=0, le=2601)
    shortestPathLength: int | None = Field(default=None, ge=0, le=10_000)
    manualSteps: int | None = Field(default=None, ge=0, le=10_000)
    detourRate: float | None = Field(default=None, ge=0)
    bfsVisited: int | None = Field(default=None, ge=0, le=2601)
    astarVisited: int | None = Field(default=None, ge=0, le=2601)
    bfsPathLength: int | None = Field(default=None, ge=0, le=10_000)
    astarPathLength: int | None = Field(default=None, ge=0, le=10_000)
    bfsCoverage: float | None = Field(default=None, ge=0, le=1)
    astarCoverage: float | None = Field(default=None, ge=0, le=1)


def local_explanation(summary: ReportSummary) -> str:
    shortest = "暂无可达终点" if summary.shortestPathLength is None else f"起终点最短距离为 {summary.shortestPathLength} 步"
    compare = "尚未完成 BFS/A* 对比"
    if summary.bfsVisited is not None and summary.astarVisited is not None:
        compare = f"BFS 访问 {summary.bfsVisited} 个节点，A* 访问 {summary.astarVisited} 个节点；两者都以同一张地图为输入。"
    manual = "手动挑战尚未完成"
    if summary.manualSteps is not None:
        detour = "无法计算绕路率" if summary.detourRate is None else f"绕路率为 {summary.detourRate:.0%}"
        manual = f"手动路线走了 {summary.manualSteps} 步，{detour}。"
    return f"这是一张 {summary.mazeSize}×{summary.mazeSize} 的纸雕迷宫，通路率约 {summary.passageRatio:.0%}，有 {summary.deadEnds} 个死胡同和 {summary.junctions} 个分叉。{shortest}。{manual}{compare}"


def create_app(database: Path | str = Path("papermaze.sqlite3")) -> FastAPI:
    database_path = Path(database)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize(database_path)
        yield

    app = FastAPI(title="PaperMaze API", lifespan=lifespan)

    @app.post("/api/ai/explain")
    def explain(summary: ReportSummary):
        fallback = local_explanation(summary)
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            return {"text": fallback, "source": "local", "message": "未配置 DeepSeek，已使用本地解读"}
        payload = {
            "model": os.getenv("DEEPSEEK_MODEL", "deepseek-flash"),
            "stream": False,
            "thinking": {"type": "disabled"},
            "max_tokens": 280,
            "messages": [
                {"role": "system", "content": "你是课程项目演示助手。只根据给定数字，用简洁中文解释 BFS、A* 和迷宫结构，不编造数字，不提出代码修改。"},
                {"role": "user", "content": summary.model_dump_json()},
            ],
        }
        try:
            response = httpx.post("https://api.deepseek.com/chat/completions", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=8.0)
            if response.status_code >= 400:
                raise httpx.HTTPError(f"DeepSeek returned {response.status_code}")
            content = response.json().get("choices", [{}])[0].get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("empty response")
            return {"text": content.strip(), "source": "deepseek", "message": ""}
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            return {"text": fallback, "source": "local", "message": "DeepSeek 暂不可用，已使用本地解读"}

    @app.post("/api/runs")
    def create_run(run: RunCreate):
        existing = get_run(database_path, run.id)
        if existing is not None:
            incoming = run.model_dump()
            stored_input = {field: existing[field] for field in RunCreate.model_fields}
            if stored_input == incoming:
                return existing
            raise HTTPException(status_code=409, detail="Run id already exists with different content")
        payload = run.model_dump()
        payload["createdAt"] = datetime.now(UTC).isoformat()
        payload["pathLength"] = len(run.path) - 1 if run.found else None
        payload["visitedCount"] = len(run.visitedOrder) if run.visitedOrder is not None else None
        insert_run(database_path, payload)
        return JSONResponse(payload, status_code=status.HTTP_201_CREATED)

    @app.get("/api/runs")
    def runs(
        mode: Literal["manual", "bfs", "astar"] | None = None,
        limit: int = Query(100, ge=1, le=100),
        offset: int = Query(0, ge=0),
    ):
        items = list_runs(database_path, mode, limit, offset)
        summaries = [
            {
                "id": item["id"], "mode": item["mode"], "found": item["found"],
                "pathLength": item["pathLength"], "visitedCount": item["visitedCount"],
                "computeMs": item["computeMs"], "manualElapsedMs": item["manualElapsedMs"],
                "createdAt": item["createdAt"], "mazeSize": item["maze"]["size"],
                "seed": item["maze"]["seed"], "edited": item["maze"]["edited"],
            }
            for item in items
        ]
        return {"items": summaries, "limit": limit, "offset": offset}

    @app.get("/api/runs/{run_id}")
    def run_detail(run_id: str):
        run = get_run(database_path, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
        return run

    @app.delete("/api/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_run(run_id: str):
        if not delete_run(database_path, run_id):
            raise HTTPException(status_code=404, detail="Run not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    frontend_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


app = create_app()
