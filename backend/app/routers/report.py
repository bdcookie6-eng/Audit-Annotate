import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.database import DocumentModel, get_db
from ..services.claude_service import generate_audit_report

logger = logging.getLogger(__name__)
router = APIRouter()


class DraftReportRequest(BaseModel):
    document_ids: list[str]


@router.post("/draft")
async def draft_report(body: DraftReportRequest, db: Session = Depends(get_db)):
    if not body.document_ids:
        raise HTTPException(400, "At least one document_id is required")

    docs = []
    for doc_id in body.document_ids:
        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if not doc:
            raise HTTPException(404, f"Document {doc_id} not found")
        if doc.status != "ready":
            raise HTTPException(400, f"Document {doc_id} is not ready (status: {doc.status})")
        docs.append({
            "id": doc.id,
            "filename": doc.filename,
            "statement_type": doc.statement_type,
            "extracted_data": doc.extracted_data or {},
        })

    result = await generate_audit_report(docs)
    return result
