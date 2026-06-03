import os
import uuid
import logging
import asyncio

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db.database import DocumentModel, FindingModel, get_db
from ..services.audit_checks import run_all_checks
from ..services.claude_service import extract_financial_data, generate_document_summary
from ..services.document_processor import extract_document_text, find_text_in_pdf

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

EXT_TO_TYPE = {"pdf": "pdf", "xlsx": "xlsx", "xls": "xls", "csv": "csv"}
MIME_TO_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv": "csv",
    "application/octet-stream": None,  # fall back to extension
}


def _doc_to_dict(doc: DocumentModel, db: Session) -> dict:
    findings = (
        db.query(FindingModel)
        .filter(FindingModel.document_id == doc.id)
        .order_by(FindingModel.created_at)
        .all()
    )
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "statement_type": doc.statement_type,
        "extracted_data": doc.extracted_data,
        "status": doc.status,
        "error_message": doc.error_message,
        "findings": [
            {
                "id": f.id,
                "document_id": f.document_id,
                "check_type": f.check_type,
                "severity": f.severity,
                "title": f.title,
                "description": f.description,
                "field_name": f.field_name,
                "expected_value": f.expected_value,
                "actual_value": f.actual_value,
                "status": f.status,
                "note": f.note,
                "coordinates": f.coordinates,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in findings
        ],
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "summary": doc.summary,
        "client_name": doc.client_name,
    }


async def _process_document(doc_id: str, file_path: str, file_type: str):
    from ..db.database import SessionLocal

    db = SessionLocal()
    try:
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if not doc:
            return

        text = extract_document_text(file_path, file_type)
        extracted = await extract_financial_data(text)
        extracted["_raw_text"] = text[:6000]

        findings = run_all_checks(extracted)

        # For PDFs, resolve each finding's field_name to page coordinates
        is_pdf = file_type == "pdf"
        for f in findings:
            if is_pdf and f.get("field_name"):
                f["coordinates"] = find_text_in_pdf(file_path, f["field_name"])

        doc.extracted_data = extracted
        doc.statement_type = extracted.get("statement_type", "unknown")

        findings_list = [
            {"severity": f["severity"], "title": f["title"], "description": f["description"]}
            for f in findings
        ]
        extracted_for_summary = {k: v for k, v in extracted.items() if k != "_raw_text"}
        try:
            doc.summary = await generate_document_summary(extracted_for_summary, findings_list)
        except Exception:
            logger.warning("Summary generation failed for %s", doc_id)
            doc.summary = None

        doc.status = "ready"

        for f in findings:
            db.add(
                FindingModel(
                    id=f["id"],
                    document_id=doc_id,
                    check_type=f["check_type"],
                    severity=f["severity"],
                    title=f["title"],
                    description=f["description"],
                    field_name=f.get("field_name"),
                    expected_value=f.get("expected_value"),
                    actual_value=f.get("actual_value"),
                    status=f.get("status", "open"),
                    coordinates=f.get("coordinates"),
                )
            )
        db.commit()
    except Exception as exc:
        logger.exception("Document processing failed for %s", doc_id)
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    client_name: str = Form(""),
    db: Session = Depends(get_db),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    file_type = MIME_TO_TYPE.get(file.content_type) or EXT_TO_TYPE.get(ext)
    if not file_type:
        raise HTTPException(400, f"Unsupported file type: {file.content_type} / .{ext}")

    doc_id = str(uuid.uuid4())
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.{file_type}")

    async with aiofiles.open(file_path, "wb") as out:
        content = await file.read()
        await out.write(content)

    doc = DocumentModel(
        id=doc_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file_type,
        status="processing",
        client_name=client_name.strip() or None,
    )
    db.add(doc)
    db.commit()

    background_tasks.add_task(_process_document, doc_id, file_path, file_type)

    return {"id": doc_id, "filename": file.filename, "file_type": file_type, "status": "processing", "client_name": doc.client_name}


@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).order_by(DocumentModel.created_at.desc()).all()
    return [_doc_to_dict(d, db) for d in docs]


@router.get("/{doc_id}/status")
def get_status(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return {"id": doc.id, "status": doc.status, "error_message": doc.error_message}


@router.get("/{doc_id}")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return _doc_to_dict(doc, db)


@router.get("/{doc_id}/file")
def serve_file(doc_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse

    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(doc.file_path, filename=doc.filename)


@router.patch("/{doc_id}/findings/{finding_id}")
def update_finding(
    doc_id: str,
    finding_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    finding = (
        db.query(FindingModel)
        .filter(FindingModel.id == finding_id, FindingModel.document_id == doc_id)
        .first()
    )
    if not finding:
        raise HTTPException(404, "Finding not found")
    if "status" in body:
        finding.status = body["status"]
    if "note" in body:
        finding.note = body["note"]
    db.commit()
    return {"success": True}


@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.query(FindingModel).filter(FindingModel.document_id == doc_id).delete()
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"success": True}
