import io
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import register_error_handlers
from app.routes.screenplay import router as screenplay_router
from app.schemas.screenplay import LLMScreenplayAnalysis, LLMSegmentation
from app.services.llm_service import LLMUnavailable
from app.services.screenplay.chunker import parse_heading, split_scenes
from app.services.screenplay.extractor import speaking_characters
from app.services.screenplay.pipeline import parse_screenplay
from app.services.screenplay.reader import clean, read_screenplay

app = FastAPI()
register_error_handlers(app)
app.include_router(screenplay_router)

FIXTURE = (Path(__file__).parent / "fixtures" / "le_dernier_ferry.fountain").read_text()


class FakeLLM:
    model = "fake-model"

    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = []

    async def parse_structured(self, *, system, user, output_format, max_tokens=16000):
        self.calls.append((output_format.__name__, user))
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        return output_format.model_validate(out)


# --- En-têtes -----------------------------------------------------------------


@pytest.mark.parametrize(
    "line, setting, place, room, moment",
    [
        ("1. EXT. PORT DE LA GOULETTE - AUBE", "EXT", "PORT DE LA GOULETTE", None, "aube"),
        ("INT. MAISON D'AMIRA - CUISINE - JOUR", "INT", "MAISON D'AMIRA", "CUISINE", "jour"),
        ("INT. CUISINE. NUIT", "INT", "CUISINE", None, "nuit"),
        ("INT. JOUR - BUREAU DU COMMISSARIAT", "INT", "BUREAU DU COMMISSARIAT", None, "jour"),
        ("12A INT/EXT. TAXI – JOUR", "EXT", "TAXI", None, "jour"),
        ("INTERIEUR NUIT - HAMMAM", "INT", "HAMMAM", None, "nuit"),
        ("EXT. TOIT - NUIT (FLASHBACK)", "EXT", "TOIT", None, "nuit"),
        ("EXT. HAMMAM - FIN D'APRÈS-MIDI", "EXT", "HAMMAM", None, "heure_doree"),
        ("EXT. PLAGE DE NUIT", "EXT", "PLAGE DE NUIT", None, None),  # un lieu, pas un moment
        ("INT. SALON - PLUS TARD", "INT", "SALON", None, None),  # hérité ensuite
        ("Int. cuisine - jour", "INT", "cuisine", None, "jour"),
        ("خارجي. سطح البيت - ليل", "EXT", "سطح البيت", None, "nuit"),
    ],
)
def test_headings(line, setting, place, room, moment):
    h = parse_heading(line)
    assert h is not None
    assert (h["setting"], h["place"], h["room"], h["moment"]) == (setting, place, room, moment)


@pytest.mark.parametrize(
    "line",
    [
        "Intérieur de la maison, Amira pleure.",
        "Extérieurement, rien ne bouge.",
        "Elle entre dans la cuisine.",
        "AMIRA",
    ],
)
def test_not_headings(line):
    assert parse_heading(line) is None


def test_sequence_without_int_ext_guesses_outdoor():
    h = parse_heading("SÉQUENCE 4 - TERRASSE - CRÉPUSCULE")
    assert h["number"] == "4" and h["setting"] == "EXT" and h["setting_guessed"]


# --- Personnages ----------------------------------------------------------------


def test_characters_extensions_and_noise():
    chunks = split_scenes(clean(FIXTURE))
    assert len(chunks) == 7
    assert speaking_characters(chunks[0]) == ["Slim", "Amira"]  # (O.S.) retiré
    assert speaking_characters(chunks[2]) == ["Amira"]  # (V.O.) retiré
    # « LE TÉLÉPHONE VIBRE. » et (SUITE) ne sont pas des personnages
    assert speaking_characters(chunks[3]) == ["Slim", "Amira"]
    # (JEUNE) est un rôle à part
    assert speaking_characters(chunks[4]) == ["Amira (jeune)"]


