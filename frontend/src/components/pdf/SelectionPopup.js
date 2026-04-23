import React, { useState } from "react";

const SelectionPopup = ({ position, onSelectMore, onLink, onClose, showSelectMore, onHighlight, onBookmark, onConnectPdf, hasPendingCrossLink, onDragWireStart }) => {
    const dragStartedRef = React.useRef(false);
    const dragPointerRef = React.useRef(null);
    const colors = [
        { hex: "#FFD60A", name: "Yellow" },
        { hex: "#32D74B", name: "Green" },
        { hex: "#0A84FF", name: "Blue" },
        { hex: "#FF375F", name: "Pink" },
        { hex: "#FF9F0A", name: "Orange" }
    ];

    const [hoveredColor, setHoveredColor] = useState(null);
    const [hoveredBtn, setHoveredBtn] = useState(null);
    const [bookmarked, setBookmarked] = useState(false);
    const [bookmarkSaving, setBookmarkSaving] = useState(false);

    React.useEffect(() => {
        return () => {
            dragPointerRef.current?.cleanup?.();
            dragPointerRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        setBookmarked(false);
        setBookmarkSaving(false);
    }, [position.x, position.y]);

    const handleBookmark = async () => {
        if (bookmarked || bookmarkSaving) return;
        setBookmarkSaving(true);
        try {
            await onBookmark?.();
            setBookmarked(true);
            setTimeout(onClose, 600);
        } catch (err) {
            console.error("Bookmark save failed:", err);
        } finally {
            setBookmarkSaving(false);
        }
    };

    const btnBase = {
        background: "transparent",
        border: "none",
        padding: "3px 7px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: "500",
        transition: "all 0.15s ease",
        display: "flex",
        alignItems: "center",
        gap: "3px",
        whiteSpace: "nowrap",
        lineHeight: 1,
    };

    return (
        <div
            className="selection-popup"
            style={{
                left: position.x,
                top: position.y,
                display: "flex",
                alignItems: "center",
                flexWrap: "nowrap",
                gap: "4px",
                padding: "4px 8px",
                background: "rgba(28,28,32,0.95)",
                backdropFilter: "blur(16px) saturate(180%)",
                WebkitBackdropFilter: "blur(16px) saturate(180%)",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.18)",
                zIndex: 1000,
                position: "absolute",
                transform: "translateX(-50%)",
                animation: "popupFadeIn 0.14s cubic-bezier(0.4,0,0.2,1)",
                maxWidth: "min(380px, 92vw)",
                boxSizing: "border-box",
            }}
        >
            {/* Highlight color dots */}
            <div style={{
                display: "flex", gap: "4px", paddingRight: "6px",
                borderRight: "1px solid rgba(255,255,255,0.12)", alignItems: "center",
                flexShrink: 0,
            }}>
                {colors.map((color) => (
                    <div
                        key={color.hex}
                        onClick={() => onHighlight(color.hex)}
                        onMouseEnter={() => setHoveredColor(color.hex)}
                        onMouseLeave={() => setHoveredColor(null)}
                        title={`Highlight ${color.name}`}
                        style={{
                            width: hoveredColor === color.hex ? "13px" : "10px",
                            height: hoveredColor === color.hex ? "13px" : "10px",
                            borderRadius: "50%",
                            backgroundColor: color.hex,
                            cursor: "pointer",
                            border: "1.5px solid rgba(255,255,255,0.25)",
                            boxShadow: hoveredColor === color.hex ? `0 0 0 2px ${color.hex}60` : "none",
                            transition: "all 0.12s ease",
                        }}
                    />
                ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "1px", alignItems: "center", flexShrink: 0 }}>
                {showSelectMore && (
                    <button
                        onClick={onSelectMore}
                        onMouseEnter={() => setHoveredBtn("more")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{
                            ...btnBase,
                            color: "rgba(255,255,255,0.8)",
                            backgroundColor: hoveredBtn === "more" ? "rgba(255,255,255,0.1)" : "transparent",
                        }}
                    >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        More
                    </button>
                )}

                {/* Bookmark */}
                <button
                    onClick={handleBookmark}
                    onMouseEnter={() => setHoveredBtn("bm")}
                    onMouseLeave={() => setHoveredBtn(null)}
                    title="Bookmark this selection"
                    disabled={bookmarkSaving}
                    style={{
                        ...btnBase,
                        color: bookmarked ? "#FFD60A" : "rgba(255,255,255,0.8)",
                        backgroundColor: hoveredBtn === "bm" ? "rgba(255,214,10,0.15)" : "transparent",
                        opacity: bookmarkSaving ? 0.65 : 1,
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 24 24"
                        fill={bookmarked ? "#FFD60A" : "none"}
                        stroke={bookmarked ? "#FFD60A" : "currentColor"}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    {bookmarked ? "Saved!" : (bookmarkSaving ? "Saving…" : "Bookmark")}
                </button>

                {/* Link to Box */}
                <button
                    onClick={onLink}
                    onMouseEnter={() => setHoveredBtn("link")}
                    onMouseLeave={() => setHoveredBtn(null)}
                    style={{
                        ...btnBase,
                        background: hoveredBtn === "link" ? "#0071e3" : "#007aff",
                        color: "white",
                        fontWeight: "600",
                        padding: "3px 9px",
                        boxShadow: hoveredBtn === "link" ? "0 2px 8px rgba(0,122,255,0.4)" : "none",
                    }}
                >
                    Link to Box
                </button>

                {/* Connect PDF */}
                {onConnectPdf && (
                    <button
                        onClick={(e) => {
                            if (dragStartedRef.current) {
                                dragStartedRef.current = false;
                                return;
                            }
                            onConnectPdf(e);
                        }}
                        onMouseEnter={() => setHoveredBtn("xpdf")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onPointerDown={(e) => {
                            if (onDragWireStart && !hasPendingCrossLink) {
                                dragStartedRef.current = false;
                                const startX = e.clientX;
                                const startY = e.clientY;
                                const btn = e.currentTarget;
                                btn.setPointerCapture(e.pointerId);

                                const onMove = (moveEvent) => {
                                    const dx = moveEvent.clientX - startX;
                                    const dy = moveEvent.clientY - startY;
                                    if (!dragStartedRef.current && Math.hypot(dx, dy) >= 6) {
                                        dragStartedRef.current = true;
                                        onDragWireStart(startX, startY);
                                    }
                                };

                                const onUp = () => {
                                    btn.removeEventListener("pointermove", onMove);
                                    btn.removeEventListener("pointerup", onUp);
                                    btn.removeEventListener("pointercancel", onUp);
                                    dragPointerRef.current = null;
                                };

                                dragPointerRef.current = {
                                    cleanup: () => {
                                        btn.removeEventListener("pointermove", onMove);
                                        btn.removeEventListener("pointerup", onUp);
                                        btn.removeEventListener("pointercancel", onUp);
                                    },
                                };

                                btn.addEventListener("pointermove", onMove);
                                btn.addEventListener("pointerup", onUp);
                                btn.addEventListener("pointercancel", onUp);
                                e.stopPropagation();
                            }
                        }}
                        title={hasPendingCrossLink
                            ? "Complete the cross-PDF connection"
                            : "Click to link step-by-step · Drag to the other PDF to connect instantly"}
                        style={{
                            ...btnBase,
                            background: hasPendingCrossLink
                                ? (hoveredBtn === "xpdf" ? "#059669" : "#10b981")
                                : (hoveredBtn === "xpdf" ? "rgba(255,255,255,0.15)" : "transparent"),
                            color: hasPendingCrossLink ? "white" : "rgba(255,255,255,0.85)",
                            fontWeight: hasPendingCrossLink ? "700" : "500",
                            border: hasPendingCrossLink ? "none" : "1px solid rgba(255,255,255,0.15)",
                            padding: "3px 8px",
                            boxShadow: hasPendingCrossLink && hoveredBtn === "xpdf" ? "0 2px 8px rgba(16,185,129,0.4)" : "none",
                            animation: hasPendingCrossLink ? "pulseGreen 1.4s ease-in-out infinite" : "none",
                            cursor: hasPendingCrossLink ? "pointer" : "grab",
                        }}
                    >
                        {hasPendingCrossLink ? "✓ Link Here" : "Connect PDF"}
                    </button>
                )}
            </div>

            {/* Close */}
            <button
                onClick={onClose}
                onMouseEnter={() => setHoveredBtn("x")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                    background: hoveredBtn === "x" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "none", width: "16px", height: "16px", borderRadius: "50%",
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "10px", transition: "all 0.15s ease",
                    flexShrink: 0, padding: 0,
                }}
            >✕</button>

            <style>{`
                @keyframes popupFadeIn {
                    from { opacity: 0; transform: translateX(-50%) scale(0.92); }
                    to   { opacity: 1; transform: translateX(-50%) scale(1); }
                }
                @keyframes pulseGreen {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
                    50%       { box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
                }
                .selection-popup {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
            `}</style>
        </div>
    );
};

export default SelectionPopup;
