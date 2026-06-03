import uuid
import datetime
from typing import Optional

FOOTING_TOLERANCE_PCT = 0.005       # 0.5% rounding tolerance for column footing
BALANCE_EQUATION_TOLERANCE = 500.0  # $500 flat — balance sheet equation should be exact
SIGNIFICANT_VARIANCE_PCT = 0.25     # 25%+ change → warning
NOTABLE_VARIANCE_PCT = 0.10         # 10%+ change → info


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.datetime.utcnow().isoformat()


def _float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _fmt(val: float) -> str:
    if val is None:
        return "N/A"
    abs_val = abs(val)
    if abs_val >= 1_000_000:
        return f"${val / 1_000_000:,.2f}M"
    if abs_val >= 1_000:
        return f"${val / 1_000:,.1f}K"
    return f"${val:,.0f}"


def _finding(check_type, severity, title, description, field_name=None, expected=None, actual=None):
    return {
        "id": _id(),
        "check_type": check_type,
        "severity": severity,
        "title": title,
        "description": description,
        "field_name": field_name,
        "expected_value": expected,
        "actual_value": actual,
        "status": "open",
        "created_at": _now(),
    }


def check_footing(extracted_data: dict) -> list:
    findings = []
    for section in extracted_data.get("sections", []):
        subtotal = section.get("subtotal")
        if not subtotal:
            continue
        line_items = [li for li in section.get("line_items", []) if not li.get("is_subtotal")]

        for year_key, label_suffix in [("current_year", ""), ("prior_year", " (prior year)")]:
            values = [_float(li.get(year_key)) for li in line_items]
            values = [v for v in values if v is not None]
            stated = _float(subtotal.get(year_key))

            if not values or stated is None:
                continue

            calculated = sum(values)
            tolerance = max(abs(stated) * FOOTING_TOLERANCE_PCT, 1.0)

            if abs(calculated - stated) > tolerance:
                findings.append(_finding(
                    check_type="footing",
                    severity="error",
                    title=f"Footing Error: {section['name']}{label_suffix}",
                    description=(
                        f"{subtotal['label']}{label_suffix} is stated as {_fmt(stated)} "
                        f"but the components sum to {_fmt(calculated)}. "
                        f"Discrepancy: {_fmt(abs(calculated - stated))}."
                    ),
                    field_name=subtotal.get("label") + label_suffix,
                    expected=calculated,
                    actual=stated,
                ))
    return findings


def check_balance_sheet_equation(extracted_data: dict) -> list:
    if extracted_data.get("statement_type") != "balance_sheet":
        return []

    findings = []
    sections = extracted_data.get("sections", [])
    assets_cy = liabilities_equity_cy = None

    for section in sections:
        name = section.get("name", "").lower()
        subtotal = section.get("subtotal", {}) or {}
        if "total asset" in name or name.strip() == "assets":
            assets_cy = _float(subtotal.get("current_year"))
        elif ("liabilit" in name and "equity" in name) or "total liabilit" in name:
            liabilities_equity_cy = _float(subtotal.get("current_year"))

    doc_total = extracted_data.get("total")
    if doc_total and "asset" in (doc_total.get("label") or "").lower():
        assets_cy = _float(doc_total.get("current_year"))

    if assets_cy is not None and liabilities_equity_cy is not None:
        diff = abs(assets_cy - liabilities_equity_cy)
        if diff > BALANCE_EQUATION_TOLERANCE:
            findings.append(_finding(
                check_type="balance_sheet_equation",
                severity="error",
                title="Balance Sheet Does Not Balance",
                description=(
                    f"Total Assets ({_fmt(assets_cy)}) ≠ Total Liabilities + Equity "
                    f"({_fmt(liabilities_equity_cy)}). "
                    f"Discrepancy: {_fmt(diff)}. Investigate the source of the imbalance."
                ),
                field_name="Total Assets",
                expected=assets_cy,
                actual=liabilities_equity_cy,
            ))
    return findings


def check_prior_year_variances(extracted_data: dict) -> list:
    findings = []
    for section in extracted_data.get("sections", []):
        items = list(section.get("line_items", []))
        if section.get("subtotal"):
            items.append(section["subtotal"])

        for item in items:
            cy = _float(item.get("current_year"))
            py = _float(item.get("prior_year"))
            if cy is None or py is None or py == 0:
                continue

            pct = (cy - py) / abs(py)

            if abs(pct) >= SIGNIFICANT_VARIANCE_PCT:
                findings.append(_finding(
                    check_type="prior_year_variance",
                    severity="warning",
                    title=f"Significant Variance: {item['label']}",
                    description=(
                        f"{item['label']} changed {pct:+.1%} year-over-year "
                        f"({_fmt(py)} → {_fmt(cy)}). "
                        f"This exceeds 25% and requires documented explanation."
                    ),
                    field_name=item.get("label"),
                    expected=py,
                    actual=cy,
                ))
            elif abs(pct) >= NOTABLE_VARIANCE_PCT:
                findings.append(_finding(
                    check_type="prior_year_variance",
                    severity="info",
                    title=f"Notable Variance: {item['label']}",
                    description=(
                        f"{item['label']} changed {pct:+.1%} year-over-year "
                        f"({_fmt(py)} → {_fmt(cy)}). Consider whether this is adequately explained."
                    ),
                    field_name=item.get("label"),
                    expected=py,
                    actual=cy,
                ))
    return findings


def _find_section_value(sections: list, *keywords: str) -> Optional[float]:
    """Return the subtotal current_year for the first section whose name contains all keywords."""
    kws = [k.lower() for k in keywords]
    for section in sections:
        name = section.get("name", "").lower()
        if all(k in name for k in kws):
            sub = section.get("subtotal") or {}
            return _float(sub.get("current_year"))
    return None


