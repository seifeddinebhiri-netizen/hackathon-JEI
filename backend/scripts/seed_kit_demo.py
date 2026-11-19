"""Compte de démonstration du Kit Festival : le crée, ou le remet exactement dans l'état de la démo.

Usage (depuis backend/) : uv run python -m scripts.seed_kit_demo
Relançable autant de fois que nécessaire : chaque exécution efface les projets du compte de
démo (et, en cascade, ses dossiers, pièces, synopsis, Passeport IA) et ses sous-titres, puis
recrée le film « Dar Hmeti » avec trois dossiers (BSFF, Vienna Shorts, Clermont-Ferrand) et le
brouillon de sous-titres (dont la version courte de l4).

Lit backend/.env :
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY : création du compte (API d'administration Auth) ;
- DATABASE_URL : écriture des données (connexion directe, RLS ignorée) ;
- DEMO_EMAIL, DEMO_PASSWORD : identifiants du compte (les mêmes que VITE_DEMO_EMAIL /
  VITE_DEMO_PASSWORD du front, pour le bouton « Continuer en démo »).
La clé service_role reste dans backend/.env : jamais dans le front ni dans git.

Données : backend/data/demo_kit.json, exporté des mocks du front par
`node web/scripts/export-demo-seed.mjs`. Nécessite la migration 0005.

owner_id est rempli explicitement dans chaque ligne : la connexion directe n'a pas d'utilisateur
(auth.uid() y est vide), le défaut de la base ne s'applique donc pas.
"""

import asyncio
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import asyncpg

from app.core.config import Settings, get_settings

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "demo_kit.json"
# Identifiant fixe : le projet garde la même adresse d'une remise à zéro à l'autre.
DEMO_PROJECT_ID = "d4a1e000-0000-4000-8000-00000000d3a0"
DEMO_NAME = "Démo encadré"

Rows = dict[str, list[dict[str, Any]]]


