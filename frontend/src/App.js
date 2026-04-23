import { useState, useRef, useEffect, useCallback, Component } from "react";
import { useApp } from "./context/AppContext";
import PDFViewer from "./components/pdf/PDFViewer";
import Navbar from "./components/layout/Navbar";
import PDFSelector from "./components/pdf/PDFSelector";
import "./App.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import Workspace from "./components/workspace/Workspace";
import TraceLineLayer from "./components/workspace/TraceLineLayer";
import KeyboardShortcuts from "./components/layout/KeyboardShortcuts";
import useLayoutResizer from "./components/layout/useLayoutResizer";
import Toast from "./components/layout/Toast";
import AnnotationsSidebar from "./components/layout/AnnotationsSidebar";
import ScreenStickyNotes from "./components/layout/ScreenStickyNotes";
import BookmarksSidebar from "./components/layout/BookmarksSidebar";
import CrossPdfConnectionLayer from "./components/workspace/CrossPdfConnectionLayer";
import DocumentationPanel from "./components/documentation/DocumentationPanel";
import useDocumentationPages from "./hooks/useDocumentationPages";
import { getCurrentTimestampName } from "./utils/defaultNames";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif" }}>
                    <h2 style={{ color: "#dc2626" }}>Something went wrong</h2>
                    <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 400, textAlign: "center" }}>
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{ padding: "8px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

/** Inline workspace-name input to avoid browser prompt() */
function NewWorkspaceBtn({ onAdd }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const openEditor = () => {
        setName(getCurrentTimestampName());
        setEditing(true);
    };

    if (editing) {
        return (
            <form
                onSubmit={e => {
                    e.preventDefault();
                    onAdd(name.trim() || getCurrentTimestampName());
                    setName("");
                    setEditing(false);
                }}
                style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
            >
                <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={() => { setEditing(false); setName(""); }}
                    placeholder={getCurrentTimestampName()}
                    style={{ fontSize: 12, padding: "2px 6px", borderRadius: 6, border: "1px solid #aaa", width: 120 }}
                />
                <button type="submit" onMouseDown={e => e.preventDefault()} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "none", background: "#007bff", color: "white", cursor: "pointer" }}>Add</button>
            </form>
        );
    }
    return (
        <button className="add-workspace-btn" onClick={openEditor} title="Create New Workspace">+</button>
    );
}

