"""
Generate a test balance sheet PDF with intentional audit errors for testing.

Errors planted:
  1. Total Current Assets: components sum to $600K, stated as $605K  (footing error, $5K)
  2. Total L&E: $1,248K vs Total Assets $1,245K                       (balance sheet doesn't balance, $3K)
  3. Accounts Receivable: +47.7% year-over-year                       (significant variance warning)
  4. Additional Paid-in Capital: +30.4% year-over-year                (significant variance warning)
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import sys
import os


def make_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.85 * inch,
        leftMargin=0.85 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CompanyName", parent=styles["Normal"],
        fontSize=13, fontName="Helvetica-Bold", alignment=1, spaceAfter=2
    )
    heading_style = ParagraphStyle(
        "StatementHeading", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica-Bold", alignment=1, spaceAfter=2
    )
    sub_style = ParagraphStyle(
        "SubHeading", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica", alignment=1, spaceAfter=2, textColor=colors.HexColor("#555555")
    )
    note_style = ParagraphStyle(
        "Note", parent=styles["Normal"],
        fontSize=7.5, fontName="Helvetica-Oblique", textColor=colors.HexColor("#777777"), alignment=1
    )

    col_widths = [3.6 * inch, 1.1 * inch, 1.1 * inch]

    HEADER_BG   = colors.HexColor("#1e3a5f")
    SECTION_BG  = colors.HexColor("#e8edf2")
    SUBTOT_BG   = colors.HexColor("#d1dce8")
    TOTAL_BG    = colors.HexColor("#c0cfe0")
    ALT_ROW     = colors.HexColor("#f5f7fa")
    WHITE       = colors.white
    BLACK       = colors.HexColor("#1a1a1a")
    LIGHT_GRAY  = colors.HexColor("#cccccc")

    def money(val, parens=False):
        if val is None:
            return ""
        if parens and val < 0:
            return f"$({abs(val):,})"
        return f"${val:,}" if val != 0 else "—"

    rows = [
        # (label, cy_val, py_val, row_type)
        # row_type: "header" | "section" | "item" | "subtotal" | "total" | "blank" | "divider"
        ("",                                            None,    None,  "header"),

        ("ASSETS",                                      None,    None,  "section"),
        ("Current Assets",                              None,    None,  "section_sub"),
        ("Cash and Cash Equivalents",                   125,     98,    "item"),
        ("Accounts Receivable, net",                    288,     195,   "item"),   # +47.7%
        ("Inventory",                                   163,     158,   "item"),
        ("Prepaid Expenses",                            24,      22,    "item"),
        ("Total Current Assets",                        605,     473,   "subtotal"),  # ERROR: should be 600

        ("Property and Equipment",                      None,    None,  "section_sub"),
        ("Land and Buildings",                          450,     420,   "item"),
        ("Equipment and Machinery",                     285,     265,   "item"),
        ("Less: Accumulated Depreciation",              -95,     -72,   "item"),
        ("Total Property and Equipment",                640,     613,   "subtotal"),

        ("Total Assets",                                1245,    1086,  "total"),
        ("",                                            None,    None,  "blank"),

        ("LIABILITIES AND STOCKHOLDERS' EQUITY",        None,    None,  "section"),
        ("Current Liabilities",                         None,    None,  "section_sub"),
        ("Accounts Payable",                            142,     138,   "item"),
        ("Accrued Expenses",                            39,      35,    "item"),
        ("Current Portion of Long-term Debt",           75,      75,    "item"),
        ("Total Current Liabilities",                   256,     248,   "subtotal"),

        ("Long-term Liabilities",                       None,    None,  "section_sub"),
        ("Long-term Debt, net of current portion",      425,     400,   "item"),
        ("Total Long-term Liabilities",                 425,     400,   "subtotal"),

        ("Total Liabilities",                           681,     648,   "total_mid"),

        ("Stockholders' Equity",                        None,    None,  "section_sub"),
        ("Common Stock",                                250,     250,   "item"),
        ("Additional Paid-in Capital",                  150,     115,   "item"),   # +30.4%
        ("Retained Earnings",                           167,     128,   "item"),
        ("Total Stockholders' Equity",                  567,     493,   "subtotal"),

        ("Total Liabilities and Stockholders' Equity",  1248,    1141,  "total"),  # ERROR: should be 1245
    ]

    table_data = [["", "December 31, 2024", "December 31, 2023"]]
    style_cmds = [
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  8.5),
        ("ALIGN",       (1, 0), (-1, 0),  "RIGHT"),
        ("BACKGROUND",  (0, 0), (-1, 0),  HEADER_BG),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  WHITE),
        ("TOPPADDING",  (0, 0), (-1, 0),  6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("GRID",        (0, 0), (-1, 0),  0.3, LIGHT_GRAY),
    ]

    for i, (label, cy, py, rtype) in enumerate(rows):
        row_i = i + 1

        if rtype == "blank":
            table_data.append(["", "", ""])
            style_cmds += [("ROWHEIGHT", (0, row_i), (-1, row_i), 6)]
            continue

        indent = "    " if rtype == "item" else ""
        cy_str = money(cy, parens=(cy is not None and cy < 0)) if cy is not None else ""
        py_str = money(py, parens=(py is not None and py < 0)) if py is not None else ""
        table_data.append([indent + label, cy_str, py_str])

        base_cmds = [
            ("ALIGN",       (1, row_i), (-1, row_i), "RIGHT"),
            ("FONTSIZE",    (0, row_i), (-1, row_i), 8.5),
            ("TOPPADDING",  (0, row_i), (-1, row_i), 3),
            ("BOTTOMPADDING", (0, row_i), (-1, row_i), 3),
        ]
        style_cmds += base_cmds

        if rtype == "section":
            style_cmds += [
                ("BACKGROUND",  (0, row_i), (-1, row_i), SECTION_BG),
                ("FONTNAME",    (0, row_i), (-1, row_i), "Helvetica-Bold"),
                ("TOPPADDING",  (0, row_i), (-1, row_i), 5),
                ("BOTTOMPADDING", (0, row_i), (-1, row_i), 5),
            ]
        elif rtype == "section_sub":
            style_cmds += [
                ("FONTNAME",    (0, row_i), (-1, row_i), "Helvetica-BoldOblique"),
                ("FONTSIZE",    (0, row_i), (-1, row_i), 8),
                ("TEXTCOLOR",   (0, row_i), (-1, row_i), colors.HexColor("#444444")),
            ]
        elif rtype == "subtotal":
            style_cmds += [
                ("BACKGROUND",  (0, row_i), (-1, row_i), SUBTOT_BG),
                ("FONTNAME",    (0, row_i), (-1, row_i), "Helvetica-Bold"),
                ("LINEABOVE",   (0, row_i), (-1, row_i), 0.5, colors.HexColor("#8899aa")),
            ]
        elif rtype in ("total", "total_mid"):
            style_cmds += [
                ("BACKGROUND",  (0, row_i), (-1, row_i), TOTAL_BG),
                ("FONTNAME",    (0, row_i), (-1, row_i), "Helvetica-Bold"),
                ("LINEABOVE",   (0, row_i), (-1, row_i), 1.0, colors.HexColor("#4a6fa5")),
                ("LINEBELOW",   (0, row_i), (-1, row_i), 0.5, colors.HexColor("#4a6fa5")),
                ("TOPPADDING",  (0, row_i), (-1, row_i), 5),
                ("BOTTOMPADDING", (0, row_i), (-1, row_i), 5),
            ]
        elif row_i % 2 == 0:
            style_cmds += [("BACKGROUND", (0, row_i), (-1, row_i), ALT_ROW)]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(style_cmds))

    story = [
        Paragraph("ACME CORPORATION", title_style),
        Paragraph("BALANCE SHEET", heading_style),
        Paragraph("As of December 31, 2024", sub_style),
        Paragraph("(Amounts in thousands of US dollars)", sub_style),
        Spacer(1, 0.25 * inch),
        table,
        Spacer(1, 0.3 * inch),
        Paragraph("See accompanying notes to the financial statements.", note_style),
        Spacer(1, 0.15 * inch),
        Paragraph("This document is for testing purposes only.", note_style),
    ]

    doc.build(story)
    print(f"Test PDF created: {output_path}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "test_balance_sheet.pdf"
    make_pdf(out)
