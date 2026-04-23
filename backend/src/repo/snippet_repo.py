from sqlalchemy.orm import Session
from src.models.snippet_model import Snippet
from src.request.snippet_request import SnippetCreate, SnippetUpdate
from src.utils.case_context import apply_case_context_to_model

# ------------------ HELPER FUNCTIONS ------------------
def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

class SnippetRepo:

    # ----------------------------------------------------
    # CREATE SNIPPET (TEXT OR IMAGE BINARY)
    # ----------------------------------------------------
    @staticmethod
    def create(db: Session, pdf_id: int, workspace_id: int, req: SnippetCreate, user_id: str, file_binary: bytes = None, case_context: dict | None = None):
        # ... numeric conversions ...
        req.x = safe_float(req.x)
        # ... (skipping some lines for brevity in match, but replacement will be full)
        req.y = safe_float(req.y)
        req.width = safe_float(req.width)
        req.height = safe_float(req.height)
        req.page = safe_int(req.page) if req.page is not None else None

        req.x_pct = safe_float(req.x_pct) if hasattr(req, 'x_pct') else 0.0
        req.y_pct = safe_float(req.y_pct) if hasattr(req, 'y_pct') else 0.0
        req.width_pct = safe_float(req.width_pct) if hasattr(req, 'width_pct') else 0.0
        req.height_pct = safe_float(req.height_pct) if hasattr(req, 'height_pct') else 0.0

        content_str = req.content if req.type == "text" else "image"

        db_snippet = Snippet(
            pdf_id=pdf_id,
            workspace_id=workspace_id,
            user_id=user_id,
            type=req.type,
            x=req.x,
            y=req.y,
            width=req.width,
            height=req.height,
            page=req.page,
            content=content_str,
            file_data=file_binary,
            x_pct=req.x_pct,
            y_pct=req.y_pct,
            width_pct=req.width_pct,
            height_pct=req.height_pct
        )
        apply_case_context_to_model(db_snippet, case_context or {})
        db.add(db_snippet)
        db.commit()
        db.refresh(db_snippet)
        return db_snippet

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, workspace_id: int, user_id: str):
        return db.query(Snippet).filter(
            Snippet.pdf_id == pdf_id,
            Snippet.workspace_id == workspace_id,
            Snippet.user_id == user_id
        ).all()

    @staticmethod
    def get_by_workspace(db: Session, workspace_id: int, user_id: str):
        return db.query(Snippet).filter(
            Snippet.workspace_id == workspace_id,
            Snippet.user_id == user_id
        ).all()

    # ----------------------------------------------------
    # UPDATE SNIPPET (TEXT FIELDS + OPTIONAL FILE BINARY)
    # ----------------------------------------------------
    @staticmethod
    def update(db: Session, snippet_id: int, update_data: dict, user_id: str, file_binary: bytes = None, case_context: dict | None = None):
        snippet = db.query(Snippet).filter(Snippet.id == snippet_id, Snippet.user_id == user_id).first()
        if not snippet:
            return None

        # Safe numeric conversion
        if "x" in update_data:
            update_data["x"] = safe_float(update_data["x"])
        if "y" in update_data:
            update_data["y"] = safe_float(update_data["y"])
        if "width" in update_data:
            update_data["width"] = safe_float(update_data["width"])
        if "height" in update_data:
            update_data["height"] = safe_float(update_data["height"])
        if "page" in update_data:
            update_data["page"] = safe_int(update_data["page"])

        for key, value in update_data.items():
            setattr(snippet, key, value)

        # Update file binary data if provided (only for image snippets)
        if file_binary is not None and snippet.type == "image":
            snippet.file_data = file_binary
        apply_case_context_to_model(snippet, case_context or {})

        db.commit()
        db.refresh(snippet)
        return snippet

    # ----------------------------------------------------
    # DELETE SNIPPET
    # ----------------------------------------------------
    @staticmethod
    def delete(db: Session, snippet_id: int, user_id: str):
        snippet = db.query(Snippet).filter(Snippet.id == snippet_id, Snippet.user_id == user_id).first()
        if not snippet:
            return False
        db.delete(snippet)
        db.commit()
        return True

    # ----------------------------------------------------
    # DELETE ALL SNIPPETS BY PDF (For workspace reset)
    # ----------------------------------------------------
    @staticmethod
    def delete_by_pdf(db: Session, pdf_id: int, user_id: str):
        db.query(Snippet).filter(Snippet.pdf_id == pdf_id, Snippet.user_id == user_id).delete()
        db.commit()
