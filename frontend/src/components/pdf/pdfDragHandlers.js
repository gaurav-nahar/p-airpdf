
import { getPdfSelectionDetails } from "./pdfSelectionUtils";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const buildSelectionOcrImage = (canvas, rect, canvasRect) => {
  if (!canvas || !canvasRect) return null;

  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  const cropX = Math.max(0, (rect.left - canvasRect.left) * scaleX);
  const cropY = Math.max(0, (rect.top - canvasRect.top) * scaleY);
  const cropW = Math.min(canvas.width - cropX, rect.width * scaleX);
  const cropH = Math.min(canvas.height - cropY, rect.height * scaleY);

  if (cropW <= 2 || cropH <= 2) return null;

  const sourceCtx = canvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) return null;

  const imageData = sourceCtx.getImageData(cropX, cropY, cropW, cropH);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = cropW;
  tempCanvas.height = cropH;
  tempCanvas.getContext("2d", { willReadFrequently: true })?.putImageData(imageData, 0, 0);
  return tempCanvas.toDataURL("image/png");
};

export function handleTextDragStart(e, containerRef, mode, zoomLevel = 1, sourcePdfId = null) {
  if (mode !== "select") return;

  const selection = window.getSelection();
  const selectionDetails = getPdfSelectionDetails(selection, containerRef, {
    current: containerRef.current.querySelector(".pdf-zoom-content") || containerRef.current,
  });
  if (!selectionDetails?.selectedText) return;

  const { rect, pageNum, canvas, canvasRect, selectedText: text } = selectionDetails;

  // 📸 TEXT SNIPPET CREATION (No Image Magic)
  if (canvas && canvasRect) {
    const zoomScale = zoomLevel; // Use passed zoomLevel
    const shouldAttachOcrImage = !DEVANAGARI_RE.test(text);

    // 2. Create Text Snippet
    const snippet = {
      id: Date.now(),
      type: "text", // Crucial: 'text' type
      text: text,
      // Store coordinates relative to the PAGE CANVAS in logical pixels
      x: (rect.left - canvasRect.left) / zoomScale,
      y: (rect.top - canvasRect.top) / zoomScale,
      width: rect.width / zoomScale,
      height: rect.height / zoomScale,
      // Store normalized coordinates
      xPct: (rect.left - canvasRect.left) / canvasRect.width,
      yPct: (rect.top - canvasRect.top) / canvasRect.height,
      widthPct: rect.width / canvasRect.width,
      heightPct: rect.height / canvasRect.height,
      pageNum,
      fromPDF: true,
      ...(shouldAttachOcrImage ? { ocrImage: buildSelectionOcrImage(canvas, rect, canvasRect) } : {}),
      ...(sourcePdfId != null && { pdf_id: sourcePdfId }),
    };


    // For mouse drag
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/json", JSON.stringify(snippet));
      e.dataTransfer.effectAllowed = "copy";
      // We don't set a drag image for text, browser default is fine, or we could set a transparent one
    }

    // For touch devices
    e.target._dragSnippet = snippet;
  } else {
    console.warn("Canvas not found for text drag coordinate calculation");
  }
}


