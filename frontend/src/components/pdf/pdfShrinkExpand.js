import { useEffect, useRef, useState } from "react";

/**
 * 🌊 Liquid PDF Shrink & Expand (The "Accordion" Feature)
 * This logic mimics LiquidText by allowing pages to shrink and stack.
 * 
 * HOW IT WORKS: 
 * It changes the 'transform: scaleY()' of PDF pages and stacks them at the top or bottom.
 * 
 * LIBRARY: None (Uses standard React hooks & Browser CSS/Event APIs).
 * CALL LOCATION: Imported and used ONLY in PDFViewer.js.
 */

// Configuration constants

export const MIN_SCALE = 0.04; // Completely flat
export const STACK_GAP = 0;   // No gap
export const TRANSITION = "transform 0.36s cubic-bezier(.22,.9,.32,1)"; // Smooth movement


/**
 * 🎯 getCurrentPageNum: Finds which page is currently in the middle of your screen.
 * CALL LOCATION: Called by simulateShrinkExpand (below) to know where to start shrinking.
 * 
 * @param {HTMLElement} container - The main PDF scroll area.
 * @param {HTMLElement} contentContainer - The element containing the page wrappers (can be same as container).
 * @returns {number} The current page number (1, 2, 3...).
 */
export const getCurrentPageNum = (container, contentContainer = null) => {
    if (!container) return 1;
    const pagesParent = contentContainer || container;
    const children = Array.from(pagesParent.children).filter(
        el => el.dataset && el.dataset.pageNumber
    );
    if (!children.length) return 1;

    const containerRect = container.getBoundingClientRect();
    const viewportCenter = containerRect.top + container.clientHeight / 2;
    let best = 1;
    let bestVisibleHeight = -1;
    let minDiff = Infinity;

    for (let i = 0; i < children.length; i++) {
        const w = children[i];
        if (w.style.position === "absolute") continue;

        const rect = w.getBoundingClientRect();
        if (rect.height <= 0) continue;

        const overlapTop = Math.max(rect.top, containerRect.top);
        const overlapBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = Math.max(0, overlapBottom - overlapTop);
        const center = rect.top + rect.height / 2;
        const diff = Math.abs(center - viewportCenter);

        // Prefer the page that is most visible in the viewport.
        // This stays correct even when the PDF container is zoomed via CSS transform.
        if (
            visibleHeight > bestVisibleHeight + 1 ||
            (Math.abs(visibleHeight - bestVisibleHeight) <= 1 && diff < minDiff)
        ) {
            bestVisibleHeight = visibleHeight;
            minDiff = diff;
            best = parseInt(w.dataset.pageNumber || i + 1, 10);
        }
    }

    return best;
};

/**
 * 🛠️ applyAllShrinks: The "Visual Engine". It actually moves the pages on screen.
 * CALL LOCATION: Called every time a page shrinks or expands.
 * 
 * LOGIC: 
 * 1. It makes shrunk pages 'Absolute' so they can stack on top of each other.
 * 2. It keeps the "Focused" page 'Static' so you can still scroll normally.
 * 3. It adds "Margin" to the focused page to make room for the stack above it.
 * 
 * @param {number} focusedPage - The main page you are reading.
 * @param {HTMLElement} container - The PDF scroll area (for scrolling).
 * @param {HTMLElement} contentContainer - The element containing the pages (for layout).
 * @param {Object} shrinkMapRef - A dictionary of scales {Page1: 0.5, Page2: 1.0}.
 * @param {Object} shrunkBelowRef - List of pages sitting in the bottom stack.
 * @param {Object} shrunkAboveRef - List of pages sitting in the top stack.
 * @param {boolean} debug - If true, it prints logs to console.
 */
// Helper to extract page number from an item that may be {page, focal} or a plain number
const getPage = (item) => typeof item === 'object' ? item.page : item;
const getFocal = (item, fallback) => typeof item === 'object' ? item.focal : fallback;

