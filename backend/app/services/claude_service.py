import json
import logging
import os
from typing import AsyncGenerator

import anthropic

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


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
- Set is_total true only for the document grand total (e.g. "Total Assets")
"""


async def extract_financial_data(document_text: str) -> dict:
    client = get_client()
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=EXTRACTION_SYSTEM,
        messages=[
            {"role": "user", "content": f"Extract financial data from this document:\n\n{document_text[:60000]}"}
        ],
    )
    raw = message.content[0].text.strip()
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError as e:
        logger.error("Claude extraction JSON parse failed: %s", e)
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
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


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
    system = (
        COPILOT_SYSTEM
        + f"\n\nDOCUMENT DATA:\n{json.dumps(extracted_data, indent=2)[:12000]}"
        + (f"\n\nORIGINAL TEXT (excerpt):\n{document_text[:8000]}" if document_text else "")
    )
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": message})

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=messages,
    ) as stream:
        for chunk in stream.text_stream:
            yield chunk


REPORT_SYSTEM = """You are an expert CPA and audit report drafter. Given financial statement data from one or more uploaded documents, produce a professional Independent Auditor's Report draft and a figure traceability map.

Return ONLY valid JSON in this exact structure — no prose, no markdown fences:

{
  "report": {
    "title": "Independent Auditor's Report",
    "addressee": "Board of Directors and Management",
    "sections": [
      {
        "id": "opinion",
        "heading": "Opinion",
        "paragraphs": [
          "We have audited the accompanying financial statements..."
        ]
      },
      {
        "id": "financial_highlights",
        "heading": "Financial Highlights",
        "paragraphs": [
          "Total assets as of the balance sheet date were {{fig_1}}, compared to {{fig_2}} in the prior year."
        ]
      }
    ],
    "signature": "[Firm Name]",
    "date": "[Date]",
    "location": "[City, State]"
  },
  "figure_map": [
    {
      "id": "fig_1",
      "display": "$4,821,000",
      "label": "Total Assets (Current Year)",
      "source_document_id": "EXACT_DOC_ID_FROM_INPUT",
      "source_document_name": "filename.pdf",
      "source_section": "Assets",
      "source_line_item": "Total Assets",
      "report_section_id": "financial_highlights",
      "report_section_heading": "Financial Highlights"
    }
  ]
}

Rules:
- Use {{fig_N}} placeholders in paragraph text ONLY where you cite a specific dollar figure from a source document
- Every {{fig_N}} in paragraph text MUST have a matching entry in figure_map with the same id
- The source_document_id MUST exactly match the document ID given in the input — copy it verbatim
- Include all grand totals, major subtotals (Total Current Assets, Total Liabilities, Net Income, Net Cash, etc.), and material year-over-year variances
- Write the Opinion section in standard AICPA boilerplate language with NO figure references (no {{fig_N}} in opinion paragraphs)
- Place figure citations in Financial Highlights, Key Account Balances, and Analysis sections only
- Format display values with $ and commas: $1,234,567
- If prior year data is present, include a prior year comparison section
- Do not invent figures — only use values explicitly present in the extracted data
"""


async def generate_audit_report(documents: list[dict]) -> dict:
    client = get_client()

    doc_blocks = []
    for doc in documents:
        extracted = doc.get("extracted_data", {})
        data_summary = {k: v for k, v in extracted.items() if k not in ("_raw_text",)}
        doc_blocks.append(
            f"=== Document ===\n"
            f"ID: {doc['id']}\n"
            f"Filename: {doc['filename']}\n"
            f"Statement Type: {doc.get('statement_type', 'unknown')}\n"
            f"Extracted Data:\n{json.dumps(data_summary, indent=2)[:8000]}"
        )

    prompt = (
        "Generate an audit report draft and figure traceability map for the following "
        "financial document(s). Use the exact document IDs shown in the input as source_document_id values.\n\n"
        + "\n\n".join(doc_blocks)
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=REPORT_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError as e:
        logger.error("Audit report JSON parse failed: %s", e)
    return {
        "report": {
            "title": "Independent Auditor's Report",
            "addressee": "",
            "sections": [],
            "signature": "",
            "date": "",
            "location": "",
        },
        "figure_map": [],
    }
