import { useState, useEffect, useCallback, useRef } from "react";
import { handleImageSelection } from "./pdfImageSelection";
import { handleTextDragStart } from "./pdfDragHandlers";
import { getPdfSelectionDetails } from "./pdfSelectionUtils";

/**
 * Custom hook for PDF selection functionality (text and image)
 * Handles both text selection highlighting and box selection for images
 * @param {Object} containerRef - React ref to PDF container
 * @param {string} mode - Current mode ("select" or other)
 * @returns {Object} Object containing selection state and handlers
 */
export const useSelection = (containerRef, mode, contentRef = null, zoomLevel = 1, sourcePdfId = null) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [popupData, setPopupData] = useState(null);
    const [multiSelections, setMultiSelections] = useState([]);

    const clearPopup = useCallback(() => {
        setPopupData(null);
        window.getSelection()?.removeAllRanges();
    }, []);

    const addToMultiSelect = useCallback(() => {
        if (!containerRef.current?._lastSelection) return;
        setMultiSelections(prev => [...prev, containerRef.current._lastSelection]);
        clearPopup();
    }, [clearPopup, containerRef]);

    // Clear selection box
    const clearSelectionBox = useCallback(() => {
        try {
            if (selectionBox && containerRef.current?.contains(selectionBox)) {
                containerRef.current.removeChild(selectionBox);
            }
        } catch { }
        finally {
            setSelectionBox(null);
            setIsDragging(false);
            setStartPos(null);
        }
    }, [selectionBox, containerRef]);

    // Handle mouse up - process text selection or image selection
    const handleMouseUp = useCallback(() => {
        if (mode !== "select") {
            clearSelectionBox();
            return;
        }

        const selection = window.getSelection();
        const selectionDetails = getPdfSelectionDetails(selection, containerRef, contentRef);
        const selectedText = selectionDetails?.selectedText || "";

        // Text selection handling
        if (selectedText.length > 0) {
            try {
                const { rect, pageNum, canvas, canvasRect } = selectionDetails || {};
                if (pageNum && canvas && canvasRect) {

                    // Anchor position as fraction of the canvas page (for cross-PDF connection lines)
                    const anchorXPct = canvasRect.width  > 0 ? Math.max(0, Math.min(1, (rect.left + rect.width  / 2 - canvasRect.left) / canvasRect.width))  : 0.5;
                    const anchorYPct = canvasRect.height > 0 ? Math.max(0, Math.min(1, (rect.top  + rect.height / 2 - canvasRect.top)  / canvasRect.height)) : 0.5;

                    const containerRect = containerRef.current.getBoundingClientRect();
                    const containerW = containerRef.current.clientWidth;

                    // Estimated popup dimensions for boundary clamping
                    const POPUP_W = 360;
                    const POPUP_H = 38;
                    const GAP = 10;

                    const rawX = (rect.left + rect.width / 2) - containerRect.left;

                    // Clamp x so the popup (centered at x) stays within the container
                    const clampedX = Math.max(POPUP_W / 2 + GAP, Math.min(containerW - POPUP_W / 2 - GAP, rawX));

                    // Prefer above selection; fall back to below if too close to top
                    const yAbove = rect.top - containerRect.top - POPUP_H - GAP;
                    const yBelow = rect.bottom - containerRect.top + GAP;
                    const finalY = yAbove >= GAP ? yAbove : yBelow;

                    setPopupData({
                        position: {
                            x: clampedX,
                            y: finalY,
                        },
                        selectedText,
                        pageNum,
                        anchorXPct,
                        anchorYPct,
                    });

                    // Store selection data for later usage
                    const selData = {
                        pageNum,
                        text: selectedText,
                        xPct: (rect.left - canvasRect.left) / canvasRect.width,
                        yPct: (rect.top - canvasRect.top) / canvasRect.height,
                        widthPct: rect.width / canvasRect.width,
                        heightPct: rect.height / canvasRect.height,
                        fromPDF: true,
                        type: "anchor",
                    };
                    containerRef.current._lastSelection = selData;
                }
                return;
            } catch (err) {
                console.warn("Selection processing failed:", err);
            }
        }

        // Image selection handling (box selection)
        if (isDragging && selectionBox) {
            const selBoxRect = selectionBox.getBoundingClientRect();
            handleImageSelection(
                containerRef.current,
                selBoxRect,
                clearSelectionBox,
                mode,
                zoomLevel,
                sourcePdfId
            );
            return;
        }

        clearSelectionBox();
    }, [mode, selectionBox, isDragging, clearSelectionBox, containerRef, contentRef, zoomLevel, sourcePdfId]);

    // Refs to track drag state and timing (persisting across renders)
    const longPressTimerRef = useRef(null);
    const isTouchSelectingRef = useRef(false);
    const touchStartCoordsRef = useRef(null);
    const isTouchEventRef = useRef(false); // 🔒 Lock to prevent mouse handlers during touch
    const pendingMouseStartRef = useRef(null); // Pending mouse-down pos — box only created after drag threshold
    const penTextDragRef = useRef(null); // Tracks pen drag of existing text selection

    // Setup event listeners for selection
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const getClientPos = (e) => {
            if (e.touches && e.touches[0]) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };

        // when selection box is created is update its size and position
        const updateBox = (clientX, clientY) => {
            const box = container.querySelector(".current-selection-box");
            if (!box) return;

            const startX = parseFloat(box.dataset.startX);
            const startY = parseFloat(box.dataset.startY);

            const rect = container.getBoundingClientRect();
            const currentX = clientX - rect.left + container.scrollLeft;
            const currentY = clientY - rect.top + container.scrollTop;

            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const left = Math.min(currentX, startX);
            const top = Math.min(currentY, startY);

            box.style.left = `${left}px`;
            box.style.top = `${top}px`;
            box.style.width = `${width}px`;
            box.style.height = `${height}px`;
        };

        // it is used when mouse is pressed
        const startNewSelection = (clientX, clientY) => {
            const rect = container.getBoundingClientRect();
            const startX = clientX - rect.left + container.scrollLeft;
            const startY = clientY - rect.top + container.scrollTop;

            setIsDragging(true);
            setStartPos({ x: startX, y: startY });

            // FIX: Clear any existing text selection/popup to prevent conflicts
            clearPopup();

            // Remove any existing temporary boxes (cleanup)
            const oldBox = container.querySelector(".current-selection-box");
            if (oldBox) oldBox.remove();

            const box = document.createElement("div");
            box.style.position = "absolute";
            box.style.border = "2px dashed red";
            box.style.background = "rgba(255,0,0,0.08)";
            box.style.left = `${startX}px`;
            box.style.top = `${startY}px`;
            box.style.zIndex = "999";
            box.classList.add("selection-box");
            box.classList.add("current-selection-box"); // Marker class

            // Store start pos on element for reliable access in listeners
            box.dataset.startX = startX;
            box.dataset.startY = startY;

            container.appendChild(box);
            setSelectionBox(box);
        };

        // 🖱️ MOUSE HANDLER (Immediate)
        const handleMouseDown = (e) => {
            if (mode !== "select") return;
            if (e.button !== 0) return;

            // 🔒 Skip mouse if touch is active
            if (isTouchEventRef.current) return;

            const isTextNode = e.target.closest(".textLayer span");
            if (isTextNode) return;
            const isCanvasOrLayer = e.target.closest("canvas") || e.target.closest(".textLayer");
            if (!isCanvasOrLayer) return;

            e.preventDefault();
            const { x, y } = getClientPos(e);
            // Store pending start — box only created once drag threshold is exceeded
            pendingMouseStartRef.current = { x, y };
        };

        const handleMouseMove = (e) => {
            if (mode !== "select") return;

            // 🔒 Skip mouse if touch is active
            if (isTouchEventRef.current) return;

            // If there's a pending mouse start, check drag threshold (8px)
            if (pendingMouseStartRef.current) {
                const { x, y } = getClientPos(e);
                const dx = x - pendingMouseStartRef.current.x;
                const dy = y - pendingMouseStartRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 8) {
                    startNewSelection(pendingMouseStartRef.current.x, pendingMouseStartRef.current.y);
                    pendingMouseStartRef.current = null;
                    updateBox(x, y);
                }
                return;
            }

            const box = container.querySelector(".current-selection-box");
            if (!box) return;

            e.preventDefault();
            const { x, y } = getClientPos(e);
            updateBox(x, y);
        };

        const handleMouseUpWrapper = () => {
            // 🔒 Skip mouse if touch is active
            if (isTouchEventRef.current) return;

            pendingMouseStartRef.current = null; // Clear any pending start

            // Cleanup marker class on commit
            const box = container.querySelector(".current-selection-box");
            if (box) box.classList.remove("current-selection-box");
            handleMouseUp();
        };

        // 👆 TOUCH HANDLER (Delayed) using REFS
        const handleTouchStart = (e) => {
            if (mode !== "select") return;
            if (e.touches.length > 1) return;

            isTouchEventRef.current = true; // 🔒 Lock mouse handlers

            // 🛑 CRITICAL FIX: Allow native Text Selection!
            // If touching text, DO NOT start image selection timer.
            const isTextNode = e.target.closest(".textLayer span");
            const isDraggableImage = e.target.closest(".pdf-draggable-image");

            if (isTextNode || isDraggableImage) {
                isTouchEventRef.current = false;
                return;
            }

            const t = e.touches[0];
            touchStartCoordsRef.current = { x: t.clientX, y: t.clientY };
            isTouchSelectingRef.current = false;

            // Start Timer. DO NOT PREVENT DEFAULT (Allow Scroll).
            longPressTimerRef.current = setTimeout(() => {
                isTouchSelectingRef.current = true;
                if (navigator.vibrate) navigator.vibrate(50);
                startNewSelection(t.clientX, t.clientY);
            }, 500);
        };

        const handleTouchMove = (e) => {
            // If neither selecting nor waiting, ignore
            if (!longPressTimerRef.current && !isTouchSelectingRef.current) return;

            const t = e.touches[0];

            if (!isTouchSelectingRef.current) {
                // Timer is running. Check if moved?
                const dx = Math.abs(t.clientX - touchStartCoordsRef.current.x);
                const dy = Math.abs(t.clientY - touchStartCoordsRef.current.y);

                if (dx > 10 || dy > 10) {
                    // User moved -> It's a scroll -> Cancel timer
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                    isTouchEventRef.current = false; // 🔒 Release lock on scroll
                }
            } else {
                // Selection Triggered!
                // NOW we prevent default to block scroll while drawing box
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                updateBox(t.clientX, t.clientY);
            }
        };

        const handleTouchEnd = (e) => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }

            if (isTouchSelectingRef.current) {
                // Commit image selection ONLY
                const box = container.querySelector(".current-selection-box");
                if (box) box.classList.remove("current-selection-box");
                handleMouseUp();
            } else {
                // Small delay so browser can finish updating native selection
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (getPdfSelectionDetails(selection, containerRef, contentRef)?.selectedText) {
                        handleMouseUp();
                        return;
                    }

                    // 📱 Fallback: if no native selection, tap on textLayer → select nearest word
                    const touch = e.changedTouches?.[0];
                    if (touch) {
                        const el = document.elementFromPoint(touch.clientX, touch.clientY);
                        if (el?.closest(".textLayer")) {
                            // Try caretRangeFromPoint (Chrome/WebKit) or caretPositionFromPoint (Firefox)
                            let range = null;
                            if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(touch.clientX, touch.clientY);
                            } else if (document.caretPositionFromPoint) {
                                const pos = document.caretPositionFromPoint(touch.clientX, touch.clientY);
                                if (pos) {
                                    range = document.createRange();
                                    range.setStart(pos.offsetNode, pos.offset);
                                    range.collapse(true);
                                }
                            }
                            if (range) {
                                range.expand("word");
                                const sel = window.getSelection();
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Check again with the newly created selection
                                setTimeout(() => {
                                    if (getPdfSelectionDetails(window.getSelection(), containerRef, contentRef)?.selectedText) {
                                        handleMouseUp();
                                    }
                                }, 50);
                            }
                        }
                    }
                }, 100);
            }

            isTouchSelectingRef.current = false;
            isTouchEventRef.current = false; // 🔒 Release lock
        };

        // ✏️ PEN/STYLUS HANDLER — acts like mouse (immediate, no long-press)
        const handlePenDown = (e) => {
            if (e.pointerType !== 'pen') return;
            if (mode !== "select") return;

            const isTextNode = e.target.closest(".textLayer span");
            const isDraggableImage = e.target.closest(".pdf-draggable-image");

            if (isDraggableImage) return; // Image has its own pointer drag handler

            if (isTextNode) {
                // Check if there is already a text selection — pen is starting a drag
                const selection = window.getSelection();
                if (selection && selection.toString().trim().length > 0) {
                    penTextDragRef.current = { x: e.clientX, y: e.clientY, dragging: false };
                }
                // Let native browser handle text selection (pen fires mouse events too)
                return;
            }

            const isCanvasOrLayer = e.target.closest("canvas") || e.target.closest(".textLayer");
            if (!isCanvasOrLayer) return;

            e.preventDefault();
            // 🔒 Lock mouse handlers — pen fires synthetic mouse events simultaneously.
            // Without this lock, both pen AND mouse handlers process the same selection,
            // causing double startNewSelection and double handleMouseUp calls.
            isTouchEventRef.current = true;
            pendingMouseStartRef.current = { x: e.clientX, y: e.clientY };
        };

        const handlePenMove = (e) => {
            if (e.pointerType !== 'pen') return;
            if (mode !== "select") return;

            // Handle drag of existing text selection to workspace
            if (penTextDragRef.current && !penTextDragRef.current.dragging) {
                const dx = e.clientX - penTextDragRef.current.x;
                const dy = e.clientY - penTextDragRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    penTextDragRef.current.dragging = true;
                    // Dispatch custom drag event so initGlobalTouchDrag handles ghost + drop
                    const selection = window.getSelection();
                    const selText = selection?.toString().trim();
                    if (selText) {
                        const snippet = {
                            id: Date.now(),
                            type: "text",
                            text: selText,
                            fromPDF: true,
                            ...(sourcePdfId != null && { pdf_id: sourcePdfId }),
                        };
                        window.dispatchEvent(new CustomEvent("pdf-touch-drag-start", {
                            detail: { snippet, startX: e.clientX, startY: e.clientY }
                        }));
                        clearPopup();
                    }
                }
                return;
            }

            if (pendingMouseStartRef.current) {
                const dx = e.clientX - pendingMouseStartRef.current.x;
                const dy = e.clientY - pendingMouseStartRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 3) { // 3px threshold for pen precision
                    startNewSelection(pendingMouseStartRef.current.x, pendingMouseStartRef.current.y);
                    pendingMouseStartRef.current = null;
                    updateBox(e.clientX, e.clientY);
                }
                return;
            }

            const box = container.querySelector(".current-selection-box");
            if (!box) return;
            e.preventDefault();
            updateBox(e.clientX, e.clientY);
        };

        const handlePenUp = (e) => {
            if (e.pointerType !== 'pen') return;
            const wasDraggingText = penTextDragRef.current?.dragging;
            penTextDragRef.current = null;
            pendingMouseStartRef.current = null;
            const box = container.querySelector(".current-selection-box");
            if (box) box.classList.remove("current-selection-box");
            if (!wasDraggingText) {
                // Process the selection
                handleMouseUp();
                // Keep mouse lock for ~100ms to suppress synthetic mouseup
                // that fires immediately after pointerup (would double-process)
                setTimeout(() => { isTouchEventRef.current = false; }, 100);
            } else {
                isTouchEventRef.current = false;
            }
        };

        // LISTENERS
        container.addEventListener("pointerdown", handlePenDown);
        container.addEventListener("pointermove", handlePenMove);
        container.addEventListener("pointerup", handlePenUp);
        container.addEventListener("pointercancel", handlePenUp);
        container.addEventListener("mousedown", handleMouseDown);
        container.addEventListener("mousemove", handleMouseMove);
        container.addEventListener("mouseup", handleMouseUpWrapper);
        container.addEventListener("dragstart", (e) => handleTextDragStart(e, containerRef, mode, zoomLevel, sourcePdfId));

        container.addEventListener("touchstart", handleTouchStart, { passive: true }); // Passive:true allows scroll
        container.addEventListener("touchmove", handleTouchMove, { passive: false }); // Passive:false allows preventDefault later
        container.addEventListener("touchend", handleTouchEnd);
        container.addEventListener("touchcancel", handleTouchEnd); // Handle cancel too


        // Handle text selection change
        const handleSelectionChange = () => {
            const selection = window.getSelection();
            const selectionDetails = getPdfSelectionDetails(selection, containerRef, contentRef);
            if (selectionDetails?.selectedText && selectionDetails.canvasRect) {
                const { rect, pageNum, canvasRect, selectedText } = selectionDetails;
                const selData = {
                    pageNum,
                    text: selectedText,
                    xPct: (rect.left - canvasRect.left) / canvasRect.width,
                    yPct: (rect.top - canvasRect.top) / canvasRect.height,
                    widthPct: rect.width / canvasRect.width,
                    heightPct: rect.height / canvasRect.height,
                    fromPDF: true,
                    type: "anchor",
                };
                containerRef.current._lastSelection = selData;
            }
        };
        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            // Cleanup listeners
            container.removeEventListener("pointerdown", handlePenDown);
            container.removeEventListener("pointermove", handlePenMove);
            container.removeEventListener("pointerup", handlePenUp);
            container.removeEventListener("pointercancel", handlePenUp);
            container.removeEventListener("mousedown", handleMouseDown);
            container.removeEventListener("mousemove", handleMouseMove);
            container.removeEventListener("mouseup", handleMouseUpWrapper);
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
            container.removeEventListener("touchcancel", handleTouchEnd);

            document.removeEventListener("selectionchange", handleSelectionChange);

            // Cleanup timer
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
            }
        };
    }, [isDragging, selectionBox, startPos, mode, handleMouseUp, containerRef, contentRef, clearSelectionBox, clearPopup, zoomLevel, sourcePdfId]);

    return {
        isDragging,
        startPos,
        selectionBox,
        clearSelectionBox,
        handleMouseUp,
        popupData,
        clearPopup,
        multiSelections,
        setMultiSelections,
        addToMultiSelect,
    };
};