/** Modal to open a second PDF via file upload or URL */
function OpenPdfModal({ onSelect, onClose }) {
    const [tab, setTab] = useState("file");
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const overlayRef = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (e.target === overlayRef.current) onClose(); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file && file.type === "application/pdf") {
            const fileUrl = URL.createObjectURL(file);
            onSelect(fileUrl, file.name, file.name);
            onClose();
        }
    };

    const handleUrl = async (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(url.trim(), { mode: "cors", cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const fileUrl = URL.createObjectURL(blob);
            let fileName = "document.pdf";
            try {
                const u = new URL(url.trim());
                const parts = u.pathname.split("/");
                const last = parts[parts.length - 1];
                if (last && last.toLowerCase().endsWith(".pdf")) fileName = decodeURIComponent(last);
            } catch {}
            onSelect(fileUrl, fileName, url.trim());
            onClose();
        } catch (err) {
            setError(err.message || "Failed to load PDF");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div ref={overlayRef} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <div style={{
                background: "#fff", borderRadius: 12, padding: "24px 28px",
                width: 420, maxWidth: "90vw",
                boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>Open PDF in New Tab</span>
                    <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                    {["file", "url"].map(t => (
                        <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
                            padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                            fontWeight: tab === t ? 600 : 400,
                            background: tab === t ? "#007bff" : "#f3f4f6",
                            color: tab === t ? "white" : "#374151",
                        }}>{t === "file" ? "Upload File" : "From URL"}</button>
                    ))}
                </div>

                {tab === "file" && (
                    <div>
                        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Select a PDF from your computer</p>
                        <input type="file" accept="application/pdf" onChange={handleFile}
                            style={{ fontSize: 13, cursor: "pointer", width: "100%" }} />
                    </div>
                )}

                {tab === "url" && (
                    <form onSubmit={handleUrl}>
                        <input
                            type="text" value={url} onChange={e => setUrl(e.target.value)}
                            placeholder="https://example.com/document.pdf"
                            disabled={loading}
                            style={{
                                width: "100%", padding: "10px 12px", fontSize: 13,
                                border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box",
                                marginBottom: error ? 8 : 12, outline: "none",
                            }}
                        />
                        {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{error}</div>}
                        <button type="submit" disabled={loading} style={{
                            width: "100%", padding: "10px", background: loading ? "#9ca3af" : "#007bff",
                            color: "white", border: "none", borderRadius: 8, fontSize: 14,
                            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                        }}>
                            {loading ? "Loading..." : "Load PDF"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function App() {
    const {
        loading,
        activeWorkspace,
        workspaces,
        setActiveWorkspace,
        selectedPDF,
        pdfPanelWidth,
        isResizing,
        pdfRef, pdf2Ref,
        pdfId,
        handlePDFSelect,
        handleAddWorkspace,
        pdfTabs, activeTabId,
        switchPdfTab, closePdfTab,
        panel2TabId, panel2PdfId, panel2PdfUrl, panel2PdfName,
        openInPanel2, closePanel2,
        isDirty,
        casePdfList,
        openCasePdf,
    } = useApp();

    // Detect case context from URL
    const caseContextParams = (() => {
        const params = new URLSearchParams(window.location.search);
        const caseNo = (params.get("case_no") || "").trim();
        const caseYear = (params.get("case_year") || "").trim();
        const caseType = (params.get("case_type") || "").trim();
        return { caseNo, caseYear, caseType, hasCaseContext: Boolean(caseNo || caseYear) };
    })();

    // Warn user before closing tab if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);
    const [isDocumentationActive, setIsDocumentationActive] = useState(false);
    const {
        documents,
        activeDocumentId,
        createDocumentPage,
        selectDocument,
        renameDocument,
        deleteDocument,
        updateDocumentContent,
    } = useDocumentationPages(activeWorkspace?.id ?? null);

    const [showOpenModal, setShowOpenModal] = useState(false);
    const [pdf2PanelWidth, setPdf2PanelWidth] = useState(35); // right panel width %
    const [pdf2Zoom, setPdf2Zoom] = useState(1.0);            // right panel independent zoom
    const [isResizing2, setIsResizing2] = useState(false);
    const resizer2Ref = useRef({ startX: 0, startWidth: 35, startZoom: 1.0 });
    const getWorkspaceTabLabel = useCallback((name) => {
        if ((name || "").trim().toLowerCase() === "main") return "E-diary";
        return name;
    }, []);

    const { handleMouseDownResizer, handleTouchStartResizer } = useLayoutResizer();

    // Right-panel drag resizer — also scales pdf2Zoom proportionally like the main resizer does for PDF1
    const handleMouseDownResizer2 = useCallback((e) => {
        setIsResizing2(true);
        resizer2Ref.current = { startX: e.clientX, startWidth: pdf2PanelWidth, startZoom: pdf2Zoom };
    }, [pdf2PanelWidth, pdf2Zoom]);

    useEffect(() => {
        if (!isResizing2) return;
        const onMove = (e) => {
            const { startX, startWidth, startZoom } = resizer2Ref.current;
            const delta = e.clientX - startX;
            const deltaPct = (delta / window.innerWidth) * 100;
            const next = Math.min(60, Math.max(15, startWidth + deltaPct));
            setPdf2PanelWidth(next);
            // Scale zoom proportionally so PDF content fills the resized panel
            const ratio = next / startWidth;
            setPdf2Zoom(Math.min(3.0, Math.max(0.3, parseFloat((startZoom * ratio).toFixed(2)))));
        };
        const onUp = () => setIsResizing2(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [isResizing2]);

    const renderWorkspaceView = () => {
        if (!selectedPDF && pdfTabs.length === 0) {
            return <PDFSelector onSelect={handlePDFSelect} />;
        }

        return (
            <>
                <KeyboardShortcuts />
                <AnnotationsSidebar />
                <BookmarksSidebar />
                {!isDocumentationActive && <ScreenStickyNotes />}
                {!isDocumentationActive && <TraceLineLayer />}
                {!isDocumentationActive && <CrossPdfConnectionLayer />}

                {showOpenModal && (
                    <OpenPdfModal
                        onSelect={handlePDFSelect}
                        onClose={() => setShowOpenModal(false)}
                    />
                )}

                {loading && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                            Loading...
                        </div>
                    </div>
                )}
                <Navbar />

                <div className="context-bar">
                    <div
                        className="pdf-tabs-container"
                        style={{ width: panel2PdfUrl ? `${pdfPanelWidth + pdf2PanelWidth}%` : `${pdfPanelWidth}%` }}
                    >
                        <span className="context-label" style={{ paddingLeft: '16px', flexShrink: 0 }}>Files:</span>
                        <div
                            className="workspace-tabs-scroll"
                            style={{
                                paddingLeft: 0, gap: 2,
                                overflowX: "auto", overflowY: "hidden",
                                flexWrap: "nowrap",
                                scrollbarWidth: "none",        /* Firefox */
                                msOverflowStyle: "none",       /* IE */
                            }}
                        >
                            {pdfTabs.map(tab => (
                                <div
                                    key={tab.tabId}
                                    className={`workspace-tab-item ${tab.tabId === activeTabId ? 'active' : ''}`}
                                    onClick={() => switchPdfTab(tab)}
                                    title={tab.name}
                                    style={{
                                        marginTop: 4,
                                        display: "flex", alignItems: "center", gap: 3,
                                        padding: "2px 4px 2px 6px",
                                        maxWidth: 130,
                                        minWidth: 60,
                                        flexShrink: 0,
                                        cursor: "pointer",
                                        background: tab.tabId === activeTabId ? "#e8f4ff" : "transparent",
                                        borderRadius: 5,
                                    }}
                                >
                                    <div style={{
                                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                        background: tab.color || "#9ca3af",
                                        boxShadow: tab.tabId === activeTabId ? `0 0 0 2px ${tab.color || "#9ca3af"}44` : "none",
                                    }} />
                                    <span className="tab-name" style={{
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        fontWeight: tab.tabId === activeTabId ? 600 : 400,
                                        color: tab.tabId === activeTabId ? (tab.color || "#0057c8") : "#374151",
                                        fontSize: 11,
                                        flex: 1,
                                    }}>{tab.name}</span>
                                    {pdfTabs.length > 1 && (
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (panel2TabId === tab.tabId) { closePanel2(); }
                                                else { openInPanel2(tab); }
                                            }}
                                            title={panel2TabId === tab.tabId ? "Close right panel" : "Open in right panel (side-by-side)"}
                                            style={{
                                                border: "none", background: "none", cursor: "pointer",
                                                color: panel2TabId === tab.tabId ? (tab.color || "#007bff") : "#9ca3af",
                                                fontSize: 10, lineHeight: 1, padding: "0 1px", flexShrink: 0,
                                                fontWeight: 700,
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.color = tab.color || "#007bff"}
                                            onMouseLeave={e => e.currentTarget.style.color = panel2TabId === tab.tabId ? (tab.color || "#007bff") : "#9ca3af"}
                                        >⊞</button>
                                    )}
                                    <button
                                        onClick={e => { e.stopPropagation(); closePdfTab(tab.tabId); }}
                                        title="Close this PDF"
                                        style={{
                                            border: "none", background: "none", cursor: "pointer",
                                            color: "#9ca3af", fontSize: 13, lineHeight: 1,
                                            padding: "0 1px", flexShrink: 0,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                                        onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="workspace-tabs-container">
                        {/* <span className="context-label">Workspaces:</span> */}
                        <div className="workspace-tabs-scroll">
                            {workspaces.map(ws => (
                                <div
                                    key={ws.id}
                                    className={`context-tab workspace-tab-item ${!isDocumentationActive && activeWorkspace?.id === ws.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setIsDocumentationActive(false);
                                        setActiveWorkspace(ws);
                                    }}
                                    title={ws.name}
                                >
                                    {!isDocumentationActive && activeWorkspace?.id === ws.id && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                    <span className="tab-name">{getWorkspaceTabLabel(ws.name)}</span>
                                </div>
                            ))}
                            <div
                                className={`context-tab workspace-tab-item ${isDocumentationActive ? 'active' : ''}`}
                                onClick={() => setIsDocumentationActive(true)}
                                title="Editor"
                            >
                                {isDocumentationActive && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                                <span className="tab-name">Editor</span>
                                <span className="workspace-tab-count">{documents.length}</span>
                            </div>
                            <NewWorkspaceBtn onAdd={handleAddWorkspace} />
                        </div>
                    </div>
                </div>

                <div className="main-content" style={{ cursor: isResizing || isResizing2 ? 'col-resize' : 'default' }}>
                    {/* PDF 1 — always left */}
                    <div className="pdf-view-container" style={{ width: `${pdfPanelWidth}%`, height: '100%', flex: 'none', position: 'relative' }}>
                        <PDFViewer key={activeTabId} ref={pdfRef} fileUrl={selectedPDF} sourcePdfId={pdfId} />
                    </div>

                    <div
                        className={`layout-resizer ${isResizing ? 'active' : ''}`}
                        onMouseDown={handleMouseDownResizer}
                        onTouchStart={handleTouchStartResizer}
                    >
                        <div className="resizer-handle"><span>⋮</span></div>
                    </div>

                    {/* PDF 2 — middle when open, placed before workspace */}
                    {panel2PdfUrl && (
                        <>
                            <div style={{
                                width: `${pdf2PanelWidth}%`, height: '100%', flex: 'none',
                                position: 'relative', display: 'flex', flexDirection: 'column',
                                borderLeft: `3px solid ${pdfTabs.find(t => t.tabId === panel2TabId)?.color || '#e5e7eb'}`,
                                borderRight: `3px solid ${pdfTabs.find(t => t.tabId === panel2TabId)?.color || '#e5e7eb'}`,
                            }}>
                                <div style={{
                                    height: 32, flexShrink: 0, display: 'flex', alignItems: 'center',
                                    padding: '0 8px', gap: 4,
                                    background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
                                }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                        background: pdfTabs.find(t => t.tabId === panel2TabId)?.color || '#9ca3af',
                                    }} />
                                    <span style={{
                                        flex: 1, fontSize: 11, fontWeight: 600, color: '#374151',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{panel2PdfName}</span>
                                    <button onClick={() => setPdf2Zoom(z => Math.max(0.3, parseFloat((z - 0.15).toFixed(2))))}
                                        title="Zoom out" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#6b7280', padding: '0 3px', lineHeight: 1 }}>−</button>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', minWidth: 30, textAlign: 'center' }}>{Math.round(pdf2Zoom * 100)}%</span>
                                    <button onClick={() => setPdf2Zoom(z => Math.min(3.0, parseFloat((z + 0.15).toFixed(2))))}
                                        title="Zoom in" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#6b7280', padding: '0 3px', lineHeight: 1 }}>+</button>
                                    <button
                                        onClick={closePanel2}
                                        title="Close PDF 2 panel"
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '0 2px', marginLeft: 2 }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                                    >×</button>
                                </div>

                                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                                    <PDFViewer
                                        key={panel2TabId}
                                        ref={pdf2Ref}
                                        fileUrl={panel2PdfUrl}
                                        sourcePdfId={panel2PdfId}
                                        localZoom={pdf2Zoom}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    width: 6, height: '100%', cursor: 'col-resize', flexShrink: 0,
                                    background: isResizing2 ? '#93c5fd' : '#e5e7eb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.15s',
                                }}
                                onMouseDown={handleMouseDownResizer2}
                                onMouseEnter={e => e.currentTarget.style.background = '#93c5fd'}
                                onMouseLeave={e => { if (!isResizing2) e.currentTarget.style.background = '#e5e7eb'; }}
                            >
                                <span style={{ fontSize: 10, color: '#9ca3af', userSelect: 'none' }}>⋮</span>
                            </div>
                        </>
                    )}

                    {/* Workspace — always rightmost */}
                    <div className="workspace-view-wrapper" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                        {isDocumentationActive ? (
                            <DocumentationPanel
                                documents={documents}
                                activeDocumentId={activeDocumentId}
                                onSelectDocument={selectDocument}
                                onCreateDocument={createDocumentPage}
                                onRenameDocument={renameDocument}
                                onDeleteDocument={deleteDocument}
                                onUpdateDocumentContent={updateDocumentContent}
                            />
                        ) : (
                            <Workspace />
                        )}
                    </div>
                </div>
            </>
        );
    };

    return (
        <ErrorBoundary>
            <div className="app-container">
                <Toast />
                {renderWorkspaceView()}
            </div>
        </ErrorBoundary>
    );
}
