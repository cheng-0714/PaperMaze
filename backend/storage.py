import json
import sqlite3
from pathlib import Path


def connect(database: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    return connection


def initialize(database: Path) -> None:
    database.parent.mkdir(parents=True, exist_ok=True)
    with connect(database) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )


def insert_run(database: Path, payload: dict) -> None:
    with connect(database) as connection:
        connection.execute(
            "INSERT INTO runs (id, mode, created_at, payload_json) VALUES (?, ?, ?, ?)",
            (payload["id"], payload["mode"], payload["createdAt"], json.dumps(payload, separators=(",", ":"))),
        )


def list_runs(database: Path, mode: str | None = None, limit: int = 100) -> list[dict]:
    with connect(database) as connection:
        if mode:
            rows = connection.execute(
                "SELECT payload_json FROM runs WHERE mode = ? ORDER BY created_at DESC LIMIT ?", (mode, limit)
            ).fetchall()
        else:
            rows = connection.execute("SELECT payload_json FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [json.loads(row["payload_json"]) for row in rows]


def get_run(database: Path, run_id: str) -> dict | None:
    with connect(database) as connection:
        row = connection.execute("SELECT payload_json FROM runs WHERE id = ?", (run_id,)).fetchone()
    return json.loads(row["payload_json"]) if row else None


def delete_run(database: Path, run_id: str) -> bool:
    with connect(database) as connection:
        cursor = connection.execute("DELETE FROM runs WHERE id = ?", (run_id,))
    return cursor.rowcount > 0
