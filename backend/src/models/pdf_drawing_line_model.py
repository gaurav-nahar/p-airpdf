import json
from sqlalchemy import Column, Integer, Float, Text, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class PdfDrawingLine(Base):
    __tablename__ = "pdf_drawing_lines"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    page_num = Column(Integer, nullable=False)
    _points = Column("points", Text, nullable=False)

    color = Column(Text, nullable=True, default="black")
    stroke_width = Column(Float, nullable=True, default=2.0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    pdf = relationship("PDFFile", back_populates="pdf_drawing_lines")

    @property
    def points(self):
        return json.loads(self._points) if self._points else []

    @points.setter
    def points(self, value):
        self._points = json.dumps(value) if isinstance(value, list) else value
