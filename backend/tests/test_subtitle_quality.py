"""Qualité du brouillon : mots douteux, omissions, versions courtes (faux client Gemini)."""

import json
import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.subtitle import SubtitleLine
from app.services import subtitle_rules, subtitle_service
from app.services.subtitle_segmentation import segment
from tests.test_gemini_translator import gemini
from tests.test_subtitles import FakeTranscriber, post_draft, w

P = math.log  # probabilité → logprob


def words_one_line():
    """Une seule ligne de 0 à 3 s : « اسمي طارق. تخرج realmente خراج »."""
    return [
        w("اسمي", 0.0, 0.4, logprob=P(0.99)),
        w("طارق.", 0.45, 0.9, logprob=P(0.98)),
        w("تخرج", 1.0, 1.4, logprob=P(0.95)),
        w("realmente", 1.45, 2.0, logprob=P(0.7)),
        w("خراج", 2.05, 3.0, logprob=P(0.3)),
    ]


def reply(**line):
    base = {"id": "l1", "fr": "", "en": "", "confidence": "elevee"}
    return json.dumps({"lines": [{**base, **line}]})


@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.db_pool = None
        app.state.transcriber = FakeTranscriber(words=words_one_line())
        subtitle_service._memory.clear()
        yield c
    subtitle_service._memory.clear()


def line_of(r):
    assert r.status_code == 200, r.text
    return r.json()["lines"][0]


# --- 1. Mots douteux -> confiance plus basse et mot cité dans la note ------------------
def test_doubtful_words_detected_in_segmentation():
    words = words_one_line()
    words.insert(1, w("Vision", 0.41, 0.44, logprob=P(0.99)))  # isolé mais sûr : gardé
    cue = segment(words)[0]
    assert cue.uncertain_words == ["خراج"]
    assert cue.mixed_words == ["realmente"]


def test_doubtful_transcription_lowers_confidence_and_names_the_word(client):
    app.state.translator, _ = gemini(
        [reply(fr="Je m'appelle Tarek. Diplômé, vraiment…", en="My name is Tarek. A graduate…")]
    )
    line = line_of(post_draft(client))
    # élevée - mot incertain - mot isolé = faible
    assert line["confidence"] == "faible"
    assert "mot incertain : خراج" in line["note"]
    assert "realmente" in line["note"]


def test_confident_transcription_keeps_high_confidence(client):
    app.state.transcriber = FakeTranscriber(
        words=[w("اسمي", 0.0, 0.4, logprob=P(0.99)), w("طارق.", 0.45, 2.0, logprob=P(0.98))]
    )
    app.state.translator, _ = gemini([reply(fr="Je m'appelle Tarek.", en="My name is Tarek.")])
    line = line_of(post_draft(client))
    assert line["confidence"] == "elevee" and "note" not in line


# --- 2. Omission ------------------------------------------------------------------------
def test_omission_rule_on_length_and_sentences():
    def warn(source, fr):
        line = SubtitleLine(
            id="l1", start="00:00:00,000", end="00:00:04,000", source=source, fr=fr, en=fr
        )
        return [x for x in subtitle_rules.apply_rules([line])[0].warnings]

    source = "اللي أنت تمشي في بحر ما تعرفوش. تمشي في ثنية ما تعرفهاش. ما تمش توصلك."
    full = "Tu navigues dans une mer inconnue. Tu suis un chemin inconnu. Tu n'arrives pas."
    cut = "Tu navigues dans une mer inconnue. Tu suis un chemin que tu ne connais pas."
    assert not [x for x in warn(source, full) if x.rule == "omission_possible"]
    omitted = [x for x in warn(source, cut) if x.rule == "omission_possible"]
    assert len(omitted) == 2 and "2 phrases pour 3" in omitted[0].detail  # FR et EN
    short = [x for x in warn(source, "Tu navigues.") if x.rule == "omission_possible"]
    assert short and "car. pour environ" in short[0].detail
    # Les hésitations (« آآآ ») ne comptent pas dans la longueur attendue.
    assert not [
        x for x in warn("تخرج آآآ آآآ آآآ آآآ خراج", "Diplômé") if x.rule == "omission_possible"
    ]


def test_omission_warns_and_lowers_confidence(client):
    app.state.transcriber = FakeTranscriber(
        words=[
            w("اسمي", 0.0, 0.4),
            w("طارق.", 0.45, 0.9),
            w("نحب", 1.0, 1.4),
            w("السينما.", 1.45, 3.0),
        ]
    )
    app.state.translator, models = gemini([reply(fr="Je m'appelle Tarek.", en="My name is Tarek.")])
    line = line_of(post_draft(client))
    rules = [x["rule"] for x in line["warnings"]]
    assert rules.count("omission_possible") == 2
    assert line["confidence"] == "moyenne"
    system = models.configs[0].system_instruction
    assert "sans rien omettre" in system


# --- 3. Lecture rapide : version courte proposée, jamais appliquée ----------------------
LONG_FR = "Je m'appelle Tarek et je suis diplômé de l'école de cinéma."  # 59 car.
LONG_EN = "My name is Tarek and I graduated from film school."  # 50 car.


def fast_words():
    return [w("اسمي", 0.0, 0.4), w("طارق", 0.45, 1.0), w("تخرجت", 1.05, 2.0)]  # 2 s : 34 car.


def test_short_version_is_a_suggestion_only(client):
    app.state.transcriber = FakeTranscriber(words=fast_words())
    app.state.translator, models = gemini(
        [
            reply(
                fr=LONG_FR,
                en=LONG_EN,
                fr_court="Je suis Tarek, diplômé en cinéma.",
                en_court="I'm Tarek, a film graduate.",
            )
        ]
    )
    line = line_of(post_draft(client))
    assert line["fr"] == LONG_FR and line["en"] == LONG_EN  # jamais remplacées
    assert line["fr_court"] == "Je suis Tarek, diplômé en cinéma."
    assert line["en_court"] == "I'm Tarek, a film graduate."
    assert any(x["rule"] == "lecture_rapide" for x in line["warnings"])
    assert json.loads(models.contents[0])["lignes"][0]["max_car"] == 34


def test_short_version_dropped_when_over_limit_or_not_needed(client):
    app.state.transcriber = FakeTranscriber(words=fast_words())
    app.state.translator, _ = gemini(
        [
            reply(
                fr=LONG_FR,
                en="Tarek.",
                fr_court="Je m'appelle Tarek, diplômé en cinéma, voilà.",
                en_court="Tarek",
            )
        ]
    )
    line = line_of(post_draft(client))
    assert "fr_court" not in line  # 45 car. > 34 : ne respecte pas la limite
    assert "en_court" not in line  # « Tarek. » se lit déjà assez vite


def test_put_keeps_or_clears_the_suggestion(client):
    app.state.transcriber = FakeTranscriber(words=fast_words())
    app.state.translator, _ = gemini(
        [reply(fr=LONG_FR, en=LONG_EN, fr_court="Je suis Tarek, diplômé en cinéma.")]
    )
    line = line_of(post_draft(client))
    accepted = {**line, "fr": line["fr_court"]}
    accepted.pop("fr_court")
    saved = client.put("/subtitles/demo", json={"lines": [accepted]}).json()["lines"][0]
    assert saved["fr"] == "Je suis Tarek, diplômé en cinéma." and "fr_court" not in saved
