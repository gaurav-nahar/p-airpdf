import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from pathlib import Path

logger = logging.getLogger(__name__)

# --- Load .env file ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # adjust to your .env location
load_dotenv(BASE_DIR / ".env")

# Read database URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL missing in .env file")


def _read_int_env(name: str, default: int, minimum: int | None = None) -> int:
    raw_value = os.getenv(name)
    if raw_value in (None, ""):
        return default

    try:
        value = int(raw_value)
    except ValueError:
        logger.warning("Invalid integer for %s=%r; using %s", name, raw_value, default)
        return default

    if minimum is not None and value < minimum:
        logger.warning("%s=%s is below minimum %s; using %s", name, value, minimum, default)
        return default

    return value


def _read_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value in (None, ""):
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


DB_POOL_CONFIG = {}

# Create engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
else:
    db_pool_size = _read_int_env("DB_POOL_SIZE", 60, minimum=1)
    db_max_overflow = _read_int_env("DB_MAX_OVERFLOW", 30, minimum=0)
    db_pool_timeout = _read_int_env("DB_POOL_TIMEOUT", 45, minimum=1)
    db_pool_recycle = _read_int_env("DB_POOL_RECYCLE", 1800, minimum=1)
    db_connect_timeout = _read_int_env("DB_CONNECT_TIMEOUT", 10, minimum=1)
    db_pool_use_lifo = _read_bool_env("DB_POOL_USE_LIFO", True)

    connect_args = {}
    if DATABASE_URL.startswith("postgresql"):
        connect_args["connect_timeout"] = db_connect_timeout
        connect_args["application_name"] = os.getenv("DB_APPLICATION_NAME", "liquid-text-backend")

    DB_POOL_CONFIG = {
        "pool_size": db_pool_size,
        "max_overflow": db_max_overflow,
        "pool_timeout": db_pool_timeout,
        "pool_pre_ping": True,
        "pool_recycle": db_pool_recycle,
        "pool_use_lifo": db_pool_use_lifo,
        "connect_args": connect_args,
    }

    engine = create_engine(
        DATABASE_URL,
        **DB_POOL_CONFIG,
    )

# SessionLocal for FastAPI
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
