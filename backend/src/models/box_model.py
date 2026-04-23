from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Box(Base):
    __tablename__ = "boxes"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    text = Column(Text, nullable=True)
    x = Column(Float, nullable=False, default=0.0)
    y = Column(Float, nullable=False, default=0.0)
    width = Column(Float, nullable=False, default=100.0)
    height = Column(Float, nullable=False, default=50.0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    pdf = relationship("PDFFile", back_populates="boxes")
    workspace = relationship("Workspace", back_populates="boxes")