// --------------------- Image Drag ---------------------
// ✂️ attachImageDragHandler: Handles dragging for a "cropped" image snippet.
// Called from: pdfImageSelection.js -> handleImageSelection
export function attachImageDragHandler(imgEl, snippet, mode) {
  imgEl.addEventListener("dragstart", (e) => {
    if (mode !== "select") {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", JSON.stringify(snippet));
    const dragImg = new Image();
    dragImg.src = snippet.src;
    e.dataTransfer.setDragImage(dragImg, snippet.width / 2, snippet.height / 2);
  });

  // Touch + pen drag via Pointer Events (works for touch AND Wacom stylus)
  let pointerDragActive = false;

  imgEl.addEventListener("pointerdown", (e) => {
    if (mode !== "select") return;
    if (e.pointerType === 'mouse') return; // Mouse uses native dragstart above
    e.preventDefault(); // Prevent browser default pen pan / ink behavior
    e.stopPropagation();
    pointerDragActive = true;
    imgEl._ptrStartX = e.clientX;
    imgEl._ptrStartY = e.clientY;
    imgEl.setPointerCapture(e.pointerId);
  }, { passive: false });

  imgEl.addEventListener("pointermove", (e) => {
    if (!pointerDragActive) return;
    e.preventDefault();
    const dx = e.clientX - imgEl._ptrStartX;
    const dy = e.clientY - imgEl._ptrStartY;
    // Pen needs a smaller threshold (3px) vs touch (10px) since stylus is more precise
    const threshold = e.pointerType === 'pen' ? 3 : 10;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      window.dispatchEvent(
        new CustomEvent("pdf-touch-drag-start", {
          detail: { snippet, startX: e.clientX, startY: e.clientY }
        })
      );
      pointerDragActive = false;
    }
  }, { passive: false });

  imgEl.addEventListener("pointerup", () => { pointerDragActive = false; });
  imgEl.addEventListener("pointercancel", () => { pointerDragActive = false; });
}

/**
 * Initializes global touch drag listeners for PDF images.
 * This handles the "ghost" drag element and drop logic on the Workspace.
 * 
 * @param {Function} addSnippet - Function to add the dropped snippet to workspace
 * @param {Function} screenToWorld - Helper to convert screen coords to world coords
 * @param {Object} workspaceRef - Ref to the workspace container to check drop bounds
 * @returns {Function} cleanup - Function to remove the global listener
 */
export function initGlobalTouchDrag(addSnippet, screenToWorld, workspaceRef) {
  const handleTouchDragStart = (e) => {
    const { snippet, startX, startY } = e.detail;
    if (!snippet) return;

    // Create Ghost Element
    const ghost = document.createElement('img');
    ghost.src = snippet.src || ''; // Ensure src exists if image
    ghost.style.position = 'fixed';
    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;
    ghost.style.width = `${snippet.width}px`;
    ghost.style.maxWidth = '200px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0.8';
    ghost.style.border = '2px dashed #007bff';
    ghost.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ghost);

    let dropped = false; // guard against double-drop (touch fires both touchend + pointerup)

    const commitDrop = (clientX, clientY) => {
      if (dropped) return;
      dropped = true;
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      if (workspaceRect &&
        clientX >= workspaceRect.left &&
        clientX <= workspaceRect.right &&
        clientY >= workspaceRect.top &&
        clientY <= workspaceRect.bottom) {
        const dropPos = screenToWorld(clientX, clientY);
        if (addSnippet) {
          addSnippet(snippet, dropPos);
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }
      ghost.remove();
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('pointermove', handlePenMove);
      window.removeEventListener('pointerup', handlePenUp);
      window.removeEventListener('pointercancel', handlePenUp);
    };

    // ✋ Touch handlers
    const handleTouchMove = (tm) => {
      const t = tm.touches[0];
      ghost.style.left = `${t.clientX}px`;
      ghost.style.top = `${t.clientY}px`;
    };

    const handleTouchEnd = (te) => {
      const t = te.changedTouches[0];
      commitDrop(t.clientX, t.clientY);
    };

    // ✏️ Pen/stylus handlers — pen fires pointermove/pointerup, NOT touchmove/touchend
    const handlePenMove = (pm) => {
      if (pm.pointerType === 'touch') return; // touch handled above
      ghost.style.left = `${pm.clientX}px`;
      ghost.style.top = `${pm.clientY}px`;
    };

    const handlePenUp = (pu) => {
      if (pu.pointerType === 'touch') return; // touch handled above
      commitDrop(pu.clientX, pu.clientY);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    window.addEventListener('pointermove', handlePenMove);
    window.addEventListener('pointerup', handlePenUp);
    window.addEventListener('pointercancel', handlePenUp);
  };

  window.addEventListener('pdf-touch-drag-start', handleTouchDragStart);

  // Return cleanup function
  return () => {
    window.removeEventListener('pdf-touch-drag-start', handleTouchDragStart);
  };
}
