import React from "react";
import { useApp } from "../../context/AppContext";

/**
 * 🎨 useHighlightLogic
 * Custom hook to handle the creation of new highlights.
 */
export const useHighlightLogic = (containerRef, clearPopup) => {
    const { highlights, setHighlights, setIsDirty } = useApp();
    const handleHighlight = (color) => {
        const sel = containerRef.current._lastSelection;
        if (sel) {
            const newHighlight = {
                id: `temp-${Date.now()}`,
                pageNum: sel.pageNum,
                color: color,
                xPct: sel.xPct,
                yPct: sel.yPct,
                widthPct: sel.widthPct,
                heightPct: sel.heightPct,
                content: (sel.text || "").split(/\s+/).slice(0, 10).join(" ") + (sel.text && sel.text.split(/\s+/).length > 10 ? "..." : "")
            };

            window.dispatchEvent(new CustomEvent("add-comment-box", { detail: newHighlight }));
            setHighlights([...highlights, newHighlight]);
            if (setIsDirty) setIsDirty(true);
            clearPopup();
        }
    };

    return { handleHighlight };
};

/**
 * 🎨 PDFTextHighlightLayer
 * Renders existing highlights for a specific page using React Portals.
 */
export const PDFTextHighlightLayer = React.memo(({ pageNum }) => {
    const { highlights } = useApp();
    const pageHighlights = (highlights || []).filter(hl => hl.pageNum === pageNum);

    if (pageHighlights.length === 0) return null;

    return (
        <div className="pdf-highlight-layer" style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 2
        }}>
            {pageHighlights.map((hl) => (
                <div
                    key={hl.id}
                    className="pdf-highlight"
                    style={{
                        position: "absolute",
                        left: `${hl.xPct * 100}%`,
                        top: `${hl.yPct * 100}%`,
                        width: `${hl.widthPct * 100}%`,
                        height: `${hl.heightPct * 100}%`,
                        backgroundColor: hl.color || "rgba(255, 235, 59, 0.4)",
                        opacity: 0.4,
                        borderRadius: "2px"
                    }}
                />
            ))}
        </div>
    );
});