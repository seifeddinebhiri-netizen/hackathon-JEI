import asyncio
import json
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.core.config import get_settings
from app.core.errors import AppError
from app.main import app
from app.schemas.subtitle import (
    Cue,
    SubtitleLine,
    Transcript,
    TranslatedLine,
    TranslationContext,
    Word,
)
from app.services import glossary_service, subtitle_rules, subtitle_service
from app.services.subtitle_segmentation import parse_srt_time, segment, srt_time
from app.services.transcription_service import MAX_KEYTERMS, clean_keyterms, parse_words
from app.services.translation_service import FALLBACK_NOTE, PromptTranslator


# --- Faux fournisseurs (aucun appel réseau) ------------------------------------------
def w(text, start, end, speaker="speaker_0", logprob=0.0):
    return Word(text=text, start=start, end=end, speaker_id=speaker, logprob=logprob)


DEFAULT_WORDS = [
    w("Ya3tik", 0.0, 0.4),
    w("essa7a,", 0.45, 0.9),
    w("Nour.", 0.95, 1.3),
    w("Labes", 2.5, 2.9, speaker="speaker_1"),
    w("3lik?", 2.95, 3.4, speaker="speaker_1"),
]


class FakeTranscriber:
    name = "fake/stt"
    available = True

    def __init__(self, words=None, error: AppError | None = None):
        self.words = DEFAULT_WORDS if words is None else words
        self.error = error
        self.seen_path: Path | None = None
        self.seen_bytes = b""
        self.calls = []

    async def transcribe(self, file, filename, language_code, keyterms):
        self.seen_path = file
        self.seen_bytes = file.read_bytes()
        self.calls.append((filename, language_code, keyterms))
        if self.error:
            raise self.error
        return Transcript(words=self.words, language_code="aeb")


class FakeTranslator:
    name = "fake/llm"
    available = True

    def __init__(self):
        self.contexts: list[TranslationContext] = []

    async def translate(self, batch, context):
        self.contexts.append(context)
        out = []
        for cue in batch:
            used = [e.id for e in context.glossary if e.id == "ya3tik-essa7a"]
            if "Ya3tik" in cue.source:
                out.append(
                    TranslatedLine(
                        id=cue.id,
                        fr="Merci, Nour.",
                        en="Thank you, Nour.",
                        confidence="elevee",
                        note="Remerciement courant.",
                        glossary_used=used,
                    )
                )
            else:
                out.append(
                    TranslatedLine(id=cue.id, fr="Ça va ?", en="You okay?", confidence="elevee")
                )
        return out


class ScriptedTranslator(PromptTranslator):
    """Vrai PromptTranslator (prompt, validation, nouvel essai) avec des réponses écrites."""

    name = "scripted/llm"
    available = True

    def __init__(self, replies):
        self.replies = list(replies)
        self.prompts = []

    async def _complete(self, system, user):
        self.prompts.append(json.loads(user))
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def cue(i, source="Labes"):
    return Cue(
        id=f"l{i}",
        start=srt_time(i * 3),
        end=srt_time(i * 3 + 2),
        source=source,
        asr_confidence=0.9,
    )


@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.db_pool = None
        app.state.transcriber = FakeTranscriber()
        app.state.translator = FakeTranslator()
        subtitle_service._memory.clear()
        yield c
    subtitle_service._memory.clear()


def post_draft(client, project="demo", content=b"RIFF....", **form):
    return client.post(
        f"/subtitles/{project}/draft",
        files={"file": ("temoignage.m4a", content, "audio/mp4")},
        data=form,
    )


# --- Transcription : lecture de la réponse ElevenLabs ---------------------------------
def test_parse_words_keeps_words_and_spacing_only():
    payload = {
        "words": [
            {
                "text": "Ya3tik",
                "start": 0,
                "end": 0.4,
                "type": "word",
                "logprob": -0.1,
                "speaker_id": "speaker_0",
            },
            {"text": " ", "start": 0.4, "end": 0.45, "type": "spacing", "logprob": 0},
            {"text": "(rires)", "start": 0.5, "end": 1, "type": "audio_event", "logprob": 0},
        ]
    }
    words = parse_words(payload)
    assert [x.type for x in words] == ["word", "spacing"]
    assert words[0].speaker_id == "speaker_0"


def test_keyterms_cleaned_and_limited():
    terms = ["Amira", "amira", "Sidi <Bou> Saïd", "x" * 51, "un deux trois quatre cinq six"]
    terms += [f"Nom{i}" for i in range(80)]
    out = clean_keyterms(terms)
    assert out[:2] == ["Amira", "Sidi Bou Saïd"]
    assert len(out) == MAX_KEYTERMS


