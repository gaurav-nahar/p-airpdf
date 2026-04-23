import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const TraceLineLayer = () => {
    const svgRef  = useRef(null);
    const pathRef = useRef(null);
    const fadeRef = useRef(null);
    const rafRef  = useRef(null);

    // Live-tracking state: kept in refs so the RAF loop can read them without stale closures
    const liveRef = useRef(null); // { snippetId, highlightRect } — set while actively tracking

    const getEndpoints = (snippetId, highlightRect) => {
        const snippetEl = document.getElementById(`workspace-item-${snippetId}`);
        if (!snippetEl) return null;
        const r = snippetEl.getBoundingClientRect();

        const startX = highlightRect.right;
        const startY = highlightRect.top + highlightRect.height / 2;
        const endX   = r.left;
        const endY   = r.top + r.height / 2;
        return { startX, startY, endX, endY };
    };

    const drawPath = (startX, startY, endX, endY) => {
        const pathEl = pathRef.current;
        if (!pathEl) return;
        const curvature = Math.max(30, Math.abs(endX - startX) * 0.45);
        const d = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;
        pathEl.setAttribute('d', d);
    };

    const stopLive = () => {
        liveRef.current = null;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    const startFade = () => {
        if (fadeRef.current) clearTimeout(fadeRef.current);
        fadeRef.current = setTimeout(() => {
            const pathEl = pathRef.current;
            const svgEl  = svgRef.current;
            if (pathEl) pathEl.style.opacity = '0';
            if (svgEl)  svgEl.style.opacity  = '0';
            stopLive();
        }, 500);
    };

    // RAF loop: continuously updates the path while live-tracking
    const runLiveLoop = () => {
        const tick = () => {
            if (!liveRef.current) return;
            const { snippetId, highlightRect } = liveRef.current;
            const pts = getEndpoints(snippetId, highlightRect);
            if (pts) drawPath(pts.startX, pts.startY, pts.endX, pts.endY);
            rafRef.current = requestAnimationFrame(tick);
        };
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        const svgEl  = svgRef.current;
        const pathEl = pathRef.current;

        const handleTrace = (e) => {
            const { snippetId, highlightRect } = e.detail || {};
            if (!highlightRect || !snippetId) return;

            const pts = getEndpoints(snippetId, highlightRect);
            if (!pts) return;

            // Cancel any pending fade
            if (fadeRef.current) clearTimeout(fadeRef.current);

            // Set initial path instantly (no transition) for snappy appearance
            pathEl.style.transition = 'none';
            drawPath(pts.startX, pts.startY, pts.endX, pts.endY);

            const len = pathEl.getTotalLength();
            pathEl.style.strokeDasharray  = `${len}`;
            pathEl.style.strokeDashoffset = `${len}`;
            pathEl.style.opacity          = '1';
            svgEl.style.opacity           = '1';

            requestAnimationFrame(() => {
                pathEl.style.transition    = 'stroke-dashoffset 160ms cubic-bezier(0.2,0,0,1)';
                pathEl.style.strokeDashoffset = '0';
            });

            // Start live-tracking: RAF will update path position every frame
            liveRef.current = { snippetId, highlightRect };
            runLiveLoop();

            // Reset fade timer — line stays as long as box is moving; fades when still
            startFade();
        };

        // Re-arm fade timer whenever the snippet moves so the line stays visible during drag
        const handleMove = () => {
            if (!liveRef.current) return;
            if (fadeRef.current) clearTimeout(fadeRef.current);
            startFade();
        };

        window.addEventListener('trace-snippet-connection', handleTrace);
        window.addEventListener('mousemove', handleMove);

        return () => {
            window.removeEventListener('trace-snippet-connection', handleTrace);
            window.removeEventListener('mousemove', handleMove);
            stopLive();
            if (fadeRef.current) clearTimeout(fadeRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return createPortal(
        <svg
            ref={svgRef}
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2147483647,
                opacity: 0,
                transition: 'opacity 120ms linear',
                overflow: 'visible',
            }}
        >
            <path
                ref={pathRef}
                d="M0 0"
                stroke="#007bff"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    filter: 'drop-shadow(0 0 4px rgba(0,123,255,0.55))',
                    willChange: 'stroke-dashoffset, opacity',
                    opacity: 0,
                    transition: 'opacity 200ms linear',
                }}
            />
        </svg>,
        document.body
    );
};

export default TraceLineLayer;
