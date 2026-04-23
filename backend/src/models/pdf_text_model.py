from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class PdfText(Base):
    __tablename__ = "pdf_texts"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    
    page_num = Column(Integer, nullable=False)
    text = Column(String, nullable=False)
    
    # Coordinates (Normalized: 0.0 to 1.0)
    x_pct = Column(Float, nullable=False)
    y_pct = Column(Float, nullable=False)
    
    created_at = Column(DateTime, server_default=func.now())

    pdf = relationship("PDFFile", back_populates="pdf_texts")