# --- Découpage -------------------------------------------------------------------------
def test_srt_time_roundtrip():
    assert srt_time(3725.4) == "01:02:05,400"
    assert parse_srt_time("01:02:05,400") == pytest.approx(3725.4)


def test_segment_breaks_on_long_pause():
    cues = segment([w("Ahla", 0, 0.4), w("bik", 0.5, 0.8), w("Chnowa", 1.5, 1.9)])
    assert [c.source for c in cues] == ["Ahla bik", "Chnowa"]
    assert cues[0].id == "l1" and cues[1].id == "l2"
    assert cues[0].start == "00:00:00,000" and cues[0].end == "00:00:00,800"


def test_segment_breaks_on_speaker_change():
    cues = segment(DEFAULT_WORDS[:3] + [w("Labes", 1.4, 1.8, speaker="speaker_1")])
    assert [c.speaker for c in cues] == ["S1", "S2"]


def test_segment_breaks_on_strong_punctuation_with_pause():
    cues = segment([w("Mchit.", 0, 0.4), w("Rje3t", 0.75, 1.0)])
    assert len(cues) == 2
    assert len(segment([w("Mchit.", 0, 0.4), w("Rje3t", 0.5, 1.0)])) == 1


def test_segment_breaks_when_too_long():
    words = [w("kelma", i * 0.3, i * 0.3 + 0.25) for i in range(30)]  # 30 × 6 car.
    cues = segment(words)
    assert len(cues) > 1
    assert all(len(c.source) <= 2 * 42 + 1 for c in cues)


def test_asr_confidence_is_mean_of_exp_logprob():
    cues = segment([w("a", 0, 0.2, logprob=0.0), w("b", 0.3, 0.5, logprob=math.log(0.5))])
    assert cues[0].asr_confidence == pytest.approx(0.75)


# --- Glossaire -------------------------------------------------------------------------
def test_glossary_finds_arabizi_variant():
    ids = [e.id for e in glossary_service.find_entries("Y3atik essa7a ya Nour!")]
    assert ids == ["ya3tik-essa7a"]


def test_glossary_finds_arabic_script_and_ignores_unrelated():
    assert [e.id for e in glossary_service.find_entries("يعطيك الصحة")] == ["ya3tik-essa7a"]
    assert glossary_service.find_entries("El 9ahwa mabi3a") == []


def test_glossary_max_three_and_all_entries_to_review():
    found = glossary_service.find_entries("labes inchallah bessa7a rabbi m3ak sbe7 el khir")
    assert len(found) == 3
    assert all(e.a_relire for e in glossary_service.load_glossary())


# --- Règles de sous-titrage -----------------------------------------------------------
def line(i, start, end, fr="Bonjour.", en="Hello."):
    return SubtitleLine(id=f"l{i}", start=start, end=end, source="x", fr=fr, en=en)


def test_rules_flag_fast_reading():
    text = "Je ne savais pas que tu allais vendre le café."  # 46 car.
    out = subtitle_rules.apply_rules([line(1, "00:00:01,000", "00:00:02,500", fr=text)])
    warn = [x for x in out[0].warnings if x.rule == "lecture_rapide"]
    assert len(warn) == 1
    assert warn[0].detail == "FR : 31 car./s pour 1,5 s (limite 17)"


def test_rules_fix_overlap_by_shifting_start():
    out = subtitle_rules.apply_rules(
        [
            line(1, "00:00:01,000", "00:00:03,000"),
            line(2, "00:00:02,900", "00:00:05,000"),
        ]
    )
    assert out[1].start == "00:00:03,080"
    assert not any(x.rule == "chevauchement" for x in out[1].warnings)


def test_rules_extend_short_cue_when_room():
    out = subtitle_rules.apply_rules(
        [
            line(1, "00:00:01,000", "00:00:01,400", fr="Oui.", en="Yes."),
            line(2, "00:00:01,700", "00:00:03,000"),
        ]
    )
    assert out[0].end == "00:00:01,620"  # rallongé jusqu'à 80 ms avant la suivante
    assert any(x.rule == "duree_courte" for x in out[0].warnings)
    alone = subtitle_rules.apply_rules([line(1, "00:00:01,000", "00:00:01,400")])
    assert alone[0].end == "00:00:02,000"
    assert not alone[0].warnings


def test_rules_check_english_too_and_long_duration():
    en = (
        "This is a very long English line that will never fit in two lines of forty-two "
        "characters, whatever we try."
    )
    out = subtitle_rules.apply_rules([line(1, "00:00:00,000", "00:00:09,000", en=en)])
    rules = {x.rule for x in out[0].warnings}
    assert {"duree_longue", "trop_de_lignes"} <= rules
    assert any(x.detail.startswith("EN") for x in out[0].warnings)


