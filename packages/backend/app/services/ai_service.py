import json
import logging

logger = logging.getLogger(__name__)

_VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
_VALID_CATEGORIES = {
    "Electrical", "Plumbing", "Structural", "Safety",
    "Equipment", "Environmental", "HVAC", "Security", "Cleaning", "Other",
}


def _model() -> "object":
    import google.generativeai as genai  # type: ignore[import-untyped]
    from app.config import settings
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-2.0-flash-lite")


def suggest_priority(title: str, description: str) -> dict[str, object]:
    from app.config import settings
    if not settings.gemini_api_key:
        return {"priority": "MEDIUM", "confidence": 0.0, "reasoning": "AI unavailable — no API key configured"}

    prompt = (
        "Analyze this field report and suggest a priority level.\n\n"
        f"Title: {title}\nDescription: {description}\n\n"
        "Return JSON with:\n"
        "- priority: exactly one of LOW, MEDIUM, HIGH, CRITICAL\n"
        "- confidence: float 0.0-1.0\n"
        "- reasoning: one short sentence explaining why\n\n"
        "Return only valid JSON, no markdown."
    )
    try:
        resp = _model().generate_content(  # type: ignore[union-attr]
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        data = json.loads(resp.text)
        priority = data.get("priority", "MEDIUM")
        if priority not in _VALID_PRIORITIES:
            priority = "MEDIUM"
        return {
            "priority": priority,
            "confidence": float(data.get("confidence", 0.5)),
            "reasoning": str(data.get("reasoning", "")),
        }
    except Exception:
        logger.exception("suggest_priority failed")
        return {"priority": "MEDIUM", "confidence": 0.0, "reasoning": "AI temporarily unavailable"}


def enhance_description(title: str, description: str) -> str:
    from app.config import settings
    if not settings.gemini_api_key:
        return description

    prompt = (
        "Rewrite this field report description to be clearer and more structured. "
        "Keep all the same facts and use the same language. Improve grammar and completeness.\n\n"
        f"Title: {title}\nOriginal description: {description}\n\n"
        "Return only the improved description text, no explanation or preamble."
    )
    try:
        resp = _model().generate_content(prompt)  # type: ignore[union-attr]
        return resp.text.strip()
    except Exception:
        logger.exception("enhance_description failed")
        return description


def tag_report(title: str, description: str) -> dict[str, str]:
    from app.config import settings
    if not settings.gemini_api_key:
        return {"category": "Other", "keywords": ""}

    prompt = (
        "Classify this field report.\n\n"
        f"Title: {title}\nDescription: {description}\n\n"
        "Return JSON with:\n"
        "- category: one of Electrical, Plumbing, Structural, Safety, Equipment, "
        "Environmental, HVAC, Security, Cleaning, Other\n"
        "- keywords: comma-separated list of 3-5 key terms\n\n"
        "Return only valid JSON, no markdown."
    )
    try:
        resp = _model().generate_content(  # type: ignore[union-attr]
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        data = json.loads(resp.text)
        category = data.get("category", "Other")
        if category not in _VALID_CATEGORIES:
            category = "Other"
        return {"category": category, "keywords": str(data.get("keywords", ""))}
    except Exception:
        logger.exception("tag_report failed")
        return {"category": "Other", "keywords": ""}


def suggest_note(title: str, description: str, priority: str, similar_notes: list[str]) -> str:
    from app.config import settings
    if not settings.gemini_api_key:
        return ""

    examples = ""
    if similar_notes:
        examples = "\n\nFrom similar resolved reports:\n" + "\n".join(f"- {n}" for n in similar_notes)

    prompt = (
        "Write a brief, professional manager action note for this field report.\n\n"
        f"Title: {title}\nDescription: {description}\nPriority: {priority}{examples}\n\n"
        "The note should describe immediate actions to take (2-4 sentences, professional tone).\n"
        "Return only the note text."
    )
    try:
        resp = _model().generate_content(prompt)  # type: ignore[union-attr]
        return resp.text.strip()
    except Exception:
        logger.exception("suggest_note failed")
        return ""
