import React, { useMemo, memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const getVal = (val, def) => { const n = parseFloat(val); return (isNaN(n) || !isFinite(n)) ? def : n; };

// Cubic bezier path between two points with horizontal control arms
function bezierPath(x1, y1, x2, y2) {
    const cx = Math.max(60, Math.abs(x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
}

const ConnectionLines = memo(({ snippets, editableBoxes, connections, pdfColorMap = {}, onDeleteConnection }) => {
    const [hoveredId, setHoveredId] = useState(null);

    const itemsMap = useMemo(() => {
        const map = new Map();
        snippets.forEach(s => map.set(String(s.id), s));
        editableBoxes.forEach(b => map.set(String(b.id), b));
        return map;
    }, [snippets, editableBoxes]);

    const rendered = useMemo(() => {
        const gradients = [];
        const lines = [];

        connections.forEach((conn, i) => {
            const { from, to } = conn;
            const fromNote = itemsMap.get(String(from));
            const toNote = itemsMap.get(String(to));
            if (!fromNote || !toNote) return;
            if (
                fromNote.type === "anchor" || toNote.type === "anchor" ||
                String(from).includes("anchor-") || String(to).includes("anchor-")
            ) return;

            const x1 = getVal(fromNote.x, 0) + getVal(fromNote.width, 180) / 2;
            const y1 = getVal(fromNote.y, 0) + getVal(fromNote.height, 60) / 2;
            const x2 = getVal(toNote.x, 0) + getVal(toNote.width, 180) / 2;
            const y2 = getVal(toNote.y, 0) + getVal(toNote.height, 60) / 2;

            const fromPdfId = String(fromNote.pdf_id || "");
            const toPdfId   = String(toNote.pdf_id   || "");
            const isCrossPdf = fromPdfId && toPdfId && fromPdfId !== toPdfId;

            const fromColor = pdfColorMap[fromPdfId]?.color || "#007bff";
            const toColor   = pdfColorMap[toPdfId]?.color   || "#007bff";
            const gradId    = `grad-${from}-${to}-${i}`;

            if (isCrossPdf) {
                gradients.push(
                    <linearGradient key={gradId} id={gradId} gradientUnits="userSpaceOnUse"
                        x1={x1} y1={y1} x2={x2} y2={y2}>
                        <stop offset="0%"   stopColor={fromColor} />
                        <stop offset="100%" stopColor={toColor} />
                    </linearGradient>
                );
            }

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const connId = conn.id || `${from}-${to}-${i}`;
            const d = bezierPath(x1, y1, x2, y2);

            lines.push({ connId, x1, y1, x2, y2, mx, my, d, isCrossPdf, gradId, fromColor });
        });

        return { gradients, lines };
    }, [connections, itemsMap, pdfColorMap]);

    return (
        <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", top: 0, left: 0, zIndex: 0, overflow: "visible" }}
        >
            <defs>{rendered.gradients}</defs>
            <AnimatePresence>
                {rendered.lines.map(({ connId, x1, y1, x2, y2, mx, my, d, isCrossPdf, gradId, fromColor }) => {
                    const isHov = hoveredId === connId;
                    return (
                        <g key={connId}>
                            {/* Animated bezier connection line */}
                            <motion.path
                                d={d}
                                stroke={isCrossPdf ? `url(#${gradId})` : "#007bff"}
                                strokeWidth={isHov ? 3.5 : 2.5}
                                strokeOpacity={isHov ? 1 : 0.85}
                                strokeDasharray={isCrossPdf ? "7 4" : "none"}
                                fill="none"
                                style={{ pointerEvents: "none" }}
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                exit={{ pathLength: 0, opacity: 0 }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                            />
                            {/* Wide invisible hit area */}
                            <path
                                d={d}
                                stroke="transparent"
                                strokeWidth={20}
                                fill="none"
                                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                                onMouseEnter={() => setHoveredId(connId)}
                                onMouseLeave={() => setHoveredId(null)}
                            />
                            {/* Cross-PDF label */}
                            {isCrossPdf && (
                                <>
                                    <text x={mx} y={my - 1} textAnchor="middle" fontSize="9"
                                        fill="white" stroke="white" strokeWidth="3" paintOrder="stroke"
                                        style={{ pointerEvents: "none", userSelect: "none" }}>
                                        PDF ↔ PDF
                                    </text>
                                    <text x={mx} y={my - 1} textAnchor="middle" fontSize="9"
                                        fill="#374151"
                                        style={{ pointerEvents: "none", userSelect: "none", fontWeight: 600 }}>
                                        PDF ↔ PDF
                                    </text>
                                </>
                            )}
                            {/* Delete × on hover */}
                            {isHov && onDeleteConnection && (
                                <g
                                    transform={`translate(${mx},${my + (isCrossPdf ? 12 : 0)})`}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => onDeleteConnection(connId)}
                                    onMouseEnter={() => setHoveredId(connId)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    <circle r={9} fill="#ef4444" stroke="white" strokeWidth={1.5} />
                                    <text textAnchor="middle" dominantBaseline="middle"
                                        fontSize="11" fontWeight="700" fill="white"
                                        style={{ userSelect: "none" }}>×</text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </AnimatePresence>
        </svg>
    );
});

export default ConnectionLines;
