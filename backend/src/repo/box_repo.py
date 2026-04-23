from sqlalchemy.orm import Session
from src.models.box_model import Box
from src.utils.case_context import apply_case_context_to_dict, apply_case_context_to_model


class BoxRepo:

    @staticmethod
    def create(db: Session, pdf_id: int, workspace_id: int, req, user_id: str, case_context: dict | None = None):
        data = req.dict()
        data["user_id"] = user_id
        apply_case_context_to_dict(data, case_context or {})
        box = Box(**data)
        db.add(box)
        db.commit()
        db.refresh(box)
        return box

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, workspace_id: int, user_id: str):
        return db.query(Box).filter(
            Box.pdf_id == pdf_id, 
            Box.workspace_id == workspace_id,
            Box.user_id == user_id
        ).all()

    @staticmethod
    def get_by_workspace(db: Session, workspace_id: int, user_id: str):
        return db.query(Box).filter(
            Box.workspace_id == workspace_id,
            Box.user_id == user_id
        ).all()

    @staticmethod
    def update(db: Session, box_id: int, req, user_id: str, case_context: dict | None = None):
        box = db.query(Box).filter(Box.id == box_id, Box.user_id == user_id).first()
        if not box:
            return None

        for key, value in req.dict(exclude_unset=True).items():
            setattr(box, key, value)
        apply_case_context_to_model(box, case_context or {})

        db.commit()
        db.refresh(box)
        return box

    @staticmethod
    def delete(db: Session, box_id: int, user_id: str):
        box = db.query(Box).filter(Box.id == box_id, Box.user_id == user_id).first()
        if not box:
            return False

        db.delete(box)
        db.commit()
        return True
    
    @staticmethod
    def delete_by_pdf(db: Session, pdf_id: int, user_id: str):
        db.query(Box).filter(Box.pdf_id == pdf_id, Box.user_id == user_id).delete()
        db.commit()

