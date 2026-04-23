from sqlalchemy.orm import Session
from src.models.line_model import Line
from src.utils.case_context import apply_case_context_to_dict, apply_case_context_to_model

class LineRepo:

    @staticmethod
    def create(db: Session, pdf_id: int, workspace_id: int, data, user_id: str, case_context: dict | None = None):
        # Create Line instance without points first
        line_data = data.dict(exclude={"points"})
        line_data["user_id"] = user_id
        apply_case_context_to_dict(line_data, case_context or {})
        line = Line(**line_data)
        # Use the property setter to correctly serialize points
        line.points = data.points  # setter will json.dumps internally
        db.add(line)
        db.commit()
        db.refresh(line)
        return line

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, workspace_id: int, user_id: str):
        lines = db.query(Line).filter(
            Line.pdf_id == pdf_id, 
            Line.workspace_id == workspace_id,
            Line.user_id == user_id
        ).all()
        return lines

    @staticmethod
    def get_by_workspace(db: Session, workspace_id: int, user_id: str):
        return db.query(Line).filter(
            Line.workspace_id == workspace_id,
            Line.user_id == user_id
        ).all()

    @staticmethod
    def update(db: Session, line_id: int, data, user_id: str, case_context: dict | None = None):
        line = db.query(Line).filter(Line.id == line_id, Line.user_id == user_id).first()
        if not line:
            return None

        update_data = data.dict(exclude_unset=True)
        # Handle points explicitly if present
        if "points" in update_data:
            line.points = update_data.pop("points")  # setter handles serialization

        for key, value in update_data.items():
            setattr(line, key, value)
        apply_case_context_to_model(line, case_context or {})

        db.commit()
        db.refresh(line)
        return line

    @staticmethod
    def delete(db: Session, line_id: int, user_id: str):
        line = db.query(Line).filter(Line.id == line_id, Line.user_id == user_id).first()
        if not line:
            return False
        db.delete(line)
        db.commit()
        return True

    @staticmethod
    def delete_by_pdf(db: Session, pdf_id: int, user_id: str):
        db.query(Line).filter(Line.pdf_id == pdf_id, Line.user_id == user_id).delete()
        db.commit()
