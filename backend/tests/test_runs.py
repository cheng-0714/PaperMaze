from fastapi.testclient import TestClient

from backend.main import create_app


def manual_run(run_id: str = "run-1") -> dict:
    cells = [[1 for _ in range(11)] for _ in range(11)]
    cells[1][1] = 0
    cells[1][2] = 0
    return {
        "id": run_id,
        "schemaVersion": 1,
        "mode": "manual",
        "maze": {
            "size": 11,
            "seed": 1,
            "generatorVersion": 1,
            "edited": False,
            "start": {"row": 1, "col": 1},
            "goal": {"row": 1, "col": 2},
            "cells": cells,
        },
        "found": True,
        "path": [{"row": 1, "col": 1}, {"row": 1, "col": 2}],
        "visitedOrder": None,
        "computeMs": None,
        "manualElapsedMs": 250.0,
    }


def test_completed_run_is_retrievable_after_app_restart(tmp_path):
    database = tmp_path / "runs.sqlite3"
    with TestClient(create_app(database)) as client:
        response = client.post("/api/runs", json=manual_run())
        assert response.status_code == 201
        assert response.json()["pathLength"] == 1

    with TestClient(create_app(database)) as client:
        listing = client.get("/api/runs")
        assert listing.status_code == 200
        assert listing.json()["items"][0]["id"] == "run-1"
        detail = client.get("/api/runs/run-1")
        assert detail.status_code == 200
        assert detail.json()["maze"]["cells"][1][1:3] == [0, 0]
