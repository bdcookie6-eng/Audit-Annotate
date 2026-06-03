import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db.database import create_tables
from .routers import documents, chat
from .auth import AuditAuthMiddleware

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import anyio
    # Widen the sync threadpool so concurrent sync DB routes don't queue behind each other
    limiter = anyio.get_current_task()  # verify we're inside an event loop
    try:
        from anyio.lowlevel import current_default_thread_limiter
        lim = current_default_thread_limiter()
        lim.total_tokens = max(lim.total_tokens, 64)
    except Exception:
        pass  # not critical — default pool still works
    yield


app = FastAPI(title="Audit-Annotate API", version="1.0.0", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditAuthMiddleware)

create_tables()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
