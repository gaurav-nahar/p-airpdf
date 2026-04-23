/**
 * AppContext — orchestration layer.
 *
 * Provider tree:  UIProvider → WorkspaceProvider → PDFProvider → AppInner
 *
 * Three focused contexts hold state:
 *   useWorkspace()  — canvas data (snippets, boxes, lines, connections, groups, undo/redo)
 *   usePDF()        — PDF annotation data (highlights, drawings, bookmarks, search, summary)
 *   useUI()         — UI state (tool, tabs, panel2, cross-pdf wires, toggles, zoom)
 *
 * Two backward-compat hooks compose all three:
 *   useApp()        — full combined value (all 56 original fields + cross-context handlers)
 *   useAppActions() — ONLY stable cross-context callbacks; rarely causes re-renders
 *
 * Heavy consumers (Workspace, PDFViewer) import specific hooks to avoid
 * unnecessary re-renders when unrelated slices change.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { UIProvider, useUI } from './UIContext';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import { PDFProvider, usePDF } from './PDFContext';
import useLocalStorageSync from '../hooks/useLocalStorageSync';
import useWorkspaceLoader from '../services/useWorkspaceLoader';
import useWorkspaceSaver from '../services/useWorkspaceSaver';
import api from '../api/api';
import { getCurrentTimestampName } from '../utils/defaultNames';

// ── Two exported contexts ─────────────────────────────────────────────────────
// AppContext      — full combined value (backward compat for useApp())
// AppActionsContext — stable handlers only (for useAppActions())
const AppContext = createContext(null);
const AppActionsContext = createContext(null);
const SUMMARY_POLL_INTERVAL_MS = 2500;
const SUMMARY_MAX_POLL_ATTEMPTS = 180;

const buildCaseKey = (caseNo = "", caseYear = "", caseType = "") =>
    [caseNo.trim(), caseYear.trim(), caseType.trim().toLowerCase()].join("::");

const readCaseContextFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const caseNo = (params.get("case_no") || "").trim();
    const caseYear = (params.get("case_year") || "").trim();
    const caseType = (params.get("case_type") || "").trim();
    const pdfUrl = (params.get("pdf_url") || "").trim();
    const pdfName = (params.get("pdf_name") || "").trim() || (pdfUrl ? pdfUrl.split('/').pop() : "");
    
    return {
        caseNo,
        caseYear,
        caseType,
        pdfUrl,
        pdfName,
        caseKey: buildCaseKey(caseNo, caseYear, caseType),
        hasCaseContext: Boolean(caseNo || caseYear || caseType),
    };
};

const getSummaryErrorMessage = (err) => {
    if (err?.code === "ECONNABORTED") {
        return "Summary request timed out in the browser. The GPU service may still be processing. Increase REACT_APP_SUMMARY_TIMEOUT_MS if this happens often.";
    }

    return err?.response?.data?.detail || err?.message || "Failed to generate summary. Please try again.";
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Inner orchestration component ─────────────────────────────────────────────
// Lives inside all three sub-context providers so it can read & combine them.
function AppInner({ children }) {
    // ── Pull state from each sub-context ─────────────────────────────────────
    const workspace = useWorkspace();
    const pdf = usePDF();
    const ui = useUI();

    const {
        pdfId, setPdfId,
        activeWorkspace, setActiveWorkspace,
        setWorkspaces,
        setSnippets, setEditableBoxes, setLines, setConnections, setGroups,
        isDirty, setIsDirty, savingWorkspace, setSavingWorkspace,
        setExistingSnippetsMap,
        viewStateRef,
        pendingSummaryWorkspaceId, setPendingSummaryWorkspaceId,
        pendingSummaryText, setPendingSummaryText,
        pdfRef, pdf2Ref,
        handleUndo, handleRedo,
    } = workspace;

    const {
        setSelectedPDF, setPdfName,
        setHighlights, setPdfAnnotations, setPdfLines, setBrushHighlights,
        setDeletedHighlights, setDeletedPdfTexts,
        setBookmarks,
        setShowSummary, setSummary, setSummaryLoading,
        savingPdf, setSavingPdf,
    } = pdf;

    const {
        loading, setLoading,
        autosaveInterval,
        crossPdfLinks, setCrossPdfLinks,
        setPendingCrossLink, setDragWire,
        dragWireRef, pendingCrossLinkRef,
        pdfTabs,
        setPdfTabs,
        activeTabId, setActiveTabId,
        setLastCreatedCrossLinkId,
        PDF_TAB_COLORS,
        panel2PdfId,
        closePanel2,
        casePdfList, setCasePdfList,
    } = ui;

    const caseSessionRef = useRef({ key: null, workspacePdfId: null, workspaceId: null, caseNo: null, caseYear: null });
    const pdfBlobUrlCacheRef = useRef(new Map());
    const openCasePdfBusyRef = useRef(false);  // separate from global loading so clicks aren't dropped
    // Always-fresh mirror of pdfTabs for use inside async callbacks (avoids stale closures)
    const tabsRef = useRef([]);
    useEffect(() => { tabsRef.current = pdfTabs; }, [pdfTabs]);

    // ── Build contextState for useWorkspaceLoader / useWorkspaceSaver ─────────
    // These services accept a flat object; we assemble it from all sub-contexts.
    const contextState = useMemo(() => ({
        pdfId, activeWorkspace,
        setLoading,
        setSnippets, setEditableBoxes, setLines, setConnections,
        setHighlights, setPdfAnnotations, setPdfLines, setBrushHighlights,
        setExistingSnippetsMap, setIsDirty, viewStateRef,
        setGroups, setCrossPdfLinks,
        snippets: workspace.snippets,
        editableBoxes: workspace.editableBoxes,
        lines: workspace.lines,
        connections: workspace.connections,
        highlights: pdf.highlights,
        pdfAnnotations: pdf.pdfAnnotations,
        pdfLines: pdf.pdfLines,
        brushHighlights: pdf.brushHighlights,
        existingSnippetsMap: workspace.existingSnippetsMap,
        isDirty: workspace.isDirty,
        savingWorkspace, setSavingWorkspace,
        savingPdf, setSavingPdf,
        deletedHighlights: pdf.deletedHighlights,
        setDeletedHighlights,
        deletedPdfTexts: pdf.deletedPdfTexts,
        setDeletedPdfTexts,
        autosaveInterval,
        groups: workspace.groups,
        crossPdfLinks,
        pendingSummaryText, setPendingSummaryText,
    }), [
        pdfId, activeWorkspace,
        workspace.snippets, workspace.editableBoxes, workspace.lines, workspace.connections,
        workspace.existingSnippetsMap, workspace.isDirty, workspace.groups,
        pdf.highlights, pdf.pdfAnnotations, pdf.pdfLines, pdf.brushHighlights,
        pdf.deletedHighlights, pdf.deletedPdfTexts,
        savingWorkspace, savingPdf, autosaveInterval, crossPdfLinks,
        pendingSummaryText, setPendingSummaryText,
        setLoading, setSnippets, setEditableBoxes, setLines, setConnections,
        setHighlights, setPdfAnnotations, setPdfLines, setBrushHighlights,
        setExistingSnippetsMap, setIsDirty, viewStateRef, setGroups, setCrossPdfLinks,
        setSavingWorkspace, setSavingPdf, setDeletedHighlights, setDeletedPdfTexts,
    ]);

    useWorkspaceLoader(contextState);
    const { savePdfChanges, saveWorkspaceChanges } = useWorkspaceSaver(contextState);

    // Keep localStorage as offline backup
    useLocalStorageSync(
        workspace.snippets, workspace.connections,
        workspace.editableBoxes, workspace.lines, pdf.pdfLines
    );

    // Load bookmarks when pdfId changes
    useEffect(() => {
        if (!pdfId) return;
        api.listBookmarks(pdfId).then(res => setBookmarks(res.data)).catch(() => {});
    }, [pdfId, setBookmarks]);

    const activatePdfTab = useCallback((tab) => {
        if (!tab) return;
        setActiveTabId(tab.tabId);
        setSelectedPDF(tab.url);
        setPdfName(tab.name);
        setPdfId(tab.pdfId);
    }, [setActiveTabId, setSelectedPDF, setPdfName, setPdfId]);

    const cachePdfBlobUrl = useCallback(async (sourceUrl) => {
        const normalized = (sourceUrl || "").trim();
        if (!normalized) {
            throw new Error("Missing PDF URL");
        }

        const cache = pdfBlobUrlCacheRef.current;
        if (cache.has(normalized)) {
            return cache.get(normalized);
        }

        const response = await fetch(normalized, {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Failed to load PDF: ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            throw new Error("Received empty PDF file");
        }

        // Validate PDF magic bytes before creating blob URL
        const header = await blob.slice(0, 5).text();
        if (!header.startsWith("%PDF-")) {
            throw new Error(`URL does not point to a valid PDF file: ${normalized}`);
        }

        const objectUrl = URL.createObjectURL(blob);
        cache.set(normalized, objectUrl);
        return objectUrl;
    }, []);

    // In-flight guard: prevents duplicate workspace creation on rapid double-clicks
    // If two PDF clicks both reach ensureCaseWorkspace simultaneously, only one
    // API call goes to the backend — both await the same promise.
    const ensureCaseWsPromiseRef = useRef(null);
    const ensureCaseWorkspace = useCallback(async () => {
        if (ensureCaseWsPromiseRef.current) {
            return ensureCaseWsPromiseRef.current;
        }
        const promise = api.getCaseWorkspace().then(wsRes => {
            const ws = wsRes.data;
            setWorkspaces([ws]);
            setActiveWorkspace(ws);
            caseSessionRef.current.workspaceId = ws.id;
            return ws;
        }).finally(() => {
            ensureCaseWsPromiseRef.current = null;
        });
        ensureCaseWsPromiseRef.current = promise;
        return promise;
    }, [setWorkspaces, setActiveWorkspace]);


    const requestSummaryText = useCallback(async (text) => {
        const startRes = await api.startPdfSummary(text);
        const startPayload = startRes.data || {};

        if (startPayload.status === "completed" && startPayload.summary) {
            return startPayload.summary;
        }

        const cacheKey = startPayload.cache_key;
        if (!cacheKey) {
            throw new Error("Summary job did not return a cache key.");
        }

        for (let attempt = 0; attempt < SUMMARY_MAX_POLL_ATTEMPTS; attempt += 1) {
            const statusRes = await api.getPdfSummaryStatus(cacheKey);
            const statusPayload = statusRes.data || {};

            if (statusPayload.status === "completed" && statusPayload.summary) {
                return statusPayload.summary;
            }

            if (statusPayload.status === "failed") {
                throw new Error(statusPayload.error || "Summary generation failed.");
            }

            await sleep(SUMMARY_POLL_INTERVAL_MS);
        }

        throw new Error("Summary generation is still running. Please wait a bit and try again.");
    }, []);

    // ── Global save ───────────────────────────────────────────────────────────
    const handleGlobalSave = useCallback(async () => {
        if (savingWorkspace || savingPdf) return;
        await Promise.all([savePdfChanges(), saveWorkspaceChanges()]);
    }, [savePdfChanges, saveWorkspaceChanges, savingWorkspace, savingPdf]);

    // ── PDF annotation handlers (cross-context: need setIsDirty from Workspace) ─
    const handleDeleteHighlight = useCallback((highlightId) => {
        if (!window.confirm("Delete this highlight?")) return;
        if (!String(highlightId).startsWith('temp-')) {
            setDeletedHighlights(prev => [...prev, highlightId]);
        }
        setHighlights(prev => prev.filter(hl => hl.id !== highlightId));
        setIsDirty(true);
    }, [setDeletedHighlights, setHighlights, setIsDirty]);

    const handleDeleteBrushHighlight = useCallback(async (highlightId) => {
        if (!window.confirm("Delete this brush highlight?")) return;
        setBrushHighlights(prev => prev.filter(h => h.id !== highlightId));
        setIsDirty(true);
    }, [setBrushHighlights, setIsDirty]);

    const handleDeletePdfText = useCallback((annotId) => {
        if (!window.confirm("Delete this text?")) return;
        if (!String(annotId).startsWith('pdf-annot-')) {
            setDeletedPdfTexts(prev => [...prev, annotId]);
        }
        setPdfAnnotations(prev => prev.filter(a => a.id !== annotId));
        setIsDirty(true);
    }, [setDeletedPdfTexts, setPdfAnnotations, setIsDirty]);

    const handleDeletePdfDrawing = useCallback((lineId) => {
        if (!window.confirm("Delete this drawing?")) return;
        setPdfLines(prev => prev.filter(l => l.id !== lineId));
        setIsDirty(true);
    }, [setPdfLines, setIsDirty]);

    const handleBrushHighlightCreate = useCallback((highlight) => {
        setBrushHighlights(prev => [...prev, highlight]);
        setIsDirty(true);
    }, [setBrushHighlights, setIsDirty]);

    // ── Bookmark handlers ─────────────────────────────────────────────────────
    const handleAddBookmark = useCallback(async (pageNum, name) => {
        if (!pdfId) return;
        const label = name || `Page ${pageNum}`;
        try {
            const res = await api.createBookmark(pdfId, pageNum, label);
            setBookmarks(prev => {
                const existingIndex = prev.findIndex(b => b.id === res.data.id || b.page_num === res.data.page_num);
                if (existingIndex === -1) return [...prev, res.data].sort((a, b) => a.page_num - b.page_num);
                const next = [...prev];
                next[existingIndex] = res.data;
                return next.sort((a, b) => a.page_num - b.page_num);
            });
            return res.data;
        } catch (err) {
            console.error("Bookmark create error:", err);
            throw err;
        }
    }, [pdfId, setBookmarks]);

    const handleDeleteBookmark = useCallback(async (bookmarkId) => {
        try {
            await api.deleteBookmark(bookmarkId);
            setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
        } catch (err) {
            console.error("Bookmark delete error:", err);
        }
    }, [setBookmarks]);

    // ── Cross-PDF link handlers (need setIsDirty from WorkspaceContext) ───────
    const completeCrossLink = useCallback((endpoint) => {
        const prev = pendingCrossLinkRef.current;
        if (!prev) return;
        const newLink = { id: `xlink-${Date.now()}`, from: prev, to: endpoint };
        setPendingCrossLink(null);
        setCrossPdfLinks(links => [...links, newLink]);
        setLastCreatedCrossLinkId(newLink.id);
        setIsDirty(true);
    }, [pendingCrossLinkRef, setPendingCrossLink, setCrossPdfLinks, setLastCreatedCrossLinkId, setIsDirty]);

    const deleteCrossLink = useCallback((id) => {
        setCrossPdfLinks(prev => prev.filter(l => l.id !== id));
        setIsDirty(true);
    }, [setCrossPdfLinks, setIsDirty]);

    const completeDragWireLink = useCallback((toEndpoint) => {
        const current = dragWireRef.current;
        if (!current) return;
        if (current.from.pdfId && toEndpoint.pdfId &&
            String(current.from.pdfId) === String(toEndpoint.pdfId)) {
            setDragWire(null);
            return;
        }
        const newLink = { id: `xlink-${Date.now()}`, from: current.from, to: toEndpoint };
        setDragWire(null);
        dragWireRef.current = null;
        setCrossPdfLinks(links => {
            const sourceKey = (ep) =>
                `${ep.pdfId}-${ep.pageNum}-${Math.round((ep.xPct || 0) * 100)}-${Math.round((ep.yPct || 0) * 100)}-${ep.snippetId || ''}`;
            const key = sourceKey(current.from);
            const filtered = links.filter(l => sourceKey(l.from) !== key && sourceKey(l.to) !== key);
            return [...filtered, newLink];
        });
        setLastCreatedCrossLinkId(newLink.id);
        setIsDirty(true);
    }, [dragWireRef, setDragWire, setCrossPdfLinks, setLastCreatedCrossLinkId, setIsDirty]);

    // ── Workspace management ──────────────────────────────────────────────────
    const handleAddWorkspace = useCallback(async (name, targetPdfId = null) => {
        const idToUse = targetPdfId ?? (caseSessionRef.current.workspaceId ? 0 : (caseSessionRef.current.workspacePdfId || pdfId));
        if (idToUse === null || idToUse === undefined) return;
        const nextName = name?.trim() || getCurrentTimestampName();
        try {
            const res = await api.createWorkspace(idToUse, nextName);
            setWorkspaces(prev => [...prev, res.data]);
            setActiveWorkspace(res.data);
            if (nextName.toLowerCase() === "summary") {
                setPendingSummaryWorkspaceId(res.data.id);
            }
            return res.data;
        } catch (err) {
            console.error("Error creating workspace:", err);
        }
    }, [pdfId, setWorkspaces, setActiveWorkspace, setPendingSummaryWorkspaceId]);

    const openCasePdf = useCallback(async ({
        caseNo,
        caseYear,
        caseType,
        selectedPdf,
        workspaceRootPdf = null, // kept for backward compat with postMessage API, no longer used
        resetTabs = false,
    }) => {
        if (!selectedPdf?.url) return;
        if (openCasePdfBusyRef.current) return;

        openCasePdfBusyRef.current = true;
        setLoading(true);
        try {
            // Save any pending data BEFORE switching context to avoid data loss
            if (isDirty) {
                await saveWorkspaceChanges();
                await savePdfChanges();
            }

            // Fall back to URL params if postMessage doesn't include diary context.
            const urlCtx = readCaseContextFromUrl();
            const effectiveCaseNo = (caseNo || "").trim() || urlCtx.caseNo;
            const effectiveCaseYear = (caseYear || "").trim() || urlCtx.caseYear;

            const selectedOriginalPath = (selectedPdf.originalPath || selectedPdf.url || selectedPdf.name || "").trim();

            // ── Use tabsRef (always-fresh) to avoid stale-closure bug ──────────
            // pdfTabs captured in the closure may be empty even when tabs exist,
            // because React state updates are async. tabsRef is always current.
            const currentTabs = tabsRef.current;
            let existingTab = currentTabs.find(
                (tab) => tab.originalPath === selectedOriginalPath
            );

            // ── If same diary & same PDF already open — just switch to it ──────
            // This is the primary path after the first PDF load: no re-init needed.
            if (existingTab) {
                activatePdfTab(existingTab);
                openCasePdfBusyRef.current = false;
                setLoading(false);
                return;
            }

            // ── Determine if this is a genuinely different case ────────────────
            // A missing workspaceId means async init hasn't finished — NOT a case switch.
            const prevInitialized = caseSessionRef.current.caseNo !== null;
            const isDifferentCase = prevInitialized && (
                caseSessionRef.current.caseNo !== effectiveCaseNo ||
                caseSessionRef.current.caseYear !== effectiveCaseYear
            );

            // Also check by pdfId using cached list before hitting the backend
            let nextPdfId = null;
            // Get or register PDF on backend
            const openRes = await api.openPdf(selectedPdf.name || "document.pdf", selectedOriginalPath);
            nextPdfId = openRes.data.id;

            // Check again by pdfId (race condition: two rapid clicks for same PDF)
            const existingTabByPdfId = tabsRef.current.find((tab) => tab.pdfId === nextPdfId);
            if (existingTabByPdfId) {
                activatePdfTab(existingTabByPdfId);
                openCasePdfBusyRef.current = false;
                setLoading(false);
                return;
            }

            const resolvedUrl = await cachePdfBlobUrl(selectedPdf.url).catch(err => {
                console.error(`[openCasePdf] Failed to load PDF from URL "${selectedPdf.url}":`, err);
                throw err;
            });

            let caseWsId = caseSessionRef.current.workspaceId;
            if (isDifferentCase) {
                // Genuinely different case — clear tabs and re-init workspace
                caseSessionRef.current = { key: buildCaseKey(effectiveCaseNo, effectiveCaseYear, caseType), caseNo: effectiveCaseNo, caseYear: effectiveCaseYear, workspacePdfId: null, workspaceId: null };
                closePanel2();
                setPdfTabs([]);
                tabsRef.current = [];
                const ws = await ensureCaseWorkspace();
                caseWsId = ws.id;
            } else if (!caseWsId) {
                // Same case but workspace not yet initialized (async init still in-flight).
                caseSessionRef.current = { ...caseSessionRef.current, caseNo: effectiveCaseNo, caseYear: effectiveCaseYear };
                const ws = await ensureCaseWorkspace();
                caseWsId = ws.id;
            }

            // Register this PDF with the case workspace (persists the PDF list)
            if (caseWsId && nextPdfId) {
                api.registerPdfInWorkspace(caseWsId, nextPdfId, selectedPdf.name || "document.pdf", selectedOriginalPath)
                    .then(() => {
                        setCasePdfList(prev => {
                            if (prev.find(p => p.pdf_id === nextPdfId)) return prev;
                            return [...prev, { pdf_id: nextPdfId, pdf_name: selectedPdf.name || "document.pdf", pdf_url: selectedOriginalPath }];
                        });
                    })
                    .catch(e => console.error("PDF registration failed:", e));
            }

            const nextTabId = `tab-${nextPdfId}`;
            const color = PDF_TAB_COLORS[tabsRef.current.length % PDF_TAB_COLORS.length];
            const newTab = {
                tabId: nextTabId,
                url: resolvedUrl,
                name: selectedPdf.name || "document.pdf",
                pdfId: nextPdfId,
                originalPath: selectedOriginalPath,
                color,
            };

            // IMMEDIATE REGISTRATION FOR CASE WORKSPACE
            const ws = await ensureCaseWorkspace();
            api.registerPdfInWorkspace(ws.id, nextPdfId, selectedPdf.name, selectedOriginalPath)
                .then(() => {
                    setCasePdfList(prev => {
                        if (prev.find(p => p.pdf_id === nextPdfId)) return prev;
                        return [...prev, { pdf_id: nextPdfId, pdf_name: selectedPdf.name, pdf_url: selectedOriginalPath }];
                    });
                })
                .catch(e => console.error("Auto-registration failed:", e));

            activatePdfTab(newTab);
            setPdfTabs(prev => {
                // Final dedup guard
                const already = prev.find(
                    (tab) => tab.pdfId === nextPdfId || tab.originalPath === selectedOriginalPath
                );

                if (already) return prev;
                return [...prev, newTab];
            });
        } catch (err) {
            console.error("Error opening shared-case PDF:", err);
        } finally {
            openCasePdfBusyRef.current = false;
            setLoading(false);
        }
    }, [
        setLoading, setPdfTabs, activatePdfTab,
        PDF_TAB_COLORS, cachePdfBlobUrl, ensureCaseWorkspace, closePanel2, setCasePdfList,
        isDirty, saveWorkspaceChanges, savePdfChanges
    ]);

    const handlePDFSelect = useCallback(async (url, fileName, originalPath) => {
        if (loading) return;
        
        // Ensure any unsaved changes to the current workspace/PDF are saved before jumping to another
        if (isDirty) {
            await saveWorkspaceChanges();
            await savePdfChanges();
        }

        setLoading(true);
        setSelectedPDF(url);
        setPdfName(fileName);
        try {
            const caseContext = readCaseContextFromUrl();
            const backendPath = (originalPath || fileName).trim();
            const openRes = await api.openPdf(fileName, backendPath);
            const newPdfId = openRes.data.id;

            if (caseContext.hasCaseContext) {
                // In case context: use the shared case workspace
                let caseWsId = caseSessionRef.current.workspaceId;
                if (!caseWsId) {
                    const ws = await ensureCaseWorkspace();
                    caseWsId = ws.id;
                }
                // Register PDF with case workspace
                api.registerPdfInWorkspace(caseWsId, newPdfId, fileName, backendPath)
                    .then(() => {
                        setCasePdfList(prev => {
                            if (prev.find(p => p.pdf_id === newPdfId)) return prev;
                            return [...prev, { pdf_id: newPdfId, pdf_name: fileName, pdf_url: backendPath }];
                        });
                    })
                    .catch(e => console.error("PDF registration failed:", e));
            } else {
                // Non-case mode: use a singular workspace across PDFs for LiquidText-like experience.
                let currentWs = caseSessionRef.current.workspaceId ? {id: caseSessionRef.current.workspaceId} : activeWorkspace;
                if (!currentWs) {
                    const wsRes = await api.listWorkspaces(newPdfId);
                    if (wsRes.data.length > 0) {
                        currentWs = wsRes.data[0];
                    } else {
                        currentWs = await handleAddWorkspace("E-diary", newPdfId);
                    }
                    setWorkspaces(wsRes.data.length > 0 ? wsRes.data : [currentWs]);
                    setActiveWorkspace(currentWs);
                } else {
                    // Do NOT list or switch if we already have one. Just register the new PDF so it shows in the list.
                    api.registerPdfInWorkspace(currentWs.id, newPdfId, fileName, backendPath)
                        .then(() => {
                            setCasePdfList(prev => {
                                if (prev.find(p => p.pdf_id === newPdfId)) return prev;
                                return [...prev, { pdf_id: newPdfId, pdf_name: fileName, pdf_url: backendPath }];
                            });
                        })
                        .catch(e => console.error("PDF registration failed:", e));
                }
            }

            setPdfId(newPdfId);
            const tabId = `tab-${newPdfId}`;
            setPdfTabs(prev => {
                const exists = prev.find(t => t.pdfId === newPdfId || t.originalPath === backendPath);
                if (exists) { setActiveTabId(exists.tabId); return prev; }
                const color = PDF_TAB_COLORS[prev.length % PDF_TAB_COLORS.length];
                setActiveTabId(tabId);
                return [...prev, { tabId, url, name: fileName, pdfId: newPdfId, color, originalPath: backendPath }];
            });
        } catch (err) {
            console.error("Error opening PDF:", err);
        } finally {
            setLoading(false);
        }
    }, [loading, setLoading, setSelectedPDF, setPdfName, setPdfId, setWorkspaces,
        setActiveWorkspace, handleAddWorkspace, setPdfTabs, setActiveTabId, PDF_TAB_COLORS,
        ensureCaseWorkspace, setCasePdfList, activeWorkspace, isDirty, saveWorkspaceChanges, savePdfChanges]);

    const switchPdfTab = useCallback(async (tab) => {
        if (activeTabId === tab.tabId) return;
        
        // Save current state before switching to another tab, otherwise PDF annotations
        // for the old PDF might get lost or saved to the new PDF ID.
        if (isDirty) {
            await saveWorkspaceChanges();
            await savePdfChanges();
        }
        
        activatePdfTab(tab);
    }, [activeTabId, activatePdfTab, isDirty, saveWorkspaceChanges, savePdfChanges]);

    const closePdfTab = useCallback((tabId) => {
        setPdfTabs(prev => {
            const tabClosing = prev.find(t => t.tabId === tabId);
            const remaining = prev.filter(t => t.tabId !== tabId);
            
            // UN-TRACK TAB IN DATABASE SO IT STAYS CLOSED ON RELOAD
            if (tabClosing && caseSessionRef.current.workspaceId && tabClosing.pdfId) {
                api.closePdfInWorkspace(caseSessionRef.current.workspaceId, tabClosing.pdfId).catch(console.error);
            }

            if (activeTabId === tabId && remaining.length > 0) {
                activatePdfTab(remaining[remaining.length - 1]);
            } else if (remaining.length === 0) {
                caseSessionRef.current = { key: null, workspacePdfId: null, workspaceId: null };
                setActiveTabId(null);
                setSelectedPDF(null);
                setPdfName("");
                setPdfId(null);
                setWorkspaces([]);
                setActiveWorkspace(null);
            }
            return remaining;
        });
    }, [activeTabId, setPdfTabs, activatePdfTab, setActiveTabId, setSelectedPDF, setPdfName, setPdfId, setWorkspaces, setActiveWorkspace]);

    const jumpToSource = useCallback((snippet) => {
        const snippetPdfId = String(snippet.pdf_id || snippet.sourcePdfId || "");
        if (!snippetPdfId) return;
        const scrollRef = (ref) => {
            setTimeout(() => {
                if (!ref.current) return;
                if (snippet.xPct !== undefined && snippet.yPct !== undefined) {
                    ref.current.scrollToSnippet?.(snippet);
                } else if (snippet.pageNum) {
                    ref.current.scrollToPage?.(snippet.pageNum);
                }
            }, 150);
        };
        if (panel2PdfId && String(panel2PdfId) === snippetPdfId) { scrollRef(pdf2Ref); return; }
        if (String(pdfId) === snippetPdfId) { scrollRef(pdfRef); return; }
        setPdfTabs(prev => {
            const tab = prev.find(t => String(t.pdfId) === snippetPdfId);
            if (!tab) {
                const casePdf = (casePdfList || []).find(entry => String(entry.pdf_id) === snippetPdfId);
                if (casePdf) {
                    const { caseNo, caseYear, caseType } = readCaseContextFromUrl();
                    openCasePdf({
                        caseNo,
                        caseYear,
                        caseType,
                        selectedPdf: {
                            url: casePdf.pdf_url,
                            name: casePdf.pdf_name,
                            originalPath: casePdf.pdf_url,
                        },
                    });
                    scrollRef(pdfRef);
                }
                return prev;
            }
            setActiveTabId(tab.tabId);
            setSelectedPDF(tab.url);
            setPdfName(tab.name);
            setPdfId(tab.pdfId);
            scrollRef(pdfRef);
            return prev;
        });
    }, [pdfId, panel2PdfId, pdfRef, pdf2Ref, setPdfTabs, setActiveTabId, setSelectedPDF, setPdfName, setPdfId, casePdfList, openCasePdf]); // eslint-disable-line

    // ── PDF summarization ─────────────────────────────────────────────────────
    const handleSummarizePdf = useCallback(async () => {
        if (!pdfRef.current) return;
        setShowSummary(true);
        setSummaryLoading(true);
        setSummary("");
        try {
            const text = await pdfRef.current.extractAllText();
            if (!text || !text.trim()) { setSummary("No text could be extracted from this PDF."); return; }
            const summaryText = await requestSummaryText(text);
            setSummary(summaryText);
            setPendingSummaryText(summaryText);
        } catch (err) {
            setSummary(getSummaryErrorMessage(err));
            console.error("Summarization error:", err);
        } finally {
            setSummaryLoading(false);
        }
    }, [pdfRef, setShowSummary, setSummaryLoading, setSummary, setPendingSummaryText, requestSummaryText]);

    // Apply pending summary text when on the summary workspace and it's already loaded
    useEffect(() => {
        if (!pendingSummaryText) return;
        if (activeWorkspace?.name?.toLowerCase() !== "summary") return;
        if (loading) return;
        setEditableBoxes(prev => {
            if (prev.length > 0) return prev.map((b, i) => i === 0 ? { ...b, text: pendingSummaryText } : b);
            return [...prev, { id: `temp-summary-${Date.now()}`, text: pendingSummaryText, x: 36, y: 24, width: 720, height: 640 }];
        });
        setIsDirty(true);
        setPendingSummaryText(null);
    }, [pendingSummaryText]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-generate summary for newly created "summary" workspaces
    useEffect(() => {
        if (!pendingSummaryWorkspaceId) return;
        if (activeWorkspace?.id !== pendingSummaryWorkspaceId) return;
        if (!pdfRef.current) return;
        setPendingSummaryWorkspaceId(null);
        (async () => {
            try {
                const text = await pdfRef.current.extractAllText();
                if (!text || !text.trim()) {
                    setEditableBoxes(prev => [...prev, { id: `temp-summary-${Date.now()}`, text: "No text could be extracted from this PDF.", x: 30, y: 30, width: 520, height: 80 }]);
                    setIsDirty(true);
                    return;
                }
                const summaryText = await requestSummaryText(text);
                setEditableBoxes(prev => [...prev, { id: `temp-summary-${Date.now()}`, text: summaryText, x: 36, y: 24, width: 720, height: 640 }]);
                setIsDirty(true);
            } catch (err) {
                console.error("Auto-summary error:", err);
                setEditableBoxes(prev => [...prev, { id: `temp-summary-${Date.now()}`, text: getSummaryErrorMessage(err), x: 30, y: 30, width: 520, height: 80 }]);
                setIsDirty(true);
            }
        })();
    }, [pendingSummaryWorkspaceId, activeWorkspace, requestSummaryText]); // eslint-disable-line react-hooks/exhaustive-deps

    // Global keyboard shortcuts (Ctrl+Z / Ctrl+Y)
    useEffect(() => {
        const onKeyDown = (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (isInput) return;
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleUndo, handleRedo]);

    useEffect(() => {
        // Deduplicate rapid retries (e.g. the 450ms second dispatch from parent apps):
        // only open a PDF if its URL differs from the one currently being opened.
        let lastOpenedUrl = null;

        const onMessage = (event) => {
            const data = event.data;
            if (!data || data.type !== "LIQUIDTEXT_OPEN_CASE_PDF") return;
            const pdfUrl = data.selected_pdf?.url || data.selected_pdf?.originalPath || "";
            if (pdfUrl && pdfUrl === lastOpenedUrl && openCasePdfBusyRef.current) return;
            lastOpenedUrl = pdfUrl;

            openCasePdf({
                caseNo: data.case_no,
                caseYear: data.case_year,
                caseType: data.case_type,
                selectedPdf: data.selected_pdf,
                workspaceRootPdf: data.workspace_root_pdf,
                resetTabs: Boolean(data.reset_tabs),
            });
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [openCasePdf]);

    useEffect(() => {
        const { hasCaseContext, caseNo, caseYear, caseType, caseKey } = readCaseContextFromUrl();
        if (!hasCaseContext) return;
        caseSessionRef.current = {
            key: caseKey,
            workspacePdfId: null,
            workspaceId: null,
            caseNo,
            caseYear,
            caseType,
        };

        // Auto-initialize the case workspace and restore saved PDF list
        (async () => {
            try {
                const wsRes = await api.getCaseWorkspace();
                const ws = wsRes.data;
                setWorkspaces([ws]);
                setActiveWorkspace(ws);
                caseSessionRef.current.workspaceId = ws.id;

                const pdfsRes = await api.listWorkspacePdfs(ws.id);
                const savedPdfs = pdfsRes.data || [];
                setCasePdfList(savedPdfs);

                // Auto-load PDF from URL if present
                // BATCH RESTORE ALL PREVIOUS TABS (ACTIVE ONES ONLY)
                const { pdfUrl, pdfName, caseNo, caseYear, caseType, caseKey } = readCaseContextFromUrl();
                
                if (savedPdfs.length > 0 || pdfUrl) {
                    const allToOpen = [];
                    
                    // Only push saved PDFs if they are active in the db
                    for (const p of savedPdfs) {
                        if (p.is_active !== false) { // Default to true if missing
                            allToOpen.push(p);
                        }
                    }
                    
                    // Always add the requested PDF if not already there
                    if (pdfUrl && !allToOpen.find(p => (p.url || p.pdf_url) === pdfUrl)) {
                        allToOpen.push({ url: pdfUrl, name: pdfName, is_active: true });
                    }

                    // Open them all stable-ly
                    for (const p of allToOpen) {
                        const resolvedUrl = p.url || p.pdf_url;
                        const resolvedName = p.name || p.pdf_name;
                        const resolvedId = p.id || p.pdf_id;
                        
                        if (!resolvedUrl) continue;

                        await openCasePdf({
                            caseNo, caseYear, caseType,
                            selectedPdf: { url: resolvedUrl, name: resolvedName, id: resolvedId, originalPath: resolvedUrl }
                        });
                    }
                }
            } catch (e) {
                console.error("Case workspace init failed:", e);
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── AppActionsContext: stable cross-context callbacks ─────────────────────
    // These are all useCallback with stable deps, so this value rarely changes.
    // Components that ONLY need handlers can use useAppActions() and avoid re-renders
    // caused by state changes in WorkspaceContext / PDFContext / UIContext.
    const actionsValue = useMemo(() => ({
        handleGlobalSave,
        handleDeleteHighlight, handleDeleteBrushHighlight,
        handleDeletePdfText, handleDeletePdfDrawing, handleBrushHighlightCreate,
        handleAddBookmark, handleDeleteBookmark,
        completeCrossLink, deleteCrossLink, completeDragWireLink,
        handleAddWorkspace, handlePDFSelect,
        switchPdfTab, closePdfTab,
        jumpToSource,
        handleSummarizePdf,
        savePdfChanges, saveWorkspaceChanges,
        openCasePdf,
        // Expose setIsDirty here so PDFViewer doesn't need to import WorkspaceContext
        setIsDirty,
    }), [
        handleGlobalSave,
        handleDeleteHighlight, handleDeleteBrushHighlight,
        handleDeletePdfText, handleDeletePdfDrawing, handleBrushHighlightCreate,
        handleAddBookmark, handleDeleteBookmark,
        completeCrossLink, deleteCrossLink, completeDragWireLink,
        handleAddWorkspace, handlePDFSelect,
        switchPdfTab, closePdfTab, jumpToSource, handleSummarizePdf,
        savePdfChanges, saveWorkspaceChanges, openCasePdf, setIsDirty,
    ]);

    // ── AppContext: full combined value for useApp() backward compat ──────────
    const fullValue = useMemo(() => ({
        // Sub-context data (spread so all original field names are present)
        ...workspace,
        ...pdf,
        ...ui,
        // Cross-context handlers
        ...actionsValue,
    }), [workspace, pdf, ui, actionsValue]);

    return (
        <AppActionsContext.Provider value={actionsValue}>
            <AppContext.Provider value={fullValue}>
                {children}
            </AppContext.Provider>
        </AppActionsContext.Provider>
    );
}

// ── Public provider ───────────────────────────────────────────────────────────
export const AppProvider = ({ children }) => (
    <UIProvider>
        <WorkspaceProvider>
            <PDFProvider>
                <AppInner>{children}</AppInner>
            </PDFProvider>
        </WorkspaceProvider>
    </UIProvider>
);

// ── Public hooks ──────────────────────────────────────────────────────────────

/**
 * useApp() — full backward-compatible hook.
 * Returns all state from all three sub-contexts plus cross-context handlers.
 * Consumers re-render whenever ANY sub-context changes.
 * Prefer useWorkspace() / usePDF() / useUI() / useAppActions() for perf-critical components.
 */
export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
};

/**
 * useAppActions() — stable cross-context handlers only.
 * This context value rarely changes because all values are useCallback with stable deps.
 * Use this in components that only need handlers (jumpToSource, handleDeleteHighlight, etc.)
 * without subscribing to state changes.
 */
export const useAppActions = () => {
    const ctx = useContext(AppActionsContext);
    if (!ctx) throw new Error('useAppActions must be used within AppProvider');
    return ctx;
};

export default AppContext;
