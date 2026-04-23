import { useState, useRef, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";

export default function useLayoutResizer() {
    const {
        zoomLevel, setZoomLevel,
        pdfPanelWidth, setPdfPanelWidth,
        isResizing, setIsResizing
    } = useApp();

    const resizeInitialState = useRef({
        startX: 0,
        initialWidthPct: 50,
        initialZoom: 1
    });

    const handleMouseDownResizer = useCallback((e) => {
        setIsResizing(true);

        const container = document.querySelector('.pdf-viewer-container');
        const wrapper = document.querySelector('.pdf-zoom-centering-wrapper');

        let scrollRatio = 0;
        let unscaledWidth = 0;
        let unscaledHeight = 0;

        if (container && wrapper) {
            const currentHeight = container.scrollHeight;
            if (currentHeight > 0) {
                scrollRatio = container.scrollTop / currentHeight;
            }
            unscaledWidth = wrapper.offsetWidth / zoomLevel;
            unscaledHeight = wrapper.offsetHeight / zoomLevel;
        }

        resizeInitialState.current = {
            startX: e.clientX,
            initialWidthPct: pdfPanelWidth,
            initialZoom: zoomLevel,
            scrollRatio,
            unscaledWidth,
            unscaledHeight
        };
    }, [pdfPanelWidth, zoomLevel]);

    const handleTouchStartResizer = useCallback((e) => {
        if (e.touches.length === 0) return;
        setIsResizing(true);
        const touch = e.touches[0];

        const container = document.querySelector('.pdf-viewer-container');
        const wrapper = document.querySelector('.pdf-zoom-centering-wrapper');

        let scrollRatio = 0;
        let unscaledWidth = 0;
        let unscaledHeight = 0;

        if (container && wrapper) {
            const currentHeight = container.scrollHeight;
            if (currentHeight > 0) {
                scrollRatio = container.scrollTop / currentHeight;
            }
            unscaledWidth = wrapper.offsetWidth / zoomLevel;
            unscaledHeight = wrapper.offsetHeight / zoomLevel;
        }

        resizeInitialState.current = {
            startX: touch.clientX,
            initialWidthPct: pdfPanelWidth,
            initialZoom: zoomLevel,
            scrollRatio,
            unscaledWidth,
            unscaledHeight
        };
    }, [pdfPanelWidth, zoomLevel]);

    useEffect(() => {
        if (!isResizing) return;

        const panel = document.querySelector('.pdf-view-container');
        const container = document.querySelector('.pdf-viewer-container');
        const zoomContent = document.querySelector('.pdf-zoom-content');
        const centeringWrapper = document.querySelector('.pdf-zoom-centering-wrapper');

        let rafId = null;

        const handleMouseMove = (e) => {
            if (rafId) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                const { startX, initialWidthPct, initialZoom, scrollRatio, unscaledWidth, unscaledHeight } = resizeInitialState.current;
                const deltaX = e.clientX - startX;
                const deltaPct = (deltaX / window.innerWidth) * 100;

                let newWidthPct = initialWidthPct + deltaPct;

                if (newWidthPct > 20 && newWidthPct < 80) {
                    const ratio = newWidthPct / initialWidthPct;
                    const newZoom = initialZoom * ratio;

                    if (panel) panel.style.width = `${newWidthPct}%`;

                    if (zoomContent) {
                        zoomContent.style.transform = `scale(${newZoom})`;
                        zoomContent.style.transition = 'none';
                    }

                    if (centeringWrapper && unscaledWidth > 0 && unscaledHeight > 0) {
                        const newW = unscaledWidth * newZoom;
                        const newH = unscaledHeight * newZoom;
                        centeringWrapper.style.width = `${newW}px`;
                        centeringWrapper.style.height = `${newH}px`;
                    }

                    if (container && scrollRatio > 0) {
                        container.scrollTop = container.scrollHeight * scrollRatio;
                    }

                    resizeInitialState.current.lastWidth = newWidthPct;
                    resizeInitialState.current.lastZoom = newZoom;
                }
            });
        };

        const handleMouseUp = () => {
            if (rafId) cancelAnimationFrame(rafId);
            setIsResizing(false);

            const { lastWidth, lastZoom } = resizeInitialState.current;
            if (lastWidth) setPdfPanelWidth(lastWidth);
            if (lastZoom) setZoomLevel(Math.min(3.0, Math.max(0.3, lastZoom)));

            window.dispatchEvent(new Event('resize'));
        };

        const handleTouchMove = (e) => {
            if (!isResizing || e.touches.length === 0) return;
            if (rafId) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                const touch = e.touches[0];
                const { startX, initialWidthPct, initialZoom, scrollRatio, unscaledWidth, unscaledHeight } = resizeInitialState.current;
                const deltaX = touch.clientX - startX;
                const deltaPct = (deltaX / window.innerWidth) * 100;

                let newWidthPct = initialWidthPct + deltaPct;

                if (newWidthPct > 20 && newWidthPct < 80) {
                    const ratio = newWidthPct / initialWidthPct;
                    const newZoom = initialZoom * ratio;

                    if (panel) panel.style.width = `${newWidthPct}%`;

                    if (zoomContent) {
                        zoomContent.style.transform = `scale(${newZoom})`;
                        zoomContent.style.transition = 'none';
                    }

                    if (centeringWrapper && unscaledWidth > 0 && unscaledHeight > 0) {
                        const newW = unscaledWidth * newZoom;
                        const newH = unscaledHeight * newZoom;
                        centeringWrapper.style.width = `${newW}px`;
                        centeringWrapper.style.height = `${newH}px`;
                    }

                    if (container && scrollRatio > 0) {
                        container.scrollTop = container.scrollHeight * scrollRatio;
                    }

                    resizeInitialState.current.lastWidth = newWidthPct;
                    resizeInitialState.current.lastZoom = newZoom;
                }
            });
            // Prevent body scroll
            if (e.cancelable) e.preventDefault();
        };

        const handleTouchEnd = () => {
            handleMouseUp();
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", handleTouchEnd);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isResizing, setZoomLevel, setPdfPanelWidth, setIsResizing]);

    return {
        pdfPanelWidth,
        isResizing,
        zoomLevel,
        setZoomLevel,
        handleMouseDownResizer,
        handleTouchStartResizer
    };
}
