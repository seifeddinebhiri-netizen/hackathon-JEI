"""Script de démonstration du Kit Festival : chaque ligne a un owner_id explicite, aucune copie de pièce."""

import asyncio
from datetime import date

import pytest

from app.services import project_service
from scripts import seed_kit_demo as seed

OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TODAY = date(2026, 11, 19)


@pytest.fixture(scope="module")
def rows():
    return seed.build_rows(OWNER, seed.load_data(), TODAY)


def test_every_row_has_explicit_owner_id(rows):
    assert set(rows) == {
        "projects", "film_kits", "festival_dossiers", "kit_pieces", "ai_passports", "subtitle_drafts",
    }  # fmt: skip
    for table, table_rows in rows.items():
        assert table_rows, table
        for row in table_rows:
            assert row["owner_id"] == OWNER, table
            sql, args = seed.insert_sql(table, row)
            # owner_id est une colonne de l'insert, avec la valeur du compte (pas le défaut auth.uid())
            columns = sql.split("(", 1)[1].split(")", 1)[0].split(", ")
            assert args[columns.index("owner_id")] == OWNER
    with pytest.raises(ValueError):
        seed.build_rows("", seed.load_data(), TODAY)


def test_demo_content_matches_the_pitch(rows):
    assert [(d["festival_id"], d["status"]) for d in rows["festival_dossiers"]] == [
        ("bsff-next-generation", "a_preparer"),
        ("vienna-shorts", "a_preparer"),
        ("clermont-international", "prochain_appel"),
    ]
    # Une pièce = une ligne par projet, jamais une copie par dossier
    keys = [p["piece_key"] for p in rows["kit_pieces"]]
    assert len(keys) == len(set(keys))
    lines = rows["subtitle_drafts"][0]["lines"]
    l4 = next(li for li in lines if li["id"] == "l4")
    assert l4["fr_court"] and l4["en_court"]  # version courte proposée pour l4
    assert rows["projects"][0]["data"]["shooting_window"] == {
        "from": "2026-11-24",
        "to": "2026-12-13",
    }
    # Le projet est lisible par GET /projects/{id}
    project = project_service._to_project({**rows["projects"][0], "id": seed.DEMO_PROJECT_ID})
    assert project.title == "Dar Hmeti"


class RecordingConn:
    def __init__(self):
        self.sql: list[tuple[str, tuple]] = []

    def transaction(self):
        conn = self

        class Tx:
            async def __aenter__(self):
                conn.sql.append(("begin", ()))

            async def __aexit__(self, *exc):
                conn.sql.append(("commit", ()))

        return Tx()

    async def execute(self, sql, *args):
        self.sql.append((sql, args))


def test_reset_is_scoped_to_the_demo_owner_and_rerunnable(rows):
    conn = RecordingConn()
    asyncio.run(seed.reset_demo(conn, OWNER, rows))
    asyncio.run(seed.reset_demo(conn, OWNER, rows))  # relançable : même séquence
    statements = [s for s, _ in conn.sql]
    assert statements[0] == "begin" and statements[-1] == "commit"
    deletes = [(s, a) for s, a in conn.sql if s.startswith("delete")]
    assert deletes and all("owner_id = $1" in s and a == (OWNER,) for s, a in deletes)
    inserts = [s for s in statements if s.startswith("insert into public.") and "profiles" not in s]
    assert inserts and all("owner_id" in s for s in inserts)
