from sqlalchemy.orm import Session
from src.models.documentation_model import DocumentationPage
from src.request.documentation_request import DocPageCreate, DocPageUpdate


class DocumentationRepo:

    @staticmethod
    def get_by_workspace(db: Session, workspace_id: int, user_id: str):
        return (
            db.query(DocumentationPage)
            .filter(
                DocumentationPage.workspace_id == workspace_id,
                DocumentationPage.user_id == user_id,
            )
            .order_by(DocumentationPage.sort_order, DocumentationPage.created_at)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, doc_id: str, user_id: str):
        return db.query(DocumentationPage).filter(
            DocumentationPage.id == doc_id,
            DocumentationPage.user_id == user_id,
        ).first()

    @staticmethod
    def create(db: Session, workspace_id: int, user_id: str, req: DocPageCreate):
        page = DocumentationPage(
            id=req.id,
            workspace_id=workspace_id,
            user_id=user_id,
            title=req.title,
            content=req.content,
            sort_order=req.sort_order,
        )
        db.add(page)
        db.commit()
        db.refresh(page)
        return page

    @staticmethod
    def update(db: Session, doc_id: str, user_id: str, req: DocPageUpdate):
        page = db.query(DocumentationPage).filter(
            DocumentationPage.id == doc_id,
            DocumentationPage.user_id == user_id,
        ).first()
        if not page:
            return None
        if req.title is not None:
            page.title = req.title
        if req.content is not None:
            page.content = req.content
        if req.sort_order is not None:
            page.sort_order = req.sort_order
        db.commit()
        db.refresh(page)
        return page

    @staticmethod
    def delete(db: Session, doc_id: str, user_id: str):
        page = db.query(DocumentationPage).filter(
            DocumentationPage.id == doc_id,
            DocumentationPage.user_id == user_id,
        ).first()
        if not page:
            return False
        db.delete(page)
        db.commit()
        return True
