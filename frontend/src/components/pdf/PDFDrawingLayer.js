import React, { useRef, memo, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Path } from "react-konva";
import { getStroke } from "perfect-freehand";
import { usePDF } from "../../context/PDFContext";
import { useUI } from "../../context/UIContext";
import { useWorkspace } from "../../context/WorkspaceContext";

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

const BASE_STROKE_OPTIONS = {
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
};

const PDFDrawingLayer = memo(({ pageNum, width, height, tool, zoomLevel = 1 }) => {
    const { pdfLines: lines, setPdfLines: setLines } = usePDF();
    const { hoveredAnnotationId, pdfDrawingColor, penSize = 4 } = useUI();
    const { setIsDirty } = useWorkspace();

    const colorRef = useRef(pdfDrawingColor);
    const sizeRef  = useRef(penSize);
    useEffect(() => { colorRef.current = pdfDrawingColor; }, [pdfDrawingColor]);
    useEffect(() => { sizeRef.current  = penSize; },         [penSize]);

    const containerRef  = useRef(null);
    const liveCanvasRef = useRef(null);
    const softCursorRef = useRef(null);
    const isDrawing     = useRef(false);
    // Both live canvas and Konva use the SAME world-space coordinates:
    //   wx = (clientX - containerRect.left) / zoomLevel
    //   wy = (clientY - containerRect.top)  / zoomLevel
    // This is correct because the container is CSS-scaled by zoomLevel, so
    // 1 world unit = 1 container-CSS-px = zoomLevel viewport pixels.
    const points        = useRef([]);
    const rafRef        = useRef(null);
    const lastPos       = useRef({ x: 0, y: 0 });

    const updateLines = useCallback((updater) => {
        setLines(updater);
        setIsDirty(true);
    }, [setLines, setIsDirty]);

    // ── Coordinate helper ────────────────────────────────────────────────────
    const getPos = (e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { wx: 0, wy: 0 };
        // getBoundingClientRect accounts for parent CSS scale, so divide once gives local coords
        return {
            wx: (e.clientX - rect.left) / zoomLevel,
            wy: (e.clientY - rect.top)  / zoomLevel,
        };
    };

    // ── Software cursor (works for Wacom/stylus too) ─────────────────────────
    const moveSoftCursor = (e) => {
        const el = softCursorRef.current;
        if (!el) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        // position in viewport coords relative to container, then un-scale for CSS placement
        el.style.left    = ((e.clientX - rect.left) / zoomLevel) + 'px';
        el.style.top     = ((e.clientY - rect.top)  / zoomLevel) + 'px';
        el.style.display = 'block';
    };
    const hideSoftCursor = () => {
        if (softCursorRef.current) softCursorRef.current.style.display = 'none';
    };

    // ── Live canvas redraw via rAF ───────────────────────────────────────────
    const drawLiveStroke = () => {
        rafRef.current = null;
        const canvas = liveCanvasRef.current;
        if (!canvas || points.current.length < 2) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // same coords & size as the final committed Konva path → zero snap on release
        const stroke = getStroke(points.current, {
            ...BASE_STROKE_OPTIONS,
            size: sizeRef.current,
        });
        const path = new Path2D(getSvgPathFromStroke(stroke));
        ctx.fillStyle = colorRef.current;
        ctx.fill(path);
    };

    // ── Pointer handlers ─────────────────────────────────────────────────────
    const handlePointerDown = (e) => {
        if (tool !== "pen" && tool !== "eraser") return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isDrawing.current = true;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const { wx, wy } = getPos(e);

        lastPos.current = { x: wx, y: wy };
        points.current  = [[wx, wy, pressure]];

        if (tool === "pen" && liveCanvasRef.current) {
            const ctx = liveCanvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
        }
    };

    const handlePointerMove = (e) => {
        moveSoftCursor(e);
        if (!isDrawing.current || (tool !== "pen" && tool !== "eraser")) return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();

        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const { wx, wy } = getPos(e);

        if (tool === "pen") {
            const dx = wx - lastPos.current.x;
            const dy = wy - lastPos.current.y;
            if (dx * dx + dy * dy < 0.25) return;
            lastPos.current = { x: wx, y: wy };

            points.current.push([wx, wy, pressure]);

            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(drawLiveStroke);
            }
        } else if (tool === "eraser") {
            const threshold = 15 / zoomLevel;
            updateLines(prevLines =>
                prevLines.filter(line => {
                    if (line.pageNum !== pageNum) return true;
                    const pts     = line.inputPts;
                    const flatPts = line.points;
                    if (pts) {
                        for (const [px, py] of pts)
                            if (Math.abs(px - wx) < threshold && Math.abs(py - wy) < threshold) return false;
                    } else if (flatPts) {
                        for (let i = 0; i < flatPts.length; i += 2)
                            if (Math.abs(flatPts[i] - wx) < threshold && Math.abs(flatPts[i + 1] - wy) < threshold) return false;
                    }
                    return true;
                })
            );
        }
    };

    const handlePointerUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;

        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

        if (tool === "pen" && points.current.length > 1) {
            if (liveCanvasRef.current) {
                const ctx = liveCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
            }
            // same points & size → committed path is pixel-identical to live preview
            const stroke  = getStroke(points.current, { ...BASE_STROKE_OPTIONS, size: sizeRef.current, last: true });
            const svgPath = getSvgPathFromStroke(stroke);
            updateLines(prev => [...prev, {
                id: `pdf-line-${Date.now()}-${Math.random()}`,
                pageNum,
                tool: "pen",
                color: colorRef.current,
                width: sizeRef.current,
                inputPts: points.current,
                svgPath,
            }]);
        }
        points.current = [];
    };

    const pageLines = lines.filter(l => l.pageNum === pageNum);

    return (
        <div ref={containerRef} className="pdf-drawing-container" style={{
            position: "absolute", top: 0, left: 0, width, height, zIndex: 3,
            pointerEvents: (tool === "pen" || tool === "eraser") ? "auto" : "none",
        }}>
            {/* Konva: committed strokes in world-space (same coordinate system as live canvas) */}
            <Stage
                width={Math.max(1, width)}
                height={Math.max(1, height)}
                pixelRatio={window.devicePixelRatio || 1}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            >
                <Layer>
                    {pageLines.map((line) => {
                        const isHov = line.id === hoveredAnnotationId;
                        if (line.svgPath) {
                            return (
                                <Path key={line.id} data={line.svgPath} fill={line.color}
                                    strokeEnabled={false}
                                    opacity={isHov ? 1 : 0.9}
                                    shadowColor={isHov ? line.color : undefined}
                                    shadowBlur={isHov ? 16 : 0}
                                    shadowEnabled={isHov}
                                />
                            );
                        }
                        return (
                            <Line key={line.id} points={line.points} stroke={line.color}
                                strokeWidth={isHov ? (line.width + 2) : line.width}
                                tension={0.5} lineCap="round" lineJoin="round"
                                opacity={isHov ? 1 : 0.95}
                                shadowColor={isHov ? line.color : undefined}
                                shadowBlur={isHov ? 16 : 0}
                                shadowEnabled={isHov}
                            />
                        );
                    })}
                </Layer>
            </Stage>

            {/* Live preview canvas — same coordinate system as Konva (world-space) */}
            <canvas ref={liveCanvasRef} width={width} height={height}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }} />

            {/* Invisible event overlay */}
            <canvas width={width} height={height}
                style={{
                    position: 'absolute', top: 0, left: 0, opacity: 0,
                    pointerEvents: (tool === "pen" || tool === "eraser") ? "auto" : "none",
                    zIndex: 2, touchAction: 'none', cursor: 'none',
                }}
                onPointerDown={e => { moveSoftCursor(e); handlePointerDown(e); }}
                onPointerMove={e => handlePointerMove(e)}
                onPointerUp={handlePointerUp}
                onPointerLeave={e => { hideSoftCursor(); handlePointerUp(); }}
                onPointerEnter={moveSoftCursor}
            />

            {/* Software cursor — visible on mouse AND Wacom/stylus */}
            {(tool === "pen" || tool === "eraser") && (
                <div ref={softCursorRef} style={{
                    display: 'none', position: 'absolute', pointerEvents: 'none', zIndex: 3,
                    transform: tool === "pen" ? 'translate(-2px, -22px)' : 'translate(-11px, -11px)',
                    userSelect: 'none',
                }} dangerouslySetInnerHTML={{
                    __html: tool === "pen"
                        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#333"/></svg>`
                        : `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="2" y="2" width="18" height="18" rx="3" fill="white" stroke="#666" stroke-width="1.5"/><line x1="2" y1="20" x2="20" y2="2" stroke="#aaa" stroke-width="1"/></svg>`,
                }} />
            )}
        </div>
    );
});

export default PDFDrawingLayer;
