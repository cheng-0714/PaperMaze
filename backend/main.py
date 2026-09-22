from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.storage import get_run, initialize, insert_run, list_runs


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
    path: list[Point]
    visitedOrder: list[Point] | None
    computeMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    manualElapsedMs: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def valid_run(self):
        if not self.found or len(self.path) < 2:
            raise ValueError("completed manual run must contain a path")
        if self.path[0] != self.maze.start or self.path[-1] != self.maze.goal:
            raise ValueError("path must start and finish at the configured points")
        for point in self.path:
            if point.row >= self.maze.size or point.col >= self.maze.size or self.maze.cells[point.row][point.col] != 0:
                raise ValueError("path must stay on passages")
        for left, right in zip(self.path, self.path[1:]):
            if abs(left.row - right.row) + abs(left.col - right.col) != 1:
                raise ValueError("path steps must be orthogonally adjacent")
        if self.mode == "manual" and (self.visitedOrder is not None or self.computeMs is not None or self.manualElapsedMs is None):
            raise ValueError("manual metrics are inconsistent")
        return self


def create_app(database: Path | str = Path("papermaze.sqlite3")) -> FastAPI:
    database_path = Path(database)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize(database_path)
        yield

    app = FastAPI(title="PaperMaze API", lifespan=lifespan)

    @app.post("/api/runs", status_code=status.HTTP_201_CREATED)
    def create_run(run: RunCreate):
        payload = run.model_dump()
        payload["createdAt"] = datetime.now(UTC).isoformat()
        payload["pathLength"] = len(run.path) - 1
        payload["visitedCount"] = len(run.visitedOrder) if run.visitedOrder is not None else None
        insert_run(database_path, payload)
        return payload

    @app.get("/api/runs")
    def runs():
        return {"items": list_runs(database_path)}

    @app.get("/api/runs/{run_id}")
    def run_detail(run_id: str):
        run = get_run(database_path, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
        return run

    return app


app = create_app()
