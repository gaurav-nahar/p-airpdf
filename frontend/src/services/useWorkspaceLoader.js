import { useEffect, useRef } from "react";
import api from "../api/api";
const useWorkspaceLoader = (context) => {
    const {
        pdfId,
        activeWorkspace,
        setLoading,
        setSnippets,
        setEditableBoxes,
        setLines,
        setConnections,
        setHighlights,
        setPdfAnnotations,
        setPdfLines,
        setBrushHighlights,
        setExistingSnippetsMap,
        setIsDirty,
        viewStateRef,
        setGroups,
        setCrossPdfLinks,
        pendingSummaryText,
        setPendingSummaryText,
    } = context;

    // Track last loaded workspace so we can skip workspace reload on PDF-only switch
    const loadedWorkspaceIdRef = useRef(null);

    // EFFECT 1: Load workspace-level data (snippets, boxes, lines, connections)
    // Only fires when the active workspace actually changes
    useEffect(() => {
        if (!pdfId || !activeWorkspace) return;
        if (loadedWorkspaceIdRef.current === activeWorkspace.id) return; // same workspace, skip
        loadedWorkspaceIdRef.current = activeWorkspace.id;

        let mounted = true;

        const loadWorkspace = async () => {
            setLoading(true);
            let appliedPendingSummary = false;
            try {
                const [data, groupsRes, crossLinksRes] = await Promise.all([
                    api.loadWorkspaceDataByWorkspace(pdfId, activeWorkspace.id),
                    api.loadWorkspaceGroups(activeWorkspace.id),
                    api.loadCrossPdfLinks(activeWorkspace.id),
                ]);
                // loadWorkspaceDataByWorkspace returns empty pdf annotation arrays if pdfId is null
                const {
                    snippets: snipData,
                    boxes: boxData,
                    lines: lineData,
                    connections: connData,
                    highlights: hlData,
                    pdfTexts: textData,
                    pdfDrawingLines: pdfLineData,
                    pdfBrushHighlights: brushData
                } = data;

                if (!mounted) return;

                // If a new summary was generated while on another workspace, apply it now
                const isSummaryWs = activeWorkspace?.name?.toLowerCase() === "summary";
                if (isSummaryWs && pendingSummaryText) {
                    const summaryBox = (boxData ?? []).length > 0
                        ? (boxData ?? []).map((b, i) => i === 0 ? { ...b, text: pendingSummaryText } : b)
                        : [{ id: `temp-summary-${Date.now()}`, text: pendingSummaryText, x: 36, y: 24, width: 720, height: 640 }];
                    setEditableBoxes(summaryBox);
                    setPendingSummaryText?.(null);
                    appliedPendingSummary = true;
                } else {
                    setEditableBoxes(boxData ?? []);
                }

                const snippetsWithFiles = (snipData ?? []).map((s) => {
                    let extra = {};
                    // Backend sends base64 in 'content' field for images
                    if (s.type === "image" && s.content && s.content !== "image") {
                        try {
                            const bstr = atob(s.content);
                            let n = bstr.length;
                            const u8arr = new Uint8Array(n);
                            while (n--) u8arr[n] = bstr.charCodeAt(n);
                            extra.file = new Blob([u8arr], { type: "image/png" });
                            extra.src = `data:image/png;base64,${s.content}`;
                        } catch (e) {
                            console.error("❌ Blob conversion failed for snippet", s.id, e);
                        }
                    }

                    return {
                        ...s,
                        ...extra,
                        id: s.id,
                        type: s.type,
                        x: s.x,
                        y: s.y,
                        width: s.width,
                        height: s.height,
                        pageNum: s.page,
                        text: (s.type === "text" || s.type === "anchor")
                            ? ((s.content && s.content !== "null") ? s.content : (s.text || ""))
                            : "",
                        fromPDF: true,
                        xPct: s.x_pct != null ? parseFloat(s.x_pct) : undefined,
                        yPct: s.y_pct != null ? parseFloat(s.y_pct) : undefined,
                        widthPct: s.width_pct != null ? parseFloat(s.width_pct) : undefined,
                        heightPct: s.height_pct != null ? parseFloat(s.height_pct) : undefined,
                    };
                });

                const map = {};
                snippetsWithFiles.forEach((s) => {
                    if (s.id && s.type === "image") {
                        map[s.id] = { src: s.src || s.content };
                    }
                });
                setExistingSnippetsMap(map);

                setSnippets(snippetsWithFiles);
                // editableBoxes already set above (with pending summary applied if needed)

                // Normalize lines: backend uses stroke_width, frontend uses width
                const normalizedLines = (lineData ?? []).map(l => ({
                    ...l,
                    width: l.stroke_width ?? l.width ?? 2
                }));
                setLines(normalizedLines);
                const normalizedConns = (connData ?? []).map(c => ({
                    ...c,
                    from: c.source_id,
                    to: c.target_id
                }));
                setConnections(normalizedConns);

                // Load cross-PDF links — deduplicate by source endpoint key
                if (setCrossPdfLinks && crossLinksRes?.data) {
                    const raw = Array.isArray(crossLinksRes.data) ? crossLinksRes.data : [];
                    const seen = new Set();
                    const deduped = raw.filter(l => {
                        const key = `${l.from?.pdfId}-${l.from?.pageNum}-${Math.round((l.from?.xPct||0)*100)}-${l.from?.snippetId||''}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                    setCrossPdfLinks(deduped);
                }

                // Load groups
                if (setGroups && groupsRes?.data) {
                    setGroups(groupsRes.data.map(g => ({
                        id: g.client_id,
                        name: g.name,
                        color: g.color,
                        itemIds: g.item_ids || [],
                        collapsed: g.collapsed,
                    })));
                }

                if (hlData !== undefined) {
                    const transformedHighlights = hlData.map(hl => ({
                        id: hl.id,
                        pageNum: hl.page_num,
                        color: hl.color,
                        xPct: hl.x_pct,
                        yPct: hl.y_pct,
                        widthPct: hl.width_pct,
                        heightPct: hl.height_pct,
                        content: hl.content
                    }));
                    setHighlights(transformedHighlights);
                }

                if (textData !== undefined) {
                    const transformedAnnots = textData.map(a => ({
                        id: a.id,
                        pageNum: a.page_num,
                        text: a.text,
                        xPct: a.x_pct,
                        yPct: a.y_pct,
                        isEditing: false
                    }));
                    setPdfAnnotations(transformedAnnots);
                }

                if (pdfLineData !== undefined) {
                    const transformedPdfLines = pdfLineData.map(l => ({
                        id: l.id,
                        pageNum: l.page_num,
                        points: l.points,
                        color: l.color,
                        width: l.stroke_width || l.width || 2,
                        tool: "pen"
                    }));
                    setPdfLines(transformedPdfLines);
                }

                if (brushData !== undefined) {
                    const transformedBrushHighlights = brushData.map(h => ({
                        id: `brush-${h.id}`,
                        serverId: h.id,
                        pageNum: h.page_num,
                        path: h.path_data,
                        color: h.color,
                        brushWidth: h.brush_width
                    }));
                    setBrushHighlights(transformedBrushHighlights);
                }

            } catch (err) {
                console.error("❌ Error loading workspace:", err);
                // NOTE: Do NOT use alert() here — it blocks the parent iframe app
                // Toast is not available in this hook; errors are surfaced in the console
                // and the loading spinner will clear on its own.
            } finally {
                setLoading(false);
                setIsDirty(appliedPendingSummary);

                const savedView = localStorage.getItem(`view-${pdfId}-${activeWorkspace.id}`);
                if (savedView) {
                    try {
                        const viewState = JSON.parse(savedView);
                        if (viewStateRef.current) {
                            viewStateRef.current = viewState;
                        }
                    } catch (e) {
                        console.error("Bad view state", e);
                    }
                }
            }
        };

        loadWorkspace();
        return () => (mounted = false);
    }, [activeWorkspace, pdfId]); // eslint-disable-line react-hooks/exhaustive-deps

    // EFFECT 2: Reload PDF-level annotations when user switches PDF tab
    // (activeWorkspace unchanged, only pdfId changes)
    const prevPdfIdRef = useRef(null);
    useEffect(() => {
        if (!pdfId || !activeWorkspace) return;
        if (prevPdfIdRef.current === null) {
            prevPdfIdRef.current = pdfId; // first load — effect 1 handles it
            return;
        }
        if (prevPdfIdRef.current === pdfId) return;
        prevPdfIdRef.current = pdfId;

        // PDF tab switched — reload only PDF-level annotations
        api.loadPdfAnnotations(pdfId).then(data => {
            const { highlights: hlData, pdfTexts: textData, pdfDrawingLines: pdfLineData, pdfBrushHighlights: brushData } = data;

            setHighlights(hlData.map(hl => ({
                id: hl.id, pageNum: hl.page_num, color: hl.color,
                xPct: hl.x_pct, yPct: hl.y_pct, widthPct: hl.width_pct, heightPct: hl.height_pct, content: hl.content
            })));
            setPdfAnnotations(textData.map(a => ({
                id: a.id, pageNum: a.page_num, text: a.text, xPct: a.x_pct, yPct: a.y_pct, isEditing: false
            })));
            setPdfLines(pdfLineData.map(l => ({
                id: l.id, pageNum: l.page_num, points: l.points, color: l.color, width: l.stroke_width || l.width || 2, tool: "pen"
            })));
            setBrushHighlights(brushData.map(h => ({
                id: `brush-${h.id}`, serverId: h.id, pageNum: h.page_num, path: h.path_data, color: h.color, brushWidth: h.brush_width
            })));
        }).catch(err => console.error("❌ Error loading PDF annotations:", err));
    }, [pdfId, activeWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps


};
export default useWorkspaceLoader;
