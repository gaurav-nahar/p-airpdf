import { useState, useEffect, useRef } from "react";
import { setupPDF, renderPage } from "./pdfLoader";
// import { attachCanvasDragHandler } from "./pdfDragHandlers";
import { TRANSITION } from "./pdfShrinkExpand";

export const usePdfRenderer = ({ fileUrl, containerRef, contentRef = null, latestRef, shrinkState, pdfRenderScale = 1.5 }) => {
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [renderedPageMap, setRenderedPageMap] = useState({});
    const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });

    const pdfDocRef = useRef(null);
    const loadedRef = useRef(false);
    const observerRef = useRef(null);
    const pageCountRef = useRef(0);

    useEffect(() => {
        if (loadedRef.current || !fileUrl) return;
        loadedRef.current = true;

        const load = async () => {
            const container = containerRef.current;
            const contentContainer = contentRef ? contentRef.current : container;
            if (!container || !contentContainer) return;

            observerRef.current = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // ⚡ PERFORMANCE FIX: Do NOT render pages that are shrunk/hidden in the stack.
                        if (entry.target.classList.contains("page-above") || entry.target.classList.contains("page-below")) {
                            return;
                        }

                        if (pdfDocRef.current) {
                            renderPage(pdfDocRef.current, entry.target, pdfRenderScale).then((result) => {
                                // ✨ CRITICAL: Highlights search matches on the newly rendered page.
                                if (latestRef.current.highlightMatchesOnPage) {
                                    latestRef.current.highlightMatchesOnPage(entry.target);
                                }
                                // 📝 Render dynamic text annotations
                                if (latestRef.current.renderPdfAnnotation) {
                                    (latestRef.current.pdfAnnotations || [])
                                        .filter(a => a.pageNum === parseInt(entry.target.dataset.pageNumber, 10))
                                        .forEach(a => latestRef.current.renderPdfAnnotation(entry.target, a));
                                }

                                // 🎨 Track this page for Konva/Portal Rendering
                                if (result && result.canvas) {
                                    setRenderedPageMap(prev => ({
                                        ...prev,
                                        [entry.target.dataset.pageNumber]: {
                                            wrapper: entry.target,
                                            width: result.canvas.width / pdfRenderScale,
                                            height: result.canvas.height / pdfRenderScale
                                        }
                                    }));
                                }
                            });
                        }
                    }
                });
            }, {
                root: container,
                rootMargin: "200px",
                threshold: 0.05
            });

            // 📄 setupPDF: Loads the PDF and creates page shells
            const { pdfDocument, numPages, totalUnscaledHeight, maxUnscaledWidth } = await setupPDF(
                fileUrl,
                contentContainer,
                pdfRenderScale,
                (pageNum, wrapper) => {
                    wrapper.style.transition = TRANSITION;
                    wrapper.style.transformOrigin = "top center";
                    if (observerRef.current) observerRef.current.observe(wrapper);
                }
            );

            setPdfDimensions({ width: maxUnscaledWidth, height: totalUnscaledHeight });
            pdfDocRef.current = pdfDocument;
            pageCountRef.current = numPages;
            setPdfLoaded(true);
        };

        load();

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [fileUrl, pdfRenderScale]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle Mode changes (Select/Pen/Eraser) without reloading everything
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
    }, [latestRef.current.mode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-trigger observer when expanding to render previously skipped pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const container = containerRef.current;
        const contentContainer = contentRef ? contentRef.current : container;
        if (!shrinkState && observerRef.current && container && contentContainer) {
            Array.from(contentContainer.children).forEach(child => {
                observerRef.current.unobserve(child);
                observerRef.current.observe(child);
            });
        }
    }, [shrinkState]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle pages rendered by scrollToSnippet to ensure PDFTextHighlightLayer gets rendered
    useEffect(() => {
        const handlePageRenderedByScroll = (event) => {
            const { pageNum, wrapper, width, height } = event.detail;
            if (pageNum && wrapper) {
                //it is used to render the layer
                setRenderedPageMap(prev => {
                    const updated = {
                        ...prev,
                        [pageNum]: {
                            wrapper: wrapper,
                            width: width || wrapper.clientWidth,
                            height: height || wrapper.clientHeight
                        }
                    };
                    return updated;
                });
            }
        };

        window.addEventListener('page-rendered-by-scroll', handlePageRenderedByScroll);
        return () => window.removeEventListener('page-rendered-by-scroll', handlePageRenderedByScroll);
    }, []);

    return { pdfDocRef, pdfLoaded, renderedPageMap, pageCountRef, observerRef, pdfDimensions };
};