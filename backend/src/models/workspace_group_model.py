from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from src.db.db import Base

class WorkspaceGroup(Base):
    __tablename__ = "workspace_groups"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(100), nullable=False)
    name = Column(String(255), default="")
    color = Column(String(50), default="#e0e7ff")
    item_ids = Column(JSONB, default=list)
    collapsed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
