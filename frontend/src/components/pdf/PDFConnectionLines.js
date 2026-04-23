import { useState, useEffect, useCallback } from "react";

/**
 * PDFConnectionLines
 * - Default: only anchor dots are visible (dots on both ends of each line)
 * - Click a dot: line appears + PDF scrolls to show the other anchor
 * - Click elsewhere: line hides again
 * - externalActiveId: activates a line from outside (e.g. sidebar click)
 */
const PDFConnectionLines = ({ lines = [], drawingLine = null, getAnchorScreenPos, containerRef, externalActiveId = null }) => {
    const [activeLineId, setActiveLineId] = useState(null);

    // Sync external activation (sidebar click)
    useEffect(() => {
        if (!externalActiveId) return;
        setActiveLineId(externalActiveId);
    }, [externalActiveId]);
    const [, setTick] = useState(0);

    // Re-render when PDF scrolls so dots track page positions
    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return;
        const onScroll = () => setTick(t => t + 1);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [containerRef]);

    // Click outside any dot → hide active line
    useEffect(() => {
        if (!activeLineId) return;
        const handler = () => setActiveLineId(null);
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [activeLineId]);

    const scrollAnchorIntoView = useCallback((anchor) => {
        const container = containerRef?.current;
        if (!container || !anchor) return;
        const pageEl = container.querySelector(`.pdf-page-wrapper[data-page-number="${anchor.pageNum}"]`);
        if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [containerRef]);

    const handleDotClick = useCallback((e, line, otherAnchor) => {
        e.stopPropagation();
        if (activeLineId === line.id) {
            setActiveLineId(null);
        } else {
            setActiveLineId(line.id);
            scrollAnchorIntoView(otherAnchor);
        }
    }, [activeLineId, scrollAnchorIntoView]);

    const containerEl = containerRef?.current;
    if (!containerEl) return null;
    const cRect = containerEl.getBoundingClientRect();

    const toLocal = (screenPt) => {
        if (!screenPt) return null;
        return { x: screenPt.x - cRect.left, y: screenPt.y - cRect.top };
    };

    const anchorToLocal = (anchor) => toLocal(getAnchorScreenPos(anchor.pageNum, anchor.xPct, anchor.yPct));

    const hasContent = lines.length > 0 || drawingLine;
    if (!hasContent) return null;

    return (
        <svg
            style={{
                position: "absolute", top: 0, left: 0,
                width: "100%", height: "100%",
                pointerEvents: "none",   // SVG itself passes clicks through
                zIndex: 500,
                overflow: "visible",
            }}
        >
            {lines.map((line) => {
                const from = anchorToLocal(line.from);
                const to   = anchorToLocal(line.to);
                if (!from || !to) return null;
                const isActive = activeLineId === line.id;
                const c = line.color || "#e53935";

                return (
                    <g key={line.id}>
                        {/* Line — only visible when active */}
                        {isActive && (
                            <>
                                {/* Shadow */}
                                <line
                                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                    stroke="rgba(0,0,0,0.15)" strokeWidth={7} strokeLinecap="round"
                                />
                                {/* Main line */}
                                <line
                                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                    stroke={c} strokeWidth={3} strokeLinecap="round"
                                />
                            </>
                        )}

                        {/* FROM dot — always visible, clickable */}
                        <circle
                            cx={from.x} cy={from.y} r={isActive ? 9 : 5}
                            fill={c} opacity={isActive ? 1 : 0.75}
                            stroke="white" strokeWidth={2}
                            style={{ pointerEvents: "auto", cursor: "pointer" }}
                            onMouseDown={(e) => handleDotClick(e, line, line.to)}
                        />

                        {/* TO dot — always visible, clickable */}
                        <circle
                            cx={to.x} cy={to.y} r={isActive ? 9 : 5}
                            fill={c} opacity={isActive ? 1 : 0.75}
                            stroke="white" strokeWidth={2}
                            style={{ pointerEvents: "auto", cursor: "pointer" }}
                            onMouseDown={(e) => handleDotClick(e, line, line.from)}
                        />

                        {/* Page number badge on dots when active */}
                        {isActive && (
                            <>
                                {/* FROM label background pill */}
                                <rect x={from.x + 12} y={from.y - 18} width={52} height={18} rx={4}
                                    fill={c} style={{ pointerEvents: "none" }} />
                                <text x={from.x + 16} y={from.y - 5} fontSize="12" fill="white"
                                    fontWeight="bold" style={{ pointerEvents: "none" }}>
                                    Page {line.from.pageNum}
                                </text>
                                {/* TO label background pill */}
                                <rect x={to.x + 12} y={to.y - 18} width={52} height={18} rx={4}
                                    fill={c} style={{ pointerEvents: "none" }} />
                                <text x={to.x + 16} y={to.y - 5} fontSize="12" fill="white"
                                    fontWeight="bold" style={{ pointerEvents: "none" }}>
                                    Page {line.to.pageNum}
                                </text>
                            </>
                        )}
                    </g>
                );
            })}

            {/* Live preview while dragging */}
            {drawingLine && (() => {
                const from = toLocal(drawingLine.startScreen);
                const to   = toLocal(drawingLine.endScreen);
                if (!from || !to) return null;
                return (
                    <g>
                        <line
                            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                            stroke={drawingLine.color || "#e53935"}
                            strokeWidth={2} strokeDasharray="8 4"
                            strokeLinecap="round" opacity={0.8}
                        />
                        <circle cx={from.x} cy={from.y} r={5}
                            fill={drawingLine.color || "#e53935"}
                            stroke="white" strokeWidth={1.5}
                        />
                    </g>
                );
            })()}
        </svg>
    );
};

export default PDFConnectionLines;
