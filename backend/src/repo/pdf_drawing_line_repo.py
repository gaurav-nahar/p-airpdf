from sqlalchemy.orm import Session
from src.models.pdf_drawing_line_model import PdfDrawingLine


class PdfLineRepo:

    @staticmethod
    def create(db: Session, pdf_id: int, data, user_id: str):
        try:
            print(f"[DEBUG] Creating PDF Line: pdf_id={pdf_id}, user_id={user_id}, data={data.dict(exclude={'points'})}")
            line_data = data.dict(exclude={"points"})
            line = PdfDrawingLine(**line_data)

            line.pdf_id = pdf_id
            line.user_id = user_id
            line.points = data.points  # uses setter for JSON conversion

            db.add(line)
            db.commit()
            db.refresh(line)
            print(f"[DEBUG] Successfully created line: id={line.id}")
            return line
        except Exception as e:
            import traceback
            print(f"[ERROR] Failed to create PDF line: {e}")
            traceback.print_exc()
            db.rollback()
            raise e

    @staticmethod
    def get_by_pdf(db: Session, pdf_id: int, user_id: str):
        return db.query(PdfDrawingLine).filter(PdfDrawingLine.pdf_id == pdf_id, PdfDrawingLine.user_id == user_id).all()

    @staticmethod
    def delete(db: Session, line_id: int, user_id: str):
        line = (
            db.query(PdfDrawingLine)
            .filter(PdfDrawingLine.id == line_id, PdfDrawingLine.user_id == user_id)
            .first()
        )
        if not line:
            return False

        db.delete(line)
        db.commit()
        return True

    @staticmethod
    def sync_lines(db: Session, pdf_id: int, items: list, user_id: str):
        """Reconciliation logic for PDF Lines"""
        existing = db.query(PdfDrawingLine).filter(PdfDrawingLine.pdf_id == pdf_id, PdfDrawingLine.user_id == user_id).all()
        existing_map = {l.id: l for l in existing}
        
        # Track which IDs are incoming
        incoming_ids = {item.get('id') for item in items if item.get('id') and isinstance(item.get('id'), int)}
        
        # 1. Delete stale records
        for eid, erecord in existing_map.items():
            if eid not in incoming_ids:
                db.delete(erecord)
                
        results = []
        
        # 2. Upsert incoming
        for item in items:
            sid = item.get('id')
            
            if sid and isinstance(sid, int) and sid in existing_map:
                # Update existing
                record = existing_map[sid]
                record.page_num = item['page_num']
                record.points = item['points'] # uses setter
                record.color = item['color']
                record.stroke_width = item['stroke_width']
                results.append(record)
            else:
                # Create new
                new_record = PdfDrawingLine(
                    pdf_id=pdf_id,
                    user_id=user_id,
                    page_num=item['page_num'],
                    points=item['points'],
                    color=item['color'],
                    stroke_width=item['stroke_width']
                )
                db.add(new_record)
                results.append(new_record)
        
        db.commit()
        for r in results:
            db.refresh(r)
        return results
