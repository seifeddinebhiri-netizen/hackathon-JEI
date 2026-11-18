from app.schemas.shot_spec import LLMSegment
from app.services.moving_plan_service import MAX_SEGMENTS, normalize_segments

C = {
    "size": "MS", "subject_kind": "person", "subject_view": "front", "subject_position": "center",
    "camera_angle": "eye_level", "tilt": "level", "light_contrast": "medium", "exposure": "balanced",
    "backlight": "avoid", "sun_relative": "not_applicable", "stability": "handheld", "movement": "tracking",
}  # fmt: skip


def seg(start, end, at_end=None):
    return LLMSegment.model_validate(
        {"start_s": start, "end_s": end, "description_fr": "x", "at_start": C, "at_end": at_end}
    )


def times(segments):
    return [(s.start_s, s.end_s) for s in segments]


def test_segments_are_glued_end_to_end_from_zero_to_the_duration():
    out = normalize_segments([seg(0.3, 3.2), seg(3.4, 6.9), seg(7.1, 9.5)], 10)
    assert times(out) == [(0, 3.2), (3.2, 6.9), (6.9, 10)]


def test_segments_are_sorted_and_ends_beyond_the_duration_are_clamped():
    out = normalize_segments([seg(5, 40), seg(0, 5)], 10)
    assert times(out) == [(0, 5), (5, 10)]


def test_a_single_segment_covers_the_whole_take():
    assert times(normalize_segments([seg(0, 4)], 12)) == [(0, 12)]


def test_unusable_plans_are_refused():
    assert normalize_segments([], 10) is None
    assert normalize_segments([seg(0, 1)] * (MAX_SEGMENTS + 1), 10) is None
    assert (
        normalize_segments([seg(0, 5), seg(5, 5.2), seg(5.2, 10)], 10) is None
    )  # passage de 0,2 s
    assert normalize_segments([seg(0, 10), seg(10, 12)], 10) is None  # le deuxième sort de la durée


def test_an_end_framing_identical_to_the_start_is_removed():
    out = normalize_segments(
        [seg(0, 5, at_end=C), seg(5, 10, at_end={**C, "camera_angle": "high"})], 10
    )
    assert out[0].at_end is None
    assert out[1].at_end.camera_angle.value == "high"
