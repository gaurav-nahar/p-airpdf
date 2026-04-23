from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, default="Initial Workspace")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    cross_pdf_links_json = Column(Text, nullable=True, default="[]")

    # Relationships
    pdf = relationship("PDFFile", back_populates="workspaces")
    snippets = relationship("Snippet", back_populates="workspace", cascade="all, delete-orphan")
    boxes = relationship("Box", back_populates="workspace", cascade="all, delete-orphan")
    lines = relationship("Line", back_populates="workspace", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="workspace", cascade="all, delete-orphan")
    documentation_pages = relationship("DocumentationPage", back_populates="workspace", cascade="all, delete-orphan")
