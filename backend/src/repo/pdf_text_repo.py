from sqlalchemy.orm import Session
from src.models.pdf_text_model import PdfText
from src.request.pdf_text_request import PdfTextCreate

class PdfTextRepo:
    @staticmethod
    def create(db: Session, req: PdfTextCreate, user_id: str):
        data = req.model_dump()
        data["user_id"] = user_id
        new_text = PdfText(**data)
        db.add(new_text)
        db.commit()
        db.refresh(new_text)
        return new_text

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, user_id: str):
        return db.query(PdfText).filter(PdfText.pdf_id == pdf_id, PdfText.user_id == user_id).all()

    @staticmethod
    def update(db: Session, text_id: int, req: PdfTextCreate, user_id: str):
        item = db.query(PdfText).filter(PdfText.id == text_id, PdfText.user_id == user_id).first()
        if item:
            for key, value in req.model_dump().items():
                setattr(item, key, value)
            db.commit()
            db.refresh(item)
            return item
        return None

    @staticmethod
    def delete(db: Session, text_id: int, user_id: str):
        item = db.query(PdfText).filter(PdfText.id == text_id, PdfText.user_id == user_id).first()
        if item:
            db.delete(item)
            db.commit()
            return True
        return False