def _find_item_value(sections: list, *keywords: str) -> Optional[float]:
    """Return current_year for the first line item whose label contains all keywords."""
    kws = [k.lower() for k in keywords]
    for section in sections:
        for item in section.get("line_items", []):
            label = (item.get("label") or "").lower()
            if all(k in label for k in kws):
                return _float(item.get("current_year"))
        sub = section.get("subtotal") or {}
        label = (sub.get("label") or "").lower()
        if all(k in label for k in kws):
            return _float(sub.get("current_year"))
    return None


def check_income_statement(extracted_data: dict) -> list:
    if extracted_data.get("statement_type") != "income_statement":
        return []

    findings = []
    sections = extracted_data.get("sections", [])

    # ── Gross margin check ─────────────────────────────────────────────────
    revenue = _find_section_value(sections, "revenue") or _find_section_value(sections, "net revenue")
    if revenue is None:
        revenue = _find_item_value(sections, "revenue") or _find_item_value(sections, "net sales")

    cogs = _find_section_value(sections, "cost of") or _find_item_value(sections, "cost of goods") or _find_item_value(sections, "cost of sales")
    gross_profit = _find_section_value(sections, "gross profit") or _find_item_value(sections, "gross profit")

    if revenue and revenue != 0 and gross_profit is not None:
        gm_pct = gross_profit / revenue
        if gm_pct < 0:
            findings.append(_finding(
                check_type="income_statement",
                severity="error",
                title="Negative Gross Margin",
                description=(
                    f"Gross profit is {_fmt(gross_profit)} on revenue of {_fmt(revenue)}, "
                    f"yielding a gross margin of {gm_pct:.1%}. "
                    f"Negative gross margin means cost of goods exceeds revenue — verify COGS and revenue figures."
                ),
                field_name="Gross Profit",
                expected=revenue * 0,
                actual=gross_profit,
            ))
        elif gm_pct > 0.95:
            findings.append(_finding(
                check_type="income_statement",
                severity="warning",
                title=f"Unusually High Gross Margin ({gm_pct:.1%})",
                description=(
                    f"Gross margin of {gm_pct:.1%} is atypically high. "
                    f"Verify that all cost of goods / cost of sales items are captured."
                ),
                field_name="Gross Profit",
                actual=gm_pct,
            ))

    # ── Revenue vs. prior year (separate from line-item variance scan) ─────
    if revenue is not None:
        py_revenue = None
        for section in sections:
            name = section.get("name", "").lower()
            if "revenue" in name or "sales" in name:
                sub = section.get("subtotal") or {}
                py_revenue = _float(sub.get("prior_year"))
                if py_revenue:
                    break
        if py_revenue and py_revenue != 0:
            pct = (revenue - py_revenue) / abs(py_revenue)
            if abs(pct) >= SIGNIFICANT_VARIANCE_PCT:
                findings.append(_finding(
                    check_type="income_statement",
                    severity="warning",
                    title=f"Revenue Changed {pct:+.1%} Year-Over-Year",
                    description=(
                        f"Total revenue moved from {_fmt(py_revenue)} to {_fmt(revenue)} ({pct:+.1%}). "
                        f"Document the business reason for this change in the audit file."
                    ),
                    field_name="Total Revenue",
                    expected=py_revenue,
                    actual=revenue,
                ))

    # ── Operating expense ratio check ──────────────────────────────────────
    opex = _find_section_value(sections, "operating expense") or _find_section_value(sections, "selling") or _find_section_value(sections, "general and admin")
    if revenue and revenue != 0 and opex is not None:
        opex_ratio = opex / revenue
        if opex_ratio > 1.0:
            findings.append(_finding(
                check_type="income_statement",
                severity="warning",
                title=f"Operating Expenses Exceed Revenue ({opex_ratio:.1%})",
                description=(
                    f"Operating expenses of {_fmt(opex)} represent {opex_ratio:.1%} of revenue {_fmt(revenue)}. "
                    f"This indicates an operating loss. Confirm this is expected and review expense classification."
                ),
                field_name="Operating Expenses",
                expected=revenue,
                actual=opex,
            ))

    return findings


def check_balance_sheet_completeness(extracted_data: dict) -> list:
    """Flag a balance sheet if key sections (assets / liabilities / equity) appear to be missing."""
    if extracted_data.get("statement_type") != "balance_sheet":
        return []

    findings = []
    sections = extracted_data.get("sections", [])
    names = " ".join(s.get("name", "").lower() for s in sections)

    if "asset" not in names:
        findings.append(_finding(
            check_type="balance_sheet_completeness",
            severity="warning",
            title="No Assets Section Detected",
            description="Could not identify an Assets section in this balance sheet. Verify the document was extracted correctly.",
        ))
    if "liabilit" not in names:
        findings.append(_finding(
            check_type="balance_sheet_completeness",
            severity="warning",
            title="No Liabilities Section Detected",
            description="Could not identify a Liabilities section. The balance sheet may be incomplete or use non-standard labeling.",
        ))
    if "equity" not in names:
        findings.append(_finding(
            check_type="balance_sheet_completeness",
            severity="warning",
            title="No Equity Section Detected",
            description="Could not identify an Equity section. Verify all sections were captured from the source document.",
        ))
    return findings


def run_all_checks(extracted_data: dict) -> list:
    findings = (
        check_footing(extracted_data)
        + check_balance_sheet_equation(extracted_data)
        + check_balance_sheet_completeness(extracted_data)
        + check_income_statement(extracted_data)
        + check_prior_year_variances(extracted_data)
    )
    order = {"error": 0, "warning": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f.get("severity", "info"), 2))
    return findings
