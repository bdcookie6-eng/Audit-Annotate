import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db.database import DocumentModel, FindingModel, get_db
from ..services.claude_service import generate_document_summary, stream_chat_response

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/summary/{doc_id}")
async def get_summary(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "ready":
        return {"summary": "Document is still being processed…"}

    findings = db.query(FindingModel).filter(FindingModel.document_id == doc_id).all()
    findings_list = [
        {"severity": f.severity, "title": f.title, "description": f.description}
        for f in findings
    ]
    extracted = {k: v for k, v in (doc.extracted_data or {}).items() if k != "_raw_text"}
    summary = await generate_document_summary(extracted, findings_list)
    return {"summary": summary}


@router.post("/message")
async def chat_message(body: dict, db: Session = Depends(get_db)):
    doc_id = body.get("document_id")
    message = body.get("message", "").strip()
    history = body.get("history", [])

    if not doc_id or not message:
        raise HTTPException(400, "document_id and message are required")

    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "ready":
        raise HTTPException(400, "Document is still processing")

    data = doc.extracted_data or {}
    raw_text = data.pop("_raw_text", "")
    extracted = {k: v for k, v in data.items()}

    async def event_stream():
        try:
            async for chunk in stream_chat_response(raw_text, extracted, message, history):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as exc:
            logger.exception("Streaming error")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
