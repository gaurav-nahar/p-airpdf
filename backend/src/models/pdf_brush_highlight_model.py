import json
from sqlalchemy import Column, Integer, Float, Text, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base
class PdfBrushHighlight(Base):
    __tablename__ = "pdf_brush_highlights"
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    page_num = Column(Integer, nullable=False)
    _path_data = Column("path_data", Text, nullable=False)
    color = Column(Text, nullable=False, default="#FFEB3B")
    brush_width = Column(Float, nullable=False, default=20.0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    pdf = relationship("PDFFile", back_populates="brush_highlights")
    @property
    def path_data(self):
        return json.loads(self._path_data) if self._path_data else []
    
    @path_data.setter
    def path_data(self, value):
        self._path_data = json.dumps(value) if isinstance(value, list) else value
