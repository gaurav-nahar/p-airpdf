import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";

const STORAGE_KEY_PREFIX = "documentation-pages-v1";
const LEGACY_DOCUMENT_TITLE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?: \d{2}:\d{2})?$/;

const formatPart = (value) => String(value).padStart(2, "0");

const getCurrentDocumentName = (date = new Date()) => {
    const day = formatPart(date.getDate());
    const month = formatPart(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const normalizeDocumentTitle = (title) => {
    const normalized = (title || "").trim();
    const match = normalized.match(LEGACY_DOCUMENT_TITLE_PATTERN);
    if (!match) return normalized;

    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
};

const normalizeDocuments = (documents = []) =>
    documents.map((documentItem) => ({
        ...documentItem,
        title: normalizeDocumentTitle(documentItem.title) || getCurrentDocumentName(),
    }));

const createDocument = (overrides = {}) => ({
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: getCurrentDocumentName(),
    content: null,
    sort_order: 0,          // always 0 by default — no Date.now() here
    updatedAt: Date.now(),
    ...overrides,
});

const getLocalState = (storageKey) => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.documents) && parsed.documents.length > 0) {
            return {
                ...parsed,
                documents: normalizeDocuments(parsed.documents),
            };
        }
    } catch (_) {}
    return null;
};

const saveLocal = (storageKey, documents, activeDocumentId) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify({ documents, activeDocumentId }));
    } catch (_) {}
};

const fromApi = (page) => ({
    id: page.id,
    title: normalizeDocumentTitle(page.title) || getCurrentDocumentName(),
    content: page.content ?? null,
    sort_order: page.sort_order ?? 0,
    updatedAt: page.updated_at ? new Date(page.updated_at).getTime() : Date.now(),
});

// ------------------------------------------------------------------
// Ensure a doc exists in the backend before sending updates.
// If PUT returns 404, auto-creates the doc then retries the update.
// ------------------------------------------------------------------
const upsertDocPage = async (workspaceId, doc, updatePayload) => {
    try {
        await api.updateDocPage(doc.id, updatePayload);
    } catch (err) {
        if (err?.response?.status === 404 && workspaceId) {
            // Doc missing from DB — create it first, then update
            try {
                await api.createDocPage(workspaceId, {
                    id: doc.id,
                    title: doc.title,
                    content: doc.content,
                    sort_order: doc.sort_order ?? 0,
                });
                await api.updateDocPage(doc.id, updatePayload);
            } catch (_) { /* backend unreachable */ }
        }
    }
};

