import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    import torch
except ImportError:  # pragma: no cover
    torch = None

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
except ImportError:  # pragma: no cover
    AutoModelForCausalLM = None
    AutoTokenizer = None


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("summary-service")


def read_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def resolve_transformers_model_source(model_name_or_path: str) -> Tuple[str, bool]:
    expanded_path = Path(model_name_or_path).expanduser()
    if expanded_path.exists():
        return str(expanded_path.resolve()), True

    if model_name_or_path.startswith(("/", "./", "../", "~")):
        raise RuntimeError(f"Local model path not found: {expanded_path}")

    return model_name_or_path, False


SUMMARY_PROVIDER = read_env("SUMMARY_PROVIDER", "ollama").lower()
HOST = read_env("SUMMARY_HOST", "0.0.0.0")
PORT = int(read_env("SUMMARY_PORT", "8010"))
MAX_SOURCE_CHARS = int(read_env("SUMMARY_MAX_SOURCE_CHARS", "120000"))
CHUNK_TARGET_CHARS = int(read_env("SUMMARY_CHUNK_TARGET_CHARS", "12000"))
CHUNK_OVERLAP_CHARS = int(read_env("SUMMARY_CHUNK_OVERLAP_CHARS", "1000"))
CHUNK_MAX_NEW_TOKENS = int(read_env("SUMMARY_CHUNK_MAX_NEW_TOKENS", "700"))
FINAL_MAX_NEW_TOKENS = int(read_env("SUMMARY_FINAL_MAX_NEW_TOKENS", "1400"))
TEMPERATURE = float(read_env("SUMMARY_TEMPERATURE", "0.1"))
TOP_P = float(read_env("SUMMARY_TOP_P", "0.9"))

