import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import api from "../../api/api";

export default function AnnotationsSidebar() {
    const {
        allAnnotations,
        showHighlightsList, setShowHighlightsList,
        setHoveredAnnotationId,
        pdfRef,
        pdfId,
        snippets,
        handleDeleteHighlight,
        handleDeletePdfText,
        handleDeletePdfDrawing,
        handleDeleteBrushHighlight,
        // Same-PDF page connections (red p1/p2 dots)
        pdfConnectionLines, setPdfConnectionLines,
        activePdfConnId, setActivePdfConnId,
        // Cross-PDF connections (between two different PDFs)
        crossPdfLinks,
        deleteCrossLink,
        pdfTabs,
        switchPdfTab,
        openCasePdf,
        casePdfList,
        lastCreatedCrossLinkId,
    } = useApp();

    const panelRef = useRef(null);
    const [workspaceAnnotations, setWorkspaceAnnotations] = useState([]);
    // Tracks which side was last navigated for each connection: id -> "from" | "to"
    const navSideRef = useRef({});
    // Tracks which connection IDs currently have pages collapsed
    const [collapsedIds, setCollapsedIds] = useState(new Set());

    const getCaseContextFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return {
            caseNo: (params.get("case_no") || "").trim(),
            caseYear: (params.get("case_year") || "").trim(),
            caseType: (params.get("case_type") || "1").trim(),
            hasCaseContext: Boolean(params.get("case_no") || params.get("case_year") || params.get("case_type")),
        };
    };

    const caseContext = useMemo(() => getCaseContextFromUrl(), []);

    useEffect(() => {
        if (!caseContext.hasCaseContext || !casePdfList.length) {
            setWorkspaceAnnotations([]);
            return;
        }

        let cancelled = false;
        const loadWorkspaceAnnotations = async () => {
            try {
                const results = await Promise.all(
                    casePdfList.map(async (item) => {
                        const data = await api.loadPdfAnnotations(item.pdf_id);
                        const pdfName = item.pdf_name || `PDF ${item.pdf_id}`;
                        const pdfAnnotations = [
                            ...(data.highlights || []).map((hl) => ({
                                id: `pdf-${item.pdf_id}-highlight-${hl.id}`,
                                annotationId: hl.id,
                                hoverId: hl.id,
                                pdfId: item.pdf_id,
                                pdfName,
                                pageNum: hl.page_num,
                                type: "highlight",
                                color: hl.color,
                                content: hl.content || "",
                                data: {
                                    id: hl.id,
                                    pageNum: hl.page_num,
                                    xPct: hl.x_pct,
                                    yPct: hl.y_pct,
                                    widthPct: hl.width_pct,
                                    heightPct: hl.height_pct,
                                    content: hl.content || "",
                                },
                            })),
                            ...(data.pdfTexts || []).map((annot) => ({
                                id: `pdf-${item.pdf_id}-text-${annot.id}`,
                                annotationId: annot.id,
                                hoverId: annot.id,
                                pdfId: item.pdf_id,
                                pdfName,
                                pageNum: annot.page_num,
                                type: "text",
                                color: null,
                                content: annot.text || "",
                                data: {
                                    id: annot.id,
                                    pageNum: annot.page_num,
                                    text: annot.text || "",
                                    xPct: annot.x_pct,
                                    yPct: annot.y_pct,
                                },
                            })),
                            ...(data.pdfDrawingLines || []).map((line) => ({
                                id: `pdf-${item.pdf_id}-drawing-${line.id}`,
                                annotationId: line.id,
                                hoverId: line.id,
                                pdfId: item.pdf_id,
                                pdfName,
                                pageNum: line.page_num,
                                type: "drawing",
                                color: line.color,
                                content: `Drawing on page ${line.page_num}`,
                                data: {
                                    id: line.id,
                                    pageNum: line.page_num,
                                    points: line.points,
                                    color: line.color,
                                },
                            })),
                            ...(data.pdfBrushHighlights || []).map((brush) => ({
                                id: `pdf-${item.pdf_id}-brush-${brush.id}`,
                                annotationId: brush.id,
                                hoverId: `brush-${brush.id}`,
                                pdfId: item.pdf_id,
                                pdfName,
                                pageNum: brush.page_num,
                                type: "brush-highlight",
                                color: brush.color,
                                content: `Brush highlight on page ${brush.page_num}`,
                                data: {
                                    id: `brush-${brush.id}`,
                                    serverId: brush.id,
                                    pageNum: brush.page_num,
                                    path: brush.path_data,
                                    color: brush.color,
                                    brushWidth: brush.brush_width,
                                },
                            })),
                        ];
                        return pdfAnnotations;
                    })
                );

                if (cancelled) return;
                setWorkspaceAnnotations(
                    results.flat().sort((a, b) => {
                        if (String(a.pdfName) !== String(b.pdfName)) {
                            return String(a.pdfName).localeCompare(String(b.pdfName));
                        }
                        return (a.pageNum || 0) - (b.pageNum || 0);
                    })
                );
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to load workspace annotations:", err);
                }
            }
        };

        loadWorkspaceAnnotations();
        return () => { cancelled = true; };
    }, [caseContext.hasCaseContext, casePdfList]); // NOTE: pdfId intentionally omitted — loadWorkspaceAnnotations loads ALL PDFs, not just the active one

    const getPdfName = (pdfId) => {
        const tab = (pdfTabs || []).find(t => String(t.pdfId) === String(pdfId));
        if (tab) return tab.name;
        const casePdf = (casePdfList || []).find(t => String(t.pdf_id) === String(pdfId));
        return casePdf?.pdf_name || `PDF ${pdfId}`;
    };

    const getWorkspaceSnippet = (snippetId) =>
        (snippets || []).find((snippet) => String(snippet.id) === String(snippetId));

    const getSnippetSourceMeta = (snippetId) => {
        const snippet = getWorkspaceSnippet(snippetId);
        if (!snippet) return null;

        const sourcePdfId = snippet.pdf_id || snippet.sourcePdfId || null;
        const sourcePageNum = snippet.pageNum || null;

        return {
            snippet,
            sourcePdfId,
            sourcePageNum,
        };
    };

    const stripHtml = (value = "") =>
        String(value)
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const getEndpointLabel = (endpoint) => {
        if (!endpoint) return "Unknown target";
        if (endpoint.type === "snippet" || endpoint.snippetId) {
            const snippetMeta = getSnippetSourceMeta(endpoint.snippetId);
            const snippet = snippetMeta?.snippet;
            const preview = stripHtml(snippet?.text || endpoint.text || "");
            const sourcePdfId = endpoint.pdfId || snippetMeta?.sourcePdfId;
            const sourcePageNum = endpoint.pageNum || snippetMeta?.sourcePageNum;
            const sourceLabel = sourcePdfId && sourcePageNum
                ? ` · ${getPdfName(sourcePdfId)} · Page ${sourcePageNum}`
                : "";
            return preview
                ? `Workspace note${sourceLabel} · ${preview.slice(0, 40)}`
                : `Workspace note${sourceLabel}`;
        }
        if (endpoint.pdfId && endpoint.pageNum) {
            return `${getPdfName(endpoint.pdfId)} · Page ${endpoint.pageNum}`;
        }
        if (endpoint.pageNum) {
            return `Page ${endpoint.pageNum}`;
        }
        return "Unknown target";
    };

    const focusWorkspaceSnippet = (snippetId) => {
        if (!snippetId) return;
        const noteEl = document.getElementById(`workspace-item-${snippetId}`);
        if (!noteEl) return;

        noteEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        const prevBoxShadow = noteEl.style.boxShadow;
        const prevOutline = noteEl.style.outline;
        noteEl.style.outline = "2px solid #3b82f6";
        noteEl.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.18)";
        setTimeout(() => {
            noteEl.style.outline = prevOutline;
            noteEl.style.boxShadow = prevBoxShadow;
        }, 1400);
    };

    const activePdfName = getPdfName(pdfId);

    const liveActivePdfAnnotations = useMemo(() => {
        if (!caseContext.hasCaseContext || !pdfId) return [];
        return (allAnnotations || []).map((item) => ({
            ...item,
            id: `live-${pdfId}-${item.type}-${item.id}`,
            annotationId: item.id,
            hoverId: item.id,
            pdfId,
            pdfName: activePdfName,
        }));
    }, [caseContext.hasCaseContext, pdfId, activePdfName, allAnnotations]);

    const caseVisibleAnnotations = useMemo(() => {
        if (!caseContext.hasCaseContext) return allAnnotations;
        const currentPdfId = String(pdfId || "");
        const otherPdfAnnotations = (workspaceAnnotations || []).filter(
            (item) => String(item.pdfId || "") !== currentPdfId
        );
        return [...otherPdfAnnotations, ...liveActivePdfAnnotations].sort((a, b) => {
            if (String(a.pdfName) !== String(b.pdfName)) {
                return String(a.pdfName).localeCompare(String(b.pdfName));
            }
            return (a.pageNum || 0) - (b.pageNum || 0);
        });
    }, [caseContext.hasCaseContext, allAnnotations, liveActivePdfAnnotations, pdfId, workspaceAnnotations]);

    const visibleAnnotations = caseContext.hasCaseContext ? caseVisibleAnnotations : allAnnotations;

    // Auto-open ONLY when the currently active PDF gets a new annotation (not other PDFs)
    const hasInitializedRef = useRef(false);
    const prevActivePdfAnnotLengthRef = useRef(0);
    useEffect(() => {
        const liveCount = allAnnotations.length; // only the active PDF's live annotations
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            prevActivePdfAnnotLengthRef.current = liveCount;
            return;
        }
        if (liveCount > prevActivePdfAnnotLengthRef.current) {
            setShowHighlightsList(true);
        }
        prevActivePdfAnnotLengthRef.current = liveCount;
    }, [allAnnotations.length, setShowHighlightsList]);

    // Auto-open and mark collapsed when a new page connection line is added
    const prevConnLengthRef = useRef(0);
    const connInitRef = useRef(false);
    useEffect(() => {
        const lines = pdfConnectionLines || [];
        if (!connInitRef.current) {
            connInitRef.current = true;
            prevConnLengthRef.current = lines.length;
            return;
        }
        if (lines.length > prevConnLengthRef.current) {
            setShowHighlightsList(true);
            // Mark newly added connections as collapsed (pages between them collapse in PDFViewer)
            const newLine = lines[lines.length - 1];
            if (newLine && newLine.from?.pageNum !== newLine.to?.pageNum) {
                setCollapsedIds(prev => new Set([...prev, newLine.id]));
            }
        }
        prevConnLengthRef.current = lines.length;
    }, [(pdfConnectionLines || []).length, setShowHighlightsList, setCollapsedIds]); // eslint-disable-line

    // Auto-open when a new cross-PDF link is created
    const prevCrossLinkIdRef = useRef(null);
    useEffect(() => {
        if (!lastCreatedCrossLinkId) return;
        if (lastCreatedCrossLinkId === prevCrossLinkIdRef.current) return;
        prevCrossLinkIdRef.current = lastCreatedCrossLinkId;
        setShowHighlightsList(true);
    }, [lastCreatedCrossLinkId, setShowHighlightsList]);

    // Auto-hide on click outside
    useEffect(() => {
        if (!showHighlightsList) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowHighlightsList(false);
            }
        };
        const t = setTimeout(() => document.addEventListener("mousedown", handler), 150);
        return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
    }, [showHighlightsList, setShowHighlightsList]);

    const onJumpToHighlight = (item) => {
        const scrollToItem = () => {
            if (item.data && item.data.pageNum && item.data.xPct !== undefined) {
                pdfRef.current?.scrollToSnippet(item.data);
            } else {
                pdfRef.current?.scrollToPage(item.pageNum);
            }
            setShowHighlightsList(false);
        };

        if (!caseContext.hasCaseContext || String(item.pdfId || pdfId) === String(pdfId)) {
            scrollToItem();
            return;
        }

        const openTab = (pdfTabs || []).find((tab) => String(tab.pdfId) === String(item.pdfId));
        if (openTab) {
            switchPdfTab(openTab);
            setTimeout(scrollToItem, 350);
            return;
        }

        const casePdf = (casePdfList || []).find((entry) => String(entry.pdf_id) === String(item.pdfId));
        if (!casePdf) return;
        openCasePdf({
            caseNo: caseContext.caseNo,
            caseYear: caseContext.caseYear,
            caseType: caseContext.caseType,
            selectedPdf: {
                url: casePdf.pdf_url,
                name: casePdf.pdf_name,
                originalPath: casePdf.pdf_url,
            },
        });
        setTimeout(scrollToItem, 900);
    };

    const typeInfo = {
        highlight:         { label: "Highlight",   bg: "#fff9c4" },
        text:              { label: "Text Note",    bg: "#e3f2fd" },
        drawing:           { label: "Drawing",      bg: "#f5f5f5" },
        "brush-highlight": { label: "Brush",        bg: "#fce4ec" },
    };

    const deleteAnnotation = (item) => {
        const annotationId = item.annotationId ?? item.id;
        const runDelete = () => {
            if (item.type === "highlight") return handleDeleteHighlight(annotationId);
            if (item.type === "text") return handleDeletePdfText(annotationId);
            if (item.type === "drawing") return handleDeletePdfDrawing(annotationId);
            if (item.type === "brush-highlight") return handleDeleteBrushHighlight(annotationId);
            return null;
        };

        if (!caseContext.hasCaseContext || String(item.pdfId || pdfId) === String(pdfId)) {
            return runDelete;
        }

        return () => {
            onJumpToHighlight(item);
            setTimeout(runDelete, 900);
        };
    };

    const pageLines  = pdfConnectionLines || [];
    const crossLinks = crossPdfLinks || [];
    const totalConnections = pageLines.length + crossLinks.length;
    const totalCount = visibleAnnotations.length + totalConnections;

    return (
        <>
            {/* Always-visible tab on right edge */}
            {!showHighlightsList && (
                <div
                    className="annotations-sidebar-tab"
                    onClick={() => setShowHighlightsList(true)}
                    title="All Annotations"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    {/* Badge when there are connections */}
                    {totalConnections > 0 && (
                        <span style={{
                            position: "absolute", top: 4, right: 4,
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#e53935", border: "1.5px solid #fff",
                        }} />
                    )}
                </div>
            )}

            {/* Slide-in panel */}
            <div ref={panelRef} className={`annotations-sidebar${showHighlightsList ? " open" : ""}`}>
                <div className="annotations-sidebar-header">
                    <span>All Annotations</span>
                    <span style={{ fontSize: 12, color: "#999", fontWeight: 400 }}>
                        {totalCount} item{totalCount !== 1 ? "s" : ""}
                    </span>
                    <button
                        onClick={() => setShowHighlightsList(false)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: 18, lineHeight: 1, padding: "0 2px" }}
                        title="Close"
                    >✕</button>
                </div>

                <div className="annotations-sidebar-body">

                    {/* ── Page Connections Section ── */}
                    {totalConnections > 0 && (
                        <>
                            <div style={{
                                padding: "7px 16px 5px",
                                fontSize: 10, fontWeight: 700, color: "#666",
                                textTransform: "uppercase", letterSpacing: "0.07em",
                                background: "#fff5f5", borderBottom: "1px solid #fdd",
                                display: "flex", alignItems: "center", gap: 6,
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                Page Connections
                                <span style={{ marginLeft: "auto", background: "#e53935", color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>
                                    {totalConnections}
                                </span>
                            </div>

                            {/* Same-PDF page connection lines (the red p1/p2 dots) */}
                            {pageLines.map((line) => {
                                const c = line.color || "#e53935";
                                const mid = Math.abs((line.to?.pageNum || 0) - (line.from?.pageNum || 0)) - 1;
                                const isCollapsed = collapsedIds.has(line.id) && mid > 0;
                                return (
                                    <div
                                        key={line.id}
                                        className="annotation-item"
                                        style={{ padding: "9px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s", cursor: "pointer", background: activePdfConnId === line.id ? `${c}18` : "transparent" }}
                                        onClick={() => {
                                            // Step 1: expand collapsed pages so both endpoints are visible
                                            if (isCollapsed) {
                                                pdfRef.current?.expandAllPages();
                                                setCollapsedIds(prev => { const s = new Set(prev); s.delete(line.id); return s; });
                                            }

                                            // Step 2: after DOM settles, show the line and scroll to destination
                                            const last = navSideRef.current[line.id];
                                            const goTo = last === "to" ? "from" : "to";
                                            navSideRef.current[line.id] = goTo;

                                            setTimeout(() => {
                                                // Activate the line — makes the full line visible on PDF
                                                setActivePdfConnId(line.id);
                                                // Navigate to destination page
                                                pdfRef.current?.scrollToPage(line[goTo]?.pageNum);
                                            }, isCollapsed ? 350 : 50);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#fff5f5"}
                                        onMouseLeave={e => { e.currentTarget.style.background = activePdfConnId === line.id ? `${c}18` : "transparent"; }}
                                    >
                                        <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: c, flexShrink: 0 }} />

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                                {/* FROM page badge */}
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: c, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
                                                    Page {line.from?.pageNum}
                                                </span>

                                                {/* Collapsed pages indicator */}
                                                {isCollapsed && (
                                                    <span style={{ fontSize: 10, color: c, background: `${c}18`, border: `1px dashed ${c}`, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>
                                                        {mid} hidden
                                                    </span>
                                                )}

                                                {/* Arrow */}
                                                <svg width="16" height="10" viewBox="0 0 24 10" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <line x1="0" y1="5" x2="18" y2="5" />
                                                    <polyline points="12 1 18 5 12 9" />
                                                </svg>

                                                {/* TO page badge */}
                                                <span style={{ fontSize: 12, fontWeight: 700, color: c, background: `${c}18`, border: `1.5px solid ${c}`, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
                                                    Page {line.to?.pageNum}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Expand/Collapse toggle button */}
                                        {mid > 0 && (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    if (isCollapsed) {
                                                        pdfRef.current?.expandAllPages();
                                                        setCollapsedIds(prev => { const s = new Set(prev); s.delete(line.id); return s; });
                                                        // Show line after expand settles
                                                        setTimeout(() => setActivePdfConnId(line.id), 300);
                                                    } else {
                                                        pdfRef.current?.contractBetweenPages(line.from.pageNum, line.to.pageNum);
                                                        setCollapsedIds(prev => new Set([...prev, line.id]));
                                                        // Show line after collapse settles
                                                        setTimeout(() => setActivePdfConnId(line.id), 350);
                                                    }
                                                }}
                                                style={{ background: isCollapsed ? c : "none", border: `1px solid ${c}`, borderRadius: 4, color: isCollapsed ? "#fff" : c, cursor: "pointer", fontSize: 11, padding: "2px 6px", flexShrink: 0 }}
                                                title={isCollapsed ? "Expand pages" : "Collapse pages"}
                                            >{isCollapsed ? "↕ Expand" : "↕ Collapse"}</button>
                                        )}

                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                setPdfConnectionLines(prev => prev.filter(l => l.id !== line.id));
                                                pdfRef.current?.expandAllPages();
                                                setCollapsedIds(prev => { const s = new Set(prev); s.delete(line.id); return s; });
                                            }}
                                            style={{ background: "none", border: "none", color: "#ff3b30", cursor: "pointer", opacity: 0.45, fontSize: 15, padding: "0 2px", flexShrink: 0, transition: "opacity 0.15s" }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                            onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                                            title="Delete connection"
                                        >✕</button>
                                    </div>
                                );
                            })}

                            {/* Cross-PDF links (between different PDF documents) */}
                            {crossLinks.map((link) => {
                                const c = link.color || "#3b82f6";
                                const isNew = link.id === lastCreatedCrossLinkId;
                                const fromLabel = getEndpointLabel(link.from);
                                const toLabel = getEndpointLabel(link.to);
                                return (
                                    <div
                                        key={link.id}
                                        className="annotation-item"
                                        style={{
                                            padding: "9px 16px", borderBottom: "1px solid #f0f0f0",
                                            display: "flex", alignItems: "center", gap: 10,
                                            transition: "background 0.15s", cursor: "pointer",
                                            background: isNew ? "#eff6ff" : "transparent",
                                        }}
                                        onClick={() => {
                                            const last = navSideRef.current[link.id];
                                            let goTo = last === "to" ? "from" : "to";
                                            // Ensure we always have a valid target (in case it wasn't set)
                                            if (!link[goTo]) goTo = "from";
                                            
                                            navSideRef.current[link.id] = goTo;
                                            const target = link[goTo];
                                            if (!target) return;

                                            if (target.type === "snippet" || target.snippetId) {
                                                focusWorkspaceSnippet(target.snippetId);
                                                setShowHighlightsList(false);
                                                return;
                                            }

                                            const targetPdfId = target.pdfId;
                                            const targetPageNum = target.pageNum;
                                            
                                            if (!targetPdfId || !targetPageNum) return;

                                            const jump = () => {
                                                pdfRef.current?.scrollToPage(targetPageNum);
                                                setShowHighlightsList(false);
                                            };

                                            // If the target is the currently active PDF, just jump
                                            if (String(targetPdfId) === String(pdfId)) {
                                                jump();
                                                return;
                                            }

                                            // If the target is already open in a tab, switch to it and jump
                                            const openTab = (pdfTabs || []).find((tab) => String(tab.pdfId) === String(targetPdfId));
                                            if (openTab) {
                                                switchPdfTab(openTab);
                                                setTimeout(jump, 350);
                                                return;
                                            }

                                            // If the target is closed, open it from the database history
                                            const casePdf = (casePdfList || []).find((entry) => String(entry.pdf_id) === String(targetPdfId));
                                            if (casePdf) {
                                                openCasePdf({
                                                    caseNo: caseContext.caseNo,
                                                    caseYear: caseContext.caseYear,
                                                    caseType: caseContext.caseType,
                                                    selectedPdf: {
                                                        url: casePdf.pdf_url,
                                                        name: casePdf.pdf_name,
                                                        originalPath: casePdf.pdf_url,
                                                    },
                                                });
                                                setTimeout(jump, 900);
                                            }
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = isNew ? "#eff6ff" : "transparent"; }}
                                    >
                                        <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: c, flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: c, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
                                                    {fromLabel}
                                                </span>
                                                <svg width="16" height="10" viewBox="0 0 24 10" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <line x1="0" y1="5" x2="18" y2="5" />
                                                    <polyline points="12 1 18 5 12 9" />
                                                </svg>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: c, background: `${c}18`, border: `1.5px solid ${c}`, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>
                                                    {toLabel}
                                                </span>
                                            </div>
                                            {(link.from?.text || link.to?.text) && (
                                                <div style={{ fontSize: 11, color: "#999", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {[link.from?.text, link.to?.text].filter(Boolean).join("  ·  ")}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteCrossLink(link.id); }}
                                            style={{ background: "none", border: "none", color: "#ff3b30", cursor: "pointer", opacity: 0.45, fontSize: 15, padding: "0 2px", flexShrink: 0, transition: "opacity 0.15s" }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                            onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                                            title="Delete connection"
                                        >✕</button>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* ── Annotations section header (only when both connections and annotations exist) ── */}
                    {visibleAnnotations.length > 0 && totalConnections > 0 && (
                        <div style={{
                            padding: "7px 16px 5px",
                            fontSize: 10, fontWeight: 700, color: "#666",
                            textTransform: "uppercase", letterSpacing: "0.07em",
                            background: "#f7f7f7", borderBottom: "1px solid #eee",
                            display: "flex", alignItems: "center", gap: 6,
                        }}>
                            Annotations
                            <span style={{ marginLeft: "auto", background: "#888", color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>
                                {visibleAnnotations.length}
                            </span>
                        </div>
                    )}

                    {/* ── Empty state ── */}
                    {visibleAnnotations.length === 0 && totalConnections === 0 && (
                        <div style={{ padding: "40px 20px", color: "#aaa", textAlign: "center", fontSize: 13 }}>
                            No annotations yet.<br />
                            <span style={{ fontSize: 12 }}>Highlight text or draw on the PDF.</span>
                        </div>
                    )}

                    {/* ── Annotation items ── */}
                    {visibleAnnotations.map((item, index) => {
                        const info = typeInfo[item.type] || { label: item.type, bg: "#f5f5f5" };
                        const onDelete = deleteAnnotation(item);
                        const words = (item.content || "").split(/\s+/);
                        const preview = words.length > 5 ? words.slice(0, 5).join(" ") + "…" : item.content;

                        return (
                            <div
                                key={item.id || index}
                                onClick={() => onJumpToHighlight(item)}
                                className="annotation-item"
                                style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10, transition: "background 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#f9f9f9"; setHoveredAnnotationId(item.hoverId ?? item.annotationId ?? item.id); }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; setHoveredAnnotationId(null); }}
                            >
                                <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: item.color || "#ccc", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                        {caseContext.hasCaseContext && item.pdfId && (
                                            <span style={{ fontSize: 10, background: "#eef2ff", color: "#4f46e5", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                                {item.pdfName || getPdfName(item.pdfId)}
                                            </span>
                                        )}
                                        <span style={{ fontSize: 11, color: "#007aff", fontWeight: 600 }}>Page No.{item.pageNum}</span>
                                        <span style={{ fontSize: 10, background: info.bg, padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em", color: "#555" }}>
                                            {info.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {item.type === "drawing" || item.type === "brush-highlight"
                                            ? <span style={{ color: "#999", fontStyle: "italic" }}>{info.label} on page {item.pageNum}</span>
                                            : preview || <span style={{ color: "#bbb" }}>No content</span>
                                        }
                                    </div>
                                </div>
                                {onDelete && (
                                    <button
                                        onClick={e => { e.stopPropagation(); onDelete(); }}
                                        style={{ background: "none", border: "none", color: "#ff3b30", cursor: "pointer", opacity: 0.5, fontSize: 15, padding: "0 2px", flexShrink: 0, transition: "opacity 0.15s" }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                                        title="Delete"
                                    >✕</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
