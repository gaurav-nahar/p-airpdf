import api from "../api/api";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const looksLikeBrokenPdfText = (value) => {
  const text = (value || "").trim();
  if (!text) return true;
  if (DEVANAGARI_RE.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  const latinWords = words.filter((word) => /^[A-Za-z]+$/.test(word));
  const suspiciousLatinWords = latinWords.filter((word) => {
    const lower = word.toLowerCase();
    const vowelCount = (lower.match(/[aeiou]/g) || []).length;
    return (
      word.length >= 4 &&
      (
        /[aeiou]{3,}/.test(lower) ||
        /[^aeiou]{5,}/.test(lower) ||
        /q(?!u)/.test(lower) ||
        /[xjw]{2,}/.test(lower) ||
        vowelCount / Math.max(1, lower.length) > 0.72
      )
    );
  });
  const oddSymbolCount = (text.match(/[@&]/g) || []).length;

  return oddSymbolCount > 0 || suspiciousLatinWords.length > 0;
};

export default function useSnippetHandlers({ tool, TOOL_MODES, pdfRef, workspaceRef, setSnippets, setConnections, screenToWorld, getScale, recordHistory, getSnapshot, showToast }) {
  const addSnippet = (data, dropPos) => {
    if (recordHistory && getSnapshot) recordHistory(getSnapshot());
    // ---------- 1. PREPARE SNIPPET OBJECT ----------
    const isFromPDF = !!data.fromPDF;
    const id = `snippet-${Date.now()}`;
    const scale = getScale() || 1;
    const isText = data.type === "text" || !data.type;

    const snippet = {
      ...data,
      id,
      x: dropPos.x,
      y: dropPos.y,
      pageNum: data.pageNum || pdfRef.current?.getCurrentPageNum?.() || 1,
    };

    const maybeRunOcrFallback = async (snippetId, currentText) => {
      if (!data.ocrImage || !looksLikeBrokenPdfText(currentText)) return;

      try {
        const response = await api.ocrSelectionImage(data.ocrImage, "hin+eng");
        const ocrText = (response?.data?.text || "").trim();
        if (!ocrText) return;

        setSnippets((prev) =>
          prev.map((item) =>
            item.id === snippetId
              ? { ...item, text: ocrText }
              : item
          )
        );
      } catch (err) {
        console.warn("OCR fallback failed:", err);
        if (!currentText && showToast) {
          showToast("Hindi text OCR failed for this selection.", "warning");
        }
      }
    };

    // ---------- 2. APPLY PDF-SPECIFIC CLEANUP ----------
    if (isFromPDF) {
      // Preserve line breaks and complex-script character ordering from the PDF selection.
      snippet.text = (data.text || "").replace(/\u00a0/g, " ").trim();
      // For text: use a fixed comfortable width regardless of selection size.
      // For images: preserve aspect ratio but cap to avoid giant drops.
      snippet.width = isText ? 220 : Math.min(300, data.width / scale);
      snippet.height = isText ? "auto" : Math.min(250, data.height / scale);
      const shouldUseOcrFallback = isText && !!data.ocrImage && looksLikeBrokenPdfText(snippet.text);

      // Guard: if the PDF text layer is broken, keep the drop alive and OCR it instead.
      if (isText && !snippet.text && !data.ocrImage) {
        if (showToast) showToast("Text could not be extracted from this PDF. Use the image crop tool to capture this area.", "warning");
        return;
      }

      if (shouldUseOcrFallback) {
        snippet.text = "Extracting text...";
      }

      setSnippets((prev) => [...prev, snippet]);
      if (isText) {
        void maybeRunOcrFallback(snippet.id, (data.text || "").trim());
      }
    } else {
      if (!data.text) snippet.text = "New note...";
      setSnippets((prev) => [...prev, snippet]);
    }

    // ---------- 4. HANDLE IMAGE CONVERSION (DRY) ----------
    if (data.type === "image" && data.src && typeof data.src === "string" && data.src.startsWith("data:")) {
      const parts = data.src.split(",");
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      snippet.file = new Blob([u8arr], { type: mime });
    }
  };

  const handleSnippetDrop = (e) => {
    e.preventDefault();
    if (tool !== TOOL_MODES.SELECT) return;

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      // Calculate drop position in World Coordinates
      const dropPos = screenToWorld(e.clientX, e.clientY);
      addSnippet(data, dropPos);
    } catch (err) {
      console.warn("Invalid drop data:", err);
    }
  };

  return { handleSnippetDrop, addSnippet };
}
