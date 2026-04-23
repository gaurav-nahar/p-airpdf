import React, { useRef, memo, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Line, Path } from "react-konva";
import { getStroke } from "perfect-freehand";
import { useCanvas } from "./InfiniteCanvas";

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

const isNear = (x1, y1, x2, y2, threshold = 15) => {
    const dx = x1 - x2;
    if (Math.abs(dx) > threshold) return false;
    const dy = y1 - y2;
    return (dx * dx + dy * dy) < threshold * threshold;
};

// base64 SVG cursors — avoids all quote-escaping issues in CSS url()
const svgCursor = (svg, x, y) =>
    `url("data:image/svg+xml;base64,${btoa(svg)}") ${x} ${y}, crosshair`;

const CURSORS = {
    pen: svgCursor(
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#333"/></svg>`,
        0, 22
    ),
    eraser: svgCursor(
        `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="2" y="2" width="18" height="18" rx="3" fill="white" stroke="#666" stroke-width="1.5"/><line x1="2" y1="20" x2="20" y2="2" stroke="#aaa" stroke-width="1"/></svg>`,
        11, 11
    ),
};

const DrawingCanvas = memo(({ tool, lines, setLines, selectedColor, penSize = 3 }) => {
    const isDrawing = useRef(false);
    const { screenToWorld, pan, scale, containerRef } = useCanvas();

    const staticLayerRef = useRef(null);
    const liveCanvasRef  = useRef(null);
    const softCursorRef  = useRef(null);

    // World-space points → final Konva committed stroke
    const inputPoints = useRef([]);
    // Screen-space points → live canvas perfect-freehand preview
    const screenPoints = useRef([]);
    const rafRef       = useRef(null);
    const lastScreenPos = useRef({ x: 0, y: 0 });

    // Refs so rAF callbacks always read latest values without stale closures
    const colorRef = useRef(selectedColor);
    const sizeRef  = useRef(penSize);
    const scaleRef = useRef(scale);
    useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
    useEffect(() => { sizeRef.current  = penSize; },      [penSize]);
    useEffect(() => { scaleRef.current = scale; },        [scale]);

    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setSize({ width: rect.width, height: rect.height });
            }
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [containerRef]);

    // Draw perfect-freehand on live canvas — called via rAF, never blocks pointer events
    const drawLiveStroke = () => {
        rafRef.current = null;
        const canvas = liveCanvasRef.current;
        if (!canvas || screenPoints.current.length < 2) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // size in screen pixels = world penSize × current scale
        const stroke = getStroke(screenPoints.current, {
            ...BASE_STROKE_OPTIONS,
            size: sizeRef.current * scaleRef.current,
        });
        const path = new Path2D(getSvgPathFromStroke(stroke));
        ctx.fillStyle = colorRef.current;
        ctx.fill(path);
    };

    // ── Software cursor helpers ──
    const moveSoftCursor = (e) => {
        const el = softCursorRef.current;
        if (!el) return;
        const rect = el.parentElement?.getBoundingClientRect();
        if (!rect) return;
        el.style.left = (e.clientX - rect.left) + 'px';
        el.style.top  = (e.clientY - rect.top)  + 'px';
        el.style.display = 'block';
    };
    const hideSoftCursor = () => {
        if (softCursorRef.current) softCursorRef.current.style.display = 'none';
    };

    // ── Pointer handlers ──
    const handlePointerDown = (e) => {
        if (tool !== "pen" && tool !== "eraser") return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isDrawing.current = true;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const worldPos  = screenToWorld(e.clientX, e.clientY);
        const canvas    = liveCanvasRef.current;
        const rect      = canvas?.getBoundingClientRect();

        lastScreenPos.current = { x: e.clientX, y: e.clientY };
        inputPoints.current   = [[worldPos.x, worldPos.y, pressure]];
        screenPoints.current  = rect
            ? [[e.clientX - rect.left, e.clientY - rect.top, pressure]]
            : [];

        if (tool === "pen" && canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handlePointerMove = (e) => {
        if (!isDrawing.current || (tool !== "pen" && tool !== "eraser")) return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();

        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const worldPos  = screenToWorld(e.clientX, e.clientY);

        if (tool === "pen") {
            const dx = e.clientX - lastScreenPos.current.x;
            const dy = e.clientY - lastScreenPos.current.y;
            if (dx * dx + dy * dy < 1) return;
            lastScreenPos.current = { x: e.clientX, y: e.clientY };

            inputPoints.current.push([worldPos.x, worldPos.y, pressure]);

            const canvas = liveCanvasRef.current;
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                screenPoints.current.push([e.clientX - rect.left, e.clientY - rect.top, pressure]);
            }

            // schedule a single rAF redraw — never queues more than one
            if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(drawLiveStroke);
            }

        } else if (tool === "eraser") {
            const dx = e.clientX - lastScreenPos.current.x;
            const dy = e.clientY - lastScreenPos.current.y;
            if (dx * dx + dy * dy < 25) return;
            lastScreenPos.current = { x: e.clientX, y: e.clientY };

            setLines(prevLines => {
                const next = prevLines.filter(line => {
                    const pts     = line.inputPts;
                    const flatPts = line.points;
                    if (pts) {
                        for (const [px, py] of pts)
                            if (isNear(px, py, worldPos.x, worldPos.y, 25 / scale)) return false;
                    } else if (flatPts) {
                        for (let i = 0; i < flatPts.length; i += 2)
                            if (isNear(flatPts[i], flatPts[i + 1], worldPos.x, worldPos.y, 25 / scale)) return false;
                    }
                    return true;
                });
                return next.length === prevLines.length ? prevLines : next;
            });
        }
    };

    const handlePointerUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;

        // cancel any pending rAF
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

        if (tool === "pen" && inputPoints.current.length > 1) {
            // clear live canvas
            if (liveCanvasRef.current) {
                const ctx = liveCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, liveCanvasRef.current.width, liveCanvasRef.current.height);
            }
            // commit world-space perfect-freehand path to Konva
            const stroke  = getStroke(inputPoints.current, { ...BASE_STROKE_OPTIONS, size: sizeRef.current, last: true });
            const svgPath = getSvgPathFromStroke(stroke);
            setLines(prev => [...prev, {
                tool: "pen",
                color: colorRef.current,
                width: sizeRef.current,
                inputPts: inputPoints.current,
                svgPath,
            }]);
        }
        inputPoints.current  = [];
        screenPoints.current = [];
    };

    // Render committed lines
    const renderedStaticLines = useMemo(() => (
        lines.map((line, i) => {
            if (line.svgPath) {
                return (
                    <Path key={i} data={line.svgPath} fill={line.color}
                        strokeEnabled={false} listening={false} perfectDrawEnabled={false} />
                );
            }
            return (
                <Line key={i} points={line.points} stroke={line.color}
                    strokeWidth={line.width / scale} tension={0.5}
                    lineCap="round" lineJoin="round"
                    listening={false} perfectDrawEnabled={false} />
            );
        })
    ), [lines, scale]);

    const canvasContent = (
        <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10,
        }}>
            {/* Konva: committed strokes only, never touched during live drawing */}
            <Stage width={size.width} height={size.height}
                pixelRatio={window.devicePixelRatio || 1}
                style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }}>
                <Layer ref={staticLayerRef} x={pan.x} y={pan.y} scaleX={scale} scaleY={scale} listening={false}>
                    {renderedStaticLines}
                </Layer>
            </Stage>

            {/* Raw 2D canvas: live perfect-freehand preview via rAF */}
            <canvas ref={liveCanvasRef} width={size.width} height={size.height}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }} />

            {/* Event-capture overlay */}
            <canvas width={size.width} height={size.height}
                style={{
                    position: 'absolute', top: 0, left: 0, opacity: 0,
                    pointerEvents: (tool === "pen" || tool === "eraser") ? "auto" : "none",
                    cursor: 'none', zIndex: 2, touchAction: 'none',
                }}
                onPointerDown={e => { moveSoftCursor(e); handlePointerDown(e); }}
                onPointerMove={e => { moveSoftCursor(e); handlePointerMove(e); }}
                onPointerUp={e => { handlePointerUp(e); }}
                onPointerLeave={e => { hideSoftCursor(); handlePointerUp(e); }}
                onPointerEnter={moveSoftCursor}
            />

            {/* Software cursor — works for mouse + Wacom + stylus */}
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

    return containerRef.current ? createPortal(canvasContent, containerRef.current) : null;
});

export default DrawingCanvas;
