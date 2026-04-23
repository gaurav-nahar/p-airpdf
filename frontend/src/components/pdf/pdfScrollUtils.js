
import { renderPage } from "./pdfLoader";

/**
 * Main entry point to scroll the PDF container to one or more snippets.
 * @param {HTMLElement} container - The scrollable PDF container.
 * @param {Object|Array} inputSnippets - Snippet(s) to scroll to.
 * @param {Object} pdfDocument - The PDF.js document object.
 * @param {Object} options - { highlightDuration, isResizing }.
 */
export function scrollToSnippet(container, inputSnippets, pdfDocument, options = {}) {
  if (!container || !inputSnippets) return;

  const snippets = Array.isArray(inputSnippets) ? inputSnippets : [inputSnippets];
  if (snippets.length === 0) return;

  const { highlightDuration = 3000, isResizing = false } = options;

  // 1. If we are resizing, we only apply highlights, no scrolling.
  if (isResizing) {
    snippets.forEach(snp => handleLazyRendering(container, snp, pdfDocument, highlightDuration, false));
    return;
  }

  // 2. Perform scrolling logic
  calculateAndScroll(container, snippets);

  // 3. Apply highlights and handle rendering for each snippet
  snippets.forEach(snp => {
    handleLazyRendering(container, snp, pdfDocument, highlightDuration, true);
  });
}

/**
 * Smoothly scrolls the container to a specific page.
 * @param {HTMLElement} container - The PDF container.
 * @param {number} pageNum - Target page number.
 * @param {Object} pdfDocument - PDFJS document.
 * @param {Object} options - { shrinkState, expandAll }.
 */
export function scrollToPage(container, pageNum, pdfDocument, options = {}) {
  if (!container) return;
  const { shrinkState, expandAll } = options;

  const performAction = () => {
    const zoomWrapper = container.querySelector(".pdf-zoom-content") || container;
    const pageWrapper = findPageWrapper(zoomWrapper, pageNum);
    if (!pageWrapper) return;

    if (pageWrapper.dataset.loaded !== "true" && pdfDocument) {
      renderPage(pdfDocument, pageWrapper, options.scale || 1.5).then((result) => {
        setTimeout(() => scrollForWrapper(container, pageWrapper), 50);
        if (result && result.canvas) {
          dispatchRenderEvent(pageWrapper);
        }
      });
    } else {
      scrollForWrapper(container, pageWrapper);
      dispatchRenderEvent(pageWrapper);
    }
  };

  if (shrinkState && expandAll) {
    expandAll();
    setTimeout(performAction, 80);
  } else {
    performAction();
  }
}

function scrollForWrapper(container, wrapper) {
  if (!wrapper) return;

  const zoomScale = getZoomScale(container);
  const { pageTop, pageHeight } = getPageMetrics(wrapper);
  const yAbs = pageTop * zoomScale;
  const hAbs = pageHeight * zoomScale;

  // Center page if possible, otherwise align top
  let target = yAbs - (container.offsetHeight - hAbs) / 2;
  if (hAbs > container.offsetHeight) target = yAbs;

  const maxScroll = container.scrollHeight - container.offsetHeight;
  container.scrollTo({
    top: Math.min(maxScroll, Math.max(0, target)),
    behavior: "smooth"
  });
}

/**
 * Calculates the bounding box for all snippets and scrolls the container.
 */
function calculateAndScroll(container, snippets) {
  setTimeout(() => {
    let minY = Infinity;
    let maxY = -Infinity;
    let found = false;

    const zoomWrapper = container.querySelector(".pdf-zoom-content") || container;

    snippets.forEach(snp => {
      const pageWrapper = findPageWrapper(zoomWrapper, snp.pageNum);
      if (!pageWrapper) return;

      const { pageTop, pageHeight } = getPageMetrics(pageWrapper);
      const { scrollTop, offsetHeight } = container;

      // Skip initial scroll for search matches if already partially visible to prevent jitter
      const isPartiallyVisible = (pageTop < (scrollTop + offsetHeight)) && ((pageTop + pageHeight) > scrollTop);
      if (snp.isSearchMatch && isPartiallyVisible) return;

      const yp = snp.yPct ?? snp.y_pct;
      const hp = snp.heightPct ?? snp.height_pct ?? 0.05;

      if (yp !== undefined) {
        const zoomScale = getZoomScale(container);
        const yAbs = (pageTop + (yp * pageHeight)) * zoomScale;
        const hAbs = hp * pageHeight * zoomScale;

        minY = Math.min(minY, yAbs);
        maxY = Math.max(maxY, yAbs + hAbs);
        found = true;
      } else if (snp.isSearchMatch || snippets.length === 1) {
        if (!isPartiallyVisible) {
          const zoomScale = getZoomScale(container);
          minY = Math.min(minY, pageTop * zoomScale);
          maxY = Math.max(maxY, (pageTop + 200) * zoomScale);
          found = true;
        }
      }
    });

    if (found) {
      performScroll(container, minY, maxY);
    }
  }, 50);
}

/**
 * Ensures the page is rendered before applying highlights.
 */
