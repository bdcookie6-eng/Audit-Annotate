import json
import logging
import os
from typing import AsyncGenerator

from groq import AsyncGroq

logger = logging.getLogger(__name__)

_client: AsyncGroq | None = None


def get_client() -> AsyncGroq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set.")
        _client = AsyncGroq(api_key=api_key)
    return _client


# Groq model selection:
# - llama-3.3-70b-versatile: best reasoning, use for extraction and chat
# - llama-3.1-8b-instant: fast/cheap, use for short summary
EXTRACTION_MODEL = "llama-3.3-70b-versatile"
SUMMARY_MODEL    = "llama-3.1-8b-instant"
CHAT_MODEL       = "llama-3.3-70b-versatile"


EXTRACTION_SYSTEM = """You are a financial statement data extraction expert. Extract structured data from financial documents and return ONLY valid JSON — no prose, no markdown fences.

Return this exact structure:
{
  "statement_type": "balance_sheet" | "income_statement" | "cash_flow" | "notes" | "unknown",
  "period": "e.g. December 31, 2024",
  "currency": "USD",
  "unit": "ones" | "thousands" | "millions",
  "sections": [
    {
      "name": "Section name",
      "line_items": [
        {
          "label": "Line item label",
          "current_year": 1234567.00,
          "prior_year": 987654.00,
          "is_subtotal": false,
          "is_total": false,
          "indent_level": 0
        }
      ],
      "subtotal": {
        "label": "Total Section Name",
        "current_year": 5000000.00,
        "prior_year": 4500000.00,
        "is_subtotal": true,
        "is_total": false,
        "indent_level": 0
      }
    }
  ],
  "total": {
    "label": "Grand Total label",
    "current_year": 10000000.00,
    "prior_year": 9000000.00,
    "is_subtotal": false,
    "is_total": true,
    "indent_level": 0
  }
}

Rules:
- Convert all values to base units (multiply by 1000 if the doc says "in thousands", by 1,000,000 if "in millions")
- Use null for missing values, never 0 as a substitute for missing
- Preserve exact label text from the document
- Set is_subtotal true only for section totals (e.g. "Total Current Assets")
- Set is_total true only for the document grand total (e.g. "Total Assets")"""


async def extract_financial_data(document_text: str) -> dict:
    client = get_client()
    response = await client.chat.completions.create(
        model=EXTRACTION_MODEL,
        max_tokens=8192,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM},
            {"role": "user",   "content": f"Extract financial data from this document:\n\n{document_text[:60000]}"},
        ],
    )
    raw = response.choices[0].message.content.strip()
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError as e:
        logger.error("Groq extraction JSON parse failed: %s", e)
    return {"statement_type": "unknown", "sections": [], "raw_text": document_text[:3000]}


async def generate_document_summary(extracted_data: dict, findings: list) -> str:
    client = get_client()
    findings_text = "\n".join(
        f"- [{f.get('severity','info').upper()}] {f.get('title')}: {f.get('description')}"
        for f in findings
    ) or "No issues detected."

    prompt = (
        f"Financial document analysis complete.\n\n"
        f"DOCUMENT INFO:\n{json.dumps({k: v for k, v in extracted_data.items() if k != 'raw_text'}, indent=2)[:4000]}\n\n"
        f"FINDINGS ({len(findings)} total):\n{findings_text}\n\n"
        f"Write a 2-4 sentence professional summary for the auditor: what document this is, "
        f"the reporting period, the most critical issues, and what to focus on first."
    )
    response = await client.chat.completions.create(
        model=SUMMARY_MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()


COPILOT_SYSTEM = """You are an expert CPA audit assistant embedded in an audit workbench tool.
You have access to a parsed financial document. Answer questions precisely, cite specific line items
and figures, flag concerns proactively, and recommend concrete next steps. Be direct and professional.
Never hallucinate figures — only reference data explicitly present in the document context."""


async def stream_chat_response(
    document_text: str,
    extracted_data: dict,
    message: str,
    history: list,
) -> AsyncGenerator[str, None]:
    client = get_client()
    system_content = (
        COPILOT_SYSTEM
        + f"\n\nDOCUMENT DATA:\n{json.dumps(extracted_data, indent=2)[:12000]}"
        + (f"\n\nORIGINAL TEXT (excerpt):\n{document_text[:8000]}" if document_text else "")
    )
    messages = [{"role": "system", "content": system_content}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": message})

    async with client.chat.completions.stream(
        model=CHAT_MODEL,
        max_tokens=2048,
        messages=messages,
    ) as stream:
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
