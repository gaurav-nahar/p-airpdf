const normalizeSelectionText = (value) =>
  (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

const getSelectionPageWrapper = (selection, contentContainer, rect) => {
  const anchorWrapper = selection.anchorNode?.parentElement?.closest?.(".pdf-page-wrapper");
  const focusWrapper = selection.focusNode?.parentElement?.closest?.(".pdf-page-wrapper");
  if (anchorWrapper && anchorWrapper === focusWrapper) return anchorWrapper;
  if (anchorWrapper) return anchorWrapper;
  if (focusWrapper) return focusWrapper;

  return Array.from(contentContainer.children).find((wrapper) => {
    if (!wrapper.dataset.pageNumber) return false;
    const wrapperRect = wrapper.getBoundingClientRect();
    const overlap = Math.min(rect.bottom, wrapperRect.bottom) - Math.max(rect.top, wrapperRect.top);
    return overlap > 0;
  }) || null;
};

export const getSelectionText = (selection, range = null) => {
  const activeRange = range || selection?.getRangeAt?.(0);
  if (!activeRange) return "";

  const clonedText = normalizeSelectionText(activeRange.cloneContents()?.textContent || "");
  if (clonedText) return clonedText;

  return normalizeSelectionText(selection?.toString?.() || "");
};

export const getPdfSelectionDetails = (selection, containerRef, contentRef = null) => {
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return null;

  const container = containerRef.current;
  const contentContainer = contentRef?.current || container;
  if (!container || !contentContainer) return null;

  const pageWrapper = getSelectionPageWrapper(selection, contentContainer, rect);
  if (!pageWrapper) return null;

  const pageNum = parseInt(pageWrapper.dataset.pageNumber, 10);
  const canvas = pageWrapper.querySelector("canvas");
  const canvasRect = canvas?.getBoundingClientRect() || null;
  const selectedText = getSelectionText(selection, range);

  return {
    range,
    rect,
    pageNum,
    pageWrapper,
    canvas,
    canvasRect,
    selectedText,
  };
};