OLLAMA_BASE_URL = read_env("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = read_env("OLLAMA_MODEL", "qwen2.5:14b")
OLLAMA_KEEP_ALIVE = read_env("OLLAMA_KEEP_ALIVE", "15m")
OLLAMA_NUM_PREDICT = int(read_env("OLLAMA_NUM_PREDICT", "1400"))
OLLAMA_REQUEST_TIMEOUT = float(read_env("OLLAMA_REQUEST_TIMEOUT", "600"))

MODEL_NAME_OR_PATH = read_env("SUMMARY_MODEL_NAME_OR_PATH", "Qwen/Qwen2.5-7B-Instruct")
DEVICE_MAP = read_env("SUMMARY_DEVICE_MAP", "auto")
MODEL_DTYPE = read_env("SUMMARY_MODEL_DTYPE", "auto").lower()
TRUST_REMOTE_CODE = read_env("SUMMARY_TRUST_REMOTE_CODE", "false").lower() == "true"


SYSTEM_PROMPT = (
    "You are a precise document analyst. Read the provided PDF text carefully and produce a "
    "fact-grounded summary. Do not invent missing details. If a detail is not present, say "
    "'Not mentioned'. Never include phone numbers, mobile numbers, or personal contact details — names only. "
    "Return clear markdown only."
)

CHUNK_PROMPT_TEMPLATE = """
You are reading a portion of a legal or official PDF document (judgment, order, petition, FIR, notice, circular, report, tribunal decision, etc.).

Extract structured notes from this chunk.

### Document Snapshot
- Document type (judgment, order, petition, notice, report, FIR, affidavit, etc.)
- Main topic / subject
- Court / authority / department / issuer
- Case / file / reference / FIR / appeal number
- Location (if mentioned)

### Case Parties / People Involved
Identify and classify people or entities mentioned. List names only — no phone numbers or contact details.
- Petitioner / Applicant / Complainant / Claimant / Plaintiff
- Respondent / Non-applicant / Accused / Defendant
- Appellant / Respondent (Appeal cases)
- Other key parties (insurer, company, government body, etc.) — only if present in this document
- Witnesses
- Police officers / Doctors / Officials

### Advocates / Representatives
Names and designation only — no phone numbers, no addresses.
- Petitioner's Advocate
- Respondent's Advocate
- Public Prosecutor / Government Advocate
- Legal representatives

### Judge / Authority / Officer
- Judge / Presiding Officer
- Tribunal / Court
- Authority / Officer issuing the order

### Case Laws / Judgments Cited (Precedents)
- Previous cases referenced (e.g., X vs Y)
- Supreme Court / High Court cases cited

### Legal Provisions Referenced
- Acts
- Sections
- Rules
- Policies
- Circulars
- Notifications
- Clauses / Regulations

### Important Dates and Numbers
- Dates of incident, filing, order, hearing, deadlines
- Case numbers, FIR numbers, appeal numbers
- Amounts, compensation, fines, percentages
- Exhibit numbers, document numbers

### Facts / Background
- Important factual statements
- Background of the case
- What happened
- Evidence or statements

### Issues / Requests / Relief Sought
- What is being requested, argued, appealed, or claimed
- Relief, compensation, bail, quashing, stay, directions, etc.

### Decision / Outcome / Directions
- Court orders
- Findings
- Decisions
- Directions to parties
- Compensation / Penalty / Bail / Dismissed / Allowed etc.

### Next Steps / Compliance / Hearings
- Deadlines
- Compliance instructions
- Next hearing date
- Follow-up actions

Source chunk:
{chunk_text}
""".strip()



FINAL_PROMPT_TEMPLATE = """
Using the extracted notes from one or more PDF chunks, create one clean final summary.

Follow this exact markdown structure:

## Document Details
- **Document type:** ...
- **Main subject:** ...
- **Court / Authority / Issuer:** ...
- **Case / File / Reference number:** ...
- **Location:** ...

## Case Parties / People Involved
List each person on a separate numbered line under their role. Names only — no phone numbers or contact details. Only include roles that actually appear in this document.

**Petitioner / Applicant / Complainant:**
1. ...

**Respondent / Accused / Defendant:**
1. ...

**Appellant / Respondent (Appeal):**
1. ...

**Witnesses / Officials:**
1. ...

[Add any other relevant party roles only if present in this case]

## Advocates / Representatives
List each name on a separate numbered line. Names and designation only — no phone numbers, no addresses.

**Petitioner's Advocate:**
1. ...

**Respondent's Advocate:**
1. ...

**Public Prosecutor / Government Advocate:**
1. ...

## Judge / Authority / Officer
- **Judge / Presiding Officer:** ...
- **Court / Tribunal / Authority:** ...

## Case Laws / Judgments Cited
- ...

## Acts, Sections, Rules, Policies, or Clauses
- ...

## Facts and Background
- ...

## Issues, Requests, Relief, or Purpose
- ...

## Decision, Outcome, or Directions
- ...

## Important Dates and Numbers
- ...

## Action Items, Compliance, or Next Steps
- ...

## Short Takeaway
Write a concise 3–5 sentence narrative summary of the entire document.

Rules:
- Use only information supported by the notes.
- If a section has no reliable information, write `Not mentioned`.
- Do NOT mix case parties with cited case law names.
- Keep bullets concise but specific.
- Preserve legal terminology when present.
- Maintain neutral and formal legal tone.

Extracted notes:
{notes}
""".strip()




class SummaryRequest(BaseModel):
    text: str


class SummaryResponse(BaseModel):
    summary: str
    chunks_used: int
    model: str


class TransformersSummarizer:
    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None
        self._lock = threading.Lock()

    def _resolve_dtype(self):
        if MODEL_DTYPE == "auto":
            return "auto"
        if torch is None:
            return "auto"
        mapping = {
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
            "float32": torch.float32,
        }
        return mapping.get(MODEL_DTYPE, "auto")

    def _load(self) -> None:
        if self._model is not None and self._tokenizer is not None:
            return

        if AutoTokenizer is None or AutoModelForCausalLM is None or torch is None:
            raise RuntimeError("transformers/torch is not installed in this environment")

        with self._lock:
            if self._model is not None and self._tokenizer is not None:
                return

            resolved_source, local_files_only = resolve_transformers_model_source(MODEL_NAME_OR_PATH)
            logger.info("Loading transformers summary model from %s", resolved_source)
            self._tokenizer = AutoTokenizer.from_pretrained(
                resolved_source,
                trust_remote_code=TRUST_REMOTE_CODE,
                local_files_only=local_files_only,
            )
            self._model = AutoModelForCausalLM.from_pretrained(
                resolved_source,
                torch_dtype=self._resolve_dtype(),
                device_map=DEVICE_MAP,
                trust_remote_code=TRUST_REMOTE_CODE,
                local_files_only=local_files_only,
            )
            self._model.eval()
            logger.info("Transformers summary model loaded successfully")

    def chat(self, user_prompt: str, max_new_tokens: int) -> str:
        self._load()

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        prompt = self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = self._tokenizer(prompt, return_tensors="pt")
        model_input_device = next(self._model.parameters()).device
        inputs = {key: value.to(model_input_device) for key, value in inputs.items()}

        generate_kwargs = {
            "do_sample": TEMPERATURE > 0,
            "temperature": max(TEMPERATURE, 0.01),
            "top_p": TOP_P,
            "max_new_tokens": max_new_tokens,
            "pad_token_id": self._tokenizer.pad_token_id or self._tokenizer.eos_token_id,
        }

        with torch.inference_mode():
            generated = self._model.generate(**inputs, **generate_kwargs)

        prompt_tokens = inputs["input_ids"].shape[-1]
        output_ids = generated[0][prompt_tokens:]
        return self._tokenizer.decode(output_ids, skip_special_tokens=True).strip()

    def model_name(self) -> str:
        return MODEL_NAME_OR_PATH

    def model_loaded(self) -> bool:
        return self._model is not None


class OllamaSummarizer:
    def status(self) -> Dict[str, object]:
        try:
            with httpx.Client(timeout=10) as client:
                response = client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                data = response.json()
        except httpx.RequestError:
            return {"reachable": False, "model_present": False, "available_models": []}
        except httpx.HTTPStatusError:
            return {"reachable": False, "model_present": False, "available_models": []}

        models = data.get("models", [])
        names = [item.get("name") for item in models if item.get("name")]
        return {
            "reachable": True,
            "model_present": OLLAMA_MODEL in names,
            "available_models": names,
        }

    def chat(self, user_prompt: str, max_new_tokens: int) -> str:
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": TEMPERATURE,
                "top_p": TOP_P,
                "num_predict": min(max_new_tokens, OLLAMA_NUM_PREDICT),
            },
        }

        with httpx.Client(timeout=OLLAMA_REQUEST_TIMEOUT) as client:
            response = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()

        message = data.get("message", {})
        content = (message.get("content") or "").strip()
        if not content:
            raise RuntimeError("Ollama returned an empty response")
        return content

    def model_name(self) -> str:
        return OLLAMA_MODEL

    def model_loaded(self) -> bool:
        return True


