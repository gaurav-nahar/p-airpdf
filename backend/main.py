import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import httpx

# Database
from src.db.db import Base, DB_POOL_CONFIG, engine, get_db
from sqlalchemy import text
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Routers
from src.routers.workspace_router import router as workspace_router
from src.routers.highlight_router import router as highlight_router
from src.routers.pdf_drawing_line_router import router as pdf_drawing_line_router
from src.routers.box_router import router as boxes_router
from src.routers.pdf_router import router as pdf_router
from src.routers.snippet_router import router as snippet_router
from src.routers.line_router import router as line_router
from src.routers.connection_router import router as connection_router
from src.routers.pdf_text_router import router as pdf_text_router
from src.models.pdf_text_model import PdfText
from src.routers.pdf_brush_highlight_router import router as pdf_brush_highlight_router
from src.routers.bookmark_router import router as bookmark_router
from src.models.bookmark_model import Bookmark  # noqa: ensure table is registered
from src.models.workspace_group_model import WorkspaceGroup  # noqa: ensure table is registered
from src.models.workspace_pdf_model import WorkspacePdf  # noqa: ensure table is registered
from src.routers.documentation_router import router as documentation_router
from src.models.documentation_model import DocumentationPage  # noqa: ensure table is registered
# NOTE: create_all disabled for production. Run migrations manually before deploying.
# Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI(title="Workspace Backend")


@app.on_event("startup")
def log_startup_settings():
    if DB_POOL_CONFIG:
        logger.info("Database pool config: %s", DB_POOL_CONFIG)


@app.exception_handler(SQLAlchemyTimeoutError)
async def handle_db_pool_timeout(request: Request, exc: SQLAlchemyTimeoutError):
    pool_status = engine.pool.status() if hasattr(engine.pool, "status") else "unavailable"
    logger.error(
        "Database pool exhausted while handling %s %s: %s | pool=%s",
        request.method,
        request.url.path,
        exc,
        pool_status,
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database is busy right now. Please retry shortly.",
            "error": "db_pool_exhausted",
        },
    )

# Warm up Redis connection on startup (non-blocking — fails gracefully)
from src.cache.cache import get_redis as _init_redis
_init_redis()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3333",
        "http://localhost:8090",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3333",
        "http://127.0.0.1:8090",
        # HTTPS local (for SSL dev setups)
        "https://localhost:3333",
        "https://172.25.0.41:3333",
        # Backend itself (self-referential)
        "http://localhost:8000",
               # GPU server
        "http://172.25.0.235:3000",
        "http://172.25.0.235:3001",
        "http://172.25.0.235:3333",
        "https://172.25.0.235:3000",
        "https://172.25.0.235:3001",
        "https://172.25.0.235:3333",
        "https://172.25.0.235:3001",
        "https://172.25.0.235:3001/",
        "http://172.25.0.235:3001/",
        "http://172.25.0.235:8005/",
        "https://172.25.0.235:3001/",
        "https://103.200.78.51",
        # Production servers — 172.21.238.33
        "https://172.21.238.33:3030",
        "http://172.21.238.33:3030",
        # Production servers — 172.21.238.34 (ALL ports used in deployment)
        "https://172.21.238.34:3001",
        "http://172.21.238.34:3001",
        "https://172.21.238.34:8005",   # ← MISSING: frontend REACT_APP_API_URL points here
        "http://172.21.238.34:8005",    # ← MISSING: http fallback
        "https://172.21.238.34:3000",
        "http://172.21.238.34:3000",
        "https://172.21.238.34",        # bare host (when iframe uses default port)
        "http://172.21.238.34",
        "https://172.21.238.12:3030",
        "http://172.21.238.12:3030",
        "https://172.21.238.12",
        "http://172.21.238.12",
        "https://172.21.238.12:3030",
        "http://172.21.238.12:3030",
        "https://172.21.238.12",
        "http://172.21.238.12"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-User-ID",
        "X-Case-No",
        "X-Case-Year",
        "X-Case-Type",
        "Accept",
    ],
)

# Include routers
app.include_router(pdf_router, prefix="/pdfs", tags=["pdfs"])
app.include_router(snippet_router, prefix="/snippets", tags=["snippets"])
app.include_router(boxes_router, prefix="/boxes", tags=["boxes"])
app.include_router(line_router, prefix="/lines", tags=["lines"])
app.include_router(connection_router, prefix="/connections", tags=["connections"])
app.include_router(workspace_router)
app.include_router(highlight_router, prefix="/highlights", tags=["highlights"])
app.include_router(pdf_text_router, prefix="/pdf_texts", tags=["pdf_texts"])
app.include_router(pdf_drawing_line_router, prefix="/pdf_drawing_lines", tags=["pdf_drawing_lines"])
app.include_router(pdf_brush_highlight_router, prefix="/pdf_brush_highlights", tags=["pdf_brush_highlights"])
app.include_router(bookmark_router)
app.include_router(documentation_router, prefix="/documentation", tags=["documentation"])
@app.get("/")
def root():
    return {"ok": True, "msg": "Workspace Backend running"}


@app.get("/health")
def health_check():
    """Health check for load balancers and Docker HEALTHCHECK."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

    from src.cache.cache import get_redis
    redis_client = get_redis()
    redis_status = "ok" if redis_client is not None else "unavailable (non-fatal)"

    pool_status = engine.pool.status() if hasattr(engine.pool, "status") else "unavailable"
    return {"status": "ok", "database": db_status, "redis": redis_status, "db_pool": pool_status}


