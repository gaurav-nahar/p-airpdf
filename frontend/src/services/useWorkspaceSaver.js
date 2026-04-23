import { useEffect, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import api from "../api/api";

function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
}

const STROKE_OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.5, simulatePressure: true };

// 💾 Save PDF Annotations (Highlights, Text, Drawings)
const useWorkspaceSaver = (context, enableAutosave = true) => {
    // Context object se props destructure karein via useApp
    const {
        pdfId, activeWorkspace,
        snippets, setSnippets,
        editableBoxes, setEditableBoxes,
        lines, setLines,
        connections, setConnections,
        highlights, setHighlights,
        pdfAnnotations, setPdfAnnotations,
        pdfLines, setPdfLines,
        brushHighlights, setBrushHighlights,
        existingSnippetsMap,
        isDirty, setIsDirty,
        savingWorkspace, setSavingWorkspace,
        savingPdf, setSavingPdf,
        deletedHighlights, setDeletedHighlights,
        deletedPdfTexts, setDeletedPdfTexts,
        autosaveInterval,
        viewStateRef,
        groups,
        crossPdfLinks,
        setCrossPdfLinks,
    } = context;

    const savePdfChanges = useCallback(async () => {
        if (savingPdf || !pdfId) return;
        setSavingPdf(true);
        console.log("💾 Saving PDF Annotations...");

        try {
            // Prepare payload
            const payload = {
                highlights: highlights.map(h => ({
                    id: (typeof h.id === 'string' && h.id.startsWith('temp-')) ? null : h.id,
                    page_num: h.pageNum,
                    color: h.color,
                    x_pct: h.xPct,
                    y_pct: h.yPct,
                    width_pct: h.widthPct,
                    height_pct: h.heightPct,
                    content: h.content
                })),
                pdf_texts: pdfAnnotations.map(t => ({
                    id: (typeof t.id === 'string' && t.id.startsWith('pdf-annot-')) ? null : t.id,
                    page_num: t.pageNum,
                    text: t.text,
                    x_pct: t.xPct,
                    y_pct: t.yPct
                })),
                pdf_drawing_lines: pdfLines.map(l => ({
                    id: (typeof l.id === 'number') ? l.id : null,
                    page_num: l.pageNum,
                    // inputPts = [[x,y,p],...] new format; points = [x,y,...] old flat format
                    points: l.inputPts || l.points || [],
                    color: l.color,
                    stroke_width: l.width
                })),
                brush_highlights: brushHighlights.map(h => ({
                    id: (typeof h.serverId === 'number') ? h.serverId : null,
                    page_num: h.pageNum,
                    path_data: (h.path || []).map(p => ({ xPct: p.xPct, yPct: p.yPct })),
                    color: h.color,
                    brush_width: h.brushWidth
                })),
                deleted_highlights: deletedHighlights,
                deleted_pdf_texts: deletedPdfTexts
            };

            const res = await api.savePdfAnnotations(pdfId, payload);
            if (res.data.status === "success") {
                // Update State with returned IDs (Sync)
                setHighlights(res.data.highlights.map(hl => ({
                    id: hl.id, pageNum: hl.page_num, color: hl.color, xPct: hl.x_pct, yPct: hl.y_pct,
                    widthPct: hl.width_pct, heightPct: hl.height_pct, content: hl.content
                })));
                setPdfAnnotations(res.data.pdf_texts.map(t => ({
                    id: t.id, pageNum: t.page_num, text: t.text, xPct: t.x_pct, yPct: t.y_pct, isEditing: false
                })));
                setPdfLines(res.data.pdf_drawing_lines.map(l => {
                    const pts = l.points || [];
                    const isNewFormat = pts.length > 0 && Array.isArray(pts[0]);
                    if (isNewFormat) {
                        // pts = [[x,y,p],...] — reconstruct svgPath via perfect-freehand
                        const svgPath = getSvgPathFromStroke(
                            getStroke(pts, { ...STROKE_OPTIONS, last: true })
                        );
                        return { id: l.id, pageNum: l.page_num, tool: "pen", color: l.color, width: l.stroke_width, inputPts: pts, svgPath };
                    }
                    // old flat format [x,y,x,y,...] — render as Line
                    return { id: l.id, pageNum: l.page_num, tool: "pen", color: l.color, width: l.stroke_width, points: pts };
                }));
                setBrushHighlights(res.data.brush_highlights.map(h => ({
                    id: `brush-${h.id}`, serverId: h.id, pageNum: h.page_num, path: h.path_data, color: h.color, brushWidth: h.brush_width
                })));
                setDeletedHighlights([]);
                setDeletedPdfTexts([]);
            }
        } catch (err) {
            console.error("❌ PDF Save Failed:", err);
            alert("Error saving PDF changes.");
        } finally {
            setSavingPdf(false);
        }
    }, [
        pdfId, highlights, pdfAnnotations, pdfLines, brushHighlights, savingPdf,
        deletedHighlights, deletedPdfTexts, setHighlights, setPdfAnnotations,
        setPdfLines, setBrushHighlights, setDeletedHighlights, setDeletedPdfTexts, setSavingPdf
    ]);

    // 💾 Save Workspace (Snippets, Boxes, Connections, Lines)
    const saveWorkspaceChanges = useCallback(async () => {
        if (savingWorkspace) return;
        if (!pdfId || !activeWorkspace) return;
        setSavingWorkspace(true);
        console.log("💾 Saving Workspace Changes...");

        const fd = new FormData();
        fd.append("pdfId", pdfId);
        fd.append("cross_pdf_links", JSON.stringify(crossPdfLinks || []));

        // Snippets
        snippets.forEach((s, i) => {
            fd.append(`snippets[${i}][id]`, s.id ?? "");
            fd.append(`snippets[${i}][type]`, s.type);
            fd.append(`snippets[${i}][x]`, s.x);
            fd.append(`snippets[${i}][y]`, s.y);
            fd.append(`snippets[${i}][width]`, s.width ?? "");
            fd.append(`snippets[${i}][height]`, s.height ?? "");
            fd.append(`snippets[${i}][source_pdf_id]`, s.pdf_id || pdfId);
            fd.append(`snippets[${i}][page]`, s.pageNum ?? 1);

            if (s.xPct !== undefined) fd.append(`snippets[${i}][xPct]`, s.xPct);
            if (s.yPct !== undefined) fd.append(`snippets[${i}][yPct]`, s.yPct);
            if (s.widthPct !== undefined) fd.append(`snippets[${i}][widthPct]`, s.widthPct);
            if (s.heightPct !== undefined) fd.append(`snippets[${i}][heightPct]`, s.heightPct);

            if (s.type === "text" || s.type === "anchor") {
                fd.append(`snippets[${i}][content]`, s.text || s.content || "");
            }

            if (s.type === "image") {
                if (s.file) {
                    fd.append(`snippets[${i}][file]`, s.file);
                } else if (s.id && existingSnippetsMap[s.id]?.src) {
                    fd.append(`snippets[${i}][src]`, existingSnippetsMap[s.id].src);
                }
            }
        });

        // Boxes
        editableBoxes.forEach((b, i) => {
            fd.append(`boxes[${i}][id]`, b.id ?? "");
            fd.append(`boxes[${i}][pdf_id]`, pdfId);
            fd.append(`boxes[${i}][x]`, b.x);
            fd.append(`boxes[${i}][y]`, b.y);
            fd.append(`boxes[${i}][width]`, b.width ?? "");
            fd.append(`boxes[${i}][height]`, b.height ?? "");
            fd.append(`boxes[${i}][text]`, b.text ?? "");
        });

        // Lines
        lines.forEach((l, i) => {
            fd.append(`lines[${i}][id]`, l.id ?? "");
            fd.append(`lines[${i}][pdf_id]`, pdfId);
            fd.append(`lines[${i}][points]`, JSON.stringify(l.points ?? []));
            fd.append(`lines[${i}][color]`, l.color ?? "black");
            fd.append(`lines[${i}][stroke_width]`, l.width ?? 2);
        });

        // View State
        if (viewStateRef.current) {
            localStorage.setItem(`view-${pdfId}-${activeWorkspace.id}`, JSON.stringify(viewStateRef.current));
        }

        // Groups
        (groups || []).forEach((g, i) => {
            fd.append(`groups[${i}][client_id]`, g.id);
            fd.append(`groups[${i}][name]`, g.name || "");
            fd.append(`groups[${i}][color]`, g.color || "#e0e7ff");
            fd.append(`groups[${i}][item_ids]`, JSON.stringify(g.itemIds || []));
            fd.append(`groups[${i}][collapsed]`, g.collapsed ? "true" : "false");
        });

        // Connections
        connections.forEach((c, i) => {
            const fromId = c.from ?? c.source_id;
            const toId = c.to ?? c.target_id;
            if (fromId != null && toId != null) {
                fd.append(`connections[${i}][id]`, c.id ?? "");
                fd.append(`connections[${i}][pdf_id]`, pdfId);
                fd.append(`connections[${i}][source_id]`, fromId);
                fd.append(`connections[${i}][target_id]`, toId);
            }
        });

        try {
            const resp = await api.saveWorkspaceData(pdfId, activeWorkspace.id, fd);
            const idMap = resp.data.id_map || {};

            // Update IDs
            setSnippets(prev => prev.map(s => ({ ...s, id: idMap[String(s.id)] || s.id })));
            setEditableBoxes(prev => prev.map(b => ({ ...b, id: idMap[String(b.id)] || b.id })));
            setConnections(prev => prev.map(c => ({ ...c, id: idMap[String(c.id)] || c.id, from: idMap[String(c.from)] || c.from, to: idMap[String(c.to)] || c.to })));
            setLines(prev => prev.map(l => ({ ...l, id: idMap[String(l.id)] || l.id })));
            setCrossPdfLinks(prev => prev.map(link => {
                const remapEndpoint = (endpoint) => {
                    if (!endpoint || endpoint.type !== "snippet") return endpoint;
                    return {
                        ...endpoint,
                        snippetId: idMap[String(endpoint.snippetId)] || endpoint.snippetId,
                    };
                };
                return {
                    ...link,
                    from: remapEndpoint(link.from),
                    to: remapEndpoint(link.to),
                };
            }));
        } catch (err) {
            console.error("❌ Save Workspace failed:", err);
        } finally {
            setSavingWorkspace(false);
            setIsDirty(false);
        }
    }, [
        pdfId, activeWorkspace, snippets, editableBoxes, lines, connections, groups,
        existingSnippetsMap, savingWorkspace, setSavingWorkspace, setSnippets,
        setEditableBoxes, setConnections, setLines, setIsDirty, viewStateRef,
        crossPdfLinks, setCrossPdfLinks
    ]);

    // Autosave Timer logic here
    useEffect(() => {
        if (!enableAutosave || !pdfId || !activeWorkspace || autosaveInterval <= 0) return;
        const timer = setInterval(() => {
            if (isDirty && !savingWorkspace && !savingPdf) {
                savePdfChanges();
                saveWorkspaceChanges();
            }
        }, autosaveInterval);
        return () => clearInterval(timer);
    }, [autosaveInterval, pdfId, activeWorkspace, isDirty, savingWorkspace, savingPdf, savePdfChanges, saveWorkspaceChanges, enableAutosave]);

    const handleGlobalSave = useCallback(async () => {
        if (savingWorkspace || savingPdf) return;
        await Promise.all([savePdfChanges(), saveWorkspaceChanges()]);
    }, [savePdfChanges, saveWorkspaceChanges, savingWorkspace, savingPdf]);

    return { savePdfChanges, saveWorkspaceChanges, handleGlobalSave };
};
export default useWorkspaceSaver;