# --- Confiance finale ------------------------------------------------------------------
def test_final_confidence():
    fc = subtitle_service.final_confidence
    assert fc("elevee", 0.9, None, []) == "elevee"
    assert fc("elevee", 0.5, None, []) == "moyenne"
    assert fc("elevee", 0.9, "Expression idiomatique.", []) == "moyenne"
    assert fc("elevee", 0.9, "Expression du glossaire.", ["ya3tik-essa7a"]) == "elevee"
    assert fc("moyenne", 0.5, "Doute.", []) == "faible"
    assert fc("faible", 0.99, None, []) == "faible"  # jamais au-dessus du LLM


# --- Traduction : validation et nouvel essai ------------------------------------------
def test_invalid_llm_line_does_not_fail_the_batch():
    good = {"id": "l1", "fr": "Ça va ?", "en": "You okay?", "confidence": "elevee"}
    bad = {"id": "l2", "fr": "Oui", "en": "Yes", "confidence": "certaine"}  # valeur invalide
    tr = ScriptedTranslator(
        [
            json.dumps({"lines": [good, bad]}),
            "pas du JSON",  # le nouvel essai échoue aussi
        ]
    )
    out = asyncio.run(tr.translate([cue(1), cue(2)], TranslationContext()))
    assert out[0].fr == "Ça va ?"
    assert out[1].fr == "" and out[1].en == ""
    assert out[1].confidence == "faible" and out[1].note == FALLBACK_NOTE
    assert [li["id"] for li in tr.prompts[1]["lignes"]] == ["l2"]  # seul l2 est redemandé


def test_retry_recovers_and_provider_error_is_contained():
    ok = {
        "id": "l1",
        "fr": "Oui.",
        "en": "Yes.",
        "confidence": "moyenne",
        "glossary_used": ["inconnu"],
    }
    tr = ScriptedTranslator([RuntimeError("quota"), json.dumps({"lines": [ok]})])
    out = asyncio.run(tr.translate([cue(1)], TranslationContext()))
    assert out[0].fr == "Oui." and out[0].glossary_used == []  # id hors glossaire retiré


# --- Endpoints ---------------------------------------------------------------------------
def test_post_draft_end_to_end(client):
    with capture_logs() as logs:
        r = post_draft(client, language_code="aeb", keyterms="Nour, Amira", characters="Nour,Amira")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["project_id"] == "demo" and d["source_lang"] == "derja"
    assert d["processing"]["transcriber"] == "fake/stt"
    assert d["processing"]["translator"] == "fake/llm"
    first, second = d["lines"]
    assert first["source"] == "Ya3tik essa7a, Nour."
    assert first["fr"] == "Merci, Nour." and first["en"] == "Thank you, Nour."
    assert first["glossary_used"] == ["ya3tik-essa7a"]
    assert first["confidence"] == "elevee" and first["validated"] is False
    assert first["speaker"] == "S1" and second["speaker"] == "S2"
    assert "note" not in second  # absent plutôt que null (contrat front)

    tx = app.state.transcriber
    assert tx.calls == [("temoignage.m4a", "aeb", ["Nour", "Amira"])]
    assert app.state.translator.contexts[0].characters == ["Nour", "Amira"]
    # Le texte des répliques n'apparaît jamais dans les logs.
    assert "essa7a" not in json.dumps(logs, default=str)
    assert any(e["event"] == "subtitles_draft_created" for e in logs)

    assert client.get("/subtitles/demo").json() == d


def test_temp_file_deleted_after_success_and_error(client):
    post_draft(client, content=b"audio-bytes")
    tx = app.state.transcriber
    assert tx.seen_bytes == b"audio-bytes"
    assert not tx.seen_path.exists() and not tx.seen_path.parent.exists()

    failing = FakeTranscriber(
        error=AppError("La transcription a échoué.", 502, "transcription_failed")
    )
    app.state.transcriber = failing
    r = post_draft(client)
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "transcription_failed"
    assert failing.seen_path is not None and not failing.seen_path.parent.exists()


def test_file_too_large_returns_413(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "subtitle_max_upload_mb", 1)
    r = post_draft(client, content=b"0" * (1024 * 1024 + 10))
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "file_too_large"
    assert app.state.transcriber.calls == []


def test_missing_provider_returns_503_before_transcription(client):
    app.state.translator = None
    r = post_draft(client)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "translation_unavailable"
    assert app.state.transcriber.calls == []


def test_no_speech_returns_422(client):
    app.state.transcriber = FakeTranscriber(words=[])
    assert post_draft(client).status_code == 422


