"""
Redis cache layer — graceful fallback if Redis is unavailable.
All cache operations are safe to call even if Redis is down.
"""
import json
import logging
import os
import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DEFAULT_TTL = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5 minutes

_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    global _client
    if _client is not None:
        return _client
    try:
        _client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info(f"Redis connected: {REDIS_URL}")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}) — caching disabled, app will work without it")
        _client = None
    return _client


def cache_get(key: str):
    """Return parsed JSON value or None if miss/error."""
    r = get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"cache_get({key}) error: {e}")
        return None


def cache_set(key: str, value, ttl: int = DEFAULT_TTL):
    """Store value as JSON. Silent on error."""
    r = get_redis()
    if r is None:
        return
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"cache_set({key}) error: {e}")


def cache_delete(key: str):
    """Delete a single key. Silent on error."""
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(key)
    except Exception as e:
        logger.warning(f"cache_delete({key}) error: {e}")


def cache_delete_pattern(pattern: str):
    """Delete all keys matching a pattern (e.g. 'highlights:user1:*'). Silent on error."""
    r = get_redis()
    if r is None:
        return
    try:
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except Exception as e:
        logger.warning(f"cache_delete_pattern({pattern}) error: {e}")


# ─── Key builders ────────────────────────────────────────────────────────────
def key_highlights(user_id: str, pdf_id: int) -> str:
    return f"highlights:{user_id}:{pdf_id}"

def key_cross_pdf_links(workspace_id: int) -> str:
    return f"cross_pdf_links:{workspace_id}"

def key_workspace_groups(workspace_id: int) -> str:
    return f"workspace_groups:{workspace_id}"

def key_workspace_list(user_id: str | None, pdf_id: int) -> str:
    return f"workspace_list:{user_id or 'anonymous'}:{pdf_id}"

def key_pdf_texts(user_id: str, pdf_id: int) -> str:
    return f"pdf_texts:{user_id}:{pdf_id}"

def key_pdf_drawing_lines(user_id: str, pdf_id: int) -> str:
    return f"pdf_drawing_lines:{user_id}:{pdf_id}"

def key_pdf_brush_highlights(user_id: str, pdf_id: int) -> str:
    return f"pdf_brush_highlights:{user_id}:{pdf_id}"

def key_pdf_detail(pdf_id: int) -> str:
    return f"pdf_detail:{pdf_id}"

def key_snippets_workspace(user_id: str, workspace_id: int) -> str:
    return f"snippets_ws:{user_id}:{workspace_id}"
