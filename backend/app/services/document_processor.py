import logging
import pandas as pd
import fitz  # PyMuPDF
import openpyxl

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            page_text = page.get_text("text")
            if page_text:
                text += page_text + "\n\n"
        doc.close()
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        raise
    return text


def extract_text_from_excel(file_path: str) -> str:
    text = ""
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            text += f"\n\n=== Sheet: {sheet_name} ===\n"
            for row in ws.iter_rows(values_only=True):
                row_values = [str(cell) if cell is not None else "" for cell in row]
                if any(v.strip() for v in row_values):
                    text += "\t".join(row_values) + "\n"
    except Exception as e:
        logger.error("Excel extraction failed: %s", e)
        raise
    return text


def extract_text_from_csv(file_path: str) -> str:
    try:
        df = pd.read_csv(file_path)
        return df.to_string(index=False)
    except Exception as e:
        logger.error("CSV extraction failed: %s", e)
        raise


def extract_document_text(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        return extract_text_from_pdf(file_path)
    elif file_type in ("xlsx", "xls"):
        return extract_text_from_excel(file_path)
    elif file_type == "csv":
        return extract_text_from_csv(file_path)
    raise ValueError(f"Unsupported file type: {file_type}")


def find_text_in_pdf(file_path: str, text: str) -> dict | None:
    """
    Search for text in a PDF and return its normalized coordinates
    {page, x, y, w, h} where all values are 0-1 fractions of page dimensions.
    Returns None if text is not found.
    """
    if not text:
        return None
    try:
        doc = fitz.open(file_path)
        for page_num, page in enumerate(doc):
            pw = page.rect.width
            ph = page.rect.height
            hits = page.search_for(text, quads=False)
            if hits:
                r = hits[0]  # take first occurrence
                doc.close()
                return {
                    "page": page_num,
                    "x": round(r.x0 / pw, 4),
                    "y": round(r.y0 / ph, 4),
                    "w": round((r.x1 - r.x0) / pw, 4),
                    "h": round((r.y1 - r.y0) / ph, 4),
                }
        doc.close()
    except Exception as e:
        logger.warning("Text search failed for '%s': %s", text, e)
    return None