export const applyAllShrinks = (
    focusedPage,
    container,
    contentContainer,
    shrinkMapRef,
    shrunkBelowRef,
    shrunkAboveRef,
    debug = false
) => {
    if (!container || !contentContainer) return;
    // Only operate on actual PDF page wrappers — skip SVG overlays and other non-page children
    const pages = Array.from(contentContainer.children).filter(
        el => el.dataset && el.dataset.pageNumber
    );
    if (!pages.length || focusedPage < 1 || focusedPage > pages.length) return;

    const focusedEl = pages[focusedPage - 1];
    const prevRect = focusedEl.getBoundingClientRect();
    const prevTopComp = prevRect.top;

    // Group below items by their focal page
    const belowByFocal = {};
    shrunkBelowRef.current.forEach((item) => {
        const p = getPage(item);
        const f = getFocal(item, focusedPage);
        if (p < 1 || p > pages.length) return;
        if (!belowByFocal[f]) belowByFocal[f] = [];
        belowByFocal[f].push(p);
    });

    // Group above items by their focal page
    const aboveByFocal = {};
    shrunkAboveRef.current.forEach((item) => {
        const p = getPage(item);
        const f = getFocal(item, focusedPage);
        if (p < 1 || p > pages.length) return;
        if (!aboveByFocal[f]) aboveByFocal[f] = [];
        aboveByFocal[f].push(p);
    });

    // Flat lists for layout decisions
    const below = Object.values(belowByFocal).flat().sort((a, b) => a - b);
    const above = Object.values(aboveByFocal).flat().sort((a, b) => b - a);

    contentContainer.style.position = "relative";

    // 1. Calculate reserved height for the Above stack
    let aboveStackHeight = 0;
    if (above.length > 0) {
        aboveStackHeight = 20; // Small fixed space for the top stack
    }

    // 2. Initial Layout Reset: Set Shrunken to Absolute, Rest to Static
    const shrunkSet = new Set([...below, ...above]);
    pages.forEach((el, i) => {
        const num = i + 1;
        if (shrunkSet.has(num)) {
            el.style.position = "absolute";
            el.style.pointerEvents = "none";
            el.classList.add(num < focusedPage ? "page-above" : "page-below");
            el.style.overflow = "hidden";
            el.style.backgroundColor = num < focusedPage ? "#cccccc" : "#dddddd";
        } else {
            el.style.position = "static";
            el.style.backgroundColor = "";
            el.style.marginTop = num === focusedPage ? `${aboveStackHeight}px` : "0px";
            el.style.transform = "translateY(0) scaleY(1)";
            el.style.zIndex = num === focusedPage ? 200 : 1;
            el.style.pointerEvents = "auto";
            el.style.transition = TRANSITION;
            el.classList.remove("page-below", "page-above");
        }
    });

    // 3. Capture Anchor Point
    const anchorTop = focusedEl.offsetTop;
    const focusedHeight = focusedEl.offsetHeight;

    // 4. Style Helpers for Shrunken Pages
    const applyBelow = (el, top, scale, zIndex) => {
        el.style.top = `${top}px`;
        el.style.transformOrigin = "top center";
        el.style.transform = `scaleY(${scale})`;
        el.style.zIndex = zIndex;
        el.style.transition = TRANSITION;
        el.style.opacity = scale < 0.01 ? "0" : "1";
    };

    const applyAbove = (el, bottom, scale, zIndex) => {
        const top = bottom - el.offsetHeight;
        el.style.top = `${top}px`;
        el.style.transformOrigin = "bottom center";
        el.style.transform = `scaleY(${scale})`;
        el.style.zIndex = zIndex;
        el.style.transition = TRANSITION;
        el.style.opacity = scale < 0.01 ? "0" : "1";
    };

    // 5. Position 'Below' stacks — each focal group anchors to its own focal page
    Object.entries(belowByFocal).forEach(([focalStr, group]) => {
        const focalNum = parseInt(focalStr, 10);
        const focalEl = pages[focalNum - 1];
        if (!focalEl) return;
        const fAnchorTop = focalEl.offsetTop;
        const fHeight = focalEl.offsetHeight;
        const sorted = [...group].sort((a, b) => a - b);
        let nextTop = fAnchorTop + fHeight;
        sorted.forEach((pageNum, idx) => {
            const el = pages[pageNum - 1];
            if (!el) return;
            const scale = shrinkMapRef.current[pageNum] ?? 1;
            applyBelow(el, nextTop, scale, 100 - idx);
        });
    });

    // 6. Position 'Above' stacks — each focal group anchors to its own focal page
    Object.entries(aboveByFocal).forEach(([focalStr, group]) => {
        const focalNum = parseInt(focalStr, 10);
        const focalEl = pages[focalNum - 1];
        if (!focalEl) return;
        const fAnchorTop = focalEl.offsetTop;
        const sorted = [...group].sort((a, b) => b - a);
        let nextBottom = fAnchorTop;
        sorted.forEach((pageNum, idx) => {
            const el = pages[pageNum - 1];
            if (!el) return;
            const scale = shrinkMapRef.current[pageNum] ?? 1;
            applyAbove(el, nextBottom, scale, 100 - idx);
        });
    });

    // 7. Calculate Total Visual Height
    const naturalHeight = contentContainer.offsetHeight;
    let totalHeight = Math.max(anchorTop + focusedHeight, naturalHeight);
    if (below.length > 0) {
        totalHeight += 20; // Room for bottom stack indicator
    }

    // 8. Compensation for Scroll Jumps
    const newRect = focusedEl.getBoundingClientRect();
    const diff = newRect.top - prevTopComp;
    if (Math.abs(diff) > 1) {
        container.scrollTop += diff;
    }

    return totalHeight;
};