def test_inline_dialogue_style():
    chunks = split_scenes("INT. SALON - JOUR\n\nMOUNIR : Tu es en retard.\nAMIRA : Je sais.\n")
    assert speaking_characters(chunks[0]) == ["Mounir", "Amira"]


def test_page_numbers_removed():
    assert "\n3\n" not in clean(FIXTURE)


# --- Pipeline sans IA -----------------------------------------------------------


@pytest.mark.asyncio
async def test_rules_only_pipeline():
    r = await parse_screenplay(clean(FIXTURE), llm=None)
    assert [s.number for s in r.scenes] == ["1", "2", "3", "4", "5", "6", "7"]
    assert not r.ai_used
    names = {loc.name for loc in r.locations}
    assert "Maison d'Amira" in names and len(r.locations) == 6
    maison = next(loc for loc in r.locations if loc.name == "Maison d'Amira")
    assert maison.rooms == ["Cuisine", "Chambre d'Amira"]
    assert maison.scene_numbers == ["2", "3"]
    # « CONTINU » reprend le moment de la scène précédente
    s3 = r.scenes[2]
    assert s3.moment == "jour" and s3.moment_guessed
    assert r.scenes[3].setting == "EXT"  # INT./EXT.
    assert all(s.estimated_hours >= 0.5 for s in r.scenes)
    assert any("INT./EXT." in w for w in r.warnings)


@pytest.mark.asyncio
async def test_no_heading_without_ai_gives_one_scene():
    r = await parse_screenplay("Amira marche seule sur la plage au coucher du soleil.", llm=None)
    assert len(r.scenes) == 1
    assert r.scenes[0].moment == "heure_doree"
    assert any("Aucun en-tête" in w for w in r.warnings)


# --- Pipeline avec IA (faux LLM) -------------------------------------------------


