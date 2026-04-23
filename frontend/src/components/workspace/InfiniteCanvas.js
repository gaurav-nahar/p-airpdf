import React, { useRef, useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { usePinch } from '@use-gesture/react';

const WORKSPACE_SECTIONS = [
    { id: 'ws-1', x: 0, y: 0, width: 1100, height: 1500, color: '#e8f3ff' },
    { id: 'ws-2', x: 1100, y: 0, width: 1100, height: 1500, color: '#fff8d8' },
    { id: 'ws-3', x: 2200, y: 0, width: 1100, height: 1500, color: '#eef9ec' },
    { id: 'ws-4', x: 0, y: 1500, width: 1100, height: 1500, color: '#fff0f0' },
    { id: 'ws-5', x: 1100, y: 1500, width: 1100, height: 1500, color: '#f6efff' },
    { id: 'ws-6', x: 2200, y: 1500, width: 1100, height: 1500, color: '#fff3e3' },
];

// Stable context: screenToWorld, worldToScreen, getScale, getPan, containerRef, rectRef
// This NEVER changes after mount → components using it don't re-render on pan/zoom
const CanvasStableContext = createContext({
    screenToWorld: (x, y) => ({ x, y }),
    worldToScreen: (x, y) => ({ x, y }),
    getScale: () => 1,
    getPan: () => ({ x: 0, y: 0 }),
    containerRef: { current: null },
    rectRef: { current: { left: 0, top: 0 } }
});

// View context: scale, pan — changes every frame while panning/zooming
// Only subscribe to this if you actually need reactive scale/pan for rendering
const CanvasViewContext = createContext({ scale: 1, pan: { x: 0, y: 0 } });

// Full context: backward-compatible hook (re-renders on pan/zoom — use sparingly)
export const useCanvas = () => ({
    ...useContext(CanvasStableContext),
    ...useContext(CanvasViewContext),
});

// Stable-only hook: does NOT re-render on pan/zoom — use in drag/drop, text boxes, etc.
export const useCanvasStable = () => useContext(CanvasStableContext);

const InfiniteCanvas = React.forwardRef(({ children, className, style, initialScale = 1, initialPan = { x: 0, y: 0 }, onViewChange, panningEnabled = true }, ref) => {
    const [pan, setPan] = useState(initialPan);
    const [scale, setScale] = useState(initialScale);
    const containerRef = useRef(null);
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const isSpacePressed = useRef(false);
    const isPinching = useRef(false); // true while @use-gesture pinch is active

    // Refs for stable access in callbacks without re-creating functions
    const panRef = useRef(pan);
    const scaleRef = useRef(scale);
    const rectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });

    // 📏 Cache rect size to avoid getBoundingClientRect reflows during drawing
    useEffect(() => {
        if (!containerRef.current) return;
        const updateRect = () => {
            if (containerRef.current) {
                rectRef.current = containerRef.current.getBoundingClientRect();
            }
        };
        updateRect();
        const observer = new ResizeObserver(updateRect);
        observer.observe(containerRef.current);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', updateRect, true);
        };
    }, []);

    useEffect(() => {
        panRef.current = pan;
        scaleRef.current = scale;
        // Notify parent of view change (debounced or throttled appropriately by parent or here)
        if (onViewChange) {
            const timer = setTimeout(() => {
                onViewChange({ scale, pan });
            }, 500); // 500ms debounce
            return () => clearTimeout(timer);
        }
    }, [pan, scale, onViewChange]);

    // 🌍 Coordinate Transformation Helpers (Stable Reference)
    const screenToWorld = useCallback((screenX, screenY) => {
        const rect = rectRef.current;
        const containerX = screenX - rect.left;
        const containerY = screenY - rect.top;
        return {
            x: (containerX - panRef.current.x) / scaleRef.current,
            y: (containerY - panRef.current.y) / scaleRef.current
        };
    }, []);

    const worldToScreen = useCallback((worldX, worldY) => {
        const rect = rectRef.current;
        return {
            x: worldX * scaleRef.current + panRef.current.x + rect.left,
            y: worldY * scaleRef.current + panRef.current.y + rect.top
        };
    }, []);

    // 🔬 Helper to Clamp Pan
    const clampPan = useCallback((x, y, s) => {
        const limit = 5000 * s;
        return {
            x: Math.min(limit, Math.max(-limit, x)),
            y: Math.min(limit, Math.max(-limit, y))
        };
    }, []);

    // Stable context value — deps are empty-dep callbacks, so this is created once
    const stableContextValue = useMemo(() => ({
        screenToWorld,
        worldToScreen,
        getScale: () => scaleRef.current,
        getPan: () => panRef.current,
        containerRef,
        rectRef
    }), [screenToWorld, worldToScreen]);

    // View context value — changes on every pan/zoom, only DrawingCanvas subscribes to this
    const viewContextValue = useMemo(() => ({ scale, pan }), [scale, pan]);

    // Expose helpers to parent via Ref
    React.useImperativeHandle(ref, () => ({
        screenToWorld,
        worldToScreen,
        getScale: () => scaleRef.current,
        getPan: () => panRef.current
    }), [screenToWorld, worldToScreen]);

    // 👌 Pinch-to-zoom via @use-gesture/react — replaces manual activePointers Map
    usePinch(
        ({ origin, offset: [pinchScale], first, last, event, memo }) => {
            event?.preventDefault?.();
            if (first) {
                isPinching.current = true;
                isPanning.current = false;
                memo = { initialScale: scaleRef.current, initialPan: panRef.current };
            }
            if (!memo) return;

            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return memo;

            const ox = origin[0] - rect.left;
            const oy = origin[1] - rect.top;
            const wx = (ox - memo.initialPan.x) / memo.initialScale;
            const wy = (oy - memo.initialPan.y) / memo.initialScale;

            const newScale = Math.min(Math.max(0.1, pinchScale * memo.initialScale), 5);
            const newPan = clampPan(ox - wx * newScale, oy - wy * newScale, newScale);

            setScale(newScale);
            setPan(newPan);

            if (last) isPinching.current = false;
            return memo;
        },
        { target: containerRef, eventOptions: { passive: false }, pinchOnWheel: false }
    );

    // ⌨️ Keyboard Listeners for Space Pan
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat && !isSpacePressed.current) {
                isSpacePressed.current = true;
                if (containerRef.current) containerRef.current.style.cursor = 'grab';
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                isSpacePressed.current = false;
                if (containerRef.current) containerRef.current.style.cursor = 'default';
                if (isPanning.current) {
                    isPanning.current = false; // Stop panning if space released
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // 🖱️ Mouse Wheel -> ZOOM or PAN
    const handleWheel = useCallback((e) => {
        const currentScale = scaleRef.current;
        const currentPan = panRef.current;

        if (e.ctrlKey || e.metaKey) {
            // ZOOM
            e.preventDefault();
            const zoomIntensity = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            const factor = direction * zoomIntensity;

            let newScale = currentScale + factor;
            newScale = Math.min(Math.max(0.1, newScale), 5); // 0.1x to 5x

            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldMouseX = (mouseX - currentPan.x) / currentScale;
            const worldMouseY = (mouseY - currentPan.y) / currentScale;

            let newPanX = mouseX - worldMouseX * newScale;
            let newPanY = mouseY - worldMouseY * newScale;

            // Clamp both
            const clamped = clampPan(newPanX, newPanY, newScale);

            setScale(newScale);
            setPan(clamped);
        } else {
            // PAN
            e.preventDefault();
            const newX = currentPan.x - e.deltaX;
            const newY = currentPan.y - e.deltaY;
            setPan(clampPan(newX, newY, currentScale));
        }
    }, [clampPan]); // Only depends on clampPan which is also stable if defined outside or wrapped in useCallback

    // 🖱️✏️📱 Unified Pointer Down (mouse + touch + pen/stylus)
    // Pinch zoom is handled by usePinch above; this only deals with pan.
    const handlePointerDown = (e) => {
        if (e.defaultPrevented) return;
        if (isPinching.current) return; // let usePinch own multi-touch

        const isMiddleClick = e.button === 1;
        const isActionButton = e.button === 0 || e.pointerType === 'pen' || e.pointerType === 'touch';
        const shouldPan = isMiddleClick || (isActionButton && (e.altKey || isSpacePressed.current || panningEnabled));

        if (shouldPan) {
            e.preventDefault();
            isPanning.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            document.body.style.cursor = 'grabbing';
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isPanning.current || isPinching.current) return;
            e.preventDefault();
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setPan(prev => clampPan(prev.x + dx, prev.y + dy, scaleRef.current));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };

        const handlePointerUp = () => {
            if (isPanning.current) {
                isPanning.current = false;
                document.body.style.cursor = 'default';
                if (containerRef.current) {
                    containerRef.current.style.cursor = isSpacePressed.current ? 'grab' : 'default';
                }
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [clampPan]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e) => {
            handleWheel(e);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, [handleWheel]);

    // ➕➖ Zoom Buttons Handlers
    const zoomIn = () => {
        setScale(prev => Math.min(prev + 0.2, 5));
    };
    const zoomOut = () => {
        setScale(prev => Math.max(prev - 0.2, 0.1));
    };

    return (
        <CanvasStableContext.Provider value={stableContextValue}>
        <CanvasViewContext.Provider value={viewContextValue}>
            <div
                ref={containerRef}
                className={className}
                style={{
                    ...style,
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'default',
                    touchAction: 'none',
                    backgroundColor: '#f8f9fa',
                    backgroundImage: 'radial-gradient(circle, #d1d1d1 1.2px, transparent 0)',
                    backgroundSize: `${40 * scale}px ${40 * scale}px`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                    willChange: 'background-position, background-size'
                }}
                onPointerDown={handlePointerDown}
            >
                {/* The World Container */}
                <div
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        willChange: 'transform'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: 'none',
                            zIndex: 0
                        }}
                    >
                        {WORKSPACE_SECTIONS.map((section) => (
                            <div
                                key={section.id}
                                style={{
                                    position: 'absolute',
                                    left: section.x,
                                    top: section.y,
                                    width: section.width,
                                    height: section.height,
                                    background: section.color,
                                    border: '1px solid rgba(15, 23, 42, 0.05)',
                                    borderRadius: 0,
                                    boxShadow: 'none',
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundImage: 'linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)',
                                        backgroundSize: '48px 48px',
                                        opacity: 0.5
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    {children}
                </div>

                {/* HUD / Indicators / Controls */}
                <div style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    zIndex: 1000
                }}>
                    <button onClick={zoomIn} style={btnStyle} title="Zoom In (+)">+</button>
                    <button onClick={zoomOut} style={btnStyle} title="Zoom Out (-)">-</button>
                    <div style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        textAlign: 'center',
                        pointerEvents: 'none'
                    }}>
                        {(scale * 100).toFixed(0)}%
                    </div>
                </div>
            </div>
        </CanvasViewContext.Provider>
        </CanvasStableContext.Provider>
    );
});

const btnStyle = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'white',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: '#333'
};

export default InfiniteCanvas;