const SCALE_STEP = 0.1;

/**
 * 🧠 simulateShrinkExpand: The "Decision Maker".
 * CALL LOCATION: Called by the mouse wheel or touch event handlers.
 * 
 * LOGIC: 
 * - If you scroll DOWN (with Shift): It shrinks the pages BELOW you.
 * - If you scroll UP (with Shift): It shrinks the pages ABOVE you.
 * - If you scroll the opposite way: It expands (restores) the shrunk pages.
 * 
 * @param {boolean} isDown - True if shrinking downwards, False if upwards.
 * @param {HTMLElement} container - The PDF scroll area.
 * @param {HTMLElement} contentContainer - The element containing the pages.
 * @param {Object} shrinkMapRef - Where we save the scale (size) of each page.
 * @param {Object} shrunkBelowRef - List of pages currently hidden at the bottom.
 * @param {Object} shrunkAboveRef - List of pages currently hidden at the top.
 */
export const simulateShrinkExpand = (
    isDown,
    container,
    contentContainer,
    shrinkMapRef,
    shrunkBelowRef,
    shrunkAboveRef,
    setShrinkStatus,
    setDynamicHeight // 📏 New callback
) => {
    const pagesParent = contentContainer || container;
    const pages = Array.from(pagesParent.children);
    if (!pages.length) return;
    const focused = getCurrentPageNum(container, pagesParent);
    const total = pages.length;

    const round = (val) => Math.round(val * 10) / 10;

    // Shrink Logic
    if (isDown) {
        // Find the page currently being shrunk below for THIS focal point, or the next potential one
        const lastBelowItem = shrunkBelowRef.current
            .filter((item) => getFocal(item, focused) === focused)
            .slice(-1)[0];
        const lastBelowPage = lastBelowItem ? getPage(lastBelowItem) : null;

        let targetPage = lastBelowPage;
        if (!targetPage || (shrinkMapRef.current[targetPage] ?? 1) <= MIN_SCALE) {
            // Find next unshrunk page
            for (let i = focused + 1; i <= total; i++) {
                if ((shrinkMapRef.current[i] ?? 1) === 1) {
                    targetPage = i;
                    shrunkBelowRef.current.push({ page: i, focal: focused });
                    break;
                }
            }
        }

        if (targetPage) {
            let currentScale = shrinkMapRef.current[targetPage] ?? 1;
            currentScale = round(currentScale - SCALE_STEP);
            if (currentScale <= MIN_SCALE) currentScale = MIN_SCALE;
            shrinkMapRef.current[targetPage] = currentScale;
            const totalHeight = applyAllShrinks(focused, container, pagesParent, shrinkMapRef, shrunkBelowRef, shrunkAboveRef);
            if (setDynamicHeight) setDynamicHeight(totalHeight);
        }
    } else {
        // Find the page currently being shrunk above for THIS focal point, or the next potential one
        const lastAboveItem = shrunkAboveRef.current
            .filter((item) => getFocal(item, focused) === focused)
            .slice(-1)[0];
        const lastAbovePage = lastAboveItem ? getPage(lastAboveItem) : null;

        let targetPage = lastAbovePage;
        if (!targetPage || (shrinkMapRef.current[targetPage] ?? 1) <= MIN_SCALE) {
            for (let i = focused - 1; i >= 1; i--) {
                if ((shrinkMapRef.current[i] ?? 1) === 1) {
                    targetPage = i;
                    shrunkAboveRef.current.push({ page: i, focal: focused });
                    break;
                }
            }
        }

        if (targetPage) {
            let currentScale = shrinkMapRef.current[targetPage] ?? 1;
            currentScale = round(currentScale - SCALE_STEP);
            if (currentScale <= MIN_SCALE) currentScale = MIN_SCALE;
            shrinkMapRef.current[targetPage] = currentScale;
            const totalHeight = applyAllShrinks(focused, container, pagesParent, shrinkMapRef, shrunkBelowRef, shrunkAboveRef);
            if (setDynamicHeight) setDynamicHeight(totalHeight);
        }
    }

    // Update state to trigger re-render in the Hook/Component
    if (setShrinkStatus) {
        if (shrunkAboveRef.current.length > 0) setShrinkStatus("top");
        else if (shrunkBelowRef.current.length > 0) setShrinkStatus("bottom");
        else setShrinkStatus(null);
    }
};