class SummaryEngine:
    def __init__(self) -> None:
        if SUMMARY_PROVIDER == "ollama":
            self.backend = OllamaSummarizer()
        elif SUMMARY_PROVIDER == "transformers":
            self.backend = TransformersSummarizer()
        else:
            raise RuntimeError(f"Unsupported SUMMARY_PROVIDER: {SUMMARY_PROVIDER}")

    def summarize(self, text: str) -> Tuple[str, int]:
        cleaned = normalize_text(text)
        if not cleaned:
            raise ValueError("No text provided")

        if len(cleaned) > MAX_SOURCE_CHARS:
            logger.info("Truncating source text from %s to %s chars", len(cleaned), MAX_SOURCE_CHARS)
            cleaned = cleaned[:MAX_SOURCE_CHARS]

        chunks = split_text_into_chunks(cleaned, CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS)
        chunk_notes: List[str] = []

        for index, chunk in enumerate(chunks, start=1):
            logger.info("Summarizing chunk %s/%s with %s", index, len(chunks), self.backend.model_name())
            note = self.backend.chat(
                CHUNK_PROMPT_TEMPLATE.format(chunk_text=chunk),
                max_new_tokens=CHUNK_MAX_NEW_TOKENS,
            )
            chunk_notes.append(f"## Chunk {index}\n{note}")

        notes_blob = "\n\n".join(chunk_notes)
        final_summary = self.backend.chat(
            FINAL_PROMPT_TEMPLATE.format(notes=notes_blob),
            max_new_tokens=FINAL_MAX_NEW_TOKENS,
        )
        return final_summary, len(chunks)

    def model_name(self) -> str:
        return self.backend.model_name()

    def model_loaded(self) -> bool:
        return self.backend.model_loaded()

    def health_details(self) -> Dict[str, object]:
        if SUMMARY_PROVIDER == "ollama":
            return self.backend.status()
        return {}


