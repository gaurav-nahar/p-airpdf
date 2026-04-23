import { useState, useEffect, useRef, useCallback } from "react";

/**
 * PDFScrollMarker
 * Markers on the scrollbar track for bookmarks, highlights, and connection lines.
 * Each marker type has a delete (×) button on hover.
 *
 * Marker colors:
 *   Orange  — bookmarks
 *   Green   — highlight pages
 *   Blue    — connection line anchors
 */
const SCROLLBAR_W = 12; // must match App.css ::-webkit-scrollbar width

const PDFScrollMarker = ({
    bookmarks = [],
    highlights = [],
    pdfConnectionLines = [],
    containerRef,
    zoomContentRef,
    onDeleteBookmark,
    onDeleteLine,
}) => {
    const [, setTick] = useState(0);
    const [hoveredKey, setHoveredKey] = useState(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return;
        const onScroll = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => setTick(t => t + 1));
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            el.removeEventListener("scroll", onScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [containerRef]);

    const container = containerRef?.current;
    const content   = zoomContentRef?.current;
    const scrollH   = container?.scrollHeight || 0;

    const getYPct = useCallback((pageNum) => {
        if (!container || !content || !scrollH) return null;
        const pageEl = content.querySelector(`.pdf-page-wrapper[data-page-number="${pageNum}"]`);
        if (!pageEl) return null;
        const pRect = pageEl.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const absTop = pRect.top - cRect.top + container.scrollTop;
        return Math.max(2, Math.min(98, (absTop / scrollH) * 100));
    }, [content, container, scrollH]);

    if (!container || !content || !scrollH) return null;

    const scrollTo = (pageNum) => {
        const pageEl = content.querySelector(`.pdf-page-wrapper[data-page-number="${pageNum}"]`);
        if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Dedupe highlight pages
    const highlightPages = [...new Set(highlights.map(h => h.pageNum).filter(Boolean))];

    // Connection line unique page anchors
    const lineAnchors = [];
    pdfConnectionLines.forEach(line => {
        if (line.from?.pageNum) lineAnchors.push({ lineId: line.id, pageNum: line.from.pageNum, side: "from" });
        if (line.to?.pageNum   && line.to.pageNum !== line.from?.pageNum)
            lineAnchors.push({ lineId: line.id, pageNum: line.to.pageNum, side: "to" });
    });

    const hasAny = bookmarks.length || highlightPages.length || lineAnchors.length;
    if (!hasAny) return null;

    const Marker = ({ mKey, pct, color, height, label, onDelete, children }) => {
        const isHovered = hoveredKey === mKey;
        return (
            <div
                onMouseEnter={() => setHoveredKey(mKey)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                    position: "absolute", left: 0, right: 0,
                    top: `${pct}%`, transform: "translateY(-50%)",
                    height, background: color,
                    borderRadius: 2,
                    cursor: "pointer",
                    pointerEvents: "auto",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                    transition: "height 0.1s",
                }}
                onClick={(e) => { e.stopPropagation(); scrollTo(children); }}
            >
                {/* Tooltip + delete button on hover */}
                {isHovered && (
                    <div style={{
                        position: "absolute", right: SCROLLBAR_W + 2, top: "50%",
                        transform: "translateY(-50%)",
                        display: "flex", alignItems: "center", gap: 4,
                        background: "rgba(20,20,20,0.88)", color: "#fff",
                        fontSize: 11, padding: "3px 7px", borderRadius: 4,
                        whiteSpace: "nowrap", pointerEvents: "auto",
                        zIndex: 10,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}>
                        <span>{label}</span>
                        {onDelete && (
                            <span
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                style={{
                                    marginLeft: 4, cursor: "pointer",
                                    fontWeight: 700, fontSize: 13, lineHeight: 1,
                                    color: "#ff6b6b",
                                    padding: "0 2px",
                                }}
                                title="Delete"
                            >×</span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: "absolute",
            right: 0, top: 8, bottom: 0,
            width: SCROLLBAR_W,
            zIndex: 600,
            pointerEvents: "none",
        }}>
            {/* Green — highlight pages */}
            {highlightPages.map(pageNum => {
                const pct = getYPct(pageNum);
                if (pct === null) return null;
                return (
                    <Marker
                        key={`hl-${pageNum}`}
                        mKey={`hl-${pageNum}`}
                        pct={pct} color="#43a047" height={4}
                        label={`Highlight · p${pageNum}`}
                    >{pageNum}</Marker>
                );
            })}

            {/* Orange — bookmarks */}
            {bookmarks.map(bm => {
                const pct = getYPct(bm.page_num);
                if (pct === null) return null;
                const label = bm.label || bm.name || `Page ${bm.page_num}`;
                return (
                    <Marker
                        key={`bm-${bm.id}`}
                        mKey={`bm-${bm.id}`}
                        pct={pct} color="#f5a623" height={6}
                        label={`🔖 ${label}`}
                        onDelete={onDeleteBookmark ? () => onDeleteBookmark(bm.id) : null}
                    >{bm.page_num}</Marker>
                );
            })}

            {/* Blue — connection line anchors */}
            {lineAnchors.map((anchor, i) => {
                const pct = getYPct(anchor.pageNum);
                if (pct === null) return null;
                return (
                    <Marker
                        key={`ln-${anchor.lineId}-${anchor.side}`}
                        mKey={`ln-${anchor.lineId}-${anchor.side}`}
                        pct={pct} color="#1e88e5" height={5}
                        label={`Link · p${anchor.pageNum}`}
                        onDelete={onDeleteLine ? () => onDeleteLine(anchor.lineId) : null}
                    >{anchor.pageNum}</Marker>
                );
            })}
        </div>
    );
};

export default PDFScrollMarker;
