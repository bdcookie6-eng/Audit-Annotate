import os
import datetime
from sqlalchemy import (
    create_engine, Column, String, Float, DateTime, Text, JSON, Integer
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./audit_annotate.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    statement_type = Column(String)
    extracted_data = Column(JSON)
    status = Column(String, default="processing")  # processing | ready | error
    error_message = Column(Text)
    summary = Column(Text)
    client_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class FindingModel(Base):
    __tablename__ = "findings"

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False, index=True)
    check_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # error | warning | info
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    field_name = Column(String)
    expected_value = Column(Float)
    actual_value = Column(Float)
    status = Column(String, default="open")  # open | approved | dismissed | noted
    note = Column(Text)
    coordinates = Column(JSON)  # {page, x, y, w, h} normalized 0-1 or null
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
