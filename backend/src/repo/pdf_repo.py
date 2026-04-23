from sqlalchemy.orm import Session
from src.models.pdf_model import PDFFile
from src.request.pdf_request import PdfCreate

class PDFRepo:

    @staticmethod
    def create(db: Session, req: PdfCreate):
        # Check existing PDF by BOTH name and path
        last_pdf = (
            db.query(PDFFile)
            .filter(PDFFile.name == req.name, PDFFile.path == req.path)
            .order_by(PDFFile.version.desc())
            .first()
        )

        if last_pdf:
            # Agar exist karta hai, naya version increment karo
            new_version = last_pdf.version + 1
        else:
            # Nahi toh version 1 se start karo
            new_version = 1

        new_pdf = PDFFile(
            name=req.name,
            path=req.path,
            version=new_version
        )

        db.add(new_pdf)
        db.commit()
        db.refresh(new_pdf)
        return new_pdf

    @staticmethod
    def get_latest_by_name_and_path(db: Session, name: str, path: str):
        # Latest PDF by name and path
        return (
            db.query(PDFFile)
            .filter(PDFFile.name == name, PDFFile.path == path)
            .order_by(PDFFile.version.desc())
            .first()
        )

    @staticmethod
    def get_latest_by_name(db: Session, file_name: str):
        # Backup function: latest PDF by name only (optional)
        return (
            db.query(PDFFile)
            .filter(PDFFile.name == file_name)
            .order_by(PDFFile.version.desc())
            .first()
        )

    @staticmethod
    def get(db: Session, pdf_id: int):
        return db.query(PDFFile).filter(PDFFile.id == pdf_id).first()
