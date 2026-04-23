from typing import Dict, Optional


def build_case_context(
    case_no: Optional[str] = None,
    case_year: Optional[str] = None,
    case_type: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    def clean(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    return {
        "case_no": clean(case_no),
        "case_year": clean(case_year),
        "case_type": clean(case_type),
    }


def apply_case_context_to_dict(payload: dict, case_context: Dict[str, Optional[str]]) -> dict:
    for key, value in (case_context or {}).items():
        payload[key] = value
    return payload


def apply_case_context_to_model(instance, case_context: Dict[str, Optional[str]]) -> None:
    for key, value in (case_context or {}).items():
        if hasattr(instance, key):
            setattr(instance, key, value)
