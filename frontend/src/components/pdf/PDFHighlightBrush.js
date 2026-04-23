import React, { useEffect, useRef, useState, memo } from 'react';
import { usePDF } from '../../context/PDFContext';
import { useUI } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAppActions } from '../../context/AppContext';

const PDFHighlightBrush = memo(({
    pageNum,
    width,
    height,
    zoomLevel = 1,
    isResizing = false
}) => {
    const { brushHighlights: existingHighlights } = usePDF();
    const { tool, highlightBrushColor: selectedColor, hoveredAnnotationId } = useUI();
    const { setSnippets, setConnections, setIsDirty, selectedItem } = useWorkspace();
    const { handleBrushHighlightCreate: onHighlightCreate } = useAppActions();
    const isActive = tool === "highlight-brush";
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);

    // 🎨 Render highlights for this page
    useEffect(() => {
        if (isResizing) return; // 🚀 OPTIMIZATION: Skip expensive re-draw during drag to fix flickering

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(zoomLevel, zoomLevel);
        ctx.clearRect(0, 0, width, height);

        // Filter highlights for THIS page
        const pageHighlights = existingHighlights.filter(h => h.pageNum === pageNum);

        pageHighlights.forEach(highlight => {
            if (!highlight.path || highlight.path.length < 2) return;

            const isHovered = highlight.id === hoveredAnnotationId;

            ctx.beginPath();
            ctx.strokeStyle = highlight.color;
            ctx.lineWidth = isHovered ? (highlight.brushWidth || 20) + 6 : (highlight.brushWidth || 20);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = isHovered ? 0.85 : 0.5;

            if (isHovered) {
                ctx.shadowColor = highlight.color;
                ctx.shadowBlur = 20;
            } else {
                ctx.shadowBlur = 0;
            }

            highlight.path.forEach((point, i) => {
                const x = point.xPct * width;
                const y = point.yPct * height;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        });
        ctx.restore();
    }, [existingHighlights, pageNum, width, height, zoomLevel, isResizing, hoveredAnnotationId]);

    // Helper to get cleaner coordinates — pointer events always have clientX/Y directly
    const getCoordinates = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / zoomLevel,
            y: (e.clientY - rect.top) / zoomLevel
        };
    };

    // Handle pointer events for drawing (pen/mouse only — touch passes through for scrolling)
    const handleStart = (e) => {
        if (!isActive) return;
        // 👆 Let finger/touch scroll the PDF while highlighting with pen
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        e.stopPropagation();
        // Capture pointer so fast pen strokes never lose the canvas
        canvasRef.current.setPointerCapture(e.pointerId);
        const { x, y } = getCoordinates(e);
        setIsDrawing(true);
        setCurrentPath([{ x, y }]);
    };

    const handleMove = (e) => {
        if (!isDrawing) return;
        if (e.pointerType === 'touch') return; // Touch scrolls, pen highlights

        // CRITICAL: Prevent scrolling while drawing
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const { x, y } = getCoordinates(e);
        const newPath = [...currentPath, { x, y }];
        setCurrentPath(newPath);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // --- Full redraw to prevent alpha compounding ---
        ctx.save();
        ctx.scale(zoomLevel, zoomLevel);
        ctx.clearRect(0, 0, width, height);

        // 1. Redraw all saved highlights for this page
        const pageHighlights = existingHighlights.filter(h => h.pageNum === pageNum);
        pageHighlights.forEach(highlight => {
            if (!highlight.path || highlight.path.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = highlight.color;
            ctx.lineWidth = highlight.brushWidth || 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            highlight.path.forEach((point, i) => {
                const px = point.xPct * width;
                const py = point.yPct * height;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
        });

        // 2. Draw the current in-progress path as a single stroke
        if (newPath.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            newPath.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }

        ctx.restore();
    };

    const handleEnd = (e) => {
        if (!isDrawing) return;

        if (currentPath.length >= 2) {
            // Convert to normalized coordinates
            const normalizedPath = currentPath.map(point => ({
                xPct: point.x / width,
                yPct: point.y / height
            }));

            const highlight = {
                id: `brush-${Date.now()}`,
                pageNum: pageNum,
                color: selectedColor,
                path: normalizedPath,
                brushWidth: 20
            };

            onHighlightCreate(highlight);

            // Auto-connect to selected workspace note if one is active
            if (selectedItem && selectedItem.id && selectedItem.type !== 'anchor') {
                const cx = normalizedPath.reduce((s, p) => s + p.xPct, 0) / normalizedPath.length;
                const cy = normalizedPath.reduce((s, p) => s + p.yPct, 0) / normalizedPath.length;
                const anchorId = `anchor-brush-${Date.now()}`;
                const anchor = {
                    id: anchorId,
                    type: 'anchor',
                    x: -1000,
                    y: -1000,
                    pageNum: pageNum,
                    xPct: cx,
                    yPct: cy,
                    text: `Brush highlight p.${pageNum}`,
                };
                setSnippets(prev => [...prev, anchor]);
                setConnections(prev => [...prev, { from: String(selectedItem.id), to: anchorId }]);
                setIsDirty(true);
            }
        }

        setIsDrawing(false);
        setCurrentPath([]);
    };

    return (
        <canvas
            ref={canvasRef}
            className="brush-highlight-canvas"
            width={width * zoomLevel}
            height={height * zoomLevel}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: width + 'px',
                height: height + 'px',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: isActive ? 10 : 2,
                cursor: isActive ? 'crosshair' : 'default',
                userSelect: 'none',
                touchAction: isActive ? 'none' : 'auto', // Disable default touch behavior like scrolling
            }}
            onPointerDown={handleStart}
            onPointerMove={handleMove}
            onPointerUp={handleEnd}
            onPointerCancel={handleEnd}
        />
    );
});

export default PDFHighlightBrush;