/**
 * 🎣 useShrinkExpand: The Event Listener Hook.
 * CALL LOCATION: Used in PDFViewer.js.
 * 
 * LOGIC:
 * - It listens for Shift + Mouse Wheel.
 * - It listens for 2-finger touch movements (like a pinch).
 * - It then tells simulateShrinkExpand to do its job.
 * 
 * @param {Object} containerRef - React ref to the PDF scroll area.
 * @param {Object} contentRef - Optional React ref to the element containing the pages.
 * @returns {Object} Functions like getCurrentPageNum and the shrinkMap data.
 */
export const useShrinkExpand = (containerRef, contentRef = null) => {
    const shrinkMapRef = useRef({});
    const shrunkBelowRef = useRef([]);
    const shrunkAboveRef = useRef([]);
    const [shrinkStatus, setShrinkStatus] = useState(null);
    const [dynamicHeight, setDynamicHeight] = useState(0); // 📏 New state

    useEffect(() => {
        const container = containerRef.current;
        const contentContainer = contentRef ? contentRef.current : container;
        if (!container || !contentContainer) return;

        let wheelCooldown = false;
        const cooldownMs = 60;
        let touchStartDist = null;
        let touchAccumulatedDelta = 0;
        const touchStepDistance = 20; // pixels per shrink step

        const handleSimulateShrinkExpand = (isDown) => {
            simulateShrinkExpand(
                isDown,
                container,
                contentContainer,
                shrinkMapRef,
                shrunkBelowRef,
                shrunkAboveRef,
                setShrinkStatus,
                setDynamicHeight
            );
        };

        const handleWheel = (e) => {
            // Shift+scroll OR horizontal trackpad swipe triggers shrink/expand
            const isHorizontalSwipe = !e.shiftKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 5;
            if (!e.shiftKey && !isHorizontalSwipe) return;
            e.preventDefault();
            if (wheelCooldown) return;
            wheelCooldown = true;
            setTimeout(() => (wheelCooldown = false), cooldownMs);

            // On some trackpads Shift+scroll sends deltaX instead of deltaY — handle both
            let isDown;
            if (isHorizontalSwipe) {
                isDown = e.deltaX > 0;
            } else if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
                isDown = e.deltaY > 0;
            } else {
                isDown = e.deltaX > 0;
            }
            handleSimulateShrinkExpand(isDown);
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 2) {
                const y1 = e.touches[0].clientY;
                const y2 = e.touches[1].clientY;
                touchStartDist = Math.abs(y1 - y2);
                touchAccumulatedDelta = 0;
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();

            const y1 = e.touches[0].clientY;
            const y2 = e.touches[1].clientY;
            const avgY = (y1 + y2) / 2;
            const currentDist = Math.abs(y1 - y2);

            if (touchStartDist !== null) {
                const distDiff = currentDist - touchStartDist;

                // Logic: 
                // 1. If avgY is in bottom half -> Pinch (dist decrease) = Shrink Below (isDown=true)
                // 2. If avgY is in bottom half -> Spread (dist increase) = Expand Below (isDown=false)
                // 3. If avgY is in top half -> Pinch (dist decrease) = Shrink Above (isDown=false)
                // 4. If avgY is in top half -> Spread (dist increase) = Expand Above (isDown=true)

                const containerHeight = container.clientHeight;
                const isTopHalf = (avgY - container.getBoundingClientRect().top) < (containerHeight / 2);

                touchAccumulatedDelta += distDiff;
                touchStartDist = currentDist; // Update base
                let steps = 0
                while (Math.abs(touchAccumulatedDelta) >= touchStepDistance && steps < 1) {
                    const isSpreading = touchAccumulatedDelta > 0;

                    if (isTopHalf) {
                        // Top Half: Spreading expands above (isDown=true in simulate), Pinching shrinks above (isDown=false)
                        handleSimulateShrinkExpand(isSpreading);
                    } else {
                        // Bottom Half: Spreading expands below (isDown=false in simulate), Pinching shrinks below (isDown=true)
                        handleSimulateShrinkExpand(!isSpreading);
                    }

                    if (isSpreading) touchAccumulatedDelta -= touchStepDistance;
                    else touchAccumulatedDelta += touchStepDistance;
                    steps++;
                }
            }
        };

        const handleTouchEnd = (e) => {
            if (e.touches.length < 2) {
                touchStartDist = null;
                touchAccumulatedDelta = 0;
            }
        };

        // 🔙 Expand All: Resets everything to scale 1.0
        const expandAll = () => {
            shrinkMapRef.current = {};
            shrunkBelowRef.current = [];
            shrunkAboveRef.current = [];
            setShrinkStatus(null);

            // Reset clipping and margins on all pages
            const pages = Array.from(contentContainer.children).filter(
                el => el.dataset && el.dataset.pageNumber
            );
            pages.forEach(pageEl => {
                pageEl.style.clipPath = "";
                pageEl.style.marginTop = "";
                pageEl.style.marginBottom = "";
            });

            // We need to apply the reset visually
            const focused = getCurrentPageNum(container, contentContainer);
            applyAllShrinks(focused, container, contentContainer, shrinkMapRef, shrunkBelowRef, shrunkAboveRef);
            // Reset to 0 so PDFViewer falls back to pdfDimensions.height (full document height)
            if (setDynamicHeight) setDynamicHeight(0);
        };
        container._expandAll = expandAll; // Exposure for hook return

        container.addEventListener("wheel", handleWheel, { passive: false });
        container.addEventListener("touchstart", handleTouchStart, { passive: false });
        container.addEventListener("touchmove", handleTouchMove, { passive: false });
        container.addEventListener("touchend", handleTouchEnd);

        return () => {
            container.removeEventListener("wheel", handleWheel);
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
        };
    }, [containerRef, contentRef]);

    return {
        shrinkMapRef,
        shrunkBelowRef,
        shrunkAboveRef,
        shrinkState: shrinkStatus, // Use state-based status
        expandAll: () => {
            if (containerRef.current && containerRef.current._expandAll) {
                containerRef.current._expandAll();
            }
        },
        applyAllShrinks: (focusedPage, debug = false) =>
            applyAllShrinks(
                focusedPage,
                containerRef.current,
                contentRef ? contentRef.current : containerRef.current,
                shrinkMapRef,
                shrunkBelowRef,
                shrunkAboveRef,
                debug
            ),
        contractBetween: (startPageOrObj, endPageOrObj) => {
            // Support both simple page numbers and objects with highlight data
            const isStartObj = typeof startPageOrObj === 'object';
            const isEndObj = typeof endPageOrObj === 'object';

            const startPage = isStartObj ? startPageOrObj.pageNum : startPageOrObj;
            const endPage = isEndObj ? endPageOrObj.pageNum : endPageOrObj;

            const min = Math.min(startPage, endPage);
            const max = Math.max(startPage, endPage);

            shrinkMapRef.current = {};
            shrunkBelowRef.current = [];
            shrunkAboveRef.current = [];

            // Shrink intermediate pages
            for (let i = min + 1; i < max; i++) {
                shrunkBelowRef.current.push(i);
                shrinkMapRef.current[i] = MIN_SCALE;
            }

            // Apply clipping to anchor pages based on highlight positions
            const container = containerRef.current;
            const contentContainer = contentRef ? contentRef.current : container;
            if (contentContainer && (isStartObj || isEndObj)) {
                const pages = Array.from(contentContainer.children).filter(
                    el => el.dataset && el.dataset.pageNumber
                );

                // Clip first page (show bottom portion with highlight)
                if (isStartObj && startPage === min) {
                    const pageEl = pages[min - 1];
                    if (pageEl) {
                        const clipTopPct = Math.max(0, (startPageOrObj.yPct * 100) - 10); // 10% padding above
                        pageEl.style.clipPath = `inset(${clipTopPct}% 0 0 0)`;
                        pageEl.style.marginTop = `-${clipTopPct}%`;
                    }
                }

                // Clip last page (show top portion with highlight)
                if (isEndObj && endPage === max) {
                    const pageEl = pages[max - 1];
                    if (pageEl) {
                        const highlightBottom = (endPageOrObj.yPct + (endPageOrObj.heightPct || 0.05)) * 100;
                        const clipBottomPct = Math.max(0, 100 - highlightBottom - 10); // 10% padding below
                        pageEl.style.clipPath = `inset(0 0 ${clipBottomPct}% 0)`;
                        pageEl.style.marginBottom = `-${clipBottomPct}%`;
                    }
                }
            }

            const totalHeight = applyAllShrinks(min, containerRef.current, contentContainer, shrinkMapRef, shrunkBelowRef, shrunkAboveRef);
            if (setDynamicHeight) setDynamicHeight(totalHeight);
            if (shrunkBelowRef.current.length > 0) setShrinkStatus("bottom");
        },
        dynamicHeight, // 📏 Exposure for hook return
        getCurrentPageNum: () => getCurrentPageNum(containerRef.current, contentRef ? contentRef.current : containerRef.current),
    };
};