function handleLazyRendering(container, snippet, pdfDocument, duration, shouldScrollAdjust) {
  const zoomWrapper = container.querySelector(".pdf-zoom-content") || container;
  const pageWrapper = findPageWrapper(zoomWrapper, snippet.pageNum);
  if (!pageWrapper) return;

  const onReady = () => {
    const hlSuccess = applySnippetHighlight(container, pageWrapper, snippet, duration);
    if (shouldScrollAdjust) {
      adjustScrollForHighlight(container, pageWrapper, snippet);
    }
    dispatchRenderEvent(pageWrapper);
    return hlSuccess;
  };

  if (pdfDocument && pageWrapper.dataset.loaded !== "true") {
    renderPage(pdfDocument, pageWrapper, duration.scale || 1.5).then((result) => {
      applyAfterRender(pageWrapper, onReady);
    });
  } else {
    setTimeout(onReady, 300);
  }
}

/**
 * Creates and appends the visual highlight box.
 * Appends directly to pageWrapper (position:relative) using canvas-relative coords,
 * avoiding getBoundingClientRect / zoom-scale calculations that caused offset bugs.
 */
function applySnippetHighlight(container, pageWrapper, snippet, duration) {
  if (snippet.isSearchMatch) return true; // Search highlights are handled by CSS/DOM elsewhere

  const highlightId = `hl-${snippet.id || Date.now()}`;
  if (pageWrapper.querySelector(`[data-hl-id="${highlightId}"]`)) return true;

  const canvas = pageWrapper.querySelector("canvas");
  if (!canvas) return false;

  const xp = snippet.xPct ?? snippet.x_pct;
  const yp = snippet.yPct ?? snippet.y_pct;
  const wp = snippet.widthPct ?? snippet.width_pct;
  const hp = snippet.heightPct ?? snippet.height_pct;

  let left, top, width, height;
  if (xp !== undefined) {
    // Use canvas.offsetLeft/Top/Width/Height — layout coords, zoom-invariant
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    left   = canvas.offsetLeft + xp * cw;
    top    = canvas.offsetTop  + yp * ch;
    width  = (wp ?? 0.1) * cw;
    height = (hp ?? 0.05) * ch;
  } else {
    left   = snippet.x || 0;
    top    = snippet.y || 0;
    width  = snippet.width || 80;
    height = snippet.height || 30;
  }

  const highlight = document.createElement("div");
  Object.assign(highlight.style, {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    background: "rgba(255, 255, 0, 0.4)",
    border: "2px solid orange",
    borderRadius: "4px",
    pointerEvents: "none",
    zIndex: "10001",
    transition: "opacity 0.5s ease"
  });

  highlight.className = "pdf-highlight pdf-highlight-active";
  highlight.dataset.hlId = highlightId;
  // Append to pageWrapper (position:relative) so coordinates are page-relative
  pageWrapper.appendChild(highlight);

  setTimeout(() => (highlight.style.opacity = 0), duration);
  setTimeout(() => highlight.remove(), duration + 500);
  return true;
}

/**
 * Fine-tunes scrolling for search matches or specific highlights.
 */
function adjustScrollForHighlight(container, pageWrapper, snippet) {
  if (!snippet.isSearchMatch) return;

  const matchEl = pageWrapper.querySelector(".current-search-highlight");
  if (!matchEl) return;

  const matchRect = matchEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const buffer = container.offsetHeight * 0.15;

  const highlightTop = matchRect.top - containerRect.top;
  const highlightBottom = matchRect.bottom - containerRect.top;

  const isVisible = (highlightTop > buffer && highlightBottom < (container.offsetHeight - buffer));

  if (!isVisible) {
    const centerPos = container.offsetHeight / 2;
    const targetOffset = highlightTop - centerPos + (matchRect.height / 2);
    container.scrollBy({ top: targetOffset, behavior: "smooth" });
  }
}

// --- HELPER UTILS ---

function findPageWrapper(parent, pageNum) {
  return Array.from(parent.children).find(
    (el) => parseInt(el.dataset.pageNumber, 10) === pageNum
  );
}

function getZoomScale(container) {
  const zoomWrapper = container.querySelector(".pdf-zoom-content");
  if (zoomWrapper && zoomWrapper.style.transform.includes("scale(")) {
    const match = zoomWrapper.style.transform.match(/scale\(([^)]+)\)/);
    if (match) return parseFloat(match[1]);
  }
  return 1;
}

function getPageMetrics(pageWrapper) {
  return {
    pageTop: pageWrapper.offsetTop,
    pageHeight: pageWrapper.offsetHeight
  };
}

function performScroll(container, minY, maxY) {
  const center = (minY + maxY) / 2;
  const viewHeight = container.offsetHeight;
  const contentHeight = maxY - minY;
  let targetScroll = center - (viewHeight / 2);

  if (contentHeight > viewHeight * 0.8) {
    targetScroll = minY - 50;
  }

  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: "smooth"
  });
}


function dispatchRenderEvent(pageWrapper) {
  window.dispatchEvent(new CustomEvent('page-rendered-by-scroll', { //handlePageRenderedByScroll in usepdfrender.js
    detail: {
      pageNum: parseInt(pageWrapper.dataset.pageNumber, 10),
      wrapper: pageWrapper,
      width: pageWrapper.clientWidth,
      height: pageWrapper.clientHeight
    }
  }));
}

function applyAfterRender(wrapper, callback) {
  let tries = 0;
  const check = () => {
    const success = callback();
    if (success || tries >= 20) return;
    tries++;
    setTimeout(check, 100);
  };
  setTimeout(check, 100);
}