def _analysis(**over):
    base = {
        "scenes": [
            {
                "number": "1",
                "title_fr": "Slim rattrape Amira au port",
                "summary_fr": "Amira hésite devant le ferry ; Slim arrive en courant.",
                "silent_characters": ["Dockers", "Fantôme"],  # absent du texte : rejeté
                "location_brief_fr": "Un quai de port avec un grand ferry, à l'aube.",
            },
            {
                "number": "2",
                "title_fr": "Petit-déjeuner tendu",
                "summary_fr": "La mère se plaint du départ d'Amira.",
                "silent_characters": [],
                "location_brief_fr": "Une cuisine familiale tunisienne modeste.",
            },
            {
                "number": "3",
                "title_fr": "Amira fait sa valise",
                "summary_fr": "Amira plie ses vêtements sous le regard de Nour.",
                "silent_characters": ["Nour"],  # présente, ne parle pas : gardée
                "location_brief_fr": "Une petite chambre.",
            },
            {
                "number": "99",  # n'existe pas : ignoré
                "title_fr": "x",
                "summary_fr": "x",
                "silent_characters": [],
                "location_brief_fr": "x",
            },
        ],
        "character_groups": [
            {"canonical": "Amira", "aliases": ["Amira (jeune)"]},  # deux rôles : rejeté
            {"canonical": "Inventé", "aliases": ["Slim"]},  # canonique inconnu : rejeté
        ],
        "locations": [
            {"key": "port de la goulette", "kind_fr": "port", "brief_fr": "Quai avec ferry."},
            {"key": "lieu inventé", "kind_fr": "x", "brief_fr": "x"},
        ],
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_ai_annotations_are_verified():
    llm = FakeLLM([_analysis()])
    r = await parse_screenplay(clean(FIXTURE), llm=llm)
    assert r.ai_used
    s1, _, s3 = r.scenes[:3]
    assert s1.title == "Slim rattrape Amira au port"
    assert "Fantôme" not in s1.characters and "Dockers" not in s1.characters
    assert s3.characters == ["Amira", "Nour"] and s3.speaking_characters == ["Amira"]
    assert s1.location_brief.startswith("Un quai")
    port = next(loc for loc in r.locations if loc.name == "Port de la Goulette")
    assert port.kind_fr == "port"
    assert not any(loc.kind_fr == "x" for loc in r.locations)
    # scènes non annotées : titre par règles
    assert r.scenes[5].title == "Slim attend seul à une table"
    assert "Amira (jeune)" in r.characters
    # le texte du scénario est envoyé, mais l'IA ne le renvoie jamais
    assert "Amira plie ses vêtements" in llm.calls[0][1]


@pytest.mark.asyncio
async def test_ai_failure_falls_back_to_rules():
    r = await parse_screenplay(clean(FIXTURE), llm=FakeLLM([LLMUnavailable("down")]))
    assert not r.ai_used and len(r.scenes) == 7
    assert any("Analyse IA indisponible" in w for w in r.warnings)


@pytest.mark.asyncio
async def test_free_text_segmented_by_ai_lines():
    text = (
        "Amira se réveille dans sa chambre.\n"
        "Elle s'habille vite.\n"
        "\n"
        "Plus tard, sur le port, elle attend Slim.\n"
        "SLIM\n"
        "Pardon pour le retard.\n"
    )
    seg = LLMSegmentation.model_validate(
        {
            "scenes": [
                {"start_line": 4, "setting": "EXT", "place": "Port", "moment": "jour"},
                {"start_line": 2, "setting": "INT", "place": "Chambre", "moment": "aube"},
                {"start_line": 400, "setting": "INT", "place": "x", "moment": "jour"},  # hors texte
            ]
        }
    ).model_dump()
    empty = LLMScreenplayAnalysis(scenes=[], character_groups=[], locations=[]).model_dump()
    r = await parse_screenplay(text, llm=FakeLLM([seg, empty]))
    assert [s.setting for s in r.scenes] == ["INT", "EXT"]
    assert r.scenes[1].characters == ["Slim"]
    assert {loc.name for loc in r.locations} == {"Chambre", "Port"}


# --- Lecture de fichiers et route -------------------------------------------------


def test_reader_rejects_unknown_format():
    from app.core.errors import AppError

    with pytest.raises(AppError) as e:
        read_screenplay(filename="film.odt", data=b"abc")
    assert e.value.status_code == 415


def test_reader_fdx():
    fdx = b"""<?xml version="1.0"?><FinalDraft><Content>
    <Paragraph Type="Scene Heading"><Text>INT. CAFE - NUIT</Text></Paragraph>
    <Paragraph Type="Action"><Text>Slim attend.</Text></Paragraph>
    <Paragraph Type="Character"><Text>SLIM</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Elle viendra.</Text></Paragraph>
    </Content></FinalDraft>"""
    text = read_screenplay(filename="film.fdx", data=fdx)
    chunks = split_scenes(text)
    assert len(chunks) == 1 and speaking_characters(chunks[0]) == ["Slim"]


def test_reader_docx():
    from docx import Document

    doc = Document()
    for p in ["EXT. PLAGE - JOUR", "", "NOUR", "Regarde !"]:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    chunks = split_scenes(read_screenplay(filename="f.docx", data=buf.getvalue()))
    assert speaking_characters(chunks[0]) == ["Nour"]


def test_route_multipart_file_without_ai():
    with TestClient(app) as client:
        r = client.post(
            "/planner/parse",
            files={"file": ("ferry.fountain", FIXTURE.encode(), "text/plain")},
            data={"use_ai": "false"},
        )
    assert r.status_code == 200
    body = r.json()
    assert len(body["scenes"]) == 7
    s = body["scenes"][0]
    # contrat du front (web/src/api/schemas.ts)
    for k in (
        "id",
        "number",
        "title",
        "setting",
        "moment",
        "location_id",
        "characters",
        "estimated_hours",
        "summary",
        "source",
        "validated",
    ):
        assert k in s
    assert s["source"] == "import_ia" and s["validated"] is False
    assert {loc["id"] for loc in body["locations"]} >= {sc["location_id"] for sc in body["scenes"]}


def test_route_empty_input():
    with TestClient(app) as client:
        r = client.post("/planner/parse", data={"text": "   "})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "empty_input"
