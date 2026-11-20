import asyncio

import pytest

from app.repositories import ai_tool_repository as repo
from app.services import ai_tool_review_service as review


def run(coro):
    return asyncio.run(coro)


def fact_row(fid, field="training_data", verified=True, confirmed=False):
    return {
        "id": fid, "field": field, "plan": "all", "value_fr": "x", "quote": "une phrase assez longue",
        "source_url": "https://a.example/t", "source_kind": "terms",
        "quote_verified": verified, "human_confirmed": confirmed,
    }  # fmt: skip


@pytest.fixture
def store(monkeypatch):
    state = {
        "tool": {"id": "t1", "slug": "claude", "name": "Claude", "status": "partiel",
                 "review_state": "a_verifier", "research_state": "complete", "reviewed_by": None},
        "facts": [fact_row("f1", "training_data"), fact_row("f2", "input_training_use"), fact_row("f3", "output_rights", verified=False)],
    }  # fmt: skip

    async def get_by_slug(pool, slug):
        return state["tool"] if slug == "claude" else None

    async def facts_for(pool, ids):
        return {"t1": list(state["facts"])}

    async def list_by_review_state(pool, s):
        return [state["tool"]] if state["tool"]["review_state"] == s else []

    async def delete_fact(pool, fid):
        state["facts"] = [f for f in state["facts"] if f["id"] != fid]

    async def confirm_fact(pool, fid):
        for f in state["facts"]:
            if f["id"] == fid:
                f["human_confirmed"] = True

    async def set_review(pool, tid, st, reviewer, status):
        state["tool"].update(review_state=st, reviewed_by=reviewer, status=status)

    for name, fn in dict(  # noqa: C408
        get_by_slug=get_by_slug,
        facts_for=facts_for,
        list_by_review_state=list_by_review_state,
        delete_fact=delete_fact,
        confirm_fact=confirm_fact,
        set_review=set_review,
    ).items():
        monkeypatch.setattr(repo, name, fn)
    return state


def test_pending_shows_what_is_left_to_decide(store):
    rows = run(review.pending(None))
    assert rows == [
        {"slug": "claude", "name": "Claude", "facts": 3, "unconfirmed": 1, "status": "partiel"}
    ]


def test_cannot_approve_while_a_fact_is_neither_found_nor_confirmed(store):
    with pytest.raises(review.ReviewError, match="1 fait"):
        run(review.approve(None, "claude", "Amira B."))
    assert store["tool"]["review_state"] == "a_verifier"


def test_confirming_the_fact_lets_the_reviewer_approve_and_the_status_counts_it(store):
    run(review.confirm_fact(None, "claude", "f3"))
    status = run(review.approve(None, "claude", "Amira B."))
    assert status == "documente"  # les trois questions de base ont maintenant une réponse
    assert store["tool"]["review_state"] == "verifie" and store["tool"]["reviewed_by"] == "Amira B."


def test_rejecting_the_doubtful_fact_also_unblocks_approval_with_a_lower_status(store):
    assert run(review.reject_fact(None, "claude", "f3")) == "partiel"
    assert run(review.approve(None, "claude", "Amira B.")) == "partiel"


def test_a_reviewer_name_is_required_and_foreign_facts_are_refused(store):
    with pytest.raises(review.ReviewError, match="nom"):
        run(review.approve(None, "claude", " "))
    with pytest.raises(review.ReviewError, match="n'appartient pas"):
        run(review.reject_fact(None, "claude", "autre-outil-fait"))
    with pytest.raises(review.ReviewError, match="introuvable"):
        run(review.show(None, "inconnu"))


def test_an_empty_sheet_cannot_be_approved_and_reopen_clears_the_reviewer(store):
    store["facts"].clear()
    store["tool"]["research_state"] = "incomplete_access"
    with pytest.raises(review.ReviewError, match="Fiche vide"):
        run(review.approve(None, "claude", "Amira B."))
    store["facts"].append(fact_row("f1"))
    run(review.approve(None, "claude", "Amira B."))
    run(review.reopen(None, "claude"))
    assert store["tool"]["review_state"] == "a_verifier" and store["tool"]["reviewed_by"] is None
