from sqlalchemy.orm import Session
from src.models.connection_model import Connection
from src.utils.case_context import apply_case_context_to_dict, apply_case_context_to_model


class ConnectionRepo:

    @staticmethod
    def create(db: Session, pdf_id: int, workspace_id: int, req, user_id: str, case_context: dict | None = None):
        data = req.dict()
        data["user_id"] = user_id
        apply_case_context_to_dict(data, case_context or {})
        conn = Connection(**data)
        db.add(conn)
        db.commit()
        db.refresh(conn)
        return conn

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, workspace_id: int, user_id: str):
        return db.query(Connection).filter(
            Connection.pdf_id == pdf_id, 
            Connection.workspace_id == workspace_id,
            Connection.user_id == user_id
        ).all()

    @staticmethod
    def get_by_workspace(db: Session, workspace_id: int, user_id: str):
        return db.query(Connection).filter(
            Connection.workspace_id == workspace_id,
            Connection.user_id == user_id
        ).all()

    @staticmethod
    def update(db: Session, conn_id: int, req, user_id: str, case_context: dict | None = None):
        conn = db.query(Connection).filter(Connection.id == conn_id, Connection.user_id == user_id).first()
        if not conn:
            return None

        # update only fields provided
        for key, value in req.dict(exclude_unset=True).items():
            setattr(conn, key, value)
        apply_case_context_to_model(conn, case_context or {})

        db.commit()
        db.refresh(conn)
        return conn

    @staticmethod
    def delete(db: Session, conn_id: int, user_id: str):
        conn = db.query(Connection).filter(Connection.id == conn_id, Connection.user_id == user_id).first()
        if not conn:
            return False
        db.delete(conn)
        db.commit()
        return True

    @staticmethod
    def delete_by_pdf(db: Session, pdf_id: int, user_id: str):
        db.query(Connection).filter(Connection.pdf_id == pdf_id, Connection.user_id == user_id).delete()
        db.commit()
