from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.storage import delete_run, get_run, initialize, insert_run, list_runs


class Point(BaseModel):
    row: int = Field(ge=0)
    col: int = Field(ge=0)


class MazeSnapshot(BaseModel):
    size: Literal[11, 21, 31]
    seed: int = Field(ge=1, le=4_294_967_295)
    generatorVersion: Literal[1]
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
    visitedOrder: list[Point] | None = Field(max_length=961)
    computeMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    manualElapsedMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)

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
        else:
            if self.visitedOrder is None or self.computeMs is None or self.manualElapsedMs is not None:
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


def create_app(database: Path | str = Path("papermaze.sqlite3")) -> FastAPI:
    database_path = Path(database)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize(database_path)
        yield

    app = FastAPI(title="PaperMaze API", lifespan=lifespan)

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
