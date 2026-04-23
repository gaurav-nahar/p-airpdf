import json
from sqlalchemy.orm import Session
from src.models.pdf_brush_highlight_model import PdfBrushHighlight

def get_all_by_pdf_id(db: Session, pdf_id: int, user_id: str):
    return db.query(PdfBrushHighlight).filter(PdfBrushHighlight.pdf_id == pdf_id, PdfBrushHighlight.user_id == user_id).all()

def create(db: Session, pdf_id: int, page_num: int, path_data: list, color: str, brush_width: float, user_id: str):
    highlight = PdfBrushHighlight(
        pdf_id=pdf_id, 
        user_id=user_id,
        page_num=page_num, 
        path_data=path_data, 
        color=color, 
        brush_width=brush_width
    )
    db.add(highlight)
    db.commit()
    db.refresh(highlight)
    return highlight

def delete(db: Session, highlight_id: int, user_id: str):
    highlight = db.query(PdfBrushHighlight).filter(PdfBrushHighlight.id == highlight_id, PdfBrushHighlight.user_id == user_id).first()
    if highlight:
        db.delete(highlight)
        db.commit()
        return True
    return False

def delete_all_by_pdf_id(db: Session, pdf_id: int, user_id: str):
    db.query(PdfBrushHighlight).filter(PdfBrushHighlight.pdf_id == pdf_id, PdfBrushHighlight.user_id == user_id).delete(synchronize_session=False)
    db.commit()

def sync_highlights(db: Session, pdf_id: int, items: list, user_id: str):
    """
    Smart Sync / Reconciliation Logic with User Isolation
    """
    existing = db.query(PdfBrushHighlight).filter(PdfBrushHighlight.pdf_id == pdf_id, PdfBrushHighlight.user_id == user_id).all()
    existing_map = {h.id: h for h in existing}
    
    incoming_ids = {item.get('id') for item in items if item.get('id')}
    
    # 1. Delete stale records
    for eid, erecord in existing_map.items():
        if eid not in incoming_ids:
            db.delete(erecord)
            
    results = []
    
    # 2. Process incoming
    for item in items:
        sid = item.get('id')
        path_json = json.dumps(item['path_data']) if isinstance(item['path_data'], list) else item['path_data']
        
        if sid and sid in existing_map:
            # Update existing
            record = existing_map[sid]
            record.page_num = item['page_num']
            record.path_data = item['path_data'] # Uses the setter in model
            record.color = item['color']
            record.brush_width = item['brush_width']
            results.append(record)
        else:
            # Create new
            new_record = PdfBrushHighlight(
                pdf_id=pdf_id,
                user_id=user_id,
                page_num=item['page_num'],
                path_data=item['path_data'],
                color=item['color'],
                brush_width=item['brush_width']
            )
            db.add(new_record)
            results.append(new_record)
            
    db.commit()
    for r in results:
        db.refresh(r)
    return results