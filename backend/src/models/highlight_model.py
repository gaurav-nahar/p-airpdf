from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    
    page_num = Column(Integer, nullable=False)
    color = Column(String, nullable=False)
    
    # Coordinates (Normalized: 0.0 to 1.0)
    x_pct = Column(Float, nullable=False)
    y_pct = Column(Float, nullable=False)
    width_pct = Column(Float, nullable=False)
    height_pct = Column(Float, nullable=False)
    
    content = Column(String, nullable=True) # 📝 Capture trimmed text (10 words)
    
    created_at = Column(DateTime, server_default=func.now())

    pdf = relationship("PDFFile", back_populates="highlights")
