from sqlalchemy.orm import Session
from src.models.highlight_model import Highlight
from src.request.highlight_request import HighlightCreate

class HighlightRepo:
    @staticmethod
    def create(db: Session, req: HighlightCreate, user_id: str):
        data = req.model_dump()
        data["user_id"] = user_id
        new_hl = Highlight(**data)
        db.add(new_hl)
        db.commit()
        db.refresh(new_hl)
        return new_hl

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, user_id: str):
        return db.query(Highlight).filter(Highlight.pdf_id == pdf_id, Highlight.user_id == user_id).all()

    @staticmethod
    def delete(db: Session, hl_id: int, user_id: str):
        hl = db.query(Highlight).filter(Highlight.id == hl_id, Highlight.user_id == user_id).first()
        if hl:
            db.delete(hl)
            db.commit()
            return True
        return False