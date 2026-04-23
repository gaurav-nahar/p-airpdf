import React from "react";
import { useApp } from "../../context/AppContext";
import { toRichTextHtml } from "../workspace/richTextUtils";

// Strip "# PDF Summary" title and numbered prefixes from section headings
const preprocessSummary = (text) => {
    if (!text) return text;
    return text
        .replace(/^#\s+PDF Summary\s*\n?/m, '')
        .replace(/^(#{1,3})\s+\d+\.\s+/gm, '$1 ');
};

const icons = {
    select: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="13" height="13" strokeDasharray="2 2" />
            <path d="M12 12l6 6-2 1-1 2-3-9z" fill="currentColor" fillOpacity="0.1" />
        </svg>
    ),
    connection: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a3 3 0 0 0 4.54.54l3-3a3 3 0 0 0-4.24-4.24l-1.72 1.71" />
            <path d="M14 11a3 3 0 0 0-4.54-.54l-3 3a3 3 0 0 0 4.24 4.24l1.71-1.71" />
        </svg>
    ),
    textBox: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" />
            <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="100" style={{ pointerEvents: 'none' }}>A</text>
        </svg>
    ),
    pen: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.17 3.06a2.39 2.39 0 0 0-3.39 0L5.12 15.73l-1.05 4.3 4.3-1.05L21.17 6.45a2.39 2.39 0 0 0 0-3.39z" />
            <line x1="15" y1="5" x2="19" y2="9" />
            <line x1="4" y1="20" x2="8" y2="20" />
        </svg>
    ),
    eraser: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
            <path d="m5.082 11.09 8.828 8.828" />
        </svg>
    ),
    search: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
    chevronUp: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
    ),
    chevronDown: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    ),
    highlight: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" /><path d="M12 2v4" /><path d="M16 2v4" />
            <rect width="16" height="18" x="4" y="4" rx="2" />
            <path d="M8 10h6" /><path d="M8 14h8" /><path d="M8 18h5" />
        </svg>
    ),
    save: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
        </svg>
    ),
    thumbnails: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
        </svg>
    ),
    textAdd: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V4h16v3M12 4v16M9 20h6" />
        </svg>
    ),
    highlightBrush: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v2" /><path d="M14 2v4" />
            <path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z" />
            <path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1" />
        </svg>
    ),
    book: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="9" y1="7" x2="15" y2="7" />
            <line x1="9" y1="11" x2="15" y2="11" />
        </svg>
    ),
    bookmark: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    ),
    bookmarkFilled: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    ),
    stickyNote: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
            <path d="M15 3v6h6" />
            <path d="M8 13h8M8 17h5" />
        </svg>
    ),
    pageJump: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
    ),
    undo: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M3 13C5.5 7.5 12 5 18 8" />
        </svg>
    ),
    redo: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M21 13C18.5 7.5 12 5 6 8" />
        </svg>
    ),
    pdfConnect: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="5" r="2" />
            <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" strokeDasharray="3 2" />
        </svg>
    ),
};

