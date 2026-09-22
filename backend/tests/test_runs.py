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


def search_run(run_id: str = "search-1", found: bool = True) -> dict:
    run = manual_run(run_id)
    run.update({
        "mode": "bfs",
        "found": found,
        "path": run["path"] if found else [],
        "visitedOrder": [{"row": 1, "col": 1}, {"row": 1, "col": 2}],
        "computeMs": 0.25,
        "manualElapsedMs": None,
    })
    if not found:
        run["maze"]["cells"][1][2] = 1
        run["maze"]["cells"][1][3] = 0
        run["maze"]["goal"] = {"row": 1, "col": 3}
        run["visitedOrder"] = [{"row": 1, "col": 1}]
    return run


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
        assert "maze" not in listing.json()["items"][0]
        detail = client.get("/api/runs/run-1")
        assert detail.status_code == 200
        assert detail.json()["maze"]["cells"][1][1:3] == [0, 0]


def test_create_is_idempotent_but_rejects_conflicting_id(tmp_path):
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        original = client.post("/api/runs", json=manual_run())
        repeated = client.post("/api/runs", json=manual_run())
        conflict_payload = manual_run()
        conflict_payload["manualElapsedMs"] = 999
        conflict = client.post("/api/runs", json=conflict_payload)

    assert original.status_code == 201
    assert repeated.status_code == 200
    assert repeated.json() == original.json()
    assert conflict.status_code == 409


def test_search_runs_support_failure_filter_and_delete(tmp_path):
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        assert client.post("/api/runs", json=manual_run()).status_code == 201
        failed = client.post("/api/runs", json=search_run(found=False))
        assert failed.status_code == 201
        assert failed.json()["pathLength"] is None

        filtered = client.get("/api/runs", params={"mode": "bfs", "limit": 1})
        assert filtered.status_code == 200
        assert [item["mode"] for item in filtered.json()["items"]] == ["bfs"]
        assert filtered.json()["offset"] == 0

        assert client.delete("/api/runs/search-1").status_code == 204
        assert client.get("/api/runs/search-1").status_code == 404
        assert client.delete("/api/runs/missing").status_code == 404


def test_invalid_run_is_rejected(tmp_path):
    invalid = manual_run()
    invalid["path"][1] = {"row": 10, "col": 10}
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/runs", json=invalid)
    assert response.status_code == 422


def test_inconsistent_search_trace_is_rejected(tmp_path):
    invalid = search_run()
    invalid["visitedOrder"] = []
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/runs", json=invalid)
    assert response.status_code == 422
