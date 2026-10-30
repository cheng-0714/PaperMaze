from fastapi.testclient import TestClient
import pytest
import httpx

from backend.main import create_app


@pytest.mark.parametrize("size", [41, 51])
def test_large_edited_map_and_long_trace_survive_restart(tmp_path, size):
    run = search_run("large")
    cells = [[1 if r in (0, size - 1) or c in (0, size - 1) else 0 for c in range(size)] for r in range(size)]
    run["maze"].update(size=size, cells=cells, edited=True, generatorId="prim")
    run["visitedOrder"] = [{"row": r, "col": c} for r in range(1, size - 1) for c in range(1, size - 1)]
    database = tmp_path / "large.sqlite3"
    with TestClient(create_app(database)) as client:
        assert client.post("/api/runs", json=run).status_code == 201
    with TestClient(create_app(database)) as client:
        restored = client.get("/api/runs/large").json()
        assert restored["maze"] == run["maze"]
        assert restored["visitedOrder"] == run["visitedOrder"]


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
            "generatorId": "dfs",
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
        "collisionCount": 0,
        "wallCollisionCount": 0,
        "boundaryCollisionCount": 0,
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
        "collisionCount": None,
        "wallCollisionCount": None,
        "boundaryCollisionCount": None,
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


def test_legacy_manual_run_without_collision_fields_remains_readable(tmp_path):
    legacy = manual_run("legacy")
    legacy.pop("collisionCount")
    legacy.pop("wallCollisionCount")
    legacy.pop("boundaryCollisionCount")
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/runs", json=legacy)
    assert response.status_code == 201
    assert response.json().get("collisionCount") is None


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


def test_ai_explanation_uses_local_fallback_without_key(tmp_path, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/ai/explain", json={"mazeSize": 11, "passageRatio": 0.4, "deadEnds": 3, "junctions": 2, "shortestPathLength": 8, "manualSteps": 10, "detourRate": 0.25, "bfsVisited": 20, "astarVisited": 12, "bfsPathLength": 8, "astarPathLength": 8})
    assert response.status_code == 200
    assert response.json()["source"] == "local"
    assert "BFS" in response.json()["text"]


def test_ai_explanation_extracts_deepseek_content(tmp_path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    def fake_post(*args, **kwargs):
        return httpx.Response(200, json={"choices": [{"message": {"content": "基于数据，A* 探索更集中。"}}]})

    monkeypatch.setattr("backend.main.httpx.post", fake_post)
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/ai/explain", json={"mazeSize": 11, "passageRatio": 0.4, "deadEnds": 3, "junctions": 2})
    assert response.json() == {"text": "基于数据，A* 探索更集中。", "source": "deepseek", "message": ""}


def test_ai_explanation_falls_back_on_upstream_timeout(tmp_path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("backend.main.httpx.post", lambda *args, **kwargs: (_ for _ in ()).throw(httpx.ReadTimeout("slow")))
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/ai/explain", json={"mazeSize": 11, "passageRatio": 0.4, "deadEnds": 3, "junctions": 2})
    assert response.json()["source"] == "local"


def test_ai_explanation_falls_back_on_malformed_upstream_response(tmp_path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("backend.main.httpx.post", lambda *args, **kwargs: httpx.Response(200, json={"choices": []}))
    with TestClient(create_app(tmp_path / "runs.sqlite3")) as client:
        response = client.post("/api/ai/explain", json={"mazeSize": 11, "passageRatio": 0.4, "deadEnds": 3, "junctions": 2})
    assert response.json()["source"] == "local"


def test_preupgrade_row_idempotent_retry_without_collision_keys(tmp_path):
    """Rows written before collision fields existed must still 200 on identical retry."""
    from backend.storage import get_run, initialize, insert_run

    database_path = tmp_path / "runs.sqlite3"
    initialize(database_path)
    legacy = manual_run("legacy-upgrade")
    legacy.pop("collisionCount")
    legacy.pop("wallCollisionCount")
    legacy.pop("boundaryCollisionCount")
    maze = dict(legacy["maze"])
    maze.pop("generatorId", None)
    legacy["maze"] = maze
    legacy["createdAt"] = "2026-01-01T00:00:00+00:00"
    legacy["pathLength"] = len(legacy["path"]) - 1
    legacy["visitedCount"] = None
    insert_run(database_path, legacy)

    retry_body = manual_run("legacy-upgrade")
    # Same content as stored after normalization: omit collision fields / use None defaults.
    retry_body["collisionCount"] = None
    retry_body["wallCollisionCount"] = None
    retry_body["boundaryCollisionCount"] = None

    with TestClient(create_app(database_path)) as client:
        detail = client.get("/api/runs/legacy-upgrade")
        assert detail.status_code == 200
        assert "collisionCount" not in detail.json() or detail.json().get("collisionCount") is None
        repeated = client.post("/api/runs", json=retry_body)
        assert repeated.status_code == 200
        assert repeated.json()["id"] == "legacy-upgrade"