def normalize_text(text: str) -> str:
    lines = []
    for raw_line in text.splitlines():
        line = " ".join(raw_line.split())
        if line:
            lines.append(line)
    return "\n".join(lines).strip()


def split_text_into_chunks(text: str, target_size: int, overlap: int) -> List[str]:
    paragraphs = [part.strip() for part in text.split("\n") if part.strip()]
    if not paragraphs:
        return [text]

    chunks: List[str] = []
    current_parts: List[str] = []
    current_length = 0

    for paragraph in paragraphs:
        paragraph_length = len(paragraph)
        if current_parts and current_length + paragraph_length + 1 > target_size:
            chunks.append("\n".join(current_parts).strip())

            if overlap > 0:
                overlap_parts: List[str] = []
                overlap_length = 0
                for previous in reversed(current_parts):
                    overlap_parts.insert(0, previous)
                    overlap_length += len(previous) + 1
                    if overlap_length >= overlap:
                        break
                current_parts = overlap_parts
                current_length = sum(len(part) + 1 for part in current_parts)
            else:
                current_parts = []
                current_length = 0

        current_parts.append(paragraph)
        current_length += paragraph_length + 1

    if current_parts:
        chunks.append("\n".join(current_parts).strip())

    return chunks or [text]


summarizer = SummaryEngine()
app = FastAPI(title="Qwen PDF Summary Service")


@app.get("/")
def root() -> Dict[str, object]:
    return {
        "ok": True,
        "service": "summary",
        "provider": SUMMARY_PROVIDER,
        "model": summarizer.model_name(),
    }


@app.get("/health")
def health() -> Dict[str, object]:
    provider_health = summarizer.health_details()
    return {
        "ok": True,
        "provider": SUMMARY_PROVIDER,
        "model_name_or_path": summarizer.model_name(),
        "model_loaded": summarizer.model_loaded(),
        "cuda_available": torch.cuda.is_available() if torch is not None else None,
        "ollama_base_url": OLLAMA_BASE_URL if SUMMARY_PROVIDER == "ollama" else None,
        "ollama_reachable": provider_health.get("reachable") if SUMMARY_PROVIDER == "ollama" else None,
        "ollama_model_present": provider_health.get("model_present") if SUMMARY_PROVIDER == "ollama" else None,
        "available_models": provider_health.get("available_models") if SUMMARY_PROVIDER == "ollama" else None,
    }


@app.post("/summarize", response_model=SummaryResponse)
def summarize_pdf(req: SummaryRequest) -> SummaryResponse:
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    try:
        summary, chunks_used = summarizer.summarize(req.text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(
            status_code=502,
            detail=f"Ollama upstream error ({exc.response.status_code}): {detail}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Ollama: {exc}") from exc
    except Exception as exc:
        logger.exception("Summary generation failed")
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {exc}") from exc

    return SummaryResponse(
        summary=summary,
        chunks_used=chunks_used,
        model=summarizer.model_name(),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=HOST, port=PORT, reload=False)
