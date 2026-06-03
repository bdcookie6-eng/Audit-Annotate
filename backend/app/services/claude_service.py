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


REPORT_SYSTEM = """You are a licensed CPA partner at a public accounting firm drafting a formal Independent Auditor's Report for partner review before issuance. You follow AICPA AU-C Section 700 (Forming an Opinion and Reporting on Financial Statements) precisely.

Rules:
- Use exact AU-C 700 paragraph language — partners will check wording against the standard
- Do NOT hallucinate figures — use only numbers explicitly provided in the prompt
- Determine opinion type from findings: unmodified if no errors, qualified if errors exist but statements are otherwise fairly presented, adverse only if pervasive material misstatements
- Calculate and state materiality threshold (use 5% of the largest relevant benchmark: total assets, total revenue, or net income/loss)
- Every material finding must be cited with the exact dollar amount and account name from the data
- All placeholders for firm/auditor signature use [FIRM NAME], [CITY, STATE], [REPORT DATE]
- The report should read as a near-final draft a partner would mark up, not a template"""


def _compute_materiality(extracted_data: dict) -> tuple[float, str]:
    """Return (threshold, benchmark_label) for the engagement."""
    total = extracted_data.get("total") or {}
    total_val = abs(float(total.get("current_year") or 0))

    # Try total assets first, then total revenue from sections
    if total_val > 0:
        threshold = total_val * 0.05
        return threshold, f"5% of total ({_fmt_dollars(total_val)})"

    sections = extracted_data.get("sections", [])
    for section in sections:
        sub = section.get("subtotal") or {}
        val = abs(float(sub.get("current_year") or 0))
        if val > 0:
            threshold = val * 0.05
            return threshold, f"5% of {section['name']} subtotal ({_fmt_dollars(val)})"

    return 0.0, "not determinable from available data"


def _fmt_dollars(val: float) -> str:
    if val >= 1_000_000:
        return f"${val / 1_000_000:,.2f}M"
    if val >= 1_000:
        return f"${val / 1_000:,.1f}K"
    return f"${val:,.0f}"


async def generate_audit_report(extracted_data: dict, findings: list, client_name: str, period: str) -> str:
    client = get_client()

    errors   = [f for f in findings if f.get("severity") == "error"]
    warnings = [f for f in findings if f.get("severity") == "warning"]
    infos    = [f for f in findings if f.get("severity") == "info"]

    opinion_type = "qualified" if errors else "unmodified"

    materiality_threshold, materiality_basis = _compute_materiality(extracted_data)
    materiality_str = (
        f"${materiality_threshold:,.0f} ({materiality_basis})"
        if materiality_threshold > 0 else materiality_basis
    )

    stmt_type = extracted_data.get("statement_type", "financial statement").replace("_", " ").title()
    entity    = client_name or "[ENTITY NAME]"
    period_str = period or "[PERIOD]"

    def fmt_finding(f: dict, idx: int) -> str:
        lines = [f"  Finding {idx}. {f.get('title')}"]
        lines.append(f"     {f.get('description')}")
        if f.get("field_name"):
            lines.append(f"     Account/Field: {f['field_name']}")
        if f.get("expected_value") is not None:
            lines.append(f"     Expected: {_fmt_dollars(abs(float(f['expected_value'])))}")
        if f.get("actual_value") is not None:
            lines.append(f"     Actual:   {_fmt_dollars(abs(float(f['actual_value'])))}")
        return "\n".join(lines)

    errors_text   = "\n\n".join(fmt_finding(f, i+1) for i, f in enumerate(errors))   or "None"
    warnings_text = "\n\n".join(fmt_finding(f, i+1) for i, f in enumerate(warnings)) or "None"
    infos_text    = "\n\n".join(fmt_finding(f, i+1) for i, f in enumerate(infos))    or "None"

    # Pull key financial figures for the report body
    total = extracted_data.get("total") or {}
    total_cy = total.get("current_year")
    total_label = total.get("label", "Total")

    section_summary = []
    for s in extracted_data.get("sections", [])[:6]:
        sub = s.get("subtotal") or {}
        cy = sub.get("current_year")
        if cy is not None:
            section_summary.append(f"  {s['name']}: {_fmt_dollars(abs(float(cy)))}")
    section_text = "\n".join(section_summary) or "  (section detail not available)"

    prompt = f"""Draft a partner-ready Independent Auditor's Report following AICPA AU-C Section 700.

=== ENGAGEMENT DATA ===
Entity: {entity}
Period: {period_str}
Statement Type: {stmt_type}
Opinion Type: {opinion_type.upper()}
Materiality Threshold: {materiality_str}

=== FINANCIAL SUMMARY ===
{section_text}
{f"  {total_label}: {_fmt_dollars(abs(float(total_cy)))}" if total_cy is not None else ""}

=== MATERIAL FINDINGS (errors — {len(errors)}) ===
{errors_text}

=== MATTERS REQUIRING ATTENTION (warnings — {len(warnings)}) ===
{warnings_text}

=== INFORMATIONAL ITEMS ({len(infos)}) ===
{infos_text}

=== INSTRUCTIONS ===
Write the complete report in this exact order:

1. REPORT HEADER
   "INDEPENDENT AUDITOR'S REPORT"
   To the [Board of Directors / Members / Owners] of {entity}

2. OPINION PARAGRAPH (first, per current AU-C 700 requirement)
   - State {"unmodified" if opinion_type == "unmodified" else "qualified"} opinion explicitly
   - Name the exact statements audited, the entity, and the period
   - If qualified, state the basis for qualification in one clear sentence referencing the specific finding(s)

3. BASIS FOR OPINION PARAGRAPH
   - Conducted in accordance with auditing standards generally accepted in the United States of America (GAAS)
   - Reference auditor independence and ethical requirements
   - State that reasonable assurance was obtained {"" if opinion_type == "unmodified" else "(except as described above)"}

4. MATERIALITY
   - State the materiality threshold of {materiality_str} and the benchmark used

5. MATERIAL FINDINGS (only if errors exist — {len(errors)} found)
   - Number each finding
   - Cite exact dollar amounts and account names
   - State whether the finding is isolated or systemic
   - State auditor's conclusion on each

6. MATTERS REQUIRING ATTENTION (only if warnings exist — {len(warnings)} found)
   - Each warning as a separate paragraph
   - Include the specific figures

7. MANAGEMENT'S RESPONSIBILITIES
   - AU-C 700 standard language: preparation and fair presentation, internal controls

8. AUDITOR'S RESPONSIBILITIES
   - AU-C 700 standard language: reasonable assurance, risk assessment, procedures
   - Note that the audit does not provide absolute assurance

9. SIGNATURE BLOCK
   [FIRM NAME]
   Certified Public Accountants
   [CITY, STATE]
   [REPORT DATE]

Write the full report now. Use formal, precise language. Every dollar figure must come from the data provided above — do not invent numbers."""

    response = await client.chat.completions.create(
        model=EXTRACTION_MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": REPORT_SYSTEM},
            {"role": "user",   "content": prompt},
        ],
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
