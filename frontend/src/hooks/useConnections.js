import { useCallback } from "react";

const getSnippetPdfId = (snippet) => String(snippet?.pdf_id || snippet?.sourcePdfId || "");

export default function useConnections({
  tool,
  TOOL_MODES,
  lineStartId,
  setLineStartId,
  connections,
  setConnections,
  pdfRef,
  pdf2Ref,
  pdfId,
  panel2PdfId,
  snippets,
  setSelectedItem,
}) {
  const resolveViewerRef = useCallback((targetPdfId) => {
    const normalizedPdfId = String(targetPdfId || "");
    if (normalizedPdfId && panel2PdfId && normalizedPdfId === String(panel2PdfId)) {
      return pdf2Ref;
    }
    if (!normalizedPdfId || normalizedPdfId === String(pdfId)) {
      return pdfRef;
    }
    return null;
  }, [pdfId, panel2PdfId, pdfRef, pdf2Ref]);

  const buildHighlightRect = useCallback((viewerRef, targetData) => {
    if (!viewerRef?.current?.getAnchorScreenPos || !targetData?.pageNum) return null;

    const xPct = Number.isFinite(Number(targetData.xPct)) ? Number(targetData.xPct) : 0.5;
    const yPct = Number.isFinite(Number(targetData.yPct)) ? Number(targetData.yPct) : 0.5;
    const widthPct = Math.max(0.02, Number(targetData.widthPct) || 0);
    const heightPct = Math.max(0.02, Number(targetData.heightPct) || 0);

    const start = viewerRef.current.getAnchorScreenPos(targetData.pageNum, xPct, yPct);
    const end = viewerRef.current.getAnchorScreenPos(
      targetData.pageNum,
      Math.min(1, xPct + widthPct),
      Math.min(1, yPct + heightPct)
    );

    if (!start || !end) return null;

    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }, []);

  const traceSnippetToTarget = useCallback((viewerRef, snippetId, targetData) => {
    if (!viewerRef?.current || !targetData?.pageNum) return;

    const maxFrames = 120;
    let frameCount = 0;
    let lastY = null;
    let stableFrames = 0;

    const poll = () => {
      const anchorPos = viewerRef.current?.getAnchorScreenPos?.(
        targetData.pageNum,
        targetData.xPct,
        targetData.yPct
      );

      if (!anchorPos) {
        frameCount += 1;
        if (frameCount < maxFrames) requestAnimationFrame(poll);
        return;
      }

      if (lastY !== null && Math.abs(anchorPos.y - lastY) < 1) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      lastY = anchorPos.y;

      if (stableFrames > 5 || frameCount >= maxFrames) {
        const highlightRect = buildHighlightRect(viewerRef, targetData);
        if (highlightRect) {
          window.dispatchEvent(new CustomEvent("trace-snippet-connection", {
            detail: { snippetId, highlightRect },
          }));
        }
        return;
      }

      frameCount += 1;
      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  }, [buildHighlightRect]);

  const handleNoteClick = useCallback((snippet) => {
    if (setSelectedItem) {
      setSelectedItem({ id: snippet.id, type: snippet.type === "box" ? "box" : "snippet" });
    }

    if (tool === TOOL_MODES.DRAW_LINE) {
      if (!lineStartId) {
        setLineStartId(snippet.id);
      } else if (lineStartId !== snippet.id) {
        const exists = connections.some(
          (connection) =>
            (String(connection.from) === String(lineStartId) && String(connection.to) === String(snippet.id)) ||
            (String(connection.from) === String(snippet.id) && String(connection.to) === String(lineStartId))
        );

        if (!exists) {
          setConnections((prev) => [...prev, { from: String(lineStartId), to: String(snippet.id) }]);
        }

        setLineStartId(null);
      } else {
        setLineStartId(null);
      }

      return;
    }

    if (tool !== TOOL_MODES.SELECT) return;

    try {
      const snippetPdfId = getSnippetPdfId(snippet);
      const targetViewerRef = resolveViewerRef(snippetPdfId);

      if (!targetViewerRef?.current || typeof targetViewerRef.current.scrollToSnippet !== "function") {
        return;
      }

      const hasPdfData = snippet.pageNum && snippet.xPct !== undefined;
      if (hasPdfData) {
        const targetData = {
          pageNum: snippet.pageNum,
          xPct: snippet.xPct,
          yPct: snippet.yPct,
          widthPct: snippet.widthPct,
          heightPct: snippet.heightPct,
        };

        targetViewerRef.current.scrollToSnippet(snippet);
        traceSnippetToTarget(targetViewerRef, snippet.id, targetData);
        return;
      }

      const connectedAnchors = [];
      connections.forEach((connection) => {
        if (String(connection.from) !== String(snippet.id) && String(connection.to) !== String(snippet.id)) {
          return;
        }

        const otherId = String(connection.from) === String(snippet.id) ? connection.to : connection.from;
        const target = snippets?.find((item) => String(item.id) === String(otherId));
        const isPdfSource = target && (target.type === "anchor" || (target.pageNum && target.xPct !== undefined));
        if (isPdfSource) connectedAnchors.push(target);
      });

      if (connectedAnchors.length > 0) {
        const targetAnchor = connectedAnchors.sort((a, b) => a.pageNum - b.pageNum)[0];
        const anchorViewerRef = resolveViewerRef(getSnippetPdfId(targetAnchor) || snippetPdfId);
        if (!anchorViewerRef?.current) return;

        const pages = connectedAnchors
          .filter((anchor) => getSnippetPdfId(anchor) === getSnippetPdfId(targetAnchor))
          .map((anchor) => anchor.pageNum)
          .filter(Boolean)
          .sort((a, b) => a - b);
        const uniquePages = [...new Set(pages)];

        if (
          uniquePages.length >= 2 &&
          uniquePages[uniquePages.length - 1] - uniquePages[0] > 1 &&
          typeof anchorViewerRef.current.contractBetweenPages === "function"
        ) {
          anchorViewerRef.current.contractBetweenPages(uniquePages[0], uniquePages[uniquePages.length - 1]);
        }

        anchorViewerRef.current.scrollToSnippet(connectedAnchors);
        traceSnippetToTarget(anchorViewerRef, snippet.id, targetAnchor);
        return;
      }

      targetViewerRef.current.scrollToSnippet(snippet);
    } catch (error) {
      console.warn("Error calling scrollToSnippet:", error);
    }
  }, [
    tool,
    TOOL_MODES,
    lineStartId,
    setLineStartId,
    connections,
    setConnections,
    resolveViewerRef,
    snippets,
    setSelectedItem,
    traceSnippetToTarget,
  ]);

  return { handleNoteClick };
}