export default function useDocumentationPages(workspaceId) {
    const storageKey = useMemo(
        () => `${STORAGE_KEY_PREFIX}-${workspaceId ?? "default"}`,
        [workspaceId]
    );

    const initFromLocal = useMemo(() => {
        const saved = getLocalState(storageKey);
        if (saved) return saved;
        const initial = createDocument();
        return { documents: [initial], activeDocumentId: initial.id };
    }, [storageKey]);

    const [documents, setDocuments] = useState(initFromLocal.documents);
    const [activeDocumentId, setActiveDocumentId] = useState(initFromLocal.activeDocumentId);
    const [loaded, setLoaded] = useState(false);

    const isSyncingFromApi = useRef(false);

    // ------------------------------------------------------------------
    // On workspace change: load from API, fall back to localStorage
    // ------------------------------------------------------------------
    useEffect(() => {
        const saved = getLocalState(storageKey);
        if (saved) {
            setDocuments(saved.documents);
            setActiveDocumentId(saved.activeDocumentId);
        } else {
            const initial = createDocument();
            setDocuments([initial]);
            setActiveDocumentId(initial.id);
        }
        setLoaded(false);

        if (!workspaceId) return;

        isSyncingFromApi.current = true;
        api.listDocPages(workspaceId)
            .then((res) => {
                const pages = res.data;
                if (pages.length === 0) {
                    // No pages on server — push each local doc up with a safe sort_order (index)
                    const localState = getLocalState(storageKey);
                    const docsToSync = localState?.documents ?? [];
                    if (docsToSync.length > 0) {
                        Promise.all(
                            docsToSync.map((doc, index) =>
                                api.createDocPage(workspaceId, {
                                    id: doc.id,
                                    title: doc.title,
                                    content: doc.content,
                                    sort_order: index,   // safe small integer, never Date.now()
                                }).catch(() => {})
                            )
                        );
                    }
                    isSyncingFromApi.current = false;
                    setLoaded(true);
                    return;
                }
                const docs = pages.map(fromApi);
                const firstId = docs[0].id;
                setDocuments(docs);
                setActiveDocumentId((prev) => {
                    const stillExists = docs.some((d) => d.id === prev);
                    return stillExists ? prev : firstId;
                });
                isSyncingFromApi.current = false;
                setLoaded(true);
            })
            .catch(() => {
                isSyncingFromApi.current = false;
                setLoaded(true);
            });
    }, [workspaceId, storageKey]);

    // Persist to localStorage on every change
    useEffect(() => {
        saveLocal(storageKey, documents, activeDocumentId);
    }, [documents, activeDocumentId, storageKey]);

    const activeDocument = useMemo(
        () => documents.find((d) => d.id === activeDocumentId) || documents[0] || null,
        [documents, activeDocumentId]
    );

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------
    const selectDocument = useCallback((documentId) => {
        startTransition(() => setActiveDocumentId(documentId));
    }, []);

    const createDocumentPage = useCallback(() => {
        // Use documents.length as sort_order — small safe integer, never Date.now()
        setDocuments((prev) => {
            const next = createDocument({ sort_order: prev.length });
            if (workspaceId) {
                api.createDocPage(workspaceId, {
                    id: next.id,
                    title: next.title,
                    content: next.content,
                    sort_order: prev.length,
                }).catch(() => {});
            }
            startTransition(() => setActiveDocumentId(next.id));
            return [...prev, next];
        });
    }, [workspaceId]);

    const renameDocument = useCallback((documentId, nextTitle) => {
        const trimmed = nextTitle.trim();
        if (!trimmed) return;
        setDocuments((prev) => {
            const doc = prev.find((d) => d.id === documentId);
            if (workspaceId && doc) {
                upsertDocPage(workspaceId, { ...doc, title: trimmed }, { title: trimmed });
            }
            return prev.map((d) =>
                d.id === documentId ? { ...d, title: trimmed, updatedAt: Date.now() } : d
            );
        });
    }, [workspaceId]);

    const deleteDocument = useCallback((documentId) => {
        let nextActiveId = activeDocumentId;
        setDocuments((prev) => {
            const idx = prev.findIndex((d) => d.id === documentId);
            const remaining = prev.filter((d) => d.id !== documentId);
            if (remaining.length === 0) {
                const replacement = createDocument();
                nextActiveId = replacement.id;
                return [replacement];
            }
            if (activeDocumentId === documentId) {
                const fallback = remaining[Math.max(0, idx - 1)] || remaining[0];
                nextActiveId = fallback.id;
            }
            return remaining;
        });
        startTransition(() => setActiveDocumentId(nextActiveId));

        if (workspaceId) {
            api.deleteDocPage(documentId).catch(() => {});
        }
    }, [activeDocumentId, workspaceId]);

    const updateDocumentContent = useCallback((documentId, content) => {
        setDocuments((prev) => {
            const doc = prev.find((d) => d.id === documentId);
            if (workspaceId && doc) {
                // upsertDocPage handles 404 by auto-creating the doc first
                upsertDocPage(workspaceId, { ...doc, content }, { content });
            }
            return prev.map((d) =>
                d.id === documentId ? { ...d, content, updatedAt: Date.now() } : d
            );
        });
    }, [workspaceId]);

    return {
        documents,
        activeDocument,
        activeDocumentId: activeDocument?.id || activeDocumentId,
        loaded,
        createDocumentPage,
        selectDocument,
        renameDocument,
        deleteDocument,
        updateDocumentContent,
    };
}
