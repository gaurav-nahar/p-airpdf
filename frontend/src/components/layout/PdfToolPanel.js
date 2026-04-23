import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";

// Relevant icons for PDF tools
const icons = {
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
            <path d="M10 2v2" />
            <path d="M14 2v4" />
            <path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z" />
            <path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1" />
        </svg>
    ),
    stickyNote: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
    dragHandle: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
        </svg>
    )
};

export default function PdfToolPanel() {
    const {
        tool, setTool,
        TOOL_MODES,
        showThumbnails, setShowThumbnails,
        showPageJump, setShowPageJump,
        pdfRef,
        highlightBrushColor, setHighlightBrushColor,
        zoomLevel, setZoomLevel,
    } = useApp();

    const onAddPdfText = () => pdfRef.current?.addPdfText();
    const onHighlightBrushColorChange = setHighlightBrushColor;

    const onToggleThumbnails = () => setShowThumbnails(!showThumbnails);
    const onTogglePageJump = () => setShowPageJump(!showPageJump);

    const [position, setPosition] = useState({ top: 250, left: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const panelRef = useRef(null);

    const handleMouseDown = (e) => {
        if (e.target.closest('.drag-handle')) {
            setIsDragging(true);
            dragStartPos.current = {
                x: e.clientX - position.left,
                y: e.clientY - position.top
            };
            e.preventDefault();
        }
    };

    const handleTouchStart = (e) => {
        if (e.target.closest('.drag-handle')) {
            const touch = e.touches[0];
            setIsDragging(true);
            dragStartPos.current = {
                x: touch.clientX - position.left,
                y: touch.clientY - position.top
            };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const newLeft = e.clientX - dragStartPos.current.x;
            const newTop = e.clientY - dragStartPos.current.y;

            // Optional: Boundary checks can be added here
            setPosition({
                left: newLeft,
                top: newTop
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        const handleTouchMove = (e) => {
            if (!isDragging || e.touches.length === 0) return;
            const touch = e.touches[0];
            const newLeft = touch.clientX - dragStartPos.current.x;
            const newTop = touch.clientY - dragStartPos.current.y;

            setPosition({
                left: newLeft,
                top: newTop
            });
            // Prevent scrolling while dragging
            if (e.cancelable) e.preventDefault();
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging]);

    return (
        <div
            ref={panelRef}
            className="draggable-pdf-panel"
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                left: `${position.left}px`,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px 4px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(5px)',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                userSelect: 'none',
                pointerEvents: 'none'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            <div className="drag-handle" style={{ cursor: 'move', color: '#888', display: 'flex', justifyContent: 'center', padding: '2px 0', pointerEvents: 'auto' }}>
                {icons.dragHandle}
            </div>

            {/* PDF Zoom Controls */}
            <button
                onClick={() => setZoomLevel(prev => Math.min(3, parseFloat((prev + 0.15).toFixed(2))))}
                title="Zoom In PDF"
                style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: "6px", background: "transparent", color: "#555", cursor: "pointer", fontSize: 16, fontWeight: 700, pointerEvents: 'auto' }}
            >+</button>
            <div style={{ fontSize: 10, color: '#666', textAlign: 'center', pointerEvents: 'none', fontWeight: 600 }}>
                {Math.round((zoomLevel || 1) * 100)}%
            </div>
            <button
                onClick={() => setZoomLevel(prev => Math.max(0.3, parseFloat((prev - 0.15).toFixed(2))))}
                title="Zoom Out PDF"
                style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: "6px", background: "transparent", color: "#555", cursor: "pointer", fontSize: 16, fontWeight: 700, pointerEvents: 'auto' }}
            >−</button>
            <div style={{ borderTop: '1px solid #eee', margin: '2px 0' }} />

            <button
                className={`panel-btn ${showPageJump ? "active" : ""}`}
                onClick={onTogglePageJump}
                title="Jump to Page"
                style={{
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "6px",
                    background: showPageJump ? "#e8f0fe" : "transparent",
                    color: showPageJump ? "#1a73e8" : "#555",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    pointerEvents: 'auto'
                }}
            >
                {icons.pageJump}
            </button>

            <button
                className={`panel-btn ${showThumbnails ? "active" : ""}`}
                onClick={onToggleThumbnails}
                title="Toggle PDF Thumbnails"
                style={{
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "6px",
                    background: showThumbnails ? "#e8f0fe" : "transparent",
                    color: showThumbnails ? "#1a73e8" : "#555",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    pointerEvents: 'auto'
                }}
            >
                {icons.thumbnails}
            </button>

            <button
                className="panel-btn"
                onClick={onAddPdfText}
                title="Add Text to PDF"
                style={{
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "6px",
                    background: "transparent",
                    color: "#555",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    pointerEvents: 'auto'
                }}
            >
                {icons.textAdd}
            </button>

            <button
                className={`panel-btn ${tool === TOOL_MODES.STICKY_NOTE ? "active" : ""}`}
                onClick={() => setTool(prev => prev === TOOL_MODES.STICKY_NOTE ? null : TOOL_MODES.STICKY_NOTE)}
                title="Sticky Note — click on PDF to place"
                style={{
                    padding: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "6px",
                    background: tool === TOOL_MODES.STICKY_NOTE ? "#fff9c4" : "transparent",
                    color: tool === TOOL_MODES.STICKY_NOTE ? "#f9a825" : "#555",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    pointerEvents: 'auto',
                    outline: tool === TOOL_MODES.STICKY_NOTE ? "2px solid #f9a825" : "none",
                }}
            >
                {icons.stickyNote}
            </button>

            <div style={{ position: 'relative', pointerEvents: 'auto' }}>
                <button
                    className={`panel-btn ${tool === TOOL_MODES.HIGHLIGHT_BRUSH ? "active" : ""}`}
                    onClick={() =>
                        setTool(prev =>
                            prev === TOOL_MODES.HIGHLIGHT_BRUSH ? null : TOOL_MODES.HIGHLIGHT_BRUSH
                        )
                    }
                    title="Highlight Brush"
                    style={{
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        borderRadius: "6px",
                        background: tool === TOOL_MODES.HIGHLIGHT_BRUSH ? "#e8f0fe" : "transparent",
                        color: tool === TOOL_MODES.HIGHLIGHT_BRUSH ? "#1a73e8" : "#555",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        width: '100%',
                        pointerEvents: 'auto'
                    }}
                >
                    {icons.highlightBrush}
                </button>

                {tool === TOOL_MODES.HIGHLIGHT_BRUSH && (
                    <div className="vertical-color-picker" style={{
                        position: 'absolute',
                        left: '100%',
                        top: '0',
                        marginLeft: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        background: 'white',
                        padding: '6px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        {['#FFEB3B', '#4CAF50', '#FF4081', '#2196F3', '#FF9800'].map(color => (
                            <div
                                key={color}
                                onClick={() => onHighlightBrushColorChange(color)}
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    cursor: 'pointer',
                                    border: highlightBrushColor === color ? '2px solid #555' : '1px solid #ddd',
                                    transform: highlightBrushColor === color ? 'scale(1.2)' : 'none'
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
