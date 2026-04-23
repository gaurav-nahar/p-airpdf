import { attachImageDragHandler } from "./pdfDragHandlers";

/**
 * Handle image selection (crop) on mouse up
 * @param {HTMLElement} containerRef - The PDF container ref
 * @param {DOMRect} selectionBoxRect - The bounding rect of selection box
 * @param {Function} clearSelectionBox - Function to clear selection box
 * @param {string} mode - Current mode
 */
export const handleImageSelection = (containerRef, selectionBoxRect, clearSelectionBox, mode, zoomLevel = 1, sourcePdfId = null) => {
    if (!selectionBoxRect) return;

    clearSelectionBox();

    // CRITICAL: Only select PDF canvas, exclude brush highlight and preview canvases
    const canvases = Array.from(containerRef.querySelectorAll("canvas")).filter(c =>
        !c.closest(".pdf-drawing-container") &&
        !c.classList.contains('brush-highlight-canvas') &&
        !c.classList.contains('brush-preview-canvas')
    );
    let clickedCanvas = null;
    let pageNumber = null;

    canvases.forEach((c) => {
        const crect = c.getBoundingClientRect();
        if (
            selectionBoxRect.top >= crect.top &&
            selectionBoxRect.bottom <= crect.bottom &&
            selectionBoxRect.left >= crect.left &&
            selectionBoxRect.right <= crect.right
        ) {
            clickedCanvas = c;
            const wrapper = c.closest(".pdf-page-wrapper") || c.closest("[data-page-number]");
            if (wrapper) {
                pageNumber = parseInt(wrapper.dataset.pageNumber, 10);
            }
        }
    });
    if (!clickedCanvas || !pageNumber) return;

    const canvasRect = clickedCanvas.getBoundingClientRect();
    const scaleX = clickedCanvas.width / canvasRect.width;
    const scaleY = clickedCanvas.height / canvasRect.height;
    const cropX = (selectionBoxRect.left - canvasRect.left) * scaleX;
    const cropY = (selectionBoxRect.top - canvasRect.top) * scaleY;
    const cropW = selectionBoxRect.width * scaleX;
    const cropH = selectionBoxRect.height * scaleY;
    if (cropW <= 5 || cropH <= 5) return;

    // Take a screenshot of selected area
    const ctx = clickedCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(cropX, cropY, cropW, cropH);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    tempCanvas.getContext("2d", { willReadFrequently: true }).putImageData(imageData, 0, 0);
    const src = tempCanvas.toDataURL("image/png");

    const imgEl = document.createElement("img");
    imgEl.src = src;
    imgEl.classList.add("pdf-draggable-image"); // 🏷️ Add class for identification

    // 🚀 FIX: Calculate zoom from DOM to ensure accuracy during resize/layout shifts
    const effectiveZoom = canvasRect.width / clickedCanvas.offsetWidth;

    const left = (selectionBoxRect.left - canvasRect.left) / effectiveZoom;
    const top = (selectionBoxRect.top - canvasRect.top) / effectiveZoom;
    const scaledW = selectionBoxRect.width / effectiveZoom;
    const scaledH = selectionBoxRect.height / effectiveZoom;

    imgEl.style.position = "absolute";
    imgEl.style.left = `${left}px`;
    imgEl.style.top = `${top}px`;
    imgEl.style.width = `${scaledW}px`;
    imgEl.style.height = `${scaledH}px`;
    imgEl.style.cursor = "grab";
    imgEl.style.zIndex = "1000";
    imgEl.style.pointerEvents = "auto";
    imgEl.setAttribute("draggable", true);

    attachImageDragHandler(
        imgEl,
        {
            id: Date.now(),
            type: "image",
            src,
            width: cropW,
            height: cropH,
            pageNum: pageNumber,
            fromPDF: true,
            ...(sourcePdfId != null && { pdf_id: sourcePdfId }),
            x: left,
            y: top,
            xPct: (selectionBoxRect.left - canvasRect.left) / canvasRect.width,
            yPct: (selectionBoxRect.top - canvasRect.top) / canvasRect.height,
            widthPct: selectionBoxRect.width / canvasRect.width,
            heightPct: selectionBoxRect.height / canvasRect.height,
        },
        mode
    );

    const pageWrapper = clickedCanvas.closest(".pdf-page-wrapper");
    if (!pageWrapper) return;

    // === 1️⃣ Temporary highlight div ===
    const highlightDiv = document.createElement("div");
    highlightDiv.style.position = "absolute";
    highlightDiv.style.left = `${left}px`;
    highlightDiv.style.top = `${top}px`;
    highlightDiv.style.width = `${scaledW}px`; // 🚀 FIX: Use scaled width
    highlightDiv.style.height = `${scaledH}px`; // 🚀 FIX: Use scaled height
    highlightDiv.style.backgroundColor = "rgba(19, 179, 207, 0.3)"; // semi-transparent yellow
    highlightDiv.style.border = "2px solid blue";
    highlightDiv.style.pointerEvents = "none"; // important so it doesn't block drag
    highlightDiv.style.zIndex = "1500"; // below image
    highlightDiv.style.transition = "opacity 1s ease";

    pageWrapper.appendChild(highlightDiv);

    // Fade out and remove after 5 seconds
    setTimeout(() => {
        highlightDiv.style.opacity = "0";
        setTimeout(() => {
            if (highlightDiv.parentNode) highlightDiv.remove();
        }, 1000); // wait for fade-out transition
    }, 8000);

    // === 2️⃣ Append draggable image ===
    pageWrapper.appendChild(imgEl);

    // Optional: remove image after 10 seconds (your previous timer)
    setTimeout(() => {
        if (imgEl && imgEl.parentNode) {
            imgEl.style.transition = "opacity 1s ease";
            imgEl.style.opacity = "0";
            setTimeout(() => {
                if (imgEl.parentNode) imgEl.remove();
            }, 1000);
        }
    }, 8000);
};
