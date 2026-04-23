import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 *  PDF Thumbnail View (The Modal Overview)
 * This file shows a grid of small pictures (thumbnails) of every page in the PDF.
 * 
 * LIBRARY: 
 * - React (for UI)
 * - pdfjs-dist (for rendering thumbnails)
 * 
 * CALL LOCATION: 
 * - Called from App.js inside a {showThumbnails && ...} block.
 * 
 * PARAMETERS:
 * - pdfDoc: The currently opened PDF file.
 * - onPageClick: A function to scroll the PDF to a specific page.
 * - onClose: A function to hide this modal.
 */
const PDFThumbnailView = ({ pdfDoc, onPageClick, onClose }) => {
    const [numPages, setNumPages] = useState(0);
    const containerRef = useRef(null);
    const [visiblePages, setVisiblePages] = useState(new Set());
    const observerRef = useRef(null);

    useEffect(() => {
        if (pdfDoc) {
            setNumPages(pdfDoc.numPages);
        }
    }, [pdfDoc]);

    useEffect(() => {
        if (!containerRef.current) return;

        //  IntersectionObserver: This makes the overview very fast!
        // It only renders thumbnails that you can actually see on the screen.
        observerRef.current = new IntersectionObserver(
            (entries) => {
                setVisiblePages((prevVisible) => {
                    const nextVisible = new Set(prevVisible);
                    entries.forEach((entry) => {
                        const pageNum = parseInt(entry.target.getAttribute("data-page-number"), 10);
                        if (entry.isIntersecting) {
                            nextVisible.add(pageNum);
                        }
                    });
                    return nextVisible;
                });
            },
            {
                root: containerRef.current,
                rootMargin: "200px", // ⭐ IMPORTANT: Pre-loads pages 200px before you reach them.
                threshold: 0.1,
            }
        );

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    const registerItem = useCallback((el) => {
        if (el && observerRef.current) {
            observerRef.current.observe(el);
        }
    }, []);

    if (!pdfDoc) return null;

    return (
        <div className="pdf-thumbnail-overlay" onClick={onClose}>
            <div className="pdf-thumbnail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pdf-thumbnail-header">
                    <h3>PDF Overview</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="pdf-thumbnail-grid" ref={containerRef}>
                    {Array.from({ length: numPages }, (_, i) => (
                        <ThumbnailItem
                            key={i + 1}
                            pageNum={i + 1}
                            pdfDoc={pdfDoc}
                            onClick={() => onPageClick(i + 1)}
                            isVisible={visiblePages.has(i + 1)}
                            registerRef={registerItem}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

//  ThumbnailItem: A single small page box in the grid.
// React.memo makes sure we only re-draw it if something actually changes.
const ThumbnailItem = React.memo(({ pageNum, pdfDoc, onClick, isVisible, registerRef }) => {
    const canvasRef = useRef(null);
    const [isRendered, setIsRendered] = useState(false);
    const itemRef = useRef(null);

    // Register with parent's observer
    useEffect(() => {
        if (itemRef.current) {
            registerRef(itemRef.current);
        }
    }, [registerRef]);

    useEffect(() => {
        if (isVisible && !isRendered && pdfDoc && canvasRef.current) {
            let isMounted = true;
            let pdfPage = null;

            const renderThumbnail = async () => {
                try {
                    pdfPage = await pdfDoc.getPage(pageNum);
                    if (!isMounted) return;

                    const viewport = pdfPage.getViewport({ scale: 0.3 }); // 📏 scale 0.3 makes it a small thumbnail.
                    const canvas = canvasRef.current;
                    if (!canvas) return;

                    const context = canvas.getContext("2d");
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    // ⭐ IMPORTANT: This line draws the PDF page onto the tiny canvas.
                    await pdfPage.render({
                        canvasContext: context,
                        viewport: viewport,
                    }).promise;

                    if (isMounted) setIsRendered(true);
                } catch (error) {
                    console.error(`Error rendering thumbnail for page ${pageNum}:`, error);
                } finally {
                    // 🧹 MEMORY CLEANUP: Essential for performance in large PDFs.
                    if (pdfPage) {
                        pdfPage.cleanup();
                    }
                }
            };
            renderThumbnail();

            return () => {
                isMounted = false;
            };
        }
    }, [isVisible, isRendered, pdfDoc, pageNum]);

    return (
        <div
            className="thumbnail-item-wrapper"
            ref={itemRef}
            data-page-number={pageNum}
            onClick={onClick}
        >
            <div className="thumbnail-container">
                <div className="thumbnail-box">
                    <canvas ref={canvasRef} />
                    {!isRendered && <div className="thumbnail-placeholder">Loading...</div>}
                </div>

                <div className="thumbnail-label">Page {pageNum}</div>
            </div>
        </div>
    );
});

export default PDFThumbnailView;
