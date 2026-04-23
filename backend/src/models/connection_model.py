from sqlalchemy import Column, Integer, BigInteger, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    source_id = Column(BigInteger, nullable=False)   # changed here
    target_id = Column(BigInteger, nullable=False)   # changed here
    meta = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    pdf = relationship("PDFFile", back_populates="connections")
    workspace = relationship("Workspace", back_populates="connections")