export default function Navbar() {
    const {
        pdfId,
        searchText, setSearchText,
        searchMatches,
        currentMatchIndex, setCurrentMatchIndex,
        tool, setTool,
        TOOL_MODES,
        savingWorkspace, savingPdf,
        autosaveInterval, setAutosaveInterval,
        handleGlobalSave,
        pdfRef,
        pdfDrawingColor, setPdfDrawingColor,
        penSize, setPenSize,
        handleUndo, handleRedo, canUndo, canRedo,
        // PDF tools
        zoomLevel, setZoomLevel,
        showThumbnails, setShowThumbnails,
        showPageJump, setShowPageJump,
        highlightBrushColor, setHighlightBrushColor,
        // Annotations sidebar toggle
        showHighlightsList, setShowHighlightsList,
        // Summary
        showSummary, setShowSummary,
        summary, summaryLoading,
        handleSummarizePdf,
        // Bookmarks
        bookmarks, showBookmarks, setShowBookmarks,
        handleAddBookmark,
        // Color picker toggles
        showPenColors, setShowPenColors,
        showHighlighterColors, setShowHighlighterColors,
    } = useApp();

    const saving = savingWorkspace || savingPdf;

    const onNextMatch = () => setCurrentMatchIndex(prev => (searchMatches.length ? (prev + 1) % searchMatches.length : -1));
    const onPrevMatch = () => setCurrentMatchIndex(prev => (searchMatches.length ? (prev - 1 + searchMatches.length) % searchMatches.length : -1));

    return (
        <>
        <div className="main-navbar">

            {/* ── LEFT: PDF Search ── */}
            <div className="navbar-left">
                <div className="search-container">
                    <div className="search-icon">{icons.search}</div>
                    <input
                        type="text"
                        placeholder="Search in PDF..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    {searchText && (
                        <div className="search-controls">
                            <span className="match-count">
                                {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : "0/0"}
                            </span>
                            <button onClick={onPrevMatch} disabled={searchMatches.length === 0} className="match-nav-btn">{icons.chevronUp}</button>
                            <button onClick={onNextMatch} disabled={searchMatches.length === 0} className="match-nav-btn">{icons.chevronDown}</button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── CENTER: All Tools ── */}
            <div className="navbar-center">

                {/* PDF Tools Group */}
                <div className="tool-group" style={{ gap: 2 }}>
                    {/* Zoom controls */}
                    <button className="tool-btn" onClick={() => setZoomLevel(prev => Math.max(0.3, parseFloat((prev - 0.15).toFixed(2))))} title="Zoom Out PDF (-)">
                        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>−</span>
                    </button>
                    <span className="zoom-display">{Math.round((zoomLevel || 1) * 100)}%</span>
                    <button className="tool-btn" onClick={() => setZoomLevel(prev => Math.min(3, parseFloat((prev + 0.15).toFixed(2))))} title="Zoom In PDF (+)">
                        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>+</span>
                    </button>

                    <div className="navbar-section-divider" />

                    {/* Page Jump — inline input in navbar (no modal, no spinners) */}
                    {showPageJump ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 4px",
                            background: "#eff6ff", borderRadius: 8, border: "2px solid #2563eb", height: 30 }}>
                            <input
                                autoFocus
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                defaultValue={pdfRef.current?.getCurrentPageNum?.() || 1}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const p = parseInt(e.target.value, 10);
                                        const total = pdfRef.current?.pdfDoc?.numPages || 9999;
                                        if (!isNaN(p) && p >= 1 && p <= total) {
                                            pdfRef.current?.scrollToPage(p);
                                        }
                                        setShowPageJump(false);
                                    }
                                    if (e.key === "Escape") setShowPageJump(false);
                                }}
                                onBlur={() => setShowPageJump(false)}
                                onFocus={(e) => e.target.select()}
                                style={{
                                    width: 36, textAlign: "center", fontSize: 13, fontWeight: 700,
                                    border: "none", outline: "none", background: "transparent",
                                    color: "#1d4ed8", padding: 0,
                                }}
                            />
                            <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 500, userSelect: "none" }}>
                                / {pdfRef.current?.pdfDoc?.numPages || "?"}
                            </span>
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setShowPageJump(false)}
                                style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "#93c5fd", fontSize: 16, lineHeight: 1, padding: "0 2px",
                                    display: "flex", alignItems: "center",
                                }}
                            >×</button>
                        </div>
                    ) : (
                        <button
                            className="tool-btn"
                            onClick={() => setShowPageJump(true)}
                            title="Jump to Page"
                        >{icons.pageJump}</button>
                    )}

                    {/* Thumbnails */}
                    <button
                        className={`tool-btn ${showThumbnails ? "active" : ""}`}
                        onClick={() => setShowThumbnails(!showThumbnails)}
                        title="PDF Thumbnails"
                    >{icons.thumbnails}</button>

                    {/* Add PDF Text */}
                    <button
                        className="tool-btn"
                        onClick={() => pdfRef.current?.addPdfText()}
                        title="Add Text to PDF"
                    >{icons.textAdd}</button>

                    {/* Sticky Note */}
                    <button
                        className={`tool-btn ${tool === TOOL_MODES.STICKY_NOTE ? "active" : ""}`}
                        onClick={() => setTool(prev => prev === TOOL_MODES.STICKY_NOTE ? TOOL_MODES.SELECT : TOOL_MODES.STICKY_NOTE)}
                        title="Sticky Note — click on PDF to place"
                        style={tool === TOOL_MODES.STICKY_NOTE ? { background: '#fff9c4', color: '#f9a825' } : {}}
                    >{icons.stickyNote}</button>

                    {/* Highlight Brush + color picker */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className={`tool-btn ${tool === TOOL_MODES.HIGHLIGHT_BRUSH ? "active" : ""}`}
                            onClick={() => {
                                if (tool === TOOL_MODES.HIGHLIGHT_BRUSH) {
                                    setShowHighlighterColors(!showHighlighterColors);
                                } else {
                                    setTool(TOOL_MODES.HIGHLIGHT_BRUSH);
                                    setShowHighlighterColors(true);
                                }
                                setShowPenColors(false);
                            }}
                            title="Highlight Brush"
                        ><i className="bi bi-highlighter" style={{ fontSize: 16 }} /></button>
                        {(tool === TOOL_MODES.HIGHLIGHT_BRUSH && showHighlighterColors) && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, marginTop: 6,
                                display: 'flex', gap: 6, background: 'white',
                                padding: '6px 8px', borderRadius: 20,
                                border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                zIndex: 500,
                            }}>
                                {['#FFEB3B', '#4CAF50', '#FF4081', '#2196F3', '#FF9800'].map(color => (
                                    <div key={color} onClick={() => {
                                        setHighlightBrushColor(color);
                                        setShowHighlighterColors(false);
                                    }} style={{
                                        width: 16, height: 16, borderRadius: '50%', backgroundColor: color,
                                        cursor: 'pointer',
                                        border: highlightBrushColor === color ? '2px solid #555' : '1px solid #ddd',
                                        transform: highlightBrushColor === color ? 'scale(1.2)' : 'none',
                                        transition: 'transform 0.15s',
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Divider between PDF and Workspace tools */}
                <div className="navbar-section-divider" style={{ height: 28, margin: '0 10px' }} />

                {/* Workspace Tools Group */}
                <div className="tool-group" style={{ marginRight: 6, paddingRight: 6, borderRight: '1px solid #eee' }}>
                    <button className="tool-btn" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.35 }}>{icons.undo}</button>
                    <button className="tool-btn" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ opacity: canRedo ? 1 : 0.35 }}>{icons.redo}</button>
                </div>
                <div className="tool-group">
                    <button className={`tool-btn ${tool === TOOL_MODES.SELECT ? "active" : ""}`} onClick={() => setTool(TOOL_MODES.SELECT)} title="Select">{icons.select}</button>
                    {/* <button className={`tool-btn ${tool === TOOL_MODES.DRAW_LINE ? "active" : ""}`} onClick={() => setTool(TOOL_MODES.DRAW_LINE)} title="Connect Notes (workspace)">{icons.connection}</button> */}
                    <button className={`tool-btn ${tool === TOOL_MODES.PDF_CONNECT ? "active" : ""}`} onClick={() => setTool(TOOL_MODES.PDF_CONNECT)} title="PDF Connect Line (click two points in PDF)">{icons.pdfConnect}</button>
                    <button className={`tool-btn ${tool === TOOL_MODES.ADD_BOX ? "active" : ""}`} onClick={() => setTool(TOOL_MODES.ADD_BOX)} title="Add Text Box">{icons.textBox}</button>

                    {/* Pen tool + floating color picker (same popover pattern as HIGHLIGHT_BRUSH) */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            className={`tool-btn ${tool === TOOL_MODES.PEN ? "active" : ""}`} 
                            onClick={() => {
                                if (tool === TOOL_MODES.PEN) {
                                    setShowPenColors(!showPenColors);
                                } else {
                                    setTool(TOOL_MODES.PEN);
                                    setShowPenColors(true);
                                }
                                setShowHighlighterColors(false);
                            }} 
                            title="Pen"
                        >{icons.pen}</button>
                        {(tool === TOOL_MODES.PEN && showPenColors) && (
                            <div style={{
                                position: 'absolute', top: '100%', left: '50%',
                                transform: 'translateX(-50%)',
                                marginTop: 6,
                                display: 'flex', flexDirection: 'column', gap: 8, background: 'white',
                                padding: '8px 12px', borderRadius: 14,
                                border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                zIndex: 600,
                                whiteSpace: 'nowrap',
                            }}>
                                {/* Colors row */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {['#000000', '#ff3b30', '#007aff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#5856d6', '#8e8e93', '#000080'].map(color => (
                                        <div key={color} onClick={() => { setPdfDrawingColor(color); }} style={{
                                            width: 18, height: 18, borderRadius: '50%', backgroundColor: color,
                                            cursor: 'pointer',
                                            border: pdfDrawingColor === color ? '2px solid #333' : '1.5px solid #ddd',
                                            transform: pdfDrawingColor === color ? 'scale(1.25)' : 'none',
                                            transition: 'transform 0.15s',
                                            flexShrink: 0,
                                        }} />
                                    ))}
                                </div>
                                {/* Thickness row */}
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', paddingTop: 2, borderTop: '1px solid #f0f0f0' }}>
                                    {[{ size: 2, label: 'S' }, { size: 4, label: 'M' }, { size: 8, label: 'L' }, { size: 14, label: 'XL' }].map(({ size, label }) => (
                                        <div key={size} onClick={() => setPenSize(size)} title={`Size ${label}`} style={{
                                            width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: penSize === size ? '#e8f0fe' : 'transparent',
                                            border: penSize === size ? '1.5px solid #4a90e2' : '1.5px solid #ddd',
                                        }}>
                                            <div style={{
                                                width: Math.min(size * 2, 20), height: Math.min(size * 2, 20),
                                                borderRadius: '50%', background: pdfDrawingColor,
                                            }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button className={`tool-btn ${tool === TOOL_MODES.ERASER ? "active" : ""}`} onClick={() => setTool(TOOL_MODES.ERASER)} title="Eraser">{icons.eraser}</button>
                </div>
            </div>

            {/* ── RIGHT: Annotations + Save ── */}
            <div className="navbar-right">
                {/* Bookmark current page */}
                <button
                    className={`tool-btn ${showBookmarks ? "active" : ""}`}
                    onClick={() => {
                        const pageNum = pdfRef.current?.getCurrentPageNum?.() || 1;
                        handleAddBookmark(pageNum, `Page ${pageNum}`);
                        setShowBookmarks(true);
                    }}
                    title="Bookmark current page"
                    style={{ marginRight: 2, color: bookmarks.some(b => b.page_num === (pdfRef.current?.getCurrentPageNum?.() || 1)) ? '#f59e0b' : undefined }}
                >{icons.bookmark}</button>

                {/* Bookmarks list toggle */}
                <button
                    className={`tool-btn ${showBookmarks ? "active" : ""}`}
                    onClick={() => setShowBookmarks(!showBookmarks)}
                    title="Show Bookmarks"
                    style={{ marginRight: 4, fontSize: 11, fontWeight: 600, padding: '0 8px', minWidth: 28 }}
                >
                    {bookmarks.length > 0 ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{bookmarks.length}</span> : icons.bookmarkFilled}
                </button>

                {/* PDF Summary button */}
                <button
                    className={`tool-btn ${showSummary ? "active" : ""}`}
                    onClick={handleSummarizePdf}
                    title="Summarize PDF"
                    style={{ marginRight: 4 }}
                    disabled={summaryLoading}
                >{icons.book}</button>

                {/* Annotations toggle — opens the right-side sidebar */}
                <button
                    className={`tool-btn ${showHighlightsList ? "active" : ""}`}
                    onClick={() => setShowHighlightsList(!showHighlightsList)}
                    title="All Annotations"
                    style={{ marginRight: 4 }}
                >{icons.highlight}</button>

                {/* Autosave + Save */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f5f5f5', padding: '2px 3px', borderRadius: 6, border: '1px solid #ddd' }}>
                    <select
                        value={autosaveInterval}
                        onChange={(e) => setAutosaveInterval(parseInt(e.target.value))}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, color: '#666', padding: '2px 2px 2px 4px', cursor: 'pointer', outline: 'none', fontWeight: 500, maxWidth: 62 }}
                        title="Autosave Interval"
                    >
                        <option value={0}>Off</option>
                        <option value={3000}>3s</option>
                        <option value={30000}>30s</option>
                        <option value={60000}>1m</option>
                        <option value={300000}>5m</option>
                        <option value={600000}>10m</option>
                    </select>
                    <button
                        className={`save-btn ${saving ? "saving" : ""}`}
                        onClick={handleGlobalSave}
                        disabled={saving || !pdfId}
                        title={saving ? "Saving..." : "Save (Ctrl+S)"}
                        style={{ margin: 0, border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, height: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                        {icons.save}
                        <span>{saving ? "..." : "Save"}</span>
                    </button>
                </div>
            </div>
        </div>

            {/* ── PDF Summary Modal ── */}
            {showSummary && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setShowSummary(false)}>
                    <div style={{
                        background: '#fff', borderRadius: 12, padding: '28px 32px',
                        width: '660px', maxWidth: '90vw', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column', gap: 16,
                        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {icons.book}
                                <span style={{ fontSize: 17, fontWeight: 600, color: '#222' }}>Summary</span>
                            </div>
                            <button onClick={() => setShowSummary(false)} style={{
                                border: 'none', background: 'none', fontSize: 20,
                                cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px'
                            }}>×</button>
                        </div>

                        {/* Body */}
                        <div style={{
                            overflowY: 'auto', flex: 1, fontSize: 14, lineHeight: 1.45,
                            color: '#333', padding: '4px 0',
                            borderTop: '1px solid #eee', paddingTop: 16,
                            fontFamily: '"Times New Roman", Times, serif',
                        }}>
                            {summaryLoading ? (
                                <div style={{ textAlign: 'center', color: '#888', paddingTop: 40 }}>
                                    <div style={{ fontSize: 13 }}>Generating summary...</div>
                                </div>
                            ) : (
                                <div className="summary-body">
                                    <div
                                        className="workspace-rich-text"
                                        dangerouslySetInnerHTML={{ __html: toRichTextHtml(preprocessSummary(summary)) }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