def test_get_without_draft_returns_empty_lines(client):
    r = client.get("/subtitles/inconnu")
    assert r.status_code == 200
    assert r.json() == {"project_id": "inconnu", "source_lang": "derja", "lines": []}


def test_put_replaces_lines_and_keeps_processing(client):
    created = post_draft(client).json()
    lines = created["lines"]
    lines[0]["fr"] = "Merci beaucoup, Nour."
    lines[0]["validated"] = True
    r = client.put("/subtitles/demo", json={"lines": lines[:1]})
    assert r.status_code == 200
    d = r.json()
    assert len(d["lines"]) == 1
    assert d["lines"][0]["fr"] == "Merci beaucoup, Nour." and d["lines"][0]["validated"]
    assert d["processing"] == created["processing"]
    assert client.get("/subtitles/demo").json() == d


def test_put_rejects_bad_lines(client):
    ok = {
        "id": "a",
        "start": "00:00:01,000",
        "end": "00:00:02,000",
        "source": "x",
        "fr": "y",
        "confidence": "elevee",
        "validated": False,
    }
    assert client.put("/subtitles/demo", json={"lines": [ok, ok]}).status_code == 422
    bad_time = {**ok, "start": "1.0"}
    assert client.put("/subtitles/demo", json={"lines": [bad_time]}).status_code == 422


# --- Appels HTTP réels simulés (httpx.MockTransport, aucun réseau) ----------------------
def _settings(**kw):
    from app.core.config import Settings

    return Settings(_env_file=None, **kw)


def test_elevenlabs_request_shape_and_errors(tmp_path):
    import httpx

    from app.services.transcription_service import ElevenLabsTranscriber

    audio = tmp_path / "a.m4a"
    audio.write_bytes(b"audio")
    seen = {}

    def handler(request: httpx.Request):
        seen["key"] = request.headers["xi-api-key"]
        seen["body"] = request.content.decode("latin-1")
        return httpx.Response(
            200,
            json={
                "language_code": "aeb",
                "words": [
                    {
                        "text": "Labes",
                        "start": 0,
                        "end": 0.4,
                        "type": "word",
                        "logprob": -0.2,
                        "speaker_id": "speaker_0",
                    }
                ],
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    tx = ElevenLabsTranscriber(_settings(elevenlabs_api_key="cle-test"), client=client)
    out = asyncio.run(tx.transcribe(audio, "a.m4a", None, ["Nour", "Amira"]))
    assert out.words[0].text == "Labes" and out.language_code == "aeb"
    body = seen["body"]
    assert seen["key"] == "cle-test"
    assert 'name="model_id"\r\n\r\nscribe_v2' in body
    assert 'name="diarize"\r\n\r\ntrue' in body
    assert 'name="timestamps_granularity"\r\n\r\nword' in body
    assert 'name="tag_audio_events"\r\n\r\nfalse' in body
    assert body.count('name="keyterms"') == 2  # champ répété
    assert 'name="language_code"' not in body

    def failing(request):
        return httpx.Response(401, json={"detail": "invalid key secret"})

    bad = ElevenLabsTranscriber(
        _settings(elevenlabs_api_key="x"),
        client=httpx.AsyncClient(transport=httpx.MockTransport(failing)),
    )
    with pytest.raises(AppError) as err:
        asyncio.run(bad.transcribe(audio, "a.m4a", "aeb", []))
    assert err.value.status_code == 502 and "secret" not in err.value.message

    with pytest.raises(AppError) as err:
        asyncio.run(ElevenLabsTranscriber(_settings()).transcribe(audio, "a", None, []))
    assert err.value.status_code == 503 and err.value.code == "transcription_unavailable"


def test_ollama_translator_request_shape():
    import httpx

    from app.services.translation_service import OllamaTranslator, create_translator

    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        content = json.dumps(
            {"lines": [{"id": "l1", "fr": "Ça va ?", "en": "You okay?", "confidence": "elevee"}]}
        )
        return httpx.Response(200, json={"message": {"content": content}})

    settings = _settings(llm_provider="ollama", ollama_model="qwen3:14b")
    tr = OllamaTranslator(
        settings, client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )
    out = asyncio.run(tr.translate([cue(1)], TranslationContext(characters=["Nour"])))
    assert out[0].fr == "Ça va ?"
    assert seen["model"] == "qwen3:14b" and seen["stream"] is False
    assert seen["format"]["type"] == "object"
    assert json.loads(seen["messages"][1]["content"])["contexte"]["personnages"] == ["Nour"]
    assert tr.name == "ollama/qwen3:14b"
    assert create_translator(_settings(llm_provider="autre")) is None
    assert not create_translator(_settings(llm_provider="gemini")).available
