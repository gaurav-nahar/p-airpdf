from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Snippet(Base):
    __tablename__ = "snippets"
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    content = Column(Text, nullable=True)   # text content or image metadata (JSON string for images)
    file_data = Column(LargeBinary, nullable=True)  # raw image binary data

    type = Column(Text, nullable=False)      # 'text' or 'image'
    x = Column(Float, nullable=False, default=0.0)
    y = Column(Float, nullable=False, default=0.0)
    page = Column(Integer, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)

    # Normalized coordinates relative to the PDF page (0.0 to 1.0)
    # Distinct from workspace x/y which are absolute pixels
    x_pct = Column(Float, nullable=True)
    y_pct = Column(Float, nullable=True)
    width_pct = Column(Float, nullable=True)
    height_pct = Column(Float, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pdf = relationship("PDFFile", back_populates="snippets")
    workspace = relationship("Workspace", back_populates="snippets")
