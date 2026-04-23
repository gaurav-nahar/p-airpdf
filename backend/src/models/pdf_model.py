from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class PDFFile(Base):
    __tablename__ = "pdf_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    boxes = relationship("Box", cascade="all, delete", back_populates="pdf")
    lines = relationship("Line", cascade="all, delete", back_populates="pdf")
    connections = relationship("Connection", cascade="all, delete", back_populates="pdf")
    snippets = relationship("Snippet", cascade="all, delete", back_populates="pdf")
    highlights = relationship("Highlight", cascade="all, delete", back_populates="pdf")
    workspaces = relationship("Workspace", cascade="all, delete", back_populates="pdf")
    pdf_texts = relationship("PdfText", cascade="all, delete", back_populates="pdf")
    pdf_drawing_lines = relationship("PdfDrawingLine", cascade="all, delete", back_populates="pdf")
    brush_highlights = relationship("PdfBrushHighlight", cascade="all, delete", back_populates="pdf")
    bookmarks = relationship("Bookmark", cascade="all, delete", back_populates="pdf")