def load_data(path: Path = DATA_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_rows(owner_id: str, data: dict[str, Any], today: date) -> Rows:
    """Lignes à insérer, table par table, dans l'ordre des clés étrangères. Fonction pure."""
    if not owner_id:
        raise ValueError("owner_id est obligatoire.")
    p = data["project"]
    offsets = p["shooting_window_offsets"]
    kit = data["film_kit"]
    synopsis = kit.get("synopsis", {})
    passport = data["passport"]
    subtitles = data["subtitles"]
    return {
        "projects": [
            {
                "id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "title": p["title"],
                "format": p["format"],
                "city": p["city"],
                "data": {
                    "shooting_window": {
                        "from": (today + timedelta(days=offsets["from"])).isoformat(),
                        "to": (today + timedelta(days=offsets["to"])).isoformat(),
                    },
                    "max_hours_per_day": p["max_hours_per_day"],
                    "scenes": p["scenes"],
                    "locations": p["locations"],
                    "people": p["people"],
                    "festival_shortlist": [],
                    "scene_extras": {},
                },
            }
        ],
        "film_kits": [
            {
                "project_id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "duration_min": kit.get("duration_min"),
                "language": kit.get("language"),
                "genre": kit.get("genre"),
                "synopsis_phrase": synopsis.get("phrase", ""),
                "synopsis_court": synopsis.get("court", ""),
                "synopsis_long": synopsis.get("long", ""),
                "synopsis_en": {},
                "stills": kit.get("stills", []),
            }
        ],
        "festival_dossiers": [
            {
                "project_id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "festival_id": d["festival_id"],
                "status": d["status"],
                "position": i,
            }
            for i, d in enumerate(data["dossiers"])
        ],
        "kit_pieces": [
            {
                "project_id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "piece_key": piece["key"],
                "state": piece["state"],
            }
            for piece in data["pieces"]
        ],
        "ai_passports": [
            {
                "project_id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "film_title": passport["film_title"],
                "director": passport["director"],
                "declarations": passport["declarations"],
                "c2pa_signed": passport["c2pa_signed"],
                "badge_code": passport["badge_code"],
            }
        ],
        "subtitle_drafts": [
            {
                "project_id": DEMO_PROJECT_ID,
                "owner_id": owner_id,
                "source_lang": subtitles["source_lang"],
                "lines": subtitles["lines"],
                "processing": subtitles.get("processing"),
            }
        ],
    }


def insert_sql(table: str, row: dict[str, Any]) -> tuple[str, list[Any]]:
    """`insert` avec la liste explicite des colonnes de la ligne (owner_id compris)."""
    cols = list(row)
    marks = ", ".join(f"${i}" for i in range(1, len(cols) + 1))
    return f"insert into public.{table} ({', '.join(cols)}) values ({marks})", [
        row[c] for c in cols
    ]


async def reset_demo(conn: Any, owner_id: str, rows: Rows) -> None:
    """Efface puis recrée les données du compte de démo, en une seule transaction."""
    async with conn.transaction():
        await conn.execute(
            "insert into public.profiles (id, display_name, is_demo) values ($1, $2, true) "
            "on conflict (id) do update set display_name = excluded.display_name, is_demo = true",
            owner_id,
            DEMO_NAME,
        )
        # Les projets emportent dossiers, pièces, synopsis et Passeport (on delete cascade).
        await conn.execute("delete from public.subtitle_drafts where owner_id = $1", owner_id)
        await conn.execute("delete from public.projects where owner_id = $1", owner_id)
        for table, table_rows in rows.items():
            for row in table_rows:
                sql, args = insert_sql(table, row)
                await conn.execute(sql, *args)
        await conn.execute(
            "update public.profiles set current_project_id = $1 where id = $2",
            DEMO_PROJECT_ID,
            owner_id,
        )


async def demo_user_id(settings: Settings) -> str:
    """Crée le compte de démo (email confirmé) ou remet son mot de passe : un clic suffit au pitch."""
    from supabase import acreate_client  # import local : les tests n'en ont pas besoin

    key = settings.supabase_service_role_key.get_secret_value()
    client = await acreate_client(settings.supabase_url, key)
    email = settings.demo_email.strip().lower()
    password = settings.demo_password.get_secret_value()
    attrs = {"password": password, "email_confirm": True, "user_metadata": {"name": DEMO_NAME}}
    page = 1
    while True:
        users = await client.auth.admin.list_users(page=page, per_page=200)
        found = next((u for u in users if (u.email or "").lower() == email), None)
        if found:
            await client.auth.admin.update_user_by_id(found.id, attrs)
            return str(found.id)
        if len(users) < 200:
            break
        page += 1
    created = await client.auth.admin.create_user({"email": email, **attrs})
    return str(created.user.id)


async def main() -> int:
    settings = get_settings()
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", settings.supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key.get_secret_value()),
            ("DATABASE_URL", settings.database_url.get_secret_value()),
            ("DEMO_EMAIL", settings.demo_email),
            ("DEMO_PASSWORD", settings.demo_password.get_secret_value()),
        )
        if not value
    ]
    if missing:
        print(f"À renseigner dans backend/.env : {', '.join(missing)}.")
        return 1
    data = load_data()

    conn = await asyncpg.connect(settings.database_url.get_secret_value(), statement_cache_size=0)
    try:
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )
        ids = [d["festival_id"] for d in data["dossiers"]]
        known = {
            r["id"]
            for r in await conn.fetch("select id from public.festivals where id = any($1)", ids)
        }
        if absent := [i for i in ids if i not in known]:
            print(
                f"Festivals absents de la table festivals : {', '.join(absent)}. Rien n'est modifié."
            )
            return 1
        owner_id = await demo_user_id(settings)
        rows = build_rows(owner_id, data, date.today())
        await reset_demo(conn, owner_id, rows)
    finally:
        await conn.close()

    counts = ", ".join(f"{t} {len(r)}" for t, r in rows.items())
    lines = len(rows["subtitle_drafts"][0]["lines"])
    print(
        f"Compte de démo prêt ({settings.demo_email}) : {counts} ; {lines} lignes de sous-titres."
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
