from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List


class LongTermMemoryStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.commit()

    def write(self, category: str, payload: Dict[str, Any]) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "INSERT INTO memories (category, payload) VALUES (?, ?)",
                (category, json.dumps(payload)),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def recent(self, category: str, limit: int = 5) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, payload, created_at
                FROM memories
                WHERE category = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (category, limit),
            ).fetchall()
        return [
            {"id": row[0], "payload": json.loads(row[1]), "created_at": row[2]} for row in rows
        ]
