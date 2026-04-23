import React, { createContext, useState, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import api from '../api/api';

// ── Constants (importable directly, no context needed) ───────────────────────
export const TOOL_MODES = {
    SELECT: "select",
    DRAW_LINE: "draw-line",
    PDF_CONNECT: "pdf-connect",
    ADD_BOX: "add-box",
    PEN: "pen",
    ERASER: "eraser",
    HIGHLIGHT_BRUSH: "highlight-brush",
    STICKY_NOTE: "sticky-note",
};

export const PDF_TAB_COLORS = ["#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"];

// ── Context ───────────────────────────────────────────────────────────────────
const UIContext = createContext(null);

export const UIProvider = ({ children }) => {
    // Tool
    const [tool, setTool] = useState("select");

    // Session
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [autosaveInterval, setAutosaveInterval] = useState(30000); // Default: 30s to protect against iframe reloads

    // Zoom / layout
    const [zoomLevel, setZoomLevel] = useState(1);
    const [pdfRenderScale, setPdfRenderScale] = useState(1.5);
    const [pdfPanelWidth, setPdfPanelWidth] = useState(55);
    const [isResizing, setIsResizing] = useState(false);

    // Drawing colours & size
    const [pdfDrawingColor, setPdfDrawingColor] = useState("black");
    const [highlightBrushColor, setHighlightBrushColor] = useState("#FFEB3B");
    const [penSize, setPenSize] = useState(3);

    // Annotation hover highlight
    const [hoveredAnnotationId, setHoveredAnnotationId] = useState(null);

    // Panel toggles
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [showPageJump, setShowPageJump] = useState(false);
    const [showHighlightsList, setShowHighlightsList] = useState(false);
    const [showWorkspaceSidebar, setShowWorkspaceSidebar] = useState(false);
    const [showBookmarks, setShowBookmarks] = useState(false);

    // Color picker toggles
    const [showPenColors, setShowPenColors] = useState(false);
    const [showHighlighterColors, setShowHighlighterColors] = useState(false);

    // PDF tabs
    const [pdfTabs, setPdfTabs] = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);

    // Case PDF list — persistent list of PDFs for the current diary case (populated from backend)
    const [casePdfList, setCasePdfList] = useState([]);

    // Secondary PDFs (side-by-side)
    const [secondaryPdfs, setSecondaryPdfs] = useState([]);

    // Right panel (panel2)
    const [panel2TabId, setPanel2TabId] = useState(null);
    const [panel2PdfId, setPanel2PdfId] = useState(null);
    const [panel2PdfUrl, setPanel2PdfUrl] = useState(null);
    const [panel2PdfName, setPanel2PdfName] = useState(null);

    // Cross-PDF link wires
    const [crossPdfLinks, setCrossPdfLinks] = useState([]);
    const [pendingCrossLink, setPendingCrossLink] = useState(null);
    const [lastCreatedCrossLinkId, setLastCreatedCrossLinkId] = useState(null);
    const [dragWire, setDragWire] = useState(null);
    const dragWireRef = useRef(null);
    const pendingCrossLinkRef = useRef(null);

    useEffect(() => { dragWireRef.current = dragWire; }, [dragWire]);
    useEffect(() => { pendingCrossLinkRef.current = pendingCrossLink; }, [pendingCrossLink]);

    // Inject userId from URL into API headers
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get("user_id") || params.get("uid");
        if (uid) {
            setUserId(uid);
            api.defaults.headers.common['X-User-ID'] = uid;
        }
    }, []);

    // Auto-deduplicate crossPdfLinks (prevents duplicates from React Strict Mode double-invoke)
    useEffect(() => {
        if (crossPdfLinks.length < 2) return;
        const sourceKey = (ep) =>
            `${ep?.pdfId}-${ep?.pageNum}-${Math.round((ep?.xPct || 0) * 100)}-${Math.round((ep?.yPct || 0) * 100)}-${ep?.snippetId || ''}`;
        const seen = new Set();
        let hasDup = false;
        const deduped = crossPdfLinks.filter(l => {
            const k = sourceKey(l.from);
            if (seen.has(k)) { hasDup = true; return false; }
            seen.add(k);
            return true;
        });
        if (hasDup) setCrossPdfLinks(deduped);
    }, [crossPdfLinks]);

    // ── Pure-UI handlers ──────────────────────────────────────────────────────

    const startDragWire = useCallback((endpoint, x, y) => {
        setDragWire({ from: endpoint, x, y });
    }, []);

    const moveDragWire = useCallback((x, y) => {
        setDragWire(prev => prev ? { ...prev, x, y } : null);
    }, []);

    const cancelDragWire = useCallback(() => {
        setDragWire(null);
        dragWireRef.current = null;
    }, []);

    const startCrossLink = useCallback((endpoint) => {
        setPendingCrossLink(endpoint);
    }, []);

    const addSecondaryPdf = useCallback((url, name, newPdfId) => {
        setSecondaryPdfs(prev => {
            if (prev.find(p => p.pdfId === newPdfId)) return prev;
            const pdfRef = React.createRef();
            return [...prev, { url, name, pdfId: newPdfId, pdfRef }];
        });
    }, []);

    const removeSecondaryPdf = useCallback((id) => {
        setSecondaryPdfs(prev => prev.filter(p => p.pdfId !== id));
    }, []);

    const openInPanel2 = useCallback((tab) => {
        setPanel2TabId(tab.tabId);
        setPanel2PdfId(tab.pdfId);
        setPanel2PdfUrl(tab.url);
        setPanel2PdfName(tab.name);
    }, []);

    // closePanel2 is pure-UI — filters links by panel2PdfId (all UIContext state)
    const closePanel2 = useCallback(() => {
        setPanel2PdfId(prev => {
            if (prev) {
                setCrossPdfLinks(links =>
                    links.filter(l =>
                        String(l.from.pdfId) !== String(prev) &&
                        String(l.to.pdfId) !== String(prev)
                    )
                );
            }
            return null;
        });
        setPanel2TabId(null);
        setPanel2PdfUrl(null);
        setPanel2PdfName(null);
        setDragWire(null);
        setPendingCrossLink(null);
    }, []);

    // ── Memoized context value ────────────────────────────────────────────────
    const value = useMemo(() => ({
        tool, setTool,
        TOOL_MODES, PDF_TAB_COLORS,
        loading, setLoading,
        userId, setUserId,
        autosaveInterval, setAutosaveInterval,
        zoomLevel, setZoomLevel,
        pdfRenderScale, setPdfRenderScale,
        pdfPanelWidth, setPdfPanelWidth,
        isResizing, setIsResizing,
        pdfDrawingColor, setPdfDrawingColor,
        penSize, setPenSize,
        highlightBrushColor, setHighlightBrushColor,
        showThumbnails, setShowThumbnails,
        showPageJump, setShowPageJump,
        showHighlightsList, setShowHighlightsList,
        hoveredAnnotationId, setHoveredAnnotationId,
        showWorkspaceSidebar, setShowWorkspaceSidebar,
        showBookmarks, setShowBookmarks,
        showPenColors, setShowPenColors,
        showHighlighterColors, setShowHighlighterColors,
        pdfTabs, setPdfTabs,
        activeTabId, setActiveTabId,
        casePdfList, setCasePdfList,
        secondaryPdfs, addSecondaryPdf, removeSecondaryPdf,
        panel2TabId, panel2PdfId, panel2PdfUrl, panel2PdfName,
        setPanel2TabId, setPanel2PdfId, setPanel2PdfUrl, setPanel2PdfName,
        crossPdfLinks, setCrossPdfLinks,
        pendingCrossLink, setPendingCrossLink,
        lastCreatedCrossLinkId, setLastCreatedCrossLinkId,
        dragWire, setDragWire,
        dragWireRef, pendingCrossLinkRef,
        startDragWire, moveDragWire, cancelDragWire,
        startCrossLink,
        openInPanel2, closePanel2,
    }), [
        tool, loading, userId, autosaveInterval, zoomLevel, pdfRenderScale, pdfPanelWidth, isResizing,
        pdfDrawingColor, penSize, highlightBrushColor, showThumbnails, showPageJump, showHighlightsList,
        hoveredAnnotationId,
        showWorkspaceSidebar, showBookmarks, showPenColors, showHighlighterColors, pdfTabs, activeTabId, casePdfList, secondaryPdfs,
        panel2TabId, panel2PdfId, panel2PdfUrl, panel2PdfName,
        crossPdfLinks, pendingCrossLink, lastCreatedCrossLinkId, dragWire,
        startDragWire, moveDragWire, cancelDragWire, startCrossLink,
        addSecondaryPdf, removeSecondaryPdf, openInPanel2, closePanel2,
    ]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUI must be used within UIProvider');
    return ctx;
};

export default UIContext